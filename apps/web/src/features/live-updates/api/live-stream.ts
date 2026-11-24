import {
  type ChangeEvent,
  LIVE_EVENTS_PATH,
  type SseMessage,
  changeEventSchema,
  createSseParser,
  liveStreamEvents,
} from "@pulse/contracts";
import { env } from "@/config/env";
import { getAccessToken } from "@/lib/api/access-token";
import { recoverSession } from "@/lib/api/http-client";

export type LiveStatus = "connecting" | "live" | "reconnecting" | "paused";

type LiveStreamHandlers = {
  onReady: () => void;
  onChange: (event: ChangeEvent) => void;
};

type LiveStreamOptions = LiveStreamHandlers & {
  onStatus: (status: LiveStatus) => void;
};

type ConnectOutcome = "unauthorized" | "closed";

const MIN_RETRY_DELAY_MS = 1_000;
const MAX_RETRY_DELAY_MS = 30_000;
const STALL_TIMEOUT_MS = 60_000;

const retryDelay = (attempt: number) => {
  const ceiling = Math.min(
    MAX_RETRY_DELAY_MS,
    MIN_RETRY_DELAY_MS * 2 ** attempt,
  );

  return ceiling / 2 + Math.random() * (ceiling / 2);
};

const wait = (ms: number, signal: AbortSignal) =>
  new Promise<void>((resolve) => {
    const timer = setTimeout(resolve, ms);

    signal.addEventListener(
      "abort",
      () => {
        clearTimeout(timer);
        resolve();
      },
      { once: true },
    );
  });

const parseChange = (data: string) => {
  try {
    const parsed = changeEventSchema.safeParse(JSON.parse(data));
    return parsed.success ? parsed.data : null;
  } catch {
    return null;
  }
};

const handleMessage = (message: SseMessage, handlers: LiveStreamHandlers) => {
  if (message.event === liveStreamEvents.ready) {
    handlers.onReady();
    return;
  }

  if (message.event === liveStreamEvents.change) {
    const event = parseChange(message.data);

    if (event) {
      handlers.onChange(event);
    }
  }
};

const requestStream = (signal: AbortSignal) => {
  const headers = new Headers({ Accept: "text/event-stream" });
  const accessToken = getAccessToken();

  if (accessToken) {
    headers.set("Authorization", `Bearer ${accessToken}`);
  }

  return fetch(`${env.apiUrl}${LIVE_EVENTS_PATH}`, {
    headers,
    credentials: "include",
    cache: "no-store",
    signal,
  });
};

const readStream = async (
  body: ReadableStream<Uint8Array>,
  handlers: LiveStreamHandlers,
  onActivity: () => void,
) => {
  const parse = createSseParser((message) => handleMessage(message, handlers));
  const decoder = new TextDecoder();
  const reader = body.getReader();

  while (true) {
    const { done, value } = await reader.read();

    if (done) {
      return;
    }

    onActivity();
    parse(decoder.decode(value, { stream: true }));
  }
};

const connectOnce = async (
  signal: AbortSignal,
  handlers: LiveStreamHandlers,
): Promise<ConnectOutcome> => {
  const connection = new AbortController();
  const abort = () => connection.abort();
  let stallTimer = setTimeout(abort, STALL_TIMEOUT_MS);

  const resetStallTimer = () => {
    clearTimeout(stallTimer);
    stallTimer = setTimeout(abort, STALL_TIMEOUT_MS);
  };

  signal.addEventListener("abort", abort, { once: true });

  try {
    if (!getAccessToken()) {
      return "unauthorized";
    }

    const response = await requestStream(connection.signal);

    if (response.status === 401) {
      return "unauthorized";
    }

    if (response.ok && response.body) {
      await readStream(response.body, handlers, resetStallTimer);
    }

    return "closed";
  } catch {
    return "closed";
  } finally {
    clearTimeout(stallTimer);
    signal.removeEventListener("abort", abort);
    connection.abort();
  }
};

export const runLiveStream = async (
  signal: AbortSignal,
  { onStatus, onReady, onChange }: LiveStreamOptions,
) => {
  let attempt = 0;

  const handlers = {
    onChange,
    onReady: () => {
      attempt = 0;
      onStatus("live");
      onReady();
    },
  };

  onStatus("connecting");

  while (!signal.aborted) {
    const outcome = await connectOnce(signal, handlers);

    if (signal.aborted) {
      return;
    }

    onStatus("reconnecting");

    if (outcome === "unauthorized" && !(await recoverSession())) {
      return;
    }

    await wait(retryDelay(attempt), signal);
    attempt += 1;
  }
};

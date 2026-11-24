import {
  LIVE_EVENTS_PATH,
  formatSseMessage,
  liveStreamEvents,
} from "@pulse/contracts";
import { http } from "msw";
import { apiPath } from "../lib/api-path";
import { authenticated } from "../lib/handler";

const openStream = (signal: AbortSignal) =>
  new ReadableStream<Uint8Array>({
    start(controller) {
      controller.enqueue(
        new TextEncoder().encode(formatSseMessage(liveStreamEvents.ready, {})),
      );
      signal.addEventListener("abort", () => controller.close(), {
        once: true,
      });
    },
  });

export const liveEventHandlers = [
  http.get(
    apiPath(LIVE_EVENTS_PATH),
    authenticated(
      ({ request }) =>
        new Response(openStream(request.signal), {
          headers: { "Content-Type": "text/event-stream" },
        }),
    ),
  ),
];

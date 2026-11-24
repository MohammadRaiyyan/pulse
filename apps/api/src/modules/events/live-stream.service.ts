import {
  type ChangeEvent,
  formatSseComment,
  formatSseMessage,
  liveStreamEvents,
} from "@pulse/contracts";
import { env } from "../../config/env.ts";
import { AppError, unauthorized } from "../../lib/errors.ts";
import { logger } from "../../lib/logger.ts";
import { subscribeToChanges } from "../../lib/realtime.ts";
import {
  ACCESS_TOKEN_TTL_SECONDS,
  type AccessTokenClaims,
  verifyAccessToken,
} from "../../security/access-token.ts";
import { isAccessTokenRevoked } from "../../security/session-revocation.ts";
import { findUserById } from "../users/user.repository.ts";
import { getCachedUser } from "../users/user.service.ts";

const RECONNECT_DELAY_MS = 3_000;
const MAX_BUFFERED_BYTES = 64 * 1024;
const RETRY_AFTER_SECONDS = 30;

export type LiveSubscriber = {
  userId: string;
  claims: AccessTokenClaims;
};

export type LiveStreamTarget = {
  write: (chunk: string) => void;
  end: () => void;
  bufferedBytes: () => number;
};

type LiveConnection = {
  subscriber: LiveSubscriber;
  target: LiveStreamTarget;
  close: () => void;
};

const connectionsByUser = new Map<string, Set<LiveConnection>>();
let fanOut: Promise<unknown> | null = null;

const allConnections = () =>
  [...connectionsByUser.values()].flatMap((connections) => [...connections]);

const send = (connection: LiveConnection, chunk: string) => {
  if (connection.target.bufferedBytes() > MAX_BUFFERED_BYTES) {
    logger.warn(
      { userId: connection.subscriber.userId },
      "Closing live stream that stopped reading",
    );
    connection.close();
    return;
  }

  connection.target.write(chunk);
};

const broadcast = (event: ChangeEvent) => {
  const chunk = formatSseMessage(liveStreamEvents.change, event);

  for (const connection of allConnections()) {
    send(connection, chunk);
  }
};

const ensureFanOut = () => {
  fanOut ??= subscribeToChanges(broadcast).catch((error: unknown) => {
    fanOut = null;
    throw error;
  });

  return fanOut;
};

const tokenExpiresInMs = (claims: AccessTokenClaims) =>
  claims.issuedAtMs + ACCESS_TOKEN_TTL_SECONDS * 1000 - Date.now();

const isStillAuthorized = async ({ userId, claims }: LiveSubscriber) => {
  const [isRevoked, user] = await Promise.all([
    isAccessTokenRevoked(claims),
    getCachedUser(userId),
  ]);

  return !isRevoked && user !== null;
};

const authorizeSubscriber = async (
  token: string | null,
): Promise<LiveSubscriber> => {
  const claims = token ? await verifyAccessToken(token) : null;
  const isRevoked = claims ? await isAccessTokenRevoked(claims) : true;
  const user = claims && !isRevoked ? await findUserById(claims.userId) : null;

  if (!claims || !user) {
    throw unauthorized("Access token is missing or expired");
  }

  return { userId: user.id, claims };
};

const assertCanConnect = (userId: string) => {
  const openCount = connectionsByUser.get(userId)?.size ?? 0;

  if (openCount >= env.LIVE_MAX_CONNECTIONS_PER_USER) {
    throw new AppError("RATE_LIMITED", "Too many live update connections", {
      retryAfterSeconds: RETRY_AFTER_SECONDS,
    });
  }
};

export const prepareLiveStream = async (token: string | null) => {
  const subscriber = await authorizeSubscriber(token);

  assertCanConnect(subscriber.userId);
  await ensureFanOut();

  return subscriber;
};

const register = (connection: LiveConnection) => {
  const { userId } = connection.subscriber;
  const connections = connectionsByUser.get(userId) ?? new Set();

  connections.add(connection);
  connectionsByUser.set(userId, connections);
};

const unregister = (connection: LiveConnection) => {
  const { userId } = connection.subscriber;
  const connections = connectionsByUser.get(userId);

  connections?.delete(connection);

  if (connections?.size === 0) {
    connectionsByUser.delete(userId);
  }
};

export const openLiveStream = (
  subscriber: LiveSubscriber,
  target: LiveStreamTarget,
) => {
  let isOpen = true;

  const close = () => {
    if (!isOpen) {
      return;
    }

    isOpen = false;
    clearInterval(heartbeat);
    clearTimeout(expiry);
    unregister(connection);
    target.end();
  };

  const connection: LiveConnection = { subscriber, target, close };

  const beat = async () => {
    const isAuthorized = await isStillAuthorized(subscriber).catch(
      (error: unknown) => {
        logger.warn({ err: error }, "Live stream authorization check failed");
        return true;
      },
    );

    if (!isOpen) {
      return;
    }

    if (isAuthorized) {
      send(connection, formatSseComment("heartbeat"));
    } else {
      close();
    }
  };

  const heartbeat = setInterval(beat, env.LIVE_HEARTBEAT_INTERVAL_MS);
  const expiry = setTimeout(
    close,
    Math.max(tokenExpiresInMs(subscriber.claims), 0),
  );

  register(connection);
  target.write(`retry: ${RECONNECT_DELAY_MS}\n\n`);
  target.write(formatSseMessage(liveStreamEvents.ready, {}));

  return close;
};

export const countLiveStreams = () => allConnections().length;

export const closeAllLiveStreams = () => {
  for (const connection of allConnections()) {
    connection.close();
  }
};

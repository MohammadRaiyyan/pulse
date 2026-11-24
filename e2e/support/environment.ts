export const API_PORT = Number(process.env.E2E_API_PORT ?? 3100);
export const WEB_PORT = Number(process.env.E2E_WEB_PORT ?? 5174);

export const API_ORIGIN = `http://localhost:${API_PORT}`;
export const WEB_ORIGIN = `http://localhost:${WEB_PORT}`;

export const backendEnvironment = {
  NODE_ENV: "test",
  LOG_LEVEL: "info",
  PORT: String(API_PORT),
  APP_URL: WEB_ORIGIN,
  DATABASE_URL: process.env.E2E_DATABASE_URL ?? "postgres://pulse:pulse@localhost:5432/pulse_e2e",
  REDIS_URL: process.env.E2E_REDIS_URL ?? "redis://localhost:6379/2",
  JWT_SECRET: "e2e-jwt-secret-that-is-at-least-32-characters-long",
  INVITE_SECRET: "e2e-invite-secret-that-is-at-least-32-characters-long",
  API_RATE_LIMIT_PER_MINUTE: "5000",
  CHECK_DISPATCH_INTERVAL_MS: "2000",
  SILENCE_CHECK_INTERVAL_MS: "5000",
  ALLOW_PRIVATE_NETWORK_TARGETS: "true",
};

export const webEnvironment = {
  VITE_API_URL: "/api",
  VITE_API_MOCKING: "false",
  API_PROXY_TARGET: API_ORIGIN,
};

export const BACKEND_LOG_FILE = new URL("../test-results/backend.log", import.meta.url).pathname;

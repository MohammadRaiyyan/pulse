import type { APIRequestContext, APIResponse } from "@playwright/test";
import { API_ORIGIN } from "./environment.ts";

export const DEMO_PASSWORD = "password123";

export const demoUsers = {
  owner: "owner@pulse.dev",
  admin: "admin@pulse.dev",
  member: "member@pulse.dev",
  viewer: "viewer@pulse.dev",
} as const;

export type DemoRole = keyof typeof demoUsers;

export type ApiResponse = {
  status: number;
  body: any;
  headers: Record<string, string>;
};

type RequestOptions = {
  body?: unknown;
  headers?: Record<string, string>;
};

export const postRespectingRateLimit = async (
  request: APIRequestContext,
  url: string,
  data: unknown,
  attemptsLeft = 3,
): Promise<APIResponse> => {
  const response = await request.post(url, { data });

  if (response.status() !== 429 || attemptsLeft === 0) {
    return response;
  }

  const waitSeconds = Number(response.headers()["retry-after"] ?? 5);
  await new Promise((resolve) => setTimeout(resolve, (waitSeconds + 1) * 1000));

  return postRespectingRateLimit(request, url, data, attemptsLeft - 1);
};

export const signInForToken = async (request: APIRequestContext, email: string, password = DEMO_PASSWORD) => {
  const response = await postRespectingRateLimit(request, `${API_ORIGIN}/api/auth/login`, { email, password });

  if (!response.ok()) {
    throw new Error(`Sign in failed for ${email}: ${response.status()} ${await response.text()}`);
  }

  return (await response.json()).accessToken as string;
};

export class ApiClient {
  readonly request: APIRequestContext;
  readonly email: string;
  readonly password: string;
  token: string;

  constructor(request: APIRequestContext, email: string, password: string, token: string) {
    this.request = request;
    this.email = email;
    this.password = password;
    this.token = token;
  }

  static async signIn(request: APIRequestContext, email: string, password = DEMO_PASSWORD) {
    return new ApiClient(request, email, password, await signInForToken(request, email, password));
  }

  async send(method: string, path: string, options: RequestOptions = {}): Promise<ApiResponse> {
    const response = await this.request.fetch(`${API_ORIGIN}/api${path}`, {
      method,
      data: options.body,
      headers: { Authorization: `Bearer ${this.token}`, ...options.headers },
    });

    if (response.status() === 401 && !path.startsWith("/auth/")) {
      this.token = await signInForToken(this.request, this.email, this.password);
      return this.send(method, path, options);
    }

    const text = await response.text();

    return { status: response.status(), body: text ? JSON.parse(text) : undefined, headers: response.headers() };
  }

  get(path: string) {
    return this.send("GET", path);
  }

  post(path: string, body?: unknown) {
    return this.send("POST", path, { body });
  }

  patch(path: string, body: unknown) {
    return this.send("PATCH", path, { body });
  }

  delete(path: string) {
    return this.send("DELETE", path);
  }
}

export const uniqueSuffix = () => `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;

export const uniqueEmail = (prefix: string) => `${prefix}-${uniqueSuffix()}@e2e.pulse.dev`;

export const tokenFromInviteUrl = (inviteUrl: string) => inviteUrl.split("/invite/")[1] ?? "";

export const createTeammate = async (
  owner: ApiClient,
  role: "admin" | "member" | "viewer",
  name = `${role} ${uniqueSuffix()}`,
) => {
  const email = uniqueEmail(role);
  const invitation = await owner.post("/invitations", { email, role });

  if (invitation.status !== 201) {
    throw new Error(`Invite failed: ${invitation.status} ${JSON.stringify(invitation.body)}`);
  }

  const accepted = await owner.request.post(`${API_ORIGIN}/api/invitations/accept`, {
    data: { token: tokenFromInviteUrl(invitation.body.inviteUrl), name, password: DEMO_PASSWORD },
  });
  const body = await accepted.json();

  return {
    email,
    name,
    password: DEMO_PASSWORD,
    user: body.user,
    client: new ApiClient(owner.request, email, DEMO_PASSWORD, body.accessToken),
  };
};

export const waitFor = async <TValue>(
  load: () => Promise<TValue>,
  isReady: (value: TValue) => boolean,
  { timeout = 45_000, interval = 1_000 } = {},
) => {
  const deadline = Date.now() + timeout;
  let value = await load();

  while (!isReady(value)) {
    if (Date.now() > deadline) {
      throw new Error(`Timed out waiting. Last value: ${JSON.stringify(value).slice(0, 300)}`);
    }

    await new Promise((resolve) => setTimeout(resolve, interval));
    value = await load();
  }

  return value;
};

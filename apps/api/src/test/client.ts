import type { AddressInfo } from "node:net";
import type { Server } from "node:http";
import { afterAll, beforeAll } from "vitest";
import type { Role } from "@pulse/contracts";
import { createApp } from "../app.ts";
import { insertUser } from "../modules/users/user.repository.ts";
import { hashPassword } from "../security/passwords.ts";

type RequestOptions = {
  method?: string;
  token?: string;
  body?: unknown;
  cookie?: string;
  headers?: Record<string, string>;
};

export type TestResponse = {
  status: number;
  body: any;
  headers: Headers;
  refreshCookie: string | undefined;
};

let server: Server;
let baseUrl = "";

export const useTestServer = () => {
  beforeAll(() => {
    server = createApp().listen(0);
    baseUrl = `http://localhost:${(server.address() as AddressInfo).port}`;
  });

  afterAll(() => {
    server.close();
  });
};

export const readCookie = (headers: Headers, name: string) => {
  const cookie = headers
    .getSetCookie()
    .find((value) => value.startsWith(`${name}=`));
  return cookie?.split(";")[0];
};

export const request = async (
  path: string,
  options: RequestOptions = {},
): Promise<TestResponse> => {
  const headers: Record<string, string> = { ...options.headers };

  if (options.body !== undefined) {
    headers["Content-Type"] = "application/json";
  }

  if (options.token) {
    headers.Authorization = `Bearer ${options.token}`;
  }

  if (options.cookie) {
    headers.Cookie = options.cookie;
  }

  const response = await fetch(`${baseUrl}${path}`, {
    method: options.method ?? "GET",
    headers,
    body: options.body === undefined ? undefined : JSON.stringify(options.body),
  });

  const text = await response.text();

  return {
    status: response.status,
    body: text ? JSON.parse(text) : undefined,
    headers: response.headers,
    refreshCookie: readCookie(response.headers, "pulse_refresh"),
  };
};

export const registerUser = async (
  name: string,
  email: string,
  password = "password123",
) => {
  const response = await request("/api/auth/register", {
    method: "POST",
    body: { name, email, password },
  });
  return {
    token: response.body.accessToken as string,
    user: response.body.user,
    cookie: response.refreshCookie,
  };
};

export const sendRaw = (path: string, init: RequestInit) =>
  fetch(`${baseUrl}${path}`, init);

export const signInWithRole = async (role: Role, email: string) => {
  await insertUser({
    name: `${role} user`,
    email,
    role,
    passwordHash: await hashPassword("password123"),
    emailVerifiedAt: new Date(),
  });
  const response = await request("/api/auth/login", {
    method: "POST",
    body: { email, password: "password123" },
  });
  return {
    token: response.body.accessToken as string,
    user: response.body.user,
  };
};

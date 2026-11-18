# Pulse backend guide

A complete, step-by-step guide to building the real Pulse API yourself. It is written so you can learn backend engineering while building it, and so you never have to guess what the frontend expects.

The frontend is finished. It currently talks to a **mock API** (MSW, running in the browser). Your job is to build a real server that behaves exactly like that mock. When you are done, you flip one environment variable and the frontend talks to your server instead.

What you will learn, in the order you will build it:

1. Project setup in a pnpm monorepo, running TypeScript directly on Node 26
2. Validation and error handling with shared zod schemas
3. Database modeling and an ORM with PostgreSQL (Drizzle)
4. Authentication: password hashing, JWT access tokens, rotating refresh tokens in cookies
5. Authorization: role-based access control (RBAC)
6. Building CRUD resources the clean way (routes, services, repositories, mappers)
7. Background jobs and cron (BullMQ + Redis): running HTTP checks, detecting silence, sending alerts
8. Caching and rate limiting (Redis)
9. Real-world flows: invitations, password reset, OAuth with GitHub and Google

---

## Table of contents

- [1. How everything fits together](#1-how-everything-fits-together)
- [2. The stack and why](#2-the-stack-and-why)
- [3. Project setup](#3-project-setup)
- [4. The contract: your source of truth](#4-the-contract-your-source-of-truth)
- [5. API conventions the frontend relies on](#5-api-conventions-the-frontend-relies-on)
- [6. Validation and error handling](#6-validation-and-error-handling)
- [7. Database modeling with PostgreSQL and Drizzle](#7-database-modeling-with-postgresql-and-drizzle)
- [8. Authentication](#8-authentication)
- [9. Authorization (RBAC)](#9-authorization-rbac)
- [10. Building resources (CRUD)](#10-building-resources-crud)
- [11. Endpoint reference](#11-endpoint-reference)
- [12. Background jobs and cron](#12-background-jobs-and-cron)
- [13. Caching](#13-caching)
- [14. Rate limiting](#14-rate-limiting)
- [15. Invitations, password reset and OAuth](#15-invitations-password-reset-and-oauth)
- [16. Connecting the frontend](#16-connecting-the-frontend)
- [17. Testing](#17-testing)
- [18. Build order and milestones](#18-build-order-and-milestones)
- [19. Troubleshooting](#19-troubleshooting)
- [20. Glossary](#20-glossary)

---

## 1. How everything fits together

```mermaid
flowchart LR
  subgraph Browser
    FE["React app<br/>apps/web"]
  end
  subgraph Monorepo
    C["@pulse/contracts<br/>zod schemas, endpoint map, RBAC"]
  end
  subgraph Server["Your backend: apps/api"]
    API["HTTP server<br/>Express"]
    W["Worker process<br/>BullMQ jobs"]
  end
  PG[("PostgreSQL")]
  R[("Redis")]
  EXT["Monitored APIs<br/>Slack, email, webhooks"]
  SRC["Third-party services<br/>sending webhooks"]

  FE -- "/api/* via Vite proxy" --> API
  FE -. imports .-> C
  API -. imports .-> C
  W -. imports .-> C
  API --> PG
  API --> R
  W --> PG
  W --> R
  W -- "HTTP checks + alerts" --> EXT
  SRC -- "POST /hooks/:slug" --> API
```

There are two processes in the backend:

- **The API server** answers HTTP requests from the frontend (and webhook senders). It must respond fast, so it never does slow work like calling external APIs.
- **The worker** runs background jobs: checking monitored URLs on a schedule, detecting webhooks that went silent, sending alerts, cleaning up old data.

They share the same code base and the same database. They talk to each other through **Redis queues**: the API (or a scheduler) puts a job in a queue, and the worker picks it up.

**Q: Why two processes instead of doing checks inside the API server?**
A: A check can take up to 30 seconds (the max timeout). If the API server did that work, a burst of checks would slow down every user request, and a crash in check code would take the API down. Separating them is the standard pattern: the API stays fast and the worker can be scaled or restarted on its own.

**Q: Where does the frontend expect the API to live?**
A: In development, the frontend calls `/api/...` on its own origin (for example `http://localhost:5173/api/monitors`). Vite proxies that to `http://localhost:3000/api/monitors`. So your server must serve every route **under the `/api` prefix**. The one exception is the webhook ingest URL, `/hooks/:slug`, which is not under `/api` (see [section 12](#12-background-jobs-and-cron)).

---

## 2. The stack and why

| Concern | Choice | Why this one |
|---|---|---|
| Runtime | Node 26, TypeScript run directly | Node 26 strips TypeScript types natively. No build step, same as `@pulse/contracts`. |
| HTTP framework | [Express](https://expressjs.com) 5.3 | The most widely used Node framework, so every tutorial and answer you find applies. Express 5 forwards errors thrown in `async` handlers to your error middleware automatically. Its `:param` route syntax is identical to the contract paths, so you can register routes straight from the endpoint map. |
| Database | PostgreSQL 18 | The industry default relational database. Strong constraints, transactions, JSONB, partial indexes. |
| ORM | [Drizzle](https://orm.drizzle.team) 0.45 with `postgres` 4.1 | SQL-shaped and fully typed. You still think in SQL, which is what you want while learning. Generates migrations from your schema. |
| Queue / jobs | [BullMQ](https://docs.bullmq.io) 6.7 with `ioredis` 6 | Reliable Redis-backed queues with retries, backoff, delays and repeatable (cron-like) jobs. |
| Cache / rate limits | Redis 8 | In-memory, atomic counters with expiry. Perfect for caching and rate limiting. |
| Password hashing | `@node-rs/argon2` 2.2 | Argon2id is the current recommendation for password hashing. Native and fast. |
| Tokens | `jose` 6.2 | Standards-compliant JWT signing and verification. |
| Logging | `pino` 10.4 | Fast structured (JSON) logs. |
| Tests | Vitest 5.1 | Same test runner the frontend uses. |
| Local infra | Docker Compose | One command starts PostgreSQL and Redis. |

**Q: Why Express 5 and not Express 4?**
A: Express 4 silently ignores errors thrown inside `async` handlers unless you wrap every handler in `try/catch` or a helper. Express 5 passes them to your error middleware for you, which removes a whole class of "request hangs forever" bugs. Everything else you know about Express still applies.

**Q: Why Drizzle instead of Prisma?**
A: Prisma hides SQL behind its own query language. Drizzle reads like SQL (`select().from(monitors).where(...)`), so you learn the database, not just the ORM. It also needs no separate engine binary.

**Q: Do I need Redis? Could I use only Postgres?**
A: You could (Postgres can do queues and rate limits). This guide uses Redis on purpose because caching, rate limiting and job queues are the three things you said you want to learn, and Redis is where most teams do them.

---

## 3. Project setup

### 3.1 Start PostgreSQL and Redis

Create `docker-compose.yml` at the **repo root**:

```yaml
services:
  postgres:
    image: postgres:18-alpine
    environment:
      POSTGRES_USER: pulse
      POSTGRES_PASSWORD: pulse
      POSTGRES_DB: pulse
    ports:
      - "5432:5432"
    volumes:
      - postgres-data:/var/lib/postgresql/data

  redis:
    image: redis:8-alpine
    ports:
      - "6379:6379"

volumes:
  postgres-data:
```

Run `docker compose up -d`. Check with `docker compose ps`; both should be `running`.

### 3.2 Create the package

```bash
mkdir -p apps/api/src
cd apps/api
pnpm init
```

`apps/*` is already in `pnpm-workspace.yaml`, so pnpm picks the package up automatically.

Add the versions to the **catalog** in `pnpm-workspace.yaml` (the repo keeps every version in one place):

```yaml
catalog:
  express: ^5.3.0
  "@types/express": ^5.0.6
  cookie-parser: ^1.4.7
  "@types/cookie-parser": ^1.4.10
  drizzle-orm: ^0.45.4
  drizzle-kit: ^0.31.11
  postgres: ^4.1.1
  bullmq: ^6.7.7
  ioredis: ^6.0.0
  jose: ^6.2.17
  "@node-rs/argon2": ^2.2.2
  pino: ^10.4.0
```

(`zod`, `typescript`, `vitest` and `@types/node` are already in the catalog.)

Then install:

```bash
pnpm add @pulse/contracts@workspace:* zod@catalog: express@catalog: cookie-parser@catalog: \
  drizzle-orm@catalog: postgres@catalog: bullmq@catalog: ioredis@catalog: jose@catalog: \
  @node-rs/argon2@catalog: pino@catalog:
pnpm add -D drizzle-kit@catalog: typescript@catalog: vitest@catalog: @types/node@catalog: \
  @types/express@catalog: @types/cookie-parser@catalog:
```

`apps/api/package.json` should end up like this (versions resolved from the catalog):

```json
{
  "name": "api",
  "private": true,
  "type": "module",
  "scripts": {
    "dev": "node --watch --env-file=.env src/server.ts",
    "worker": "node --watch --env-file=.env src/worker.ts",
    "typecheck": "tsc --noEmit",
    "test": "vitest",
    "db:generate": "drizzle-kit generate",
    "db:migrate": "drizzle-kit migrate",
    "db:studio": "drizzle-kit studio",
    "db:seed": "node --env-file=.env src/db/seed.ts"
  }
}
```

**Q: How does `node src/server.ts` work without compiling?**
A: Node 26 strips TypeScript types at load time. It does not type-check (that is what `pnpm typecheck` is for) and it only supports "erasable" syntax: no `enum`, no `namespace`, no constructor parameter properties. The tsconfig below enforces that, so you get an error in your editor before Node ever complains.

### 3.3 TypeScript config

`apps/api/tsconfig.json`:

```json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": {
    "noEmit": true,
    "allowImportingTsExtensions": true,
    "erasableSyntaxOnly": true,
    "verbatimModuleSyntax": true,
    "types": ["node"]
  },
  "include": ["src", "drizzle.config.ts"]
}
```

Rule for imports: **relative imports use the `.ts` extension** (`import { db } from "./db/client.ts"`), package imports do not (`import { z } from "zod"`). That is the same rule `@pulse/contracts` follows.

### 3.4 Environment variables

`apps/api/.env.example` (copy it to `.env`, which is git-ignored):

```bash
NODE_ENV=development
PORT=3000
APP_URL=http://localhost:5173
DATABASE_URL=postgres://pulse:pulse@localhost:5432/pulse
REDIS_URL=redis://localhost:6379
JWT_SECRET=change-me-to-a-long-random-string-at-least-32-chars
INVITE_SECRET=change-me-too-another-long-random-string
GITHUB_CLIENT_ID=
GITHUB_CLIENT_SECRET=
GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=
```

`APP_URL` is the **frontend** origin. The backend uses it to build links that point at the frontend: invite links, reset links, webhook ingest URLs and OAuth redirect URLs.

Validate them at startup so a missing variable fails immediately with a clear message instead of a confusing error later. `src/config/env.ts`:

```ts
import { z } from "zod";

const envSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  PORT: z.coerce.number().int().default(3000),
  APP_URL: z.url(),
  DATABASE_URL: z.url(),
  REDIS_URL: z.url(),
  JWT_SECRET: z.string().min(32),
  INVITE_SECRET: z.string().min(32),
  GITHUB_CLIENT_ID: z.string().default(""),
  GITHUB_CLIENT_SECRET: z.string().default(""),
  GOOGLE_CLIENT_ID: z.string().default(""),
  GOOGLE_CLIENT_SECRET: z.string().default(""),
});

export const env = envSchema.parse(process.env);

export const isProduction = env.NODE_ENV === "production";
```

**Q: Why validate env vars with zod?**
A: The same reason you validate request bodies: data from outside your code is untrusted. A typo in `.env` should stop the server at boot with "DATABASE_URL: Invalid url", not crash an hour later on the first query.

### 3.5 Suggested folder structure

```
apps/api/
├── docker-compose.yml          (at repo root, see 3.1)
├── drizzle.config.ts
├── .env / .env.example
└── src/
    ├── server.ts               starts the HTTP server
    ├── worker.ts               starts the job workers and schedulers
    ├── app.ts                  builds the Express app: middleware, routes, error handler
    ├── config/env.ts
    ├── db/
    │   ├── client.ts           drizzle + postgres connection
    │   ├── schema/             one file per table group
    │   ├── migrations/         generated by drizzle-kit, committed to git
    │   └── seed.ts             demo data (same accounts as the mock)
    ├── lib/
    │   ├── errors.ts           AppError + helpers
    │   ├── validate.ts         parse body/query/params with contract schemas
    │   ├── route.ts            register a route from an endpoint definition
    │   ├── pagination.ts
    │   ├── redis.ts
    │   ├── cache.ts
    │   ├── rate-limit.ts
    │   └── logger.ts
    ├── auth/
    │   ├── passwords.ts        argon2 hash/verify
    │   ├── tokens.ts           JWT access tokens
    │   ├── sessions.ts         refresh tokens (rotation, revocation)
    │   ├── cookies.ts
    │   └── middleware.ts       authenticate + authorize
    ├── modules/                one folder per domain
    │   ├── auth/  account/  members/  invitations/
    │   ├── monitors/  webhooks/  alert-channels/  incidents/  dashboard/
    │   └── <module>/
    │       ├── routes.ts       HTTP layer: parse input, call service, send response
    │       ├── service.ts      business rules
    │       ├── repository.ts   database queries
    │       └── mapper.ts       database row -> contract object
    └── jobs/
        ├── queues.ts
        ├── schedulers.ts
        └── workers/            one file per job type
```

**Q: Why split routes / service / repository / mapper?**
A: Each layer has one reason to change. Routes change when HTTP details change. Services change when business rules change. Repositories change when the database changes. Mappers change when the API shape changes. It also makes testing easy: you can test a service without HTTP, and a mapper without a database.

---

## 4. The contract: your source of truth

`packages/contracts` (imported as `@pulse/contracts`) is shared by the frontend, the mock API and your backend. **Never redefine a schema in the backend.** Import it.

```mermaid
flowchart TB
  C["@pulse/contracts"]
  C --> S["Schemas<br/>createMonitorSchema, monitorSchema, ..."]
  C --> R["resources<br/>monitors, webhooks, alertChannels,<br/>incidents, members, invitations"]
  C --> E["endpoints<br/>login, refreshSession, listMonitorChecks, ..."]
  C --> P["RBAC<br/>roleSchema, hasPermission, rolePermissions"]
  C --> B["Business rules<br/>applyIncidentTransition, resolveInvitationStatus,<br/>DEFAULT_SIGNUP_ROLE"]
  S --> V["You validate request bodies and query strings"]
  R --> CR["You register CRUD routes"]
  E --> OR["You register every other route"]
  P --> G["You guard routes"]
  B --> SV["Your services reuse the same rules"]
```

Open `packages/contracts/src/api/endpoints.ts`. It is the complete list of what you must build:

- **`resources`**: the six collection resources. Each has a `path`, `permissions` (`read`, `write`), an `item` schema (what one record looks like in responses), a `listQuery` schema (accepted query string), and optionally `create` and `update` schemas (request bodies).
- **`endpoints`**: every other endpoint. Each has a `method`, `path`, `access` (`"public"`, `"authenticated"`, or a specific permission), and optionally `body`, `query` and `response` schemas.

A resource implies these routes:

| Route | Exists when | Access | Body | Response |
|---|---|---|---|---|
| `GET {path}` | always | `permissions.read` | none, query = `listQuery` | `Paginated<item>` |
| `GET {path}/:id` | always | `permissions.read` | none | `item` |
| `POST {path}` | `create` is defined | `permissions.write` | `create` | `item`, status 201 |
| `PATCH {path}/:id` | `update` is defined | `permissions.write` | `update` (partial) | `item` |
| `DELETE {path}/:id` | every resource except incidents (incidents are resolved, never deleted) | `permissions.write` | none | empty, status 204 |

**Q: Where do I see what a route should actually do, not just its shape?**
A: The mock API in `apps/web/src/mocks` is a working reference implementation. Every handler there is small. For example, `mocks/handlers/members.ts` shows that the owner can never be changed and that you cannot change your own role. When this guide says "same as the mock", that is the file to read.

**Q: What does `buildPath` do?**
A: It fills path parameters: `buildPath("/monitors/:id/checks", { id: "abc" })` returns `"/monitors/abc/checks"`. You will mostly use it in tests and when building links.

---

## 5. API conventions the frontend relies on

These are hard requirements. The frontend breaks if any of them differ.

### 5.1 Base path and transport

- All routes live under **`/api`** (`/api/monitors`, `/api/auth/login`, ...). The webhook ingest route `/hooks/:slug` is the only exception.
- Request and response bodies are **JSON** (`Content-Type: application/json`).
- The frontend sends **`credentials: "include"`** on every request, so cookies flow automatically. Because the Vite dev server proxies `/api` to your server, the browser sees everything as same-origin: **you do not need CORS in development.**
- Authenticated requests carry **`Authorization: Bearer <accessToken>`**.

### 5.2 Status codes

| Situation | Status | Body |
|---|---|---|
| Read or update succeeded | 200 | the resource |
| Created (POST to a collection, register, accept invite) | 201 | the created resource or auth response |
| Success with nothing to return (delete, logout, password change, test alert, revoke) | 204 | **empty** |
| Any error | see 5.4 | the error envelope |

The frontend treats a 204 as "no body" and parses everything else as JSON. Returning `{}` with 200 where the contract has no `response` schema is tolerated, but 204 is the convention.

### 5.3 Lists and pagination

Every list endpoint accepts `?page=1&pageSize=20` (defaults 1 and 20, max 100, from `paginationQuerySchema`) plus its own filters, and returns:

```json
{ "items": [ ... ], "page": 1, "pageSize": 20, "total": 57 }
```

Lists are sorted **newest first** (by `createdAt`, or `checkedAt` / `receivedAt` / `startedAt` for those resources).

### 5.4 The error envelope

Every error response, without exception, has this shape (`apiErrorResponseSchema`):

```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Some fields are invalid",
    "fieldErrors": { "email": ["Enter a valid email"] }
  }
}
```

| `code` | HTTP status | When |
|---|---|---|
| `VALIDATION_ERROR` | 400 | Body, query or params failed the contract schema, or a business validation failed (wrong current password, unknown alert channel id) |
| `UNAUTHORIZED` | 401 | Missing, invalid or expired access token; invalid login; no refresh cookie |
| `FORBIDDEN` | 403 | Authenticated, but the role lacks the permission, or a business rule forbids it (changing the owner) |
| `NOT_FOUND` | 404 | The resource or route does not exist |
| `CONFLICT` | 409 | The request clashes with current state: duplicate email, already invited, invalid incident transition |
| `RATE_LIMITED` | 429 | Too many attempts. **Also send a `Retry-After: <seconds>` header**; the frontend shows "Try again in Ns." |
| `INTERNAL_ERROR` | 500 | Anything unexpected. Never leak stack traces in the message. |

`fieldErrors` keys must match the form field names (the request body keys). The frontend shows each message under the matching input. Messages for keys that match no field are shown at the top of the form.

### 5.5 Data formats

- IDs are UUIDs.
- Timestamps are ISO 8601 strings in UTC with `Z`, e.g. `"2026-11-18T10:15:00.000Z"`. Postgres `timestamptz` + `.toISOString()` gives you this.
- Nullable fields are `null`, never missing. If the schema says `.nullable()`, send `null`.
- Emails are lowercased (the contract's `emailSchema` does `toLowerCase()` when you parse).

**Q: What exactly happens when an access token expires?**
A: Your server returns `401` with code `UNAUTHORIZED`. The frontend then calls `POST /api/auth/refresh` once (sending the refresh cookie). If that succeeds, it retries the original request with the new access token. If refresh also fails with 401, it signs the user out and redirects to login. This logic lives in `apps/web/src/lib/api/transport.ts` and `refresh-session.ts`. Your only job is to return `401` for bad tokens and implement refresh correctly.

---

## 6. Validation and error handling

### 6.1 The flow of one request

```mermaid
sequenceDiagram
  participant B as Browser
  participant E as Express
  participant G as Access guard
  participant H as Route handler
  participant S as Service
  participant DB as PostgreSQL
  participant EH as Error middleware

  B->>E: PATCH /api/monitors/:id (JSON body + Bearer token)
  E->>G: authenticate + authorize("monitor:write")
  alt token missing or invalid
    G-->>EH: throw AppError UNAUTHORIZED
  end
  G->>H: req.user is set
  H->>H: parse body with updateMonitorSchema
  alt body invalid
    H-->>EH: throw AppError VALIDATION_ERROR + fieldErrors
  end
  H->>S: updateMonitor(id, input)
  S->>DB: update ... returning *
  alt row not found
    S-->>EH: throw AppError NOT_FOUND
  end
  S-->>H: monitor row
  H-->>B: 200 + mapped Monitor JSON
  EH-->>B: status + error envelope
```

Every failure path ends at **one** error middleware that formats the envelope. Handlers just `throw`.

### 6.2 `AppError`

`src/lib/errors.ts`:

```ts
import type { ApiErrorCode, FieldErrors } from "@pulse/contracts";

export const statusByCode: Record<ApiErrorCode, number> = {
  VALIDATION_ERROR: 400,
  UNAUTHORIZED: 401,
  FORBIDDEN: 403,
  NOT_FOUND: 404,
  CONFLICT: 409,
  RATE_LIMITED: 429,
  INTERNAL_ERROR: 500,
};

type AppErrorOptions = {
  fieldErrors?: FieldErrors;
  retryAfterSeconds?: number;
};

export class AppError extends Error {
  readonly code: ApiErrorCode;
  readonly fieldErrors: FieldErrors | undefined;
  readonly retryAfterSeconds: number | undefined;

  constructor(code: ApiErrorCode, message: string, options: AppErrorOptions = {}) {
    super(message);
    this.name = "AppError";
    this.code = code;
    this.fieldErrors = options.fieldErrors;
    this.retryAfterSeconds = options.retryAfterSeconds;
  }

  get status() {
    return statusByCode[this.code];
  }
}

export const notFound = (label: string) => new AppError("NOT_FOUND", `${label} not found`);

export const forbidden = (message: string) => new AppError("FORBIDDEN", message);

export const conflict = (message: string, fieldErrors?: FieldErrors) =>
  new AppError("CONFLICT", message, { fieldErrors });
```

Note the fields are declared and assigned in the constructor body, not with `constructor(private readonly code ...)`. Parameter properties are not "erasable" syntax, so Node 26 cannot run them.

### 6.3 Parsing input with contract schemas

`src/lib/validate.ts`:

```ts
import { z } from "zod";
import { AppError } from "./errors.ts";

const toFieldErrors = (error: z.ZodError) =>
  Object.fromEntries(
    Object.entries(z.flattenError(error).fieldErrors).filter(
      (entry): entry is [string, string[]] => Array.isArray(entry[1]),
    ),
  );

export const parseWith = <TSchema extends z.ZodType>(
  schema: TSchema,
  data: unknown,
  message = "Some fields are invalid",
): z.output<TSchema> => {
  const result = schema.safeParse(data);

  if (!result.success) {
    throw new AppError("VALIDATION_ERROR", message, { fieldErrors: toFieldErrors(result.error) });
  }

  return result.data;
};
```

Use it in handlers:

```ts
const input = parseWith(createMonitorSchema, req.body);
const query = parseWith(monitorListQuerySchema, req.query, "Invalid query parameters");
```

**Q: Why parse instead of just reading `req.body`?**
A: `req.body` is whatever the client sent. Parsing gives you three things at once: rejects bad input with field-level messages, **strips unknown keys** (so a client cannot sneak in `role: "owner"`), and **transforms** values (trims names, lowercases emails, coerces `"2"` to `2` in query strings). After parsing, `input` is fully typed.

**Q: The query string is all strings. How does `page=2` become a number?**
A: `paginationQuerySchema` uses `z.coerce.number()`. That is why list query schemas are written with coercion. Body schemas do not coerce because JSON already has numbers.

### 6.4 The error middleware

`src/lib/error-handler.ts`:

```ts
import type { ErrorRequestHandler, RequestHandler } from "express";
import { isProduction } from "../config/env.ts";
import { AppError } from "./errors.ts";
import { logger } from "./logger.ts";

const POSTGRES_UNIQUE_VIOLATION = "23505";

const isUniqueViolation = (error: unknown) =>
  typeof error === "object" && error !== null && "code" in error && error.code === POSTGRES_UNIQUE_VIOLATION;

const isMalformedJson = (error: unknown) =>
  typeof error === "object" && error !== null && "type" in error && error.type === "entity.parse.failed";

const toAppError = (error: unknown) => {
  if (error instanceof AppError) {
    return error;
  }

  if (isMalformedJson(error)) {
    return new AppError("VALIDATION_ERROR", "Request body is not valid JSON");
  }

  if (isUniqueViolation(error)) {
    return new AppError("CONFLICT", "This record already exists");
  }

  logger.error({ err: error }, "Unhandled error");

  return new AppError("INTERNAL_ERROR", isProduction ? "Something went wrong" : String(error));
};

export const errorHandler: ErrorRequestHandler = (error, _req, res, _next) => {
  const appError = toAppError(error);

  if (appError.retryAfterSeconds) {
    res.setHeader("Retry-After", String(appError.retryAfterSeconds));
  }

  res.status(appError.status).json({
    error: {
      code: appError.code,
      message: appError.message,
      fieldErrors: appError.fieldErrors,
    },
  });
};

export const notFoundHandler: RequestHandler = () => {
  throw new AppError("NOT_FOUND", "Route not found");
};
```

**Q: Why does an error middleware need four parameters?**
A: Express recognises error middleware by its arity (number of declared parameters). With four parameters `(error, req, res, next)` Express calls it only when something threw. Keep `_next` even though it is unused.

**Q: Why map Postgres error `23505`?**
A: That is "unique constraint violation". Your service should check for duplicates first (to give a precise message like "Email already in use"), but two requests can race. The database constraint is the real guarantee, and this mapping turns the race into a clean `409` instead of a `500`.

### 6.5 Sending responses

`src/lib/respond.ts`:

```ts
import type { Response } from "express";
import type { z } from "zod";

export const sendJson = <TSchema extends z.ZodType>(
  res: Response,
  schema: TSchema,
  data: z.input<TSchema>,
  status = 200,
) => {
  res.status(status).json(schema.parse(data));
};

export const sendNoContent = (res: Response) => {
  res.status(204).end();
};
```

Parsing the **response** against the contract is a safety net: if your mapper forgets a field or returns a wrong type, you get an error in development instead of a broken screen. It also strips columns you did not mean to expose, like `passwordHash`.

**Q: Isn't parsing every response slow?**
A: For the sizes in this app (at most 100 items per page) it is negligible. If you ever measure it as a bottleneck, you can parse only in development.

### 6.6 Registering routes from the endpoint map

`src/lib/route.ts`:

```ts
import type { EndpointDefinition } from "@pulse/contracts";
import type { RequestHandler, Router } from "express";
import { accessGuard } from "../auth/middleware.ts";

const methodOf = (endpoint: EndpointDefinition) =>
  endpoint.method.toLowerCase() as "get" | "post" | "patch" | "delete";

export const route = (router: Router, endpoint: EndpointDefinition, handler: RequestHandler) => {
  router[methodOf(endpoint)](endpoint.path, accessGuard(endpoint.access), handler);
};
```

Usage:

```ts
route(router, endpoints.changePassword, async (req, res) => {
  const input = parseWith(changePasswordSchema, req.body);
  await changePassword(req.user!.id, input);
  sendNoContent(res);
});
```

`accessGuard` is built in [section 9](#9-authorization-rbac). Because method, path and access all come from the contract, your server cannot drift from what the frontend calls.

### 6.7 Wiring the app

`src/app.ts`:

```ts
import cookieParser from "cookie-parser";
import express from "express";
import { errorHandler, notFoundHandler } from "./lib/error-handler.ts";
import { apiRouter } from "./routes.ts";
import { ingestRouter } from "./modules/webhooks/ingest-routes.ts";

export const createApp = () => {
  const app = express();

  app.set("trust proxy", 1);
  app.disable("x-powered-by");

  app.use("/hooks", ingestRouter);

  app.use(express.json({ limit: "1mb" }));
  app.use(cookieParser());
  app.use("/api", apiRouter);

  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
};
```

`src/server.ts`:

```ts
import { createApp } from "./app.ts";
import { env } from "./config/env.ts";
import { logger } from "./lib/logger.ts";

createApp().listen(env.PORT, () => logger.info(`API listening on http://localhost:${env.PORT}`));
```

`src/routes.ts` collects every module router:

```ts
import { Router } from "express";
import { authRouter } from "./modules/auth/routes.ts";
import { monitorsRouter } from "./modules/monitors/routes.ts";

export const apiRouter = Router();

apiRouter.use(authRouter);
apiRouter.use(monitorsRouter);
```

Add one line per module as you build them.

**Q: What does `trust proxy` do and why set it?**
A: Behind a proxy (the Vite dev proxy now, a load balancer in production) every request seems to come from the proxy's IP. `trust proxy` makes Express read the real client IP from the `X-Forwarded-For` header into `req.ip`. You need the real IP for rate limiting and for recording a webhook event's source IP.

**Q: Why mount `/hooks` first, before `express.json()`?**
A: Webhook senders (Stripe, GitHub, ...) post to the ingest URL shown in the app, `APP_URL/hooks/<slug>`. Pulse stores the payload **exactly as received** so users can inspect it, and senders sign the raw bytes (for example Stripe signatures). `express.json()` would parse and discard the original text, so the ingest router must run before it and read the body as raw text itself. It is also not part of the authenticated API, so it has its own rules: no auth, raw body, its own rate limit.

---

## 7. Database modeling with PostgreSQL and Drizzle

### 7.1 The data model

```mermaid
erDiagram
  users ||--o{ sessions : "has refresh tokens"
  users ||--o{ linked_accounts : "signs in with"
  users ||--o{ password_reset_tokens : "requests"
  users ||--o{ invitations : "invites"
  monitors ||--o{ check_results : "produces"
  monitors ||--o{ monitor_alert_channels : ""
  alert_channels ||--o{ monitor_alert_channels : ""
  webhooks ||--o{ webhook_events : "receives"
  webhooks ||--o{ webhook_alert_channels : ""
  alert_channels ||--o{ webhook_alert_channels : ""
  monitors ||--o{ incidents : "source (monitor)"
  webhooks ||--o{ incidents : "source (webhook)"

  users {
    uuid id PK
    text name
    text email UK
    text password_hash "nullable: OAuth-only users"
    role role
    timestamptz created_at
  }
  sessions {
    uuid id PK
    uuid user_id FK
    uuid family_id
    text token_hash UK
    timestamptz expires_at
    timestamptz revoked_at "nullable"
    timestamptz created_at
  }
  linked_accounts {
    uuid user_id FK
    oauth_provider provider
    text provider_account_id
    text email
    timestamptz linked_at
  }
  password_reset_tokens {
    uuid id PK
    uuid user_id FK
    text token_hash UK
    timestamptz expires_at
    timestamptz used_at "nullable"
  }
  invitations {
    uuid id PK
    text email
    role role
    invitation_status status
    uuid invited_by FK
    timestamptz expires_at
    timestamptz created_at
  }
  monitors {
    uuid id PK
    text name
    text url
    http_method method
    int interval_seconds
    int timeout_ms
    int expected_status_code
    bool is_paused
    monitor_status status
    timestamptz last_checked_at
    int last_response_time_ms
    real uptime_percent
    timestamptz created_at
    timestamptz updated_at
  }
  check_results {
    uuid id PK
    uuid monitor_id FK
    check_outcome outcome
    int status_code
    int response_time_ms
    text error_message
    timestamptz checked_at
  }
  webhooks {
    uuid id PK
    text name
    text slug UK
    int expected_interval_seconds "nullable"
    webhook_status status
    int event_count
    timestamptz last_received_at
    timestamptz created_at
  }
  webhook_events {
    uuid id PK
    uuid webhook_id FK
    text method
    jsonb headers
    text body
    text content_type
    text source_ip
    timestamptz received_at
  }
  alert_channels {
    uuid id PK
    text name
    bool is_enabled
    alert_channel_type type
    text target
    timestamptz created_at
  }
  monitor_alert_channels {
    uuid monitor_id PK
    uuid channel_id PK
  }
  webhook_alert_channels {
    uuid webhook_id PK
    uuid channel_id PK
  }
  incidents {
    uuid id PK
    incident_source_type source_type
    uuid source_id
    text source_name
    incident_status status
    text cause
    timestamptz started_at
    timestamptz acknowledged_at
    timestamptz resolved_at
  }
```

### 7.2 Design decisions, explained

**Q: `alertChannelIds` is an array in the API. Why not an array column?**
A: A monitor can notify many channels and a channel can be used by many monitors: a **many-to-many** relationship. The relational way is a **join table** (`monitor_alert_channels`) with a composite primary key `(monitor_id, channel_id)`. Benefits: foreign keys guarantee every id exists, and `ON DELETE CASCADE` removes the link automatically when a channel is deleted (which is exactly the behaviour the mock implements by hand in `detachAlertChannel`). The mapper turns the rows back into an `alertChannelIds` array.

**Q: The API nests the alert channel target as `destination: { type, target }`. Why flat columns?**
A: Storage and API shape do not have to match. Two plain columns are easy to query and index. The mapper builds the nested object. This separation is exactly what mappers are for.

**Q: An incident's source can be a monitor or a webhook. How do I model that?**
A: This is a **polymorphic association**. Two common options:
1. Two nullable foreign keys (`monitor_id`, `webhook_id`) plus a `CHECK` that exactly one is set.
2. `source_type` + `source_id` without a foreign key.

This guide uses option 2 because it matches the API (`source: { type, id, name }`) and incidents are historical records you may want to keep after the source is deleted. The trade-off: the database cannot enforce that `source_id` exists, so your service deletes a source's incidents when the source is deleted (same as the mock's `removeIncidentsForSource`). If you prefer database-enforced integrity, option 1 is the stricter choice; both are legitimate.

**Q: Why store `source_name` on the incident? Isn't that duplicated data?**
A: It is a deliberate **denormalisation**: the incidents list shows the source name, and storing it avoids a join against two different tables for every row. The cost is keeping it in sync: when a monitor or webhook is renamed, update its incidents' `source_name` (the mock does this in `renameIncidentSource`).

**Q: Why do `sessions`, `password_reset_tokens` store a hash and not the token?**
A: If your database leaks, raw tokens would let an attacker log in as anyone. Store `sha256(token)` and compare hashes. SHA-256 is enough here (unlike passwords) because the tokens are long random values, not human-chosen secrets.

**Q: Why is there no `token` column on `invitations`?**
A: The admin can copy an invite link at any time from the Team page, so the server must be able to rebuild the link. Instead of storing the token, derive it: `token = base64url(invitationId + "." + hmac(INVITE_SECRET, invitationId))`. You can recompute it whenever you need the URL, and verify an incoming token by recomputing the HMAC. See [section 15](#15-invitations-password-reset-and-oauth).

**Q: `uptime_percent` can be computed from `check_results`. Why store it?**
A: Computing a 24-hour ratio for every monitor on every list request is wasteful. The worker updates it after each check (it already has the data in hand). That is the "precompute on write, read cheaply" pattern.

### 7.3 Enums from the contract

Postgres enums restrict a column to known values. Build them **from the contract enums** so the database and API can never disagree. `src/db/schema/enums.ts`:

```ts
import {
  alertChannelTypeSchema,
  checkOutcomeSchema,
  httpMethodSchema,
  incidentSourceTypeSchema,
  incidentStatusSchema,
  invitationStatusSchema,
  monitorStatusSchema,
  oauthProviderSchema,
  roleSchema,
  webhookStatusSchema,
} from "@pulse/contracts";
import { pgEnum } from "drizzle-orm/pg-core";

export const roleEnum = pgEnum("role", roleSchema.options);
export const httpMethodEnum = pgEnum("http_method", httpMethodSchema.options);
export const monitorStatusEnum = pgEnum("monitor_status", monitorStatusSchema.options);
export const checkOutcomeEnum = pgEnum("check_outcome", checkOutcomeSchema.options);
export const webhookStatusEnum = pgEnum("webhook_status", webhookStatusSchema.options);
export const alertChannelTypeEnum = pgEnum("alert_channel_type", alertChannelTypeSchema.options);
export const incidentStatusEnum = pgEnum("incident_status", incidentStatusSchema.options);
export const incidentSourceTypeEnum = pgEnum("incident_source_type", incidentSourceTypeSchema.options);
export const invitationStatusEnum = pgEnum("invitation_status", invitationStatusSchema.options);
export const oauthProviderEnum = pgEnum("oauth_provider", oauthProviderSchema.options);
```

**Q: What happens if I later add a value to a contract enum?**
A: Run `pnpm db:generate`; drizzle-kit produces an `ALTER TYPE ... ADD VALUE` migration. Removing an enum value is harder in Postgres (it needs a type swap), so add values carefully.

### 7.4 Tables

A shared timestamp helper, `src/db/schema/columns.ts`:

```ts
import { sql } from "drizzle-orm";
import { timestamp, uuid } from "drizzle-orm/pg-core";

export const id = () => uuid("id").primaryKey().default(sql`gen_random_uuid()`);

export const timestampColumn = (name: string) => timestamp(name, { withTimezone: true });

export const createdAt = () => timestampColumn("created_at").notNull().defaultNow();
```

`src/db/schema/users.ts`:

```ts
import { sql } from "drizzle-orm";
import { index, pgTable, primaryKey, text, uniqueIndex, uuid } from "drizzle-orm/pg-core";
import { createdAt, id, timestampColumn } from "./columns.ts";
import { oauthProviderEnum, roleEnum } from "./enums.ts";

export const users = pgTable(
  "users",
  {
    id: id(),
    name: text("name").notNull(),
    email: text("email").notNull(),
    passwordHash: text("password_hash"),
    role: roleEnum("role").notNull(),
    createdAt: createdAt(),
  },
  (table) => [uniqueIndex("users_email_unique").on(sql`lower(${table.email})`)],
);

export const sessions = pgTable(
  "sessions",
  {
    id: id(),
    userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
    familyId: uuid("family_id").notNull(),
    tokenHash: text("token_hash").notNull().unique(),
    expiresAt: timestampColumn("expires_at").notNull(),
    revokedAt: timestampColumn("revoked_at"),
    createdAt: createdAt(),
  },
  (table) => [index("sessions_user_idx").on(table.userId), index("sessions_family_idx").on(table.familyId)],
);

export const linkedAccounts = pgTable(
  "linked_accounts",
  {
    userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
    provider: oauthProviderEnum("provider").notNull(),
    providerAccountId: text("provider_account_id").notNull(),
    email: text("email").notNull(),
    linkedAt: createdAt(),
  },
  (table) => [
    primaryKey({ columns: [table.userId, table.provider] }),
    uniqueIndex("linked_accounts_provider_account_unique").on(table.provider, table.providerAccountId),
  ],
);

export const passwordResetTokens = pgTable("password_reset_tokens", {
  id: id(),
  userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  tokenHash: text("token_hash").notNull().unique(),
  expiresAt: timestampColumn("expires_at").notNull(),
  usedAt: timestampColumn("used_at"),
});
```

`src/db/schema/team.ts`:

```ts
import { index, pgTable, text, uuid } from "drizzle-orm/pg-core";
import { createdAt, id, timestampColumn } from "./columns.ts";
import { invitationStatusEnum, roleEnum } from "./enums.ts";
import { users } from "./users.ts";

export const invitations = pgTable(
  "invitations",
  {
    id: id(),
    email: text("email").notNull(),
    role: roleEnum("role").notNull(),
    status: invitationStatusEnum("status").notNull().default("pending"),
    invitedBy: uuid("invited_by").notNull().references(() => users.id, { onDelete: "cascade" }),
    expiresAt: timestampColumn("expires_at").notNull(),
    createdAt: createdAt(),
  },
  (table) => [index("invitations_email_idx").on(table.email)],
);
```

`src/db/schema/monitoring.ts`:

```ts
import { sql } from "drizzle-orm";
import { boolean, index, integer, jsonb, pgTable, primaryKey, real, text, uniqueIndex, uuid } from "drizzle-orm/pg-core";
import { createdAt, id, timestampColumn } from "./columns.ts";
import {
  alertChannelTypeEnum,
  checkOutcomeEnum,
  httpMethodEnum,
  incidentSourceTypeEnum,
  incidentStatusEnum,
  monitorStatusEnum,
  webhookStatusEnum,
} from "./enums.ts";

export const alertChannels = pgTable("alert_channels", {
  id: id(),
  name: text("name").notNull(),
  isEnabled: boolean("is_enabled").notNull().default(true),
  type: alertChannelTypeEnum("type").notNull(),
  target: text("target").notNull(),
  createdAt: createdAt(),
});

export const monitors = pgTable(
  "monitors",
  {
    id: id(),
    name: text("name").notNull(),
    url: text("url").notNull(),
    method: httpMethodEnum("method").notNull(),
    intervalSeconds: integer("interval_seconds").notNull(),
    timeoutMs: integer("timeout_ms").notNull(),
    expectedStatusCode: integer("expected_status_code").notNull(),
    isPaused: boolean("is_paused").notNull().default(false),
    status: monitorStatusEnum("status").notNull().default("pending"),
    lastCheckedAt: timestampColumn("last_checked_at"),
    lastResponseTimeMs: integer("last_response_time_ms"),
    uptimePercent: real("uptime_percent"),
    createdAt: createdAt(),
    updatedAt: createdAt(),
  },
  (table) => [index("monitors_due_idx").on(table.isPaused, table.lastCheckedAt)],
);

export const monitorAlertChannels = pgTable(
  "monitor_alert_channels",
  {
    monitorId: uuid("monitor_id").notNull().references(() => monitors.id, { onDelete: "cascade" }),
    channelId: uuid("channel_id").notNull().references(() => alertChannels.id, { onDelete: "cascade" }),
  },
  (table) => [primaryKey({ columns: [table.monitorId, table.channelId] })],
);

export const checkResults = pgTable(
  "check_results",
  {
    id: id(),
    monitorId: uuid("monitor_id").notNull().references(() => monitors.id, { onDelete: "cascade" }),
    outcome: checkOutcomeEnum("outcome").notNull(),
    statusCode: integer("status_code"),
    responseTimeMs: integer("response_time_ms").notNull(),
    errorMessage: text("error_message"),
    checkedAt: createdAt(),
  },
  (table) => [index("check_results_monitor_time_idx").on(table.monitorId, table.checkedAt.desc())],
);

export const webhooks = pgTable("webhooks", {
  id: id(),
  name: text("name").notNull(),
  slug: text("slug").notNull().unique(),
  expectedIntervalSeconds: integer("expected_interval_seconds"),
  status: webhookStatusEnum("status").notNull().default("pending"),
  eventCount: integer("event_count").notNull().default(0),
  lastReceivedAt: timestampColumn("last_received_at"),
  createdAt: createdAt(),
});

export const webhookAlertChannels = pgTable(
  "webhook_alert_channels",
  {
    webhookId: uuid("webhook_id").notNull().references(() => webhooks.id, { onDelete: "cascade" }),
    channelId: uuid("channel_id").notNull().references(() => alertChannels.id, { onDelete: "cascade" }),
  },
  (table) => [primaryKey({ columns: [table.webhookId, table.channelId] })],
);

export const webhookEvents = pgTable(
  "webhook_events",
  {
    id: id(),
    webhookId: uuid("webhook_id").notNull().references(() => webhooks.id, { onDelete: "cascade" }),
    method: text("method").notNull(),
    headers: jsonb("headers").$type<Record<string, string>>().notNull(),
    body: text("body").notNull(),
    contentType: text("content_type"),
    sourceIp: text("source_ip").notNull(),
    receivedAt: createdAt(),
  },
  (table) => [index("webhook_events_webhook_time_idx").on(table.webhookId, table.receivedAt.desc())],
);

export const incidents = pgTable(
  "incidents",
  {
    id: id(),
    sourceType: incidentSourceTypeEnum("source_type").notNull(),
    sourceId: uuid("source_id").notNull(),
    sourceName: text("source_name").notNull(),
    status: incidentStatusEnum("status").notNull().default("open"),
    cause: text("cause").notNull(),
    startedAt: createdAt(),
    acknowledgedAt: timestampColumn("acknowledged_at"),
    resolvedAt: timestampColumn("resolved_at"),
  },
  (table) => [
    index("incidents_status_started_idx").on(table.status, table.startedAt.desc()),
    uniqueIndex("incidents_one_active_per_source")
      .on(table.sourceId)
      .where(sql`${table.status} <> 'resolved'`),
  ],
);
```

`src/db/schema/index.ts` re-exports everything:

```ts
export * from "./enums.ts";
export * from "./monitoring.ts";
export * from "./team.ts";
export * from "./users.ts";
```

**Q: What is that partial unique index on incidents for?**
A: `incidents_one_active_per_source` says: for any source, at most **one** incident whose status is not `resolved`. Without it, two worker jobs checking the same failing monitor at the same moment could each open an incident. The index makes the database reject the second one. Your code catches the conflict and treats it as "already open". This is how you make background work **idempotent** under concurrency.

**Q: Why does `users_email_unique` index `lower(email)`?**
A: So `Olivia@Pulse.dev` and `olivia@pulse.dev` cannot both register. The contract already lowercases emails, but the index protects you from any code path that forgets.

**Q: Why the composite index `(monitor_id, checked_at desc)`?**
A: The check history query is "checks for this monitor, newest first, page N". An index on exactly those columns, in that order, lets Postgres read the page straight off the index without sorting. Rule of thumb: index the columns in your `WHERE`, then your `ORDER BY`.

### 7.5 Connection and migrations

`src/db/client.ts`:

```ts
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { env } from "../config/env.ts";
import * as schema from "./schema/index.ts";

export const sql = postgres(env.DATABASE_URL);

export const db = drizzle({ client: sql, schema });

export type Database = typeof db;
```

`apps/api/drizzle.config.ts`:

```ts
import { defineConfig } from "drizzle-kit";

process.loadEnvFile(".env");

export default defineConfig({
  dialect: "postgresql",
  schema: "./src/db/schema/index.ts",
  out: "./src/db/migrations",
  dbCredentials: { url: process.env.DATABASE_URL ?? "" },
});
```

The migration workflow:

```mermaid
flowchart LR
  A["Edit src/db/schema/*.ts"] --> B["pnpm db:generate"]
  B --> C["Review the new SQL file<br/>in src/db/migrations"]
  C --> D["pnpm db:migrate"]
  D --> E["Commit schema + migration together"]
```

**Q: Why generate SQL migrations instead of letting the ORM sync the schema automatically?**
A: Migrations are a reviewed, versioned history of every change. In production you must know exactly what SQL runs against real data (for example, a column rename versus a drop-and-add would lose data). Always read the generated SQL before applying it.

**Q: `pnpm db:studio`?**
A: Opens Drizzle Studio, a browser UI to look at your tables. Very handy while learning.

### 7.6 Seeding demo data

Create `src/db/seed.ts` that inserts the same demo data as the mock, so the frontend looks the same against your backend:

- The four demo users from `apps/web/src/mocks/demo-accounts.ts` (owner, admin, member, viewer), all with password `password123` hashed with argon2 (see [8.2](#82-passwords)).
- Alert channels, monitors (with check history), webhooks (with events) and incidents: copy the shapes from `apps/web/src/mocks/seed/*.ts`.

Make it idempotent: delete existing rows first (in foreign-key-safe order), or skip if the owner already exists.

### 7.7 Mappers: database row to contract object

The API never returns rows directly. `src/modules/monitors/mapper.ts`:

```ts
import type { Monitor } from "@pulse/contracts";
import type { monitors } from "../../db/schema/index.ts";

type MonitorRow = typeof monitors.$inferSelect;

const toIso = (date: Date | null) => date?.toISOString() ?? null;

export const toMonitor = (row: MonitorRow, alertChannelIds: string[]): Monitor => ({
  id: row.id,
  name: row.name,
  url: row.url,
  method: row.method,
  intervalSeconds: row.intervalSeconds,
  timeoutMs: row.timeoutMs,
  expectedStatusCode: row.expectedStatusCode,
  alertChannelIds,
  isPaused: row.isPaused,
  status: row.status,
  lastCheckedAt: toIso(row.lastCheckedAt),
  lastResponseTimeMs: row.lastResponseTimeMs,
  uptimePercent: row.uptimePercent,
  createdAt: row.createdAt.toISOString(),
  updatedAt: row.updatedAt.toISOString(),
});
```

Put `toIso` in `src/lib/dates.ts` and reuse it in every mapper.

**Q: Why write mappers by hand instead of returning rows?**
A: Rows use database names and types (`Date`, flat columns, `password_hash`). The contract uses API names and types (ISO strings, nested `destination`, no secrets). The mapper is the one place that translation happens, and the `Monitor` return type makes TypeScript check you did not miss a field.

---

## 8. Authentication

### 8.1 The big picture

Pulse uses **two tokens**:

| | Access token | Refresh token |
|---|---|---|
| What | A signed JWT | A long random string |
| Lifetime | 15 minutes | 7 days |
| Where the browser keeps it | In JavaScript memory only (never `localStorage`) | In an `httpOnly` cookie named `pulse_refresh` |
| Sent how | `Authorization: Bearer ...` header | Automatically by the browser, only to `/api/auth/*` |
| Stored on the server | Not stored (stateless) | `sha256` hash in the `sessions` table |
| Can be revoked | No, it just expires | Yes, delete or revoke the row |

**Q: Why two tokens instead of one?**
A: It balances speed and control. The access token is checked on every request without touching the database (just a signature check), but it cannot be revoked, so it must be short-lived. The refresh token lives longer but is checked against the database every time it is used, so you can revoke it (logout, "sign out everywhere", password change).

**Q: Why keep the access token in memory and not `localStorage`?**
A: Any JavaScript on the page can read `localStorage`, so one XSS bug would leak tokens. Memory is cleared on reload, which is why the frontend calls `/api/auth/refresh` on startup: the `httpOnly` refresh cookie (which JavaScript cannot read) restores the session.

### 8.2 Passwords

`src/auth/passwords.ts`:

```ts
import { hash, verify } from "@node-rs/argon2";

export const hashPassword = (password: string) => hash(password);

export const verifyPassword = (passwordHash: string, password: string) => verify(passwordHash, password);
```

`@node-rs/argon2` uses **Argon2id** with sensible defaults. The resulting string contains the algorithm, parameters and salt, so you store just that one string in `users.password_hash`.

**Q: Why not SHA-256 for passwords like I do for tokens?**
A: SHA-256 is designed to be fast; an attacker with a leaked database can try billions of guesses per second. Argon2 is designed to be **slow and memory-hungry** on purpose, making each guess expensive. Tokens are random 256-bit values, so guessing is hopeless anyway and a fast hash is fine.

### 8.3 Access tokens

`src/auth/tokens.ts`:

```ts
import { SignJWT, jwtVerify } from "jose";
import { env } from "../config/env.ts";

const secret = new TextEncoder().encode(env.JWT_SECRET);
const ALGORITHM = "HS256";
const ACCESS_TOKEN_TTL = "15m";

export const issueAccessToken = (userId: string) =>
  new SignJWT()
    .setProtectedHeader({ alg: ALGORITHM })
    .setSubject(userId)
    .setIssuedAt()
    .setExpirationTime(ACCESS_TOKEN_TTL)
    .sign(secret);

export const readAccessToken = async (token: string) => {
  try {
    const { payload } = await jwtVerify(token, secret, { algorithms: [ALGORITHM] });
    return payload.sub ?? null;
  } catch {
    return null;
  }
};
```

**Q: Why put only the user id (`sub`) in the token and not the role?**
A: If the role were in the token, demoting someone would only take effect when their token expires. Loading the user from the database on each request (one indexed primary-key lookup) means role changes and deleted users take effect immediately. Later you can cache that lookup (see [section 13](#13-caching)).

**Q: Why pass `algorithms: ["HS256"]` to `jwtVerify`?**
A: To prevent "algorithm confusion" attacks, where a forged token claims a different algorithm (historically even `none`). Always pin the algorithm you issue.

### 8.4 Refresh tokens with rotation

`src/auth/sessions.ts`:

```ts
import { createHash, randomBytes, randomUUID } from "node:crypto";
import { and, eq, isNull } from "drizzle-orm";
import { db } from "../db/client.ts";
import { sessions } from "../db/schema/index.ts";

const REFRESH_TOKEN_TTL_MS = 7 * 24 * 60 * 60 * 1000;

export const hashToken = (token: string) => createHash("sha256").update(token).digest("hex");

const newToken = () => randomBytes(32).toString("base64url");

export const createSession = async (userId: string, familyId: string = randomUUID()) => {
  const token = newToken();

  await db.insert(sessions).values({
    userId,
    familyId,
    tokenHash: hashToken(token),
    expiresAt: new Date(Date.now() + REFRESH_TOKEN_TTL_MS),
  });

  return token;
};

export const rotateSession = async (token: string) =>
  db.transaction(async (tx) => {
    const [session] = await tx.select().from(sessions).where(eq(sessions.tokenHash, hashToken(token)));

    if (!session) {
      return null;
    }

    if (session.revokedAt) {
      await tx
        .update(sessions)
        .set({ revokedAt: new Date() })
        .where(and(eq(sessions.familyId, session.familyId), isNull(sessions.revokedAt)));
      return null;
    }

    if (session.expiresAt < new Date()) {
      return null;
    }

    await tx.update(sessions).set({ revokedAt: new Date() }).where(eq(sessions.id, session.id));

    const nextToken = newToken();
    await tx.insert(sessions).values({
      userId: session.userId,
      familyId: session.familyId,
      tokenHash: hashToken(nextToken),
      expiresAt: new Date(Date.now() + REFRESH_TOKEN_TTL_MS),
    });

    return { userId: session.userId, token: nextToken };
  });

export const revokeSession = (token: string) =>
  db.update(sessions).set({ revokedAt: new Date() }).where(eq(sessions.tokenHash, hashToken(token)));

export const revokeAllSessions = (userId: string) =>
  db
    .update(sessions)
    .set({ revokedAt: new Date() })
    .where(and(eq(sessions.userId, userId), isNull(sessions.revokedAt)));
```

```mermaid
sequenceDiagram
  participant B as Browser
  participant A as API
  participant DB as sessions table

  B->>A: POST /api/auth/refresh (cookie: token T1)
  A->>DB: find by sha256(T1)
  DB-->>A: session S1 (active, family F)
  A->>DB: revoke S1, insert S2 with sha256(T2), family F
  A-->>B: 200 { accessToken, user } + Set-Cookie: T2

  Note over B,DB: Later, an attacker replays the stolen old token T1
  B->>A: POST /api/auth/refresh (cookie: T1)
  A->>DB: find by sha256(T1)
  DB-->>A: S1 is already revoked: reuse detected
  A->>DB: revoke every session in family F (including S2)
  A-->>B: 401 UNAUTHORIZED + clear cookie
```

**Q: What is "rotation" and why bother?**
A: Every refresh replaces the refresh token with a new one and revokes the old one. If a refresh token is stolen and used, the next time **either** party uses the old one, the server sees a revoked token being reused. It cannot tell who is the attacker, so it revokes the whole **family** (every token descended from that login). Both get logged out, and the stolen token becomes worthless.

**Q: Why is `rotateSession` inside a transaction?**
A: "Read the session, revoke it, insert the new one" must happen atomically. Without a transaction, two refresh calls arriving at the same moment could both read the session as active and both get a new token.

**Q: The frontend could call refresh twice in parallel on startup. Will that trip reuse detection?**
A: The frontend deduplicates concurrent refresh calls into one request (`apps/web/src/lib/api/refresh-session.ts`), so this does not happen in normal use.

### 8.5 The refresh cookie

`src/auth/cookies.ts`:

```ts
import type { Response } from "express";
import { isProduction } from "../config/env.ts";

const REFRESH_COOKIE = "pulse_refresh";
const REFRESH_COOKIE_MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000;

const cookieOptions = {
  httpOnly: true,
  secure: isProduction,
  sameSite: "lax",
  path: "/api/auth",
} as const;

export const readRefreshToken = (cookies: Record<string, string | undefined>): string | undefined =>
  cookies[REFRESH_COOKIE];

export const setRefreshCookie = (res: Response, token: string) => {
  res.cookie(REFRESH_COOKIE, token, { ...cookieOptions, maxAge: REFRESH_COOKIE_MAX_AGE_MS });
};

export const clearRefreshCookie = (res: Response) => {
  res.clearCookie(REFRESH_COOKIE, cookieOptions);
};
```

| Flag | Why |
|---|---|
| `httpOnly` | JavaScript cannot read it, so XSS cannot steal it. |
| `secure` | Only sent over HTTPS. Off in development because `localhost` runs over HTTP. |
| `sameSite: "lax"` | Not sent on cross-site POSTs, which blocks CSRF against your auth endpoints. |
| `path: "/api/auth"` | The browser only sends it to `/api/auth/*`, never to other endpoints. Less exposure. |

**Q: Accepting an invitation is `POST /api/invitations/accept`, outside `/api/auth`. Can it still set the cookie?**
A: Yes. `Path` controls where the browser **sends** the cookie, not which response may **set** it. Any response can set a cookie with `Path=/api/auth`.

### 8.6 Starting a session (shared by login, register, refresh, OAuth, accept invite)

Five endpoints end with "the user is now signed in". Write that once, `src/modules/auth/session-response.ts`:

```ts
import type { AuthResponse, User } from "@pulse/contracts";
import type { Response } from "express";
import { setRefreshCookie } from "../../auth/cookies.ts";
import { createSession } from "../../auth/sessions.ts";
import { issueAccessToken } from "../../auth/tokens.ts";

export const startSession = async (res: Response, user: User): Promise<AuthResponse> => {
  setRefreshCookie(res, await createSession(user.id));

  return { accessToken: await issueAccessToken(user.id), user };
};
```

### 8.7 The auth endpoints

| Endpoint | Behaviour |
|---|---|
| `POST /api/auth/register` | Parse `registerSchema`. If the email exists, `409 CONFLICT` with `fieldErrors.email = ["An account with this email already exists"]`. Hash the password. Role is **`owner` if this is the first user in the database**, otherwise `DEFAULT_SIGNUP_ROLE` (`viewer`). `startSession`, respond **201** with `AuthResponse`. |
| `POST /api/auth/login` | Rate limit (5 per minute per email). Parse `loginSchema`. Find user by email. If not found **or** no password hash **or** password wrong: `401 UNAUTHORIZED "Invalid email or password"`. `startSession`, respond 200 with `AuthResponse`. |
| `POST /api/auth/refresh` | Read the `pulse_refresh` cookie. No cookie, or `rotateSession` returns `null`: clear the cookie and `401 UNAUTHORIZED "Session expired"`. Otherwise set the new cookie, issue an access token, load the user, respond 200 with `AuthResponse`. |
| `POST /api/auth/logout` | If a cookie exists, `revokeSession`. Always clear the cookie. **204**. Public on purpose: logging out must work even with an expired access token. |
| `POST /api/auth/logout-all` | Authenticated. `revokeAllSessions(user.id)`, clear the cookie, **204**. |

```mermaid
sequenceDiagram
  participant B as Browser
  participant A as API
  participant DB as Database

  B->>A: POST /api/auth/login { email, password }
  A->>A: rate limit check (email)
  A->>DB: select user by lower(email)
  A->>A: argon2 verify
  A->>DB: insert session (hash of refresh token)
  A-->>B: 200 { accessToken, user } + Set-Cookie pulse_refresh
  B->>A: GET /api/monitors (Authorization: Bearer accessToken)
  A->>A: verify JWT, load user, check monitor:read
  A-->>B: 200 { items, ... }
  Note over B,A: 15 minutes later the access token expires
  B->>A: GET /api/monitors (expired token)
  A-->>B: 401 UNAUTHORIZED
  B->>A: POST /api/auth/refresh (cookie)
  A-->>B: 200 new accessToken + rotated cookie
  B->>A: retry GET /api/monitors
  A-->>B: 200
```

**Q: Why return the same message for "no such user" and "wrong password"?**
A: Different messages let an attacker discover which emails have accounts (**user enumeration**). One generic message reveals nothing.

**Q: Even with the same message, can timing reveal whether the user exists?**
A: Yes: "user not found" returns instantly, while "wrong password" spends ~50ms in argon2. To close that gap, when the user is not found, still run `verifyPassword` against a fixed dummy hash (create one at startup with `hashPassword("dummy")`) and discard the result.

**Q: Why does the first registered user become the owner?**
A: Someone has to own the workspace, and there is no admin to invite them. "First user is owner" is the standard bootstrap. Everyone after that signs up as a viewer or joins through an invitation with a chosen role.

### 8.8 Authenticating requests

Tell TypeScript that requests can carry a user. `src/types/express.d.ts`:

```ts
import type { User } from "@pulse/contracts";

declare global {
  namespace Express {
    interface Request {
      user?: User;
    }
  }
}

export {};
```

A helper that reads it safely, `src/auth/current-user.ts`:

```ts
import type { Request } from "express";
import { AppError } from "../lib/errors.ts";

export const currentUser = (req: Request) => {
  if (!req.user) {
    throw new AppError("UNAUTHORIZED", "Sign in to continue");
  }

  return req.user;
};
```

Handlers call `currentUser(req)` instead of `req.user!`. No non-null assertions.

**Q: The project forbids `namespace` because Node cannot strip it. Is `express.d.ts` a problem?**
A: No. `.d.ts` files contain only types; Node never executes them. `erasableSyntaxOnly` only applies to code that runs.

---

## 9. Authorization (RBAC)

### 9.1 Roles and permissions

The matrix is defined once in `packages/contracts/src/rbac/permissions.ts` (`rolePermissions`). You never re-type it in the backend; you call `hasPermission(role, permission)`.

| Permission | owner | admin | member | viewer |
|---|:-:|:-:|:-:|:-:|
| `monitor:read` | ✓ | ✓ | ✓ | ✓ |
| `monitor:write` | ✓ | ✓ | ✓ | |
| `webhook:read` | ✓ | ✓ | ✓ | ✓ |
| `webhook:write` | ✓ | ✓ | ✓ | |
| `alert-channel:read` | ✓ | ✓ | ✓ | ✓ |
| `alert-channel:write` | ✓ | ✓ | | |
| `incident:read` | ✓ | ✓ | ✓ | ✓ |
| `incident:manage` | ✓ | ✓ | ✓ | |
| `member:read` | ✓ | ✓ | ✓ | ✓ |
| `member:manage` | ✓ | ✓ | | |

### 9.2 The access guard

`src/auth/middleware.ts`:

```ts
import { type EndpointAccess, hasPermission } from "@pulse/contracts";
import type { Request, RequestHandler } from "express";
import { AppError } from "../lib/errors.ts";
import { findUserById } from "../modules/members/repository.ts";
import { toUser } from "../modules/members/mapper.ts";
import { readAccessToken } from "./tokens.ts";

const BEARER_PREFIX = "Bearer ";

const bearerToken = (req: Request) => {
  const header = req.get("authorization");

  return header?.startsWith(BEARER_PREFIX) ? header.slice(BEARER_PREFIX.length) : null;
};

const authenticate = async (req: Request) => {
  const token = bearerToken(req);
  const userId = token ? await readAccessToken(token) : null;
  const row = userId ? await findUserById(userId) : undefined;

  if (!row) {
    throw new AppError("UNAUTHORIZED", "Access token is missing or expired");
  }

  return toUser(row);
};

export const accessGuard =
  (access: EndpointAccess): RequestHandler =>
  async (req, _res, next) => {
    if (access === "public") {
      next();
      return;
    }

    const user = await authenticate(req);

    if (access !== "authenticated" && !hasPermission(user.role, access)) {
      throw new AppError("FORBIDDEN", `Your role is not allowed to perform ${access}`);
    }

    req.user = user;
    next();
  };
```

```mermaid
flowchart TD
  R["Request"] --> P{"access is public?"}
  P -- yes --> H["Handler"]
  P -- no --> T{"valid Bearer token<br/>and user exists?"}
  T -- no --> U["401 UNAUTHORIZED"]
  T -- yes --> A{"access is authenticated?"}
  A -- yes --> H
  A -- no --> HP{"hasPermission(role, access)?"}
  HP -- no --> F["403 FORBIDDEN"]
  HP -- yes --> H
```

**Q: 401 or 403, how do I choose?**
A: **401** means "I do not know who you are" (no token, bad token, expired token). The frontend reacts by refreshing the session. **403** means "I know who you are, and you are not allowed". The frontend shows "You don't have access". Mixing them up causes refresh loops (403 that should be 401) or silent logouts (401 that should be 403).

### 9.3 Rules that permissions alone cannot express

Permissions answer "can this role do this kind of action?". Some rules depend on **which record** is affected. These live in services:

| Rule | Where | Error |
|---|---|---|
| The owner can never be changed or removed | members service (update, delete) | `403 FORBIDDEN "The workspace owner cannot be changed or removed"` |
| You cannot change your own role or remove yourself | members service | `403 FORBIDDEN "You cannot change your own access"` |
| Nobody can be invited or promoted **to** owner | enforced by `assignableRoleSchema` in the contract | `400 VALIDATION_ERROR` |
| A disabled channel cannot send a test alert | alert-channels service | `409 CONFLICT "Enable the channel before sending a test alert"` |

The frontend also hides controls the user cannot use (for example, no role dropdown for a viewer). **That is a convenience, not security.** The server must enforce every rule, because anyone can call the API directly with `curl`.

---

## 10. Building resources (CRUD)

Build **monitors** first; every other resource follows the same four files.

### 10.1 Pagination helper

`src/lib/pagination.ts`:

```ts
import type { Paginated, PaginationQuery } from "@pulse/contracts";

export const pageWindow = ({ page, pageSize }: PaginationQuery) => ({
  limit: pageSize,
  offset: (page - 1) * pageSize,
});

export const toPage = <TItem>(items: TItem[], total: number, { page, pageSize }: PaginationQuery): Paginated<TItem> => ({
  items,
  page,
  pageSize,
  total,
});
```

### 10.2 Repository: only database queries

`src/modules/monitors/repository.ts`:

```ts
import type { CreateMonitorInput, MonitorListQuery, UpdateMonitorInput } from "@pulse/contracts";
import { and, count, desc, eq, ilike, inArray, or, type SQL } from "drizzle-orm";
import { db } from "../../db/client.ts";
import { monitorAlertChannels, monitors } from "../../db/schema/index.ts";
import { pageWindow } from "../../lib/pagination.ts";

type Transaction = Parameters<Parameters<typeof db.transaction>[0]>[0];

const listFilter = ({ status, search }: MonitorListQuery): SQL | undefined =>
  and(
    status ? eq(monitors.status, status) : undefined,
    search ? or(ilike(monitors.name, `%${search}%`), ilike(monitors.url, `%${search}%`)) : undefined,
  );

export const listMonitors = async (query: MonitorListQuery) => {
  const where = listFilter(query);
  const [rows, [{ total }]] = await Promise.all([
    db.select().from(monitors).where(where).orderBy(desc(monitors.createdAt)).limit(pageWindow(query).limit).offset(pageWindow(query).offset),
    db.select({ total: count() }).from(monitors).where(where),
  ]);

  return { rows, total };
};

export const findMonitor = async (id: string) => {
  const [row] = await db.select().from(monitors).where(eq(monitors.id, id));
  return row;
};

export const channelIdsByMonitor = async (monitorIds: string[]) => {
  const links = monitorIds.length
    ? await db.select().from(monitorAlertChannels).where(inArray(monitorAlertChannels.monitorId, monitorIds))
    : [];
  const byMonitor = new Map<string, string[]>(monitorIds.map((id) => [id, []]));

  links.forEach((link) => byMonitor.get(link.monitorId)?.push(link.channelId));

  return byMonitor;
};

const replaceChannels = async (tx: Transaction, monitorId: string, channelIds: string[]) => {
  await tx.delete(monitorAlertChannels).where(eq(monitorAlertChannels.monitorId, monitorId));

  if (channelIds.length) {
    await tx.insert(monitorAlertChannels).values(channelIds.map((channelId) => ({ monitorId, channelId })));
  }
};

export const insertMonitor = ({ alertChannelIds, ...values }: CreateMonitorInput) =>
  db.transaction(async (tx) => {
    const [row] = await tx.insert(monitors).values(values).returning();
    await replaceChannels(tx, row.id, alertChannelIds);
    return row;
  });

export const updateMonitorRow = (id: string, { alertChannelIds, ...values }: UpdateMonitorInput) =>
  db.transaction(async (tx) => {
    const [row] = await tx
      .update(monitors)
      .set({ ...values, updatedAt: new Date() })
      .where(eq(monitors.id, id))
      .returning();

    if (row && alertChannelIds) {
      await replaceChannels(tx, id, alertChannelIds);
    }

    return row;
  });

export const deleteMonitorRow = async (id: string) => {
  const [row] = await db.delete(monitors).where(eq(monitors.id, id)).returning();
  return row;
};
```

**Q: Why two queries for a list (rows + count)?**
A: The frontend needs `total` to show "Showing 1-20 of 57" and to know whether there is a next page. Running both with `Promise.all` keeps it to one round trip of wall-clock time. Both use the same `where` so they always agree.

**Q: Why load channel ids with one `inArray` query instead of one query per monitor?**
A: Querying once per row is the classic **N+1 problem**: 20 monitors would cost 21 queries. One `IN (...)` query fetches all links for the page, then you group them in memory.

**Q: Is `ilike` with `%search%` safe from SQL injection?**
A: Yes. Drizzle sends `search` as a bound parameter, never concatenated into SQL. (It cannot use a normal index because of the leading `%`; fine at this scale. For large tables you would add a `pg_trgm` index.)

**Q: Why does creating a monitor need a transaction?**
A: It writes two tables. If the monitor insert succeeds but the channel links fail (say, an unknown channel id violates the foreign key), the transaction rolls back and no half-created monitor is left behind.

### 10.3 Service: business rules

`src/modules/monitors/service.ts`:

```ts
import type { CreateMonitorInput, Monitor, MonitorListQuery, UpdateMonitorInput } from "@pulse/contracts";
import { notFound } from "../../lib/errors.ts";
import { toPage } from "../../lib/pagination.ts";
import { assertChannelsExist } from "../alert-channels/service.ts";
import { removeIncidentsForSource, renameIncidentSource } from "../incidents/service.ts";
import { toMonitor } from "./mapper.ts";
import {
  channelIdsByMonitor,
  deleteMonitorRow,
  findMonitor,
  insertMonitor,
  listMonitors,
  updateMonitorRow,
} from "./repository.ts";

const LABEL = "Monitor";

const withChannels = async (rows: Awaited<ReturnType<typeof findMonitor>>[]) => {
  const present = rows.filter((row) => row !== undefined);
  const channels = await channelIdsByMonitor(present.map((row) => row.id));

  return present.map((row) => toMonitor(row, channels.get(row.id) ?? []));
};

const loadMonitor = async (id: string): Promise<Monitor> => {
  const [monitor] = await withChannels([await findMonitor(id)]);

  if (!monitor) {
    throw notFound(LABEL);
  }

  return monitor;
};

export const getMonitors = async (query: MonitorListQuery) => {
  const { rows, total } = await listMonitors(query);
  return toPage(await withChannels(rows), total, query);
};

export const getMonitor = loadMonitor;

export const createMonitor = async (input: CreateMonitorInput) => {
  await assertChannelsExist(input.alertChannelIds);
  const row = await insertMonitor(input);
  return loadMonitor(row.id);
};

export const updateMonitor = async (id: string, input: UpdateMonitorInput) => {
  await assertChannelsExist(input.alertChannelIds);
  const row = await updateMonitorRow(id, input);

  if (!row) {
    throw notFound(LABEL);
  }

  if (input.name) {
    await renameIncidentSource(id, input.name);
  }

  return loadMonitor(id);
};

export const deleteMonitor = async (id: string) => {
  const row = await deleteMonitorRow(id);

  if (!row) {
    throw notFound(LABEL);
  }

  await removeIncidentsForSource(id);
};
```

`assertChannelsExist(ids)` lives in the alert-channels service: if any id is unknown, throw `400 VALIDATION_ERROR` with `fieldErrors: { alertChannelIds: ["Unknown alert channel"] }`. Checking first gives a friendlier error than the foreign key violation would.

### 10.4 Routes: only HTTP

`src/modules/monitors/routes.ts`:

```ts
import {
  createMonitorSchema,
  idSchema,
  itemPath,
  monitorListQuerySchema,
  monitorSchema,
  paginatedSchema,
  resources,
  updateMonitorSchema,
} from "@pulse/contracts";
import { Router } from "express";
import { accessGuard } from "../../auth/middleware.ts";
import { sendJson, sendNoContent } from "../../lib/respond.ts";
import { parseWith } from "../../lib/validate.ts";
import { createMonitor, deleteMonitor, getMonitor, getMonitors, updateMonitor } from "./service.ts";

const { path, permissions } = resources.monitors;
const monitorPath = itemPath(resources.monitors);
const monitorPageSchema = paginatedSchema(monitorSchema);
const canRead = accessGuard(permissions.read);
const canWrite = accessGuard(permissions.write);

const monitorId = (params: Record<string, string>) => parseWith(idSchema, params.id, "Unknown monitor");

export const monitorsRouter = Router();

monitorsRouter.get(path, canRead, async (req, res) => {
  sendJson(res, monitorPageSchema, await getMonitors(parseWith(monitorListQuerySchema, req.query)));
});

monitorsRouter.get(monitorPath, canRead, async (req, res) => {
  sendJson(res, monitorSchema, await getMonitor(monitorId(req.params)));
});

monitorsRouter.post(path, canWrite, async (req, res) => {
  sendJson(res, monitorSchema, await createMonitor(parseWith(createMonitorSchema, req.body)), 201);
});

monitorsRouter.patch(monitorPath, canWrite, async (req, res) => {
  sendJson(res, monitorSchema, await updateMonitor(monitorId(req.params), parseWith(updateMonitorSchema, req.body)));
});

monitorsRouter.delete(monitorPath, canWrite, async (req, res) => {
  await deleteMonitor(monitorId(req.params));
  sendNoContent(res);
});
```

```mermaid
flowchart LR
  RT["routes.ts<br/>parse input, pick status code"] --> SV["service.ts<br/>rules, orchestration"]
  SV --> RP["repository.ts<br/>SQL via Drizzle"]
  SV --> MP["mapper.ts<br/>row to contract"]
  RP --> DB[("PostgreSQL")]
```

**Q: Why validate the `:id` param?**
A: `GET /api/monitors/not-a-uuid` would otherwise reach Postgres, which throws "invalid input syntax for type uuid", a 500. Parsing it with `idSchema` turns that into a clean 400.

**Q: Once monitors work, do I copy all four files for every resource?**
A: Copy the **shape**, not the code. After building two resources you will see what repeats (list with count, find-or-404, delete-or-404, the five route registrations). That is the right moment to extract helpers, for example a `registerCrudRoutes(router, resource, service)` function, the same idea as `crudHandlers` in `apps/web/src/mocks/lib/crud.ts`. Extracting before you have two real examples usually produces the wrong abstraction.

### 10.5 Per-resource notes

**Alert channels.** The API shape is `{ id, name, isEnabled, destination: { type, target }, createdAt }`. Store `type` and `target` as columns; build `destination` in the mapper. `PATCH` is partial: if `destination` is present, update both columns; otherwise leave them. The contract validates the target per type (email for `email`, http(s) URL for `slack` and `webhook`).

**Webhooks.** On create, generate a unique `slug` from the name plus a short random suffix (for example `stripe-events-3f9a1c`). The API's `ingestUrl` is **not stored**: the mapper builds it as `${APP_URL}/hooks/${slug}`. New webhooks start with `status: "pending"`, `eventCount: 0`, `lastReceivedAt: null`.

**Incidents.** Read-only through CRUD (list and detail). Status changes go through `POST /api/incidents/:id/:transition` where `:transition` is `acknowledge` or `resolve` (parse it with `incidentTransitionSchema`). Use the contract's `canTransitionIncident` (otherwise `409 CONFLICT "Cannot <transition> an incident that is <status>"`) and `applyIncidentTransition` to compute the new row. Incidents are **created** by the worker, never by the API.

**Members.** A member is a `users` row. `GET /api/members` lists users newest first. `PATCH /api/members/:id` changes the role (body `updateMemberSchema`). `DELETE /api/members/:id` deletes the user (sessions and linked accounts cascade). Apply the owner and self rules from [9.3](#93-rules-that-permissions-alone-cannot-express).

**Invitations.** See [section 15](#15-invitations-password-reset-and-oauth). Note that `DELETE /api/invitations/:id` means **revoke**: set `status = "revoked"`, keep the row, respond 204. Only `pending` invitations can be revoked (`409` otherwise).

---

## 11. Endpoint reference

Every endpoint the frontend calls. Paths are relative to `/api`. "Contract" names refer to exports of `@pulse/contracts`.

### 11.1 Auth and account

| Method + path | Access | Body | Success | Errors |
|---|---|---|---|---|
| `POST /auth/register` | public | `registerSchema` | 201 `AuthResponse` + cookie | 400 validation, 409 email taken |
| `POST /auth/login` | public | `loginSchema` | 200 `AuthResponse` + cookie | 400, 401 invalid credentials, 429 |
| `POST /auth/refresh` | public (cookie) | none | 200 `AuthResponse` + rotated cookie | 401 + cleared cookie |
| `POST /auth/logout` | public (cookie) | none | 204 + cleared cookie | none |
| `POST /auth/logout-all` | authenticated | none | 204 + cleared cookie | 401 |
| `POST /auth/password/forgot` | public | `forgotPasswordSchema` | **always** 204 | 400, 429 |
| `POST /auth/password/reset` | public | `resetPasswordSchema` | 204 | 400, 404 invalid or expired link |
| `POST /auth/oauth/:provider/authorize` | public, **authenticated when `intent` is `link`** | `oauthAuthorizeSchema` | 200 `OAuthAuthorizeResponse` | 404 unknown provider, 401 |
| `POST /auth/oauth/:provider/callback` | public | `oauthCallbackSchema` | 200 `OAuthCallbackResponse` + cookie | 401 invalid state or code |
| `PATCH /me` | authenticated | `updateProfileSchema` | 200 `User` | 400, 409 email taken |
| `POST /me/password` | authenticated | `changePasswordSchema` | 204 | 400 (`fieldErrors.currentPassword = ["Current password is incorrect"]`) |
| `GET /me/connections` | authenticated | none | 200 `LinkedAccount[]` | 401 |
| `DELETE /me/connections/:provider` | authenticated | none | 204 | 404 unknown provider |

`AuthResponse` is `{ accessToken, user }`. `OAuthCallbackResponse` adds `redirectTo`.

### 11.2 Resources

| Method + path | Access | Body / query | Success |
|---|---|---|---|
| `GET /monitors` | `monitor:read` | query `monitorListQuerySchema` (`page`, `pageSize`, `status`, `search`) | 200 `Paginated<Monitor>` |
| `GET /monitors/:id` | `monitor:read` | | 200 `Monitor` |
| `POST /monitors` | `monitor:write` | `createMonitorSchema` | 201 `Monitor` |
| `PATCH /monitors/:id` | `monitor:write` | `updateMonitorSchema` (partial, plus `isPaused`) | 200 `Monitor` |
| `DELETE /monitors/:id` | `monitor:write` | | 204 |
| `GET /monitors/:id/checks` | `monitor:read` | query `paginationQuerySchema` | 200 `Paginated<CheckResult>`, newest first |
| `GET /webhooks` | `webhook:read` | query `paginationQuerySchema` | 200 `Paginated<Webhook>` |
| `GET /webhooks/:id` | `webhook:read` | | 200 `Webhook` |
| `POST /webhooks` | `webhook:write` | `createWebhookSchema` | 201 `Webhook` |
| `PATCH /webhooks/:id` | `webhook:write` | `updateWebhookSchema` | 200 `Webhook` |
| `DELETE /webhooks/:id` | `webhook:write` | | 204 |
| `GET /webhooks/:id/events` | `webhook:read` | query `paginationQuerySchema` | 200 `Paginated<WebhookEvent>`, newest first |
| `GET /alert-channels` | `alert-channel:read` | query `paginationQuerySchema` | 200 `Paginated<AlertChannel>` |
| `GET /alert-channels/:id` | `alert-channel:read` | | 200 `AlertChannel` |
| `POST /alert-channels` | `alert-channel:write` | `createAlertChannelSchema` | 201 `AlertChannel` |
| `PATCH /alert-channels/:id` | `alert-channel:write` | `updateAlertChannelSchema` (partial) | 200 `AlertChannel` |
| `DELETE /alert-channels/:id` | `alert-channel:write` | | 204 |
| `POST /alert-channels/:id/test` | `alert-channel:write` | | 204 (409 if disabled) |
| `GET /incidents` | `incident:read` | query `incidentListQuerySchema` (`status`) | 200 `Paginated<Incident>`, newest `startedAt` first |
| `GET /incidents/:id` | `incident:read` | | 200 `Incident` |
| `POST /incidents/:id/:transition` | `incident:manage` | | 200 `Incident` (409 invalid transition) |
| `GET /members` | `member:read` | query `paginationQuerySchema` | 200 `Paginated<User>` |
| `GET /members/:id` | `member:read` | | 200 `User` |
| `PATCH /members/:id` | `member:manage` | `updateMemberSchema` | 200 `User` (403 owner or self) |
| `DELETE /members/:id` | `member:manage` | | 204 (403 owner or self) |
| `GET /invitations` | `member:manage` | query `invitationListQuerySchema` (`status`) | 200 `Paginated<Invitation>` |
| `GET /invitations/:id` | `member:manage` | | 200 `Invitation` |
| `POST /invitations` | `member:manage` | `createInvitationSchema` | 201 `Invitation` (409 already member or already invited) |
| `DELETE /invitations/:id` | `member:manage` | | 204 (revoke; 409 if not pending) |
| `GET /invitations/preview/:token` | public | | 200 `InvitationPreview` (404 invalid or expired) |
| `POST /invitations/accept` | public | `acceptInvitationSchema` | 201 `AuthResponse` + cookie |
| `GET /dashboard/summary` | `monitor:read` | | 200 `DashboardSummary` |

### 11.3 Outside `/api`

| Method + path | Access | Behaviour |
|---|---|---|
| `ANY /hooks/:slug` | public, rate limited | Records a webhook event (see [12.6](#126-webhook-ingest-and-silence-detection)). Responds **202** with no body. Unknown slug: 404. |

### 11.4 Dashboard summary

`GET /api/dashboard/summary` returns aggregate numbers. Compute them with SQL aggregates, not by loading rows:

| Field | How |
|---|---|
| `monitors.total` | `count(*)` from monitors |
| `monitors.paused` | count where `is_paused` |
| `monitors.byStatus` | `count(*) group by status`; fill every `monitorStatusSchema.options` key, missing ones as 0 |
| `webhooks.total`, `webhooks.byStatus` | same idea with webhooks and `webhookStatusSchema.options` |
| `openIncidents` | count where `status = 'open'` |
| `averageResponseTimeMs` | `round(avg(last_response_time_ms))` over monitors **not paused**, `null` if none |
| `uptimePercent` | `avg(uptime_percent)` over monitors not paused, `null` if none |

**Q: The contract says `byStatus` is a record with every status. Why fill zeros?**
A: `GROUP BY` only returns groups that have rows. If no monitor is `down`, the `down` key would be missing and the response would fail the contract. Start from `Object.fromEntries(monitorStatusSchema.options.map((status) => [status, 0]))` and overwrite with the query results.

---

## 12. Background jobs and cron

### 12.1 What runs in the background

| Job | Trigger | What it does |
|---|---|---|
| `dispatch-due-checks` | every 15 seconds (job scheduler) | Finds monitors whose next check is due and enqueues one `run-check` job per monitor |
| `run-check` | enqueued by the dispatcher | Calls the monitor's URL, stores a check result, updates the monitor, opens or resolves incidents |
| `detect-silent-webhooks` | every 60 seconds | Marks webhooks that have not received an event within their window as `silent` and opens an incident |
| `send-alert` | enqueued when an incident opens or resolves, or by "test alert" | Delivers one notification to one alert channel, with retries |
| `cleanup` | daily at 03:00 (cron pattern) | Deletes old check results and expired sessions and reset tokens |

```mermaid
flowchart LR
  subgraph Redis
    Q1[["checks queue"]]
    Q2[["alerts queue"]]
    Q3[["maintenance queue"]]
  end
  SCH["Job schedulers<br/>(stored in Redis)"] -- every 15s --> Q1
  SCH -- every 60s --> Q3
  SCH -- daily 03:00 --> Q3
  Q1 --> W1["checks worker"]
  W1 -- "run-check jobs" --> Q1
  W1 -- "incident opened / resolved" --> Q2
  Q3 --> W3["maintenance worker"]
  W3 -- "webhook went silent" --> Q2
  API["API: test alert"] --> Q2
  Q2 --> W2["alerts worker"]
  W2 --> OUT["Email / Slack / Webhook"]
```

**Q: Why not use `setInterval` in the server?**
A: `setInterval` lives inside one process. Run two API instances and every check runs twice; restart the server and scheduled work is lost; a failed check is never retried. BullMQ stores schedules and jobs **in Redis**, so they survive restarts, run exactly once across many workers, and retry with backoff on failure.

**Q: What is a "job scheduler" in BullMQ?**
A: A repeatable job definition stored in Redis: "create a `dispatch-due-checks` job every 15 seconds". `upsertJobScheduler` creates it or updates it if it already exists, so calling it on every worker start is safe and never duplicates.

### 12.2 Redis connection and queues

`src/lib/redis.ts`:

```ts
import { Redis } from "ioredis";
import { env } from "../config/env.ts";

export const createRedisConnection = () => new Redis(env.REDIS_URL, { maxRetriesPerRequest: null });

export const redis = createRedisConnection();
```

`src/jobs/queues.ts`:

```ts
import { Queue } from "bullmq";
import { createRedisConnection } from "../lib/redis.ts";

const connection = createRedisConnection();

export const QUEUES = {
  checks: "checks",
  alerts: "alerts",
  maintenance: "maintenance",
} as const;

export const checksQueue = new Queue(QUEUES.checks, { connection });
export const alertsQueue = new Queue(QUEUES.alerts, { connection });
export const maintenanceQueue = new Queue(QUEUES.maintenance, { connection });
```

**Q: Why `maxRetriesPerRequest: null`?**
A: BullMQ workers keep blocking connections open to wait for jobs. BullMQ requires this setting so ioredis does not give up on those long-waiting commands.

### 12.3 The worker process

`src/jobs/schedulers.ts`:

```ts
import { checksQueue, maintenanceQueue } from "./queues.ts";

export const registerSchedulers = async () => {
  await checksQueue.upsertJobScheduler("dispatch-due-checks", { every: 15_000 }, { name: "dispatch-due-checks" });
  await maintenanceQueue.upsertJobScheduler("detect-silent-webhooks", { every: 60_000 }, { name: "detect-silent-webhooks" });
  await maintenanceQueue.upsertJobScheduler("cleanup", { pattern: "0 3 * * *" }, { name: "cleanup" });
};
```

`src/worker.ts`:

```ts
import { Worker } from "bullmq";
import { QUEUES } from "./jobs/queues.ts";
import { registerSchedulers } from "./jobs/schedulers.ts";
import { processAlertJob } from "./jobs/workers/alerts.ts";
import { processCheckJob } from "./jobs/workers/checks.ts";
import { processMaintenanceJob } from "./jobs/workers/maintenance.ts";
import { createRedisConnection } from "./lib/redis.ts";
import { logger } from "./lib/logger.ts";

await registerSchedulers();

const workers = [
  new Worker(QUEUES.checks, processCheckJob, { connection: createRedisConnection(), concurrency: 20 }),
  new Worker(QUEUES.alerts, processAlertJob, { connection: createRedisConnection(), concurrency: 10 }),
  new Worker(QUEUES.maintenance, processMaintenanceJob, { connection: createRedisConnection() }),
];

workers.forEach((worker) =>
  worker.on("failed", (job, error) => logger.error({ job: job?.name, err: error }, "Job failed")),
);

logger.info("Worker started");
```

Each processor receives a job and switches on `job.name`, for example `processCheckJob` handles both `dispatch-due-checks` and `run-check`.

### 12.4 Checking monitors

**Dispatching due checks.** A monitor is due when it is not paused and it was never checked, or `last_checked_at + interval_seconds <= now()`:

```ts
import { and, eq, isNull, lte, or, sql } from "drizzle-orm";

export const findDueMonitors = () =>
  db
    .select({ id: monitors.id, intervalSeconds: monitors.intervalSeconds })
    .from(monitors)
    .where(
      and(
        eq(monitors.isPaused, false),
        or(
          isNull(monitors.lastCheckedAt),
          lte(sql`${monitors.lastCheckedAt} + make_interval(secs => ${monitors.intervalSeconds})`, sql`now()`),
        ),
      ),
    );
```

Enqueue with a **deterministic job id** so a slow check is never enqueued twice:

```ts
const dispatchDueChecks = async () => {
  const due = await findDueMonitors();
  const now = Date.now();

  await checksQueue.addBulk(
    due.map((monitor) => ({
      name: "run-check",
      data: { monitorId: monitor.id },
      opts: {
        jobId: `${monitor.id}-${Math.floor(now / (monitor.intervalSeconds * 1000))}`,
        removeOnComplete: true,
        removeOnFail: 100,
      },
    })),
  );
};
```

**Q: How does the job id prevent duplicates?**
A: BullMQ ignores `add` when a job with the same id already exists. The id contains the monitor id and the current "interval bucket" (time divided by interval). Within one interval the id is always the same, so if the dispatcher runs again before the previous check finished, nothing new is added.

**Running one check.** The HTTP call:

```ts
type CheckOutcome = { outcome: "up" | "down" | "degraded"; statusCode: number | null; responseTimeMs: number; errorMessage: string | null };

const DEGRADED_RATIO = 0.5;

export const runHttpCheck = async (monitor: MonitorRow): Promise<CheckOutcome> => {
  const startedAt = performance.now();

  try {
    const response = await fetch(monitor.url, {
      method: monitor.method,
      signal: AbortSignal.timeout(monitor.timeoutMs),
      redirect: "follow",
    });
    const responseTimeMs = Math.round(performance.now() - startedAt);

    if (response.status !== monitor.expectedStatusCode) {
      return {
        outcome: "down",
        statusCode: response.status,
        responseTimeMs,
        errorMessage: `Expected HTTP ${monitor.expectedStatusCode}, got ${response.status}`,
      };
    }

    const isSlow = responseTimeMs > monitor.timeoutMs * DEGRADED_RATIO;

    return {
      outcome: isSlow ? "degraded" : "up",
      statusCode: response.status,
      responseTimeMs,
      errorMessage: isSlow ? "Response slower than threshold" : null,
    };
  } catch (error) {
    return {
      outcome: "down",
      statusCode: null,
      responseTimeMs: Math.round(performance.now() - startedAt),
      errorMessage: error instanceof DOMException && error.name === "TimeoutError" ? `Timed out after ${monitor.timeoutMs} ms` : "Connection failed",
    };
  }
};
```

Then, in one transaction:

1. Insert the `check_results` row.
2. Recompute `uptime_percent` over the last 24 hours: `100 * count(outcome <> 'down') / count(*)`.
3. Update the monitor: `status = outcome`, `last_checked_at = now()`, `last_response_time_ms`, `uptime_percent`.

After the transaction, apply the incident rules below.

**Q: Why classify "slow" as degraded instead of down?**
A: The service answered correctly, just slowly. Users want to know (a payment API at 2 seconds is a problem) but it is a different severity from "not responding". The rule "slower than half the timeout" is a simple, explainable default; you could later make it a per-monitor setting.

**Q: Is it safe to `fetch` any URL a user enters?**
A: In a real product this is a **Server-Side Request Forgery (SSRF)** risk: a user could point a monitor at `http://169.254.169.254/` (cloud metadata) or internal services. For a learning project on your machine it is fine. For production, resolve the hostname and refuse private, loopback and link-local IP ranges before connecting.

### 12.5 Incident lifecycle

```mermaid
stateDiagram-v2
  [*] --> open: check is down or degraded,<br/>webhook went silent
  open --> acknowledged: user clicks Acknowledge
  open --> resolved: source recovers, or user resolves
  acknowledged --> resolved: source recovers, or user resolves
  resolved --> [*]
```

Rules for the worker, after each check (and after each webhook silence or recovery):

| Source state | Active incident (open or acknowledged) exists? | Action |
|---|---|---|
| down / degraded / silent | no | Insert incident (`status: open`, `cause` = the check's error message or "No events received within <duration>"), enqueue `send-alert` (event `incident.opened`) for every **enabled** channel linked to the source |
| down / degraded / silent | yes | Nothing. Do not alert again for the same incident. |
| up / event received | yes | Apply `applyIncidentTransition(incident, "resolve", now)`, enqueue `send-alert` (event `incident.resolved`) |
| up / event received | no | Nothing |

If the insert hits the `incidents_one_active_per_source` unique index (another job won the race), catch the `23505` error and do nothing: the incident already exists. That is idempotency in practice.

### 12.6 Webhook ingest and silence detection

The ingest router, `src/modules/webhooks/ingest-routes.ts`:

```ts
import express, { Router } from "express";
import { rateLimit } from "../../lib/rate-limit.ts";
import { recordWebhookEvent } from "./ingest-service.ts";

const RAW_BODY_LIMIT = "1mb";

export const ingestRouter = Router();

const flattenHeaders = (headers: express.Request["headers"]) =>
  Object.fromEntries(
    Object.entries(headers).map(([name, value]) => [name, Array.isArray(value) ? value.join(", ") : (value ?? "")]),
  );

ingestRouter.all(
  "/:slug",
  rateLimit({ name: "ingest", limit: 120, windowSeconds: 60, key: (req) => req.params.slug }),
  express.text({ type: () => true, limit: RAW_BODY_LIMIT }),
  async (req, res) => {
    await recordWebhookEvent(req.params.slug, {
      method: req.method,
      headers: flattenHeaders(req.headers),
      body: typeof req.body === "string" ? req.body : "",
      contentType: req.get("content-type") ?? null,
      sourceIp: req.ip ?? "unknown",
    });
    res.status(202).end();
  },
);
```

`recordWebhookEvent` (service): find the webhook by slug (404 if missing), then in a transaction insert the event and update the webhook (`event_count = event_count + 1`, `last_received_at = now()`, `status = 'active'`). If the webhook **was** `silent`, resolve its active incident and send a recovery alert.

**Q: Why respond `202 Accepted` instead of 200?**
A: 202 means "received, will be processed". Webhook senders only care that you got it. Responding fast matters because many senders time out after a few seconds and retry, which would create duplicate events.

`detect-silent-webhooks` (maintenance worker): select webhooks where `expected_interval_seconds is not null`, `status <> 'silent'`, and `coalesce(last_received_at, created_at) + make_interval(secs => expected_interval_seconds) < now()`. For each one, set `status = 'silent'` and open an incident with cause `"No events received within <duration>"`.

### 12.7 Sending alerts

Job data: `{ channelId, event: "incident.opened" | "incident.resolved" | "test", incidentId? }`. Enqueue with retries:

```ts
await alertsQueue.add("send-alert", data, {
  attempts: 5,
  backoff: { type: "exponential", delay: 5_000 },
  removeOnComplete: true,
});
```

The processor loads the channel (skip if deleted or disabled), builds a message, and delivers by type:

| Type | Delivery |
|---|---|
| `email` | Development: log the message. Production: send with an email provider or SMTP (for local testing, run [Mailpit](https://mailpit.axllent.org) in Docker and use `nodemailer`). |
| `slack` | `POST` the Slack incoming-webhook URL with JSON `{ "text": "🔴 Legacy SOAP gateway is down: Connection failed" }` |
| `webhook` | `POST` the target URL with JSON `{ "event": "incident.opened", "incident": { ...Incident } }` |

If delivery throws (network error, non-2xx), let the error propagate: BullMQ retries with exponential backoff (5s, 10s, 20s, ...).

`POST /api/alert-channels/:id/test` checks the channel exists and is enabled, enqueues a `send-alert` job with event `test`, and responds 204 immediately.

**Q: Why one job per channel instead of one job per incident?**
A: If Slack is down but email works, a single job would fail and retry, re-sending the email every time. One job per channel isolates failures: each delivery retries independently.

### 12.8 Cleanup

The daily `cleanup` job deletes:

- `check_results` older than 30 days
- `sessions` that expired or were revoked more than 7 days ago
- used or expired `password_reset_tokens`

**Q: Why delete old check results at all?**
A: A monitor checking every 30 seconds writes 2,880 rows a day. Ten monitors for a year is over 10 million rows nobody looks at. A **retention policy** keeps the table, its indexes and your backups small. Uptime only uses the last 24 hours and the chart the last 50 checks.

---

## 13. Caching

### 13.1 Cache-aside

The pattern you will use is **cache-aside** (also called lazy loading):

```mermaid
flowchart TD
  R["Request needs data"] --> G{"In Redis?"}
  G -- "yes (hit)" --> RET["Return cached value"]
  G -- "no (miss)" --> DB["Load from PostgreSQL"]
  DB --> S["Store in Redis with a TTL"]
  S --> RET
  W["A write changes the data"] --> INV["Delete the cache key"]
```

`src/lib/cache.ts`:

```ts
import { redis } from "./redis.ts";

export const cached = async <TValue>(key: string, ttlSeconds: number, load: () => Promise<TValue>) => {
  const hit = await redis.get(key);

  if (hit !== null) {
    return JSON.parse(hit) as TValue;
  }

  const value = await load();
  await redis.set(key, JSON.stringify(value), "EX", ttlSeconds);

  return value;
};

export const invalidate = (...keys: string[]) => redis.del(...keys);
```

### 13.2 What to cache in Pulse

| Data | Key | TTL | Invalidate when |
|---|---|---|---|
| Dashboard summary | `dashboard:summary` | 30 s | A monitor, webhook or incident is created, updated or deleted; a check changes a monitor's status |
| The authenticated user (looked up on every request) | `user:<id>` | 60 s | Their role, name or email changes, or they are removed |

Use it in the dashboard service: `getSummary = () => cached("dashboard:summary", 30, computeSummary)`. In every service that writes monitors, webhooks or incidents (including the worker), call `invalidate("dashboard:summary")`.

**Q: If I invalidate on every write, why have a TTL?**
A: Defence in depth. If you ever forget an invalidation (it will happen), stale data heals itself within 30 seconds instead of staying wrong forever.

**Q: The dashboard is cheap to compute. Why cache it at all?**
A: It is polled by every open tab (the sidebar badge and header status pill use it on every page) and it runs several aggregate queries. It is the textbook "read often, changes rarely, slightly stale is fine" case, which is what caching is for. Do **not** cache things where stale data is harmful, like "is this session revoked".

**Q: Why use `as TValue` in `cached`?**
A: `JSON.parse` returns `unknown`-like data. The cast trusts that what you wrote is what you read back, which holds because only `cached` writes these keys. If you want to be strict, pass a zod schema and parse instead (the contract schemas work for this).

---

## 14. Rate limiting

### 14.1 Fixed-window counter in Redis

```mermaid
sequenceDiagram
  participant C as Client
  participant A as API
  participant R as Redis

  C->>A: POST /api/auth/login
  A->>R: INCR rate:login:olivia@pulse.dev (+ EXPIRE 60 if new)
  R-->>A: 6
  A-->>C: 429 RATE_LIMITED, Retry-After: 41
```

`src/lib/rate-limit.ts`:

```ts
import type { Request, RequestHandler } from "express";
import { AppError } from "./errors.ts";
import { redis } from "./redis.ts";

type RateLimitOptions = {
  name: string;
  limit: number;
  windowSeconds: number;
  key: (req: Request) => string;
};

export const rateLimit =
  ({ name, limit, windowSeconds, key }: RateLimitOptions): RequestHandler =>
  async (req, _res, next) => {
    const redisKey = `rate:${name}:${key(req)}`;
    const [[, hits], [, ttl]] = (await redis.multi().incr(redisKey).ttl(redisKey).exec()) as [
      [null, number],
      [null, number],
    ];

    if (ttl === -1) {
      await redis.expire(redisKey, windowSeconds);
    }

    if (hits > limit) {
      throw new AppError("RATE_LIMITED", "Too many attempts.", {
        retryAfterSeconds: ttl > 0 ? ttl : windowSeconds,
      });
    }

    next();
  };
```

### 14.2 Where to apply it

| Route | Limit | Key | Why |
|---|---|---|---|
| `POST /api/auth/login` | 5 per minute | lowercased email from the body | Stops password guessing against one account |
| `POST /api/auth/login` | 20 per minute | `req.ip` | Stops guessing across many accounts from one machine |
| `POST /api/auth/password/forgot` | 3 per minute | lowercased email | Stops email bombing someone's inbox |
| `POST /api/auth/register` | 10 per hour | `req.ip` | Stops mass account creation |
| `ANY /hooks/:slug` | 120 per minute | slug | Protects the database from a runaway sender |
| everything under `/api` | 300 per minute | `req.ip` | General abuse protection |

For body-based keys, read the raw value safely, before validation: `key: (req) => String(req.body?.email ?? "").toLowerCase()`.

**Q: Why use `MULTI` (a transaction) for `INCR` and `TTL`?**
A: Both commands run atomically together, so the count and remaining time you read belong to the same moment. `INCR` itself is atomic, which is why counters in Redis are safe even with many API instances.

**Q: What is the weakness of a fixed window?**
A: A client can send 5 requests at 0:59 and 5 more at 1:01: 10 requests in 2 seconds. A **sliding window** (a sorted set of timestamps) or a **token bucket** smooths that out. Fixed windows are simple and good enough for login protection; implement a sliding window as a stretch goal.

**Q: Why must the response include `Retry-After`?**
A: The frontend reads it and tells the user exactly how long to wait ("Too many attempts. Try again in 41s."). It is also the standard signal well-behaved API clients use to back off.

---

## 15. Invitations, password reset and OAuth

### 15.1 Invitations

```mermaid
sequenceDiagram
  participant Ad as Admin (browser)
  participant A as API
  participant DB as Database
  participant N as New member (browser)

  Ad->>A: POST /api/invitations { email, role }
  A->>DB: email not a user? no pending invite?
  A->>DB: insert invitation (pending, expires in 7 days)
  A-->>Ad: 201 Invitation (with inviteUrl)
  Note over Ad,N: Admin shares the link (or you email it)
  N->>A: GET /api/invitations/preview/:token
  A->>A: verify HMAC, load invitation, resolve status
  A-->>N: 200 { email, role, invitedBy, expiresAt }
  N->>A: POST /api/invitations/accept { token, name, password }
  A->>DB: create user with the invited email + role, mark invitation accepted
  A-->>N: 201 AuthResponse + refresh cookie (signed in)
```

**The token.** `src/modules/invitations/token.ts`:

```ts
import { createHmac, timingSafeEqual } from "node:crypto";
import { env } from "../../config/env.ts";

const sign = (invitationId: string) => createHmac("sha256", env.INVITE_SECRET).update(invitationId).digest("base64url");

export const invitationToken = (invitationId: string) => `${invitationId}.${sign(invitationId)}`;

export const readInvitationToken = (token: string) => {
  const [invitationId, signature] = token.split(".");

  if (!invitationId || !signature) {
    return null;
  }

  const expected = Buffer.from(sign(invitationId));
  const received = Buffer.from(signature);

  return expected.length === received.length && timingSafeEqual(expected, received) ? invitationId : null;
};
```

The mapper builds `inviteUrl` as `${APP_URL}/invite/${invitationToken(row.id)}` and sets `status` with the contract's `resolveInvitationStatus(row, new Date().toISOString())`, which reports `expired` for pending invitations past `expiresAt`.

| Step | Rules |
|---|---|
| Create | Email already belongs to a user: `409 CONFLICT "Email already in use"`, `fieldErrors.email = ["An account with this email already exists"]`. A pending, unexpired invitation exists for that email: `409 CONFLICT "Already invited"`, `fieldErrors.email = ["An invitation is already pending for this email"]`. Otherwise insert with `expires_at = now + INVITATION_TTL_DAYS`. In development, log the invite link; later, email it. |
| List | Filter `status` on the **resolved** status, so `?status=pending` excludes expired ones. |
| Preview | Invalid signature, unknown id, or resolved status not `pending`: `404 "This invitation is invalid or has expired"`. |
| Accept | Same checks as preview, then in one transaction: create the user (`email` and `role` from the invitation, hashed password, `name` from the body), set the invitation `accepted`. `startSession`, respond 201. |
| Revoke | `DELETE /api/invitations/:id`: only `pending` can be revoked (`409` otherwise). Set `revoked`. 204. |

**Q: Why is `timingSafeEqual` used instead of `===`?**
A: `===` stops at the first different character, so response timing can leak how many leading characters were right, letting an attacker guess a signature byte by byte. `timingSafeEqual` always compares every byte.

### 15.2 Password reset

```mermaid
sequenceDiagram
  participant U as User
  participant A as API
  participant DB as Database

  U->>A: POST /api/auth/password/forgot { email }
  A->>A: rate limit (3/min per email)
  A->>DB: user exists? create token (store sha256), expires in 30 min
  A-->>U: 204 (always, even if the email is unknown)
  Note over A: Development: log "Password reset link for <email>: <APP_URL>/reset-password?token=..."
  U->>A: POST /api/auth/password/reset { token, password }
  A->>DB: find unused, unexpired token by sha256(token)
  A->>DB: set new password hash, mark token used, revoke all sessions
  A-->>U: 204
```

- Unknown, used or expired token: `404 NOT_FOUND "This reset link is invalid or has expired"`.
- **Revoke all sessions** after a reset. If someone reset a password because their account was compromised, the attacker's sessions must die too.

**Q: Why respond 204 even when the email does not exist?**
A: Same as login: a different response would reveal which emails have accounts.

### 15.3 Account settings

| Endpoint | Rules |
|---|---|
| `PATCH /api/me` | If the new email belongs to **another** user: `409 "Email already in use"` with `fieldErrors.email`. Invalidate the `user:<id>` cache. Respond with the updated `User`. |
| `POST /api/me/password` | Verify `currentPassword`; wrong: `400 VALIDATION_ERROR "Current password is incorrect"` with `fieldErrors.currentPassword = ["Current password is incorrect"]`. The contract already rejects a new password equal to the current one. Hash and save. Optionally revoke the user's **other** sessions. 204. |
| `GET /api/me/connections` | The user's `linked_accounts` as `LinkedAccount[]`. |
| `DELETE /api/me/connections/:provider` | Remove the link. Recommended extra rule: if the user has **no password** and this is their only linked account, refuse with `409` ("Set a password before disconnecting your only sign-in method"), otherwise they could lock themselves out. |

### 15.4 OAuth (GitHub and Google)

The frontend never talks to GitHub or Google APIs directly. The backend creates the authorization URL, and later exchanges the code. The frontend just redirects the browser and relays the code back.

```mermaid
sequenceDiagram
  participant B as Browser (Pulse frontend)
  participant A as API
  participant R as Redis
  participant P as GitHub / Google

  B->>A: POST /api/auth/oauth/github/authorize { intent: "sign-in", redirectTo }
  A->>R: SET oauth:state:<state> { provider, intent, redirectTo, codeVerifier, userId? } EX 600
  A-->>B: 200 { authorizationUrl }
  B->>P: full-page redirect to authorizationUrl
  P->>B: user approves, redirect to APP_URL/oauth/callback/github?code=...&state=...
  B->>A: POST /api/auth/oauth/github/callback { code, state }
  A->>R: GETDEL oauth:state:<state>
  A->>P: exchange code (+ code_verifier) for an access token
  A->>P: fetch profile (id, email, name)
  A->>A: find or create the user, link the account
  A-->>B: 200 { accessToken, user, redirectTo } + refresh cookie
```

**Authorize** (`POST /api/auth/oauth/:provider/authorize`):

1. Parse `:provider` with `oauthProviderSchema` (404 otherwise) and the body with `oauthAuthorizeSchema`.
2. If `intent` is `"link"`, the user must be signed in: authenticate the request and remember `userId`.
3. Generate `state` (32 random bytes, base64url) and a PKCE `codeVerifier` (32 random bytes); `codeChallenge = base64url(sha256(codeVerifier))`.
4. Store `{ provider, intent, redirectTo: redirectTo ?? (intent === "link" ? "/settings" : "/"), codeVerifier, userId }` in Redis under `oauth:state:<state>` with a 10-minute expiry.
5. Return `{ authorizationUrl }` built from the provider table below, with `redirect_uri = ${APP_URL}/oauth/callback/${provider}`.

**Callback** (`POST /api/auth/oauth/:provider/callback`):

1. `GETDEL` the state from Redis (single use). Missing, or provider mismatch: `401 "OAuth state or code is invalid"`.
2. Exchange the code at the provider's token endpoint (include `code_verifier` for Google).
3. Fetch the profile: provider account id, a **verified** email, and a name.
4. **Link intent:** insert a `linked_accounts` row for `userId` (if that provider account already belongs to another user: `409`).
5. **Sign-in intent:** find the user by `(provider, providerAccountId)`; otherwise by verified email (then link it); otherwise create a user with no password and `DEFAULT_SIGNUP_ROLE`, and link it.
6. `startSession` and respond `{ accessToken, user, redirectTo }`.

| | GitHub | Google |
|---|---|---|
| Register the app | GitHub → Settings → Developer settings → OAuth Apps | Google Cloud Console → APIs & Services → Credentials → OAuth client ID (Web application) |
| Callback URL to register | `http://localhost:5173/oauth/callback/github` | `http://localhost:5173/oauth/callback/google` |
| Authorization URL | `https://github.com/login/oauth/authorize` | `https://accounts.google.com/o/oauth2/v2/auth` |
| Scopes | `read:user user:email` | `openid email profile` |
| Token endpoint | `POST https://github.com/login/oauth/access_token` (send header `Accept: application/json`) | `POST https://oauth2.googleapis.com/token` |
| Profile | `GET https://api.github.com/user` and `GET https://api.github.com/user/emails` (pick the primary, verified email) | `GET https://openidconnect.googleapis.com/v1/userinfo` (`sub`, `email`, `email_verified`, `name`) |

**Q: What does `state` protect against?**
A: **Login CSRF**: an attacker could otherwise trick your browser into completing *their* OAuth flow, signing you into their account. The state value is random, single-use and stored server-side, so only a flow your own server started can complete.

**Q: And PKCE?**
A: It binds the authorization code to the session that requested it. Even if someone intercepts the `code` in the redirect, they cannot exchange it without the `code_verifier`, which never left your server.

**Q: Why only link by email when it is verified?**
A: If a provider let someone sign up with an unverified email, that person could claim `owner@pulse.dev` on the provider and take over your owner account by "signing in". Verified emails only.

**Q: I do not want to set up OAuth apps yet. Will I get blocked?**
A: No. OAuth is the last milestone and everything else works without it. The frontend's GitHub and Google buttons simply fail with an error toast until you implement these two endpoints.

---

## 16. Connecting the frontend

1. **Point the frontend at your server.** In `apps/web/.env.development`:

   ```bash
   VITE_API_URL=/api
   VITE_API_MOCKING=false
   API_PROXY_TARGET=http://localhost:3000
   ```

2. **Proxy the webhook ingest path too.** In `apps/web/vite.config.ts`, the `server.proxy` block only forwards `/api`. Add `/hooks` next to it so ingest URLs work in development:

   ```ts
   proxy: {
     "/api": { target: env.API_PROXY_TARGET ?? "http://localhost:3000", changeOrigin: true },
     "/hooks": { target: env.API_PROXY_TARGET ?? "http://localhost:3000", changeOrigin: true },
   },
   ```

3. **Run everything** (four terminals, or one terminal with `&`):

   ```bash
   docker compose up -d
   pnpm --filter api dev
   pnpm --filter api worker
   pnpm --filter web dev
   ```

4. **Seed and sign in.** Run `pnpm --filter api db:seed`, open `http://localhost:5173`, sign in as `owner@pulse.dev` / `password123`.

Switch `VITE_API_MOCKING` back to `true` at any time to compare your server's behaviour against the mock.

**Q: The frontend still shows the mock's demo-accounts box on the login page. Is that a problem?**
A: It only appears when mocking is enabled. With `VITE_API_MOCKING=false` it disappears.

**Q: How do I send a test webhook?**
A: Copy an endpoint's ingest URL from the Webhooks page, then:

```bash
curl -X POST "http://localhost:5173/hooks/stripe-events-3f9a1c" \
  -H "Content-Type: application/json" \
  -d '{"type":"invoice.paid","amount":1200}'
```

The event appears on the webhook's detail page.

---

## 17. Testing

### 17.1 Test database

Create a separate database so tests never touch your dev data:

```bash
docker compose exec postgres createdb -U pulse pulse_test
```

`apps/api/.env.test` is the same as `.env` but with `DATABASE_URL=postgres://pulse:pulse@localhost:5432/pulse_test`.

`apps/api/vitest.config.ts`:

```ts
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    setupFiles: ["./src/test/setup.ts"],
    fileParallelism: false,
  },
});
```

`src/test/setup.ts`:

```ts
process.loadEnvFile(".env.test");

const { migrate } = await import("drizzle-orm/postgres-js/migrator");
const { db, sql } = await import("../db/client.ts");

await migrate(db, { migrationsFolder: "./src/db/migrations" });

const { beforeEach, afterAll } = await import("vitest");

beforeEach(async () => {
  await sql`truncate users, monitors, webhooks, alert_channels, incidents, invitations restart identity cascade`;
});

afterAll(async () => {
  await sql.end();
});
```

**Q: Why the dynamic `await import(...)`?**
A: Static imports are hoisted and would read `process.env` before `loadEnvFile` runs. Importing after loading the env file guarantees `config/env.ts` sees the test database URL.

### 17.2 What to test

| Kind | Example | Why |
|---|---|---|
| Unit | `runHttpCheck` classifies a 500 as `down` and a slow 200 as `degraded`; incident rules open once and resolve on recovery | Fast, no database, covers the trickiest logic |
| Integration (HTTP) | Login then `GET /api/monitors` returns 200; a viewer gets 403 on `POST /api/monitors`; a bad body returns 400 with `fieldErrors` | Proves routes, auth, RBAC, validation and the error envelope together |
| Contract | Every response passes its contract schema (already enforced by `sendJson`) | The frontend will not break |

An integration test, `src/modules/monitors/routes.test.ts`:

```ts
import type { AddressInfo } from "node:net";
import { afterAll, beforeAll, expect, it } from "vitest";
import { createApp } from "../../app.ts";

let baseUrl = "";
const server = createApp().listen(0);

beforeAll(() => {
  baseUrl = `http://localhost:${(server.address() as AddressInfo).port}/api`;
});

afterAll(() => {
  server.close();
});

const register = async () => {
  const response = await fetch(`${baseUrl}/auth/register`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name: "Test Owner", email: "owner@test.dev", password: "password123" }),
  });
  const body = await response.json();
  return body.accessToken as string;
};

it("rejects an invalid monitor with field errors", async () => {
  const accessToken = await register();
  const response = await fetch(`${baseUrl}/monitors`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${accessToken}` },
    body: JSON.stringify({ name: "", url: "not-a-url" }),
  });
  const body = await response.json();

  expect(response.status).toBe(400);
  expect(body.error.code).toBe("VALIDATION_ERROR");
  expect(body.error.fieldErrors).toHaveProperty("url");
});
```

---

## 18. Build order and milestones

Build in this order. Each milestone ends with something you can **see working**, so you always know you are on track.

| # | Milestone | Done when |
|---|---|---|
| 0 | Docker up, `apps/api` created, env validated | `pnpm --filter api dev` prints "API listening"; a missing env var fails with a clear zod message |
| 1 | App skeleton: error envelope, 404 handler, logger | `curl localhost:3000/api/nope` returns `404` with `{ "error": { "code": "NOT_FOUND", ... } }` |
| 2 | Database schema, first migration, Drizzle Studio | `pnpm db:migrate` succeeds; tables visible in `pnpm db:studio` |
| 3 | Register, login, refresh, logout | Frontend (with `VITE_API_MOCKING=false`) can register, sign in, reload the page and stay signed in, and sign out |
| 4 | Access guard + members endpoints | Team page lists users; role changes work; a viewer sees read-only UI and gets 403 from `curl` |
| 5 | Alert channels CRUD | Create, edit, toggle and delete channels from the UI |
| 6 | Monitors CRUD + check history endpoint | Create and edit monitors (with channels) from the UI; detail page loads |
| 7 | Seed script | `db:seed` fills demo data; the app looks like it did with the mock |
| 8 | Worker: dispatcher + `run-check` | New monitors turn `up`/`down` within a minute; check history and chart fill in |
| 9 | Incidents: worker rules + list + transitions | Point a monitor at `https://httpbin.org/status/500`: an incident opens; acknowledge and resolve work from the UI |
| 10 | Alerts worker + test alert | "Send test alert" posts to a real Slack incoming webhook (or logs for email) |
| 11 | Webhooks CRUD + ingest + silence detection | `curl` an ingest URL and see the event; set a 60-second silence window and watch it go `silent` |
| 12 | Dashboard summary + caching | Dashboard numbers match the data; Redis shows `dashboard:summary` (`redis-cli get dashboard:summary`) |
| 13 | Rate limiting | Six fast wrong logins show "Too many attempts. Try again in Ns." |
| 14 | Invitations | Invite from the Team page; open the link in a private window; accept and land signed in |
| 15 | Password reset + account settings | Forgot password logs a link; reset works; profile and password changes work |
| 16 | OAuth | "Continue with GitHub" signs you in; Settings can connect and disconnect providers |
| 17 | Tests | `pnpm --filter api test` passes |

**Q: I am stuck on a milestone. What should I compare against?**
A: Flip `VITE_API_MOCKING=true`, perform the same action in the browser with DevTools open (Network tab), and compare the request and response with what your server does. The mock shows the exact shapes, status codes and headers the frontend expects.

---

## 19. Troubleshooting

**The frontend shows "Unable to reach the server".**
Your API is not running on the port in `API_PROXY_TARGET`, or it crashed at startup (read its terminal). Check `curl localhost:3000/api/auth/refresh -X POST`; you should get a `401` JSON envelope.

**Login works but reloading the page signs me out.**
The refresh cookie is not being set or sent. In DevTools → Application → Cookies, look for `pulse_refresh` on `localhost:5173`. Common causes: `secure: true` in development (cookies over HTTP are dropped), a `path` other than `/api/auth`, or calling the API on `localhost:3000` directly instead of through the Vite proxy.

**Every request returns 401, even right after login.**
Check that the frontend sends `Authorization: Bearer ...` (it does) and that you read it with `req.get("authorization")`. Make sure `JWT_SECRET` is the same in the process that issues and the one that verifies tokens.

**I get an infinite refresh loop.**
Something returns `401` for a reason other than "bad token", such as a permission check. Permission failures must be `403`.

**`ERR_UNSUPPORTED_TYPESCRIPT_SYNTAX` or a similar Node error at startup.**
You used syntax Node cannot strip: `enum`, `namespace` in a `.ts` file, constructor parameter properties, or a relative import without `.ts`. Run `pnpm --filter api typecheck`; `erasableSyntaxOnly` points at the exact line.

**`invalid input syntax for type uuid`.**
An id from the URL reached Postgres unvalidated. Parse route params with `idSchema` first.

**Drizzle cannot find the env variable during `db:generate`.**
`drizzle.config.ts` must call `process.loadEnvFile(".env")`, and you must run the command from `apps/api` (or through `pnpm --filter api`).

**The worker does nothing.**
It is a separate process: is `pnpm --filter api worker` running? Is Redis up? Use `redis-cli keys "bull:*"` to see queues and job schedulers.

**Checks run twice.**
Two dispatchers enqueue the same monitor: make sure jobs use the deterministic `jobId` from [12.4](#124-checking-monitors).

**A form shows no error but the request failed.**
Your `fieldErrors` keys do not match the request body keys. The frontend can only place errors under fields whose names match exactly.

**`409` when creating an incident in the worker.**
That is the partial unique index doing its job: an active incident already exists. Catch `23505` and continue.

---

## 20. Glossary

| Term | Meaning |
|---|---|
| Access token | Short-lived signed token proving who you are, sent in the `Authorization` header |
| Refresh token | Long-lived random token in an `httpOnly` cookie, exchanged for new access tokens |
| Rotation | Replacing the refresh token on every use and revoking the old one |
| RBAC | Role-based access control: permissions are granted to roles, roles to users |
| Contract | The shared schemas and endpoint map in `@pulse/contracts` |
| Mapper | A function that turns a database row into an API object |
| Repository | The module that holds the SQL for one domain |
| Service | The module that holds the business rules for one domain |
| Migration | A versioned SQL file that changes the database schema |
| Join table | A table that links two tables in a many-to-many relationship |
| Partial index | An index (often unique) that only covers rows matching a condition |
| Idempotent | Safe to run more than once with the same result |
| N+1 problem | Running one query per row instead of one query for all rows |
| Cache-aside | Read from cache; on miss, load from the database and store in cache |
| TTL | Time to live: how long a cached value or Redis key lasts |
| Fixed window | A rate-limit counter that resets at the end of each window |
| Job scheduler | A BullMQ definition that creates jobs on an interval or cron pattern |
| Backoff | Waiting longer between each retry of a failed job |
| PKCE | Proof Key for Code Exchange: binds an OAuth code to the client that requested it |
| SSRF | Server-side request forgery: making your server call internal addresses |
| User enumeration | Discovering which emails have accounts from differing responses |

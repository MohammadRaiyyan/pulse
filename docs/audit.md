# Pulse audit: security, logic and production readiness

Audit date: 2026-11-24. Scope: `apps/api`, `apps/web`, `packages/contracts` at commit `9c3d632`.

Each finding has an ID, a severity and a recommendation. Severity reflects impact in a real deployment:

| Severity | Meaning |
| -------- | ------- |
| Critical | Blocks a production launch. Data exposure, account takeover, or a core feature that does not work. |
| High     | Serious risk or a broken user expectation. Fix before launch. |
| Medium   | Real gap that users or operators will hit. Fix soon after launch. |
| Low      | Polish, hardening, or nice to have. |

## Summary

Pulse is well built at the core: authentication primitives, authorization checks, validation, transactions and the
background pipeline are sound and covered by 85 automated tests. It is **not ready for a public production launch**.
Four problems block it:

1. Anyone can sign up and read the whole workspace (S-01).
2. Accounts can be taken over through email-based OAuth linking (S-02, S-07).
3. The SSRF guard can be bypassed through redirects (S-03).
4. Email is never sent, so password reset, invitations and email alerts do not work (L-03).

Part 1 covers security, Part 2 covers feature logic and production readiness, and Part 3 is the rework plan.

The security findings come from an independent review of the code. Each was then verified against the source; file
references are to `apps/api/src` unless stated.

---

## Part 1: Security

### What is done correctly

- Passwords: Argon2id, with a dummy verify so unknown emails take the same time as wrong passwords.
- Access tokens: HS256 with the algorithm pinned, issuer checked, 15-minute lifetime, 32+ character secret, and immediate
  revocation after sign-out everywhere, password change or reset.
- Refresh tokens: 256-bit, stored as SHA-256, rotated atomically, family revoked on reuse, httpOnly SameSite=Lax cookie
  scoped to `/api/auth`. The access token lives in memory only. CORS is an allow-list. The CSRF posture is sound.
- Invitation tokens: HMAC-SHA256 with a separate secret, constant-time comparison, atomic single-use accept, owner is
  never assignable.
- OAuth: single-use state (`GETDEL`), PKCE S256, provider match, verified emails required from GitHub and Google.
- Every route has `requireAuth` plus the permission from the matrix; owner and self protections hold.
- All input is validated with zod; page size is capped at 100; malformed ids return 404.
- No SQL injection: every raw `sql` fragment interpolates only columns or bound parameters.
- Body limits (JSON 100 KB, ingest 1 MB), helmet, no `x-powered-by`, log redaction of auth headers and cookies.
- React renders webhook bodies, headers and names as text; there is no `dangerouslySetInnerHTML`.
- `.env` files are not tracked.

### Findings

| ID | Severity | Finding |
| -- | -------- | ------- |
| S-01 | Critical | Public sign-up joins the private workspace |
| S-02 | Critical | Account pre-hijacking and persistent takeover through OAuth email linking |
| S-03 | High | SSRF guard bypass through redirects, DNS rebinding and missing ranges |
| S-04 | High | Reset and invite tokens are written to logs |
| S-05 | High | Webhook ingest stores secrets and grows without limit |
| S-06 | Medium | Ingest URLs are guessable and guessing is not rate limited |
| S-07 | Medium | OAuth callback is not bound to the browser (login CSRF) |
| S-08 | Medium | Safety controls fail open when `NODE_ENV` is not `production` |
| S-09 | Medium | Client IP trust is hard-coded |
| S-10 | Low | Admins can demote or remove other admins |
| S-11 | Low | First-user race decides who becomes owner |
| S-12 | Low | Anyone can lock a user out of login |
| S-13 | Low | Reset tokens: concurrent use and siblings stay valid |
| S-14 | Low | No monitor quota or per-host limits |
| S-15 | Low | Open redirect after sign-in with a backslash path |
| S-16 | Low | Local Docker services exposed without authentication |

**S-01 (Critical) Public sign-up joins the private workspace.** `modules/auth/auth.service.ts:69-80` and
`modules/oauth/oauth.service.ts:129-139` give every new account the `viewer` role in the only workspace. A stranger can
read captured webhook headers (including senders' `Authorization` and cookies), Slack and webhook alert URLs (which act
as secrets), monitor URLs that may contain credentials, every member's email, and every ingest URL (which lets them
inject events). *Fix:* refuse sign-up and OAuth account creation once an owner exists (invite-only), or move to one
workspace per sign-up.

**S-02 (Critical) Account pre-hijacking and persistent takeover.** OAuth sign-in links to any existing account with the
same email (`modules/oauth/oauth.service.ts:129`), but local emails are never verified and `PATCH /api/me` changes the
email without the password (`modules/account/account.service.ts`). (a) An attacker registers `victim@corp.com` with a
password; when the real person later signs in with Google they are silently linked into the attacker's account, and any
role an admin grants "them" belongs to the attacker. (b) With a stolen access token an attacker changes the email to
their own Gmail, then links Google; the link survives password reset and sign-out everywhere. *Fix:* track
`email_verified`; link by email only to verified accounts; require the current password and a verification step to
change email; remove linked accounts on password reset.

**S-03 (High) SSRF guard bypass.** `lib/outbound-url.ts` checks only the first hostname, but checks use
`redirect: "follow"` (`modules/monitors/http-check.ts:32`) and alert delivery follows redirects by default, so a 302 to
`http://169.254.169.254/` passes. The name is resolved again by `fetch` after the check (DNS rebinding). The blocklist
misses `::`, `192.0.0.0/24`, `198.18.0.0/15`, `64:ff9b::/96`, multicast and `240.0.0.0/4`. The guard is off unless
`NODE_ENV=production`. Members can choose any method, and the stored status, timing and error type act as an internal
port scanner. *Fix:* validate the address actually connected to (undici `Agent` with `connect.lookup`), handle redirects
manually and validate each hop, use a complete special-purpose range check, and enforce the guard in every environment
with an explicit development opt-out.

**S-04 (High) Secrets in logs.** The full reset URL with its token (`modules/auth/auth.service.ts:177-180`) and invite
URLs (`modules/invitations/invitation.service.ts:111-114`) are logged at info level, and `pino-http` logs request URLs
for `/api/invitations/preview/:token`. Anyone with log access can reset any password or join with any role. *Fix:*
deliver tokens only by email; strip token paths in a pino serializer.

**S-05 (High) Webhook ingest stores secrets and grows without limit.** All sender headers, including `Authorization`,
`Cookie` and API keys, are stored (`modules/webhooks/ingest.controller.ts:4-20`) and shown to viewers. Events are never
deleted (`modules/maintenance/cleanup.service.ts`); at the allowed 120 requests per minute with 1 MB bodies one endpoint
can write about 170 GB a day, and listing 100 events can return about 100 MB. *Fix:* redact sensitive headers at
ingest, add retention and a per-endpoint cap, lower the body limit, and leave bodies out of list responses.

**S-06 (Medium) Guessable ingest URLs.** A slug is the name plus 24 random bits (`modules/webhooks/webhook.service.ts:43`),
and the rate limit is per slug, so guessing across slugs is unthrottled and each guess opens a locking transaction. A
found URL lets an attacker forge events, keep a dead job looking healthy, or exhaust its rate limit. *Fix:* 128-bit
random tokens and a per-IP limit on ingest.

**S-07 (Medium) OAuth login CSRF.** Any valid `state` is accepted (`modules/oauth/oauth.service.ts:150-166`) and the
frontend redeems `code` and `state` from the URL automatically. A crafted link signs the victim into the attacker's
account, and with `intent=link` attaches the victim's Google or GitHub identity to the attacker's user. *Fix:* set a
random nonce in an httpOnly SameSite cookie at authorize time and require it at callback.

**S-08 (Medium) Fail-open defaults.** `NODE_ENV` defaults to `development` (`config/env.ts`). In that mode the SSRF guard
is off, the refresh cookie is not `Secure`, 500 responses include internal error text, and the seed script can create
demo users with `password123`. *Fix:* require `NODE_ENV` explicitly, or tie each control to its own setting that
defaults to the safe value.

**S-09 (Medium) Hard-coded proxy trust.** `app.set("trust proxy", 1)` (`app.ts`). Exposed directly, `X-Forwarded-For` is
attacker-controlled and every IP rate limit can be bypassed; behind two proxies, all users share one rate-limit bucket.
*Fix:* make trusted proxies configurable and document the required value per deployment.

**S-10 (Low) Admins can strip other admins.** Only the owner and the actor are protected
(`modules/members/member.service.ts`). One compromised admin can demote or remove every other admin. *Fix:* only the
owner changes or removes admins.

**S-11 (Low) First-user race.** The user count and insert are not atomic (`auth.service.ts:70`, `oauth.service.ts:130`),
so two simultaneous sign-ups can both become owner, and whoever reaches a fresh deployment first owns it. *Fix:* bootstrap
the owner with a setup token or CLI command, and make the check atomic.

**S-12 (Low) Login lockout.** The 5-per-minute limit is per email only, so anyone can keep a user locked out. *Fix:* key
on email plus IP, with progressive backoff.

**S-13 (Low) Reset token gaps.** `completePasswordReset` does not re-check `used_at IS NULL`
(`modules/auth/password-reset.repository.ts`), so two simultaneous submissions both succeed, and other unexpired tokens
for the user stay valid after a reset. *Fix:* conditional update, and invalidate all of the user's tokens in the same
transaction.

**S-14 (Low) No abuse limits on checks.** No monitor quota or per-host concurrency. A member can aim many monitors at a
third party, or add slow targets that delay every other check (worker concurrency is 20). *Fix:* per-workspace quota and
per-host concurrency.

**S-15 (Low) Open redirect after sign-in.** `apps/web/src/features/auth/auth-search.ts` rejects `//evil.com` but accepts
`/\evil.com`, which browsers treat as `//evil.com`. The API's `relativePathSchema` also accepts `//`. *Fix:* allow only
paths matching `^/(?![/\\])` on both sides.

**S-16 (Low) Local infrastructure.** `docker-compose.yml` publishes PostgreSQL (`pulse:pulse`) and Redis (no password) on
all interfaces. Write access to Redis is an authentication bypass: a planted `cache:user:<id>` entry with `role: "owner"`
is trusted. *Fix:* bind to `127.0.0.1` locally; in production use managed services with authentication and TLS.

---


---

## Part 2: Feature logic and production readiness

For each feature: what makes sense, what does not, and what is missing compared with production monitoring tools.

### 2.1 Workspace and sign-up model

**What makes sense.** One workspace, four roles, the first account becomes owner, and teammates join by invitation.

**What does not make sense.**

- **L-01 (Critical) Anyone on the internet can join your workspace.** `POST /api/auth/register` and OAuth sign-in
  create a `viewer` in the single shared workspace (`auth.service.ts:70-75`, `oauth.service.ts:130-137`). A stranger who
  signs up can read every monitor URL, every captured webhook payload and header, every incident, and the email address of
  every team member. For a single-team product, public sign-up must be closed once the owner exists (invite-only), or the
  product must become multi-tenant so each sign-up gets its own workspace.
- **L-02 (Medium) No ownership transfer.** The owner can never be changed by anyone, including themself. If the owner
  leaves the company, the workspace has no path to a new owner.

**What is missing.** Multi-tenancy (organisations), leaving a workspace, an audit log of who changed what.

### 2.2 Authentication and account

**What makes sense.** Argon2id, short-lived JWT with rotating refresh cookie, reuse detection, immediate sign-out
everywhere, generic login errors, rate limits, single-use reset tokens, show/hide password.

**What does not make sense.**

- **L-03 (Critical) Password reset, invitations and email alerts never send email.** They are written to the server log
  (`auth.service.ts` `requestPasswordReset`, `invitation.service.ts`, `alert-delivery.service.ts`). In production a user
  who forgets their password cannot recover, and email alert channels silently do nothing while showing as enabled.
- **L-04 (High) Emails are never verified.** Sign-up, profile email changes and invitations accept any address. Combined
  with OAuth linking by email this enables account pre-hijacking (see the security section), and reset links can be sent
  to an address the user mistyped.
- **L-05 (Medium) GitHub and Google buttons show even when OAuth is not configured.** Clicking them returns an error.
  The API should expose which providers are enabled and the UI should hide the rest.

**What is missing.** Email verification, two-factor authentication, a list of active sessions with per-device sign-out,
account deletion, breached-password checks.

### 2.3 Monitors

**What makes sense.** URL, method, interval, timeout and expected status; pause and resume; 24-hour uptime; check
history; response-time chart; degraded state for slow responses.

**What does not make sense.**

- **L-06 (High) One failed check opens an incident and pages the team.** `monitor-check.service.ts:39-42` opens an
  incident on the first `down` or `degraded` result. A single network blip at 3 a.m. wakes someone up. Production tools
  confirm a failure with a retry or require N consecutive failures (configurable, default 2 or 3) before alerting.
- **L-07 (High) Degraded is treated the same as down.** A slow response opens the same incident and sends the same alert
  as an outage. There is no severity. Degraded should either not open incidents by default or open a lower-severity one.
- **L-08 (Medium) Deleting a monitor deletes its incident history.** `monitor.service.ts:91`. Incidents are the record of
  past outages; deleting the monitor should keep them (they already store `source_name`).
- **L-09 (Medium) Requests cannot carry headers or a body.** Most private health endpoints need an `Authorization` header,
  and a `POST` check without a body (the seeded "Legacy SOAP gateway") is not realistic.
- **L-10 (Medium) Only one exact status code is accepted.** No 2xx range, no list, no response-body keyword assertion.
- **L-11 (Low) A paused monitor keeps its open incident open.** Pausing should either resolve it or show it as paused.
- **L-12 (Low) Timing fields use raw seconds and milliseconds.** "Interval (seconds)", "Timeout (ms)" and a silence window
  of "604800" are hard to use. Use a number plus a unit, or presets.

**What is missing.** "Check now" button, configurable degraded threshold, multi-region checks, SSL certificate expiry
alerts, TCP, ping and DNS check types, 7, 30 and 90-day uptime and SLA reports, maintenance windows, tags and groups.

### 2.4 Webhooks

**What makes sense.** A unique ingest URL, raw payload capture with an inspector, and silence detection for jobs that
should report on a schedule (heartbeat monitoring).

**What does not make sense.**

- **L-13 (High) Captured events are never deleted.** The daily cleanup removes old checks, sessions and reset tokens but
  not `webhook_events` (`cleanup.service.ts`). A busy sender fills the database without limit.
- **L-14 (High) Senders' secrets are stored and shown to every viewer.** Ingest stores all request headers, including
  `Authorization`, signature and API-key headers (`ingest.controller.ts:19`), and any viewer can read them. Sensitive
  headers should be redacted or hidden behind a write permission.
- **L-15 (Medium) No signature verification.** Pulse cannot verify that an event really came from Stripe or GitHub, so
  anyone who learns the URL can inject events and keep a "silent" check green. See also the URL-entropy finding in the
  security section.

**What is missing.** Per-endpoint signing secrets (Stripe, GitHub, generic HMAC), event search and filtering, replay or
forward to another URL, a retention setting.

### 2.5 Incidents

**What makes sense.** Open, acknowledged and resolved states with enforced transitions; automatic open and resolve from
checks; one active incident per source.

**What does not make sense.**

- **L-16 (High) Nobody knows who acknowledged or resolved an incident.** The table stores only timestamps
  (`incident.model.ts`). On a team, "who is handling this?" is the main question.
- **L-17 (Medium) Acknowledged incidents disappear from the dashboard.** The dashboard card ("Issues that still need
  attention"), the header pill and the sidebar badge count only `open`. An acknowledged incident is still an outage.
  Count active incidents (open plus acknowledged) and show their state.
- **L-18 (Medium) Resolving an incident while the source is still down reopens it on the next check.** This is defensible
  but surprising. The UI should say so, or offer "resolve and pause".
- **L-19 (Low) The empty state says "Everything is operating normally" on every tab**, including an empty Resolved tab.

**What is missing.** Timeline and notes, severity, escalation and repeat notifications for unacknowledged incidents,
on-call schedules, MTTA and MTTR metrics, post-mortems.

### 2.6 Alert channels

**What makes sense.** Email, Slack and generic webhook channels; enable and disable; one delivery job per channel with
retries.

**What does not make sense.**

- **L-20 (High) "Test alert sent" is shown before anything is sent.** The API only queues the job; if delivery fails the
  user never finds out. Either deliver the test synchronously and report the result, or show delivery status.
- **L-21 (Medium) Delivery failures are invisible.** After five failed retries the job is dropped into Redis with no
  trace in the UI. Users believe they are covered when they are not. Record deliveries and show the last result per
  channel.
- **L-22 (Low) Outgoing webhooks are unsigned.** Receivers cannot verify that a request came from Pulse.

**What is missing.** A real email provider (see L-03), PagerDuty, Opsgenie, Microsoft Teams and Discord, one-click Slack
app install, per-channel event filters (outages only, recoveries too), quiet hours.

### 2.7 Team

**What makes sense.** Invitations with copyable links, role changes, removal, owner and self protection, immediate
effect of role changes.

**What does not make sense.**

- **L-23 (Low) The role description in the invite form is inaccurate.** It says "members edit monitors, viewers only
  read". Members also manage webhooks and incidents; admins also manage alert channels.

### 2.8 Dashboard and live data

- **L-24 (High) Nothing updates live.** A monitor going down only appears when the user navigates, refocuses the tab or
  changes something. For a monitoring product the dashboard must update by itself. Recommended: Server-Sent Events from
  the API, fed by Redis pub/sub from the worker, with the frontend invalidating the affected queries.

### 2.9 Product surface compared with production tools

Missing capabilities that users of uptime tools expect, roughly in order of value:

1. Public status page per workspace (the most visible feature of uptime products).
2. Integrations page: one place to connect Slack, PagerDuty, Teams, Discord and email, replacing raw alert channels.
3. Services: group monitors and webhooks into a service with its own status and owners.
4. Maintenance windows that suppress alerts.
5. Reports: uptime and response time over 7, 30 and 90 days, exportable.
6. Public API keys for automation (today only the browser session can call the API).

### 2.10 Operations

- **L-25 (High) No deployment artefacts.** No Dockerfiles, CI pipeline or production run book. Planned next.
- **L-26 (Medium) No observability beyond logs.** No metrics endpoint, error tracking or alerting on the worker itself.
  If the worker stops, nobody is told, which defeats the purpose of a monitoring tool. Add a worker heartbeat and expose
  queue depth and failed-job counts.
- **L-27 (Low) No API documentation.** The contracts package could generate an OpenAPI document.

---

## Part 3: Rework plan

Ordered so that each phase leaves the product shippable and tested. Every item ends with tests in the Vitest and
Playwright suites.

### Phase 1: Launch blockers

| Item | Findings |
| ---- | -------- |
| Invite-only workspace: close public sign-up and OAuth account creation after the owner exists; owner bootstrap via setup token | S-01, S-11, L-01 |
| Email delivery through a provider (SMTP or API) for password reset, invitations, verification and email alerts; stop logging tokens | L-03, S-04 |
| Email verification; link OAuth only to verified emails; password required to change email; OAuth state nonce cookie | S-02, S-07, L-04 |
| SSRF hardening: connect-time address validation, manual redirects, full range list, enforced in all environments | S-03 |
| Webhook ingest: redact sensitive headers, 128-bit tokens, per-IP limit, event retention and cap | S-05, S-06, L-13, L-14 |
| Fail-closed configuration and configurable proxy trust | S-08, S-09 |

### Phase 2: Correct alerting

| Item | Findings |
| ---- | -------- |
| Confirm failures before opening incidents (N consecutive failures, configurable) | L-06 |
| Severity: degraded does not page by default | L-07 |
| Record who acknowledged and resolved; incident timeline | L-16 |
| Count active (open plus acknowledged) incidents on the dashboard | L-17 |
| Delivery log per channel; real result for test alerts | L-20, L-21 |
| Keep incident history when a source is deleted | L-08 |
| Live updates with Server-Sent Events | L-24 |

### Phase 3: Production operations

| Item | Findings |
| ---- | -------- |
| Dockerfiles, CI/CD pipeline, migrations as a release step, run book | L-25 |
| Worker heartbeat, queue and failure metrics, error tracking | L-26 |
| Abuse limits: monitor quota, per-host concurrency, login backoff | S-12, S-14 |
| Small fixes: admin-on-admin rule, reset token race, redirect validation, copy fixes | S-10, S-13, S-15, L-19, L-23 |

### Phase 4: Product depth

Request headers and body for checks, status ranges and keyword assertions, "Check now", unit-friendly timing inputs,
OAuth provider discovery, webhook signature verification, public status page, integrations page, services, maintenance
windows, reports, API keys, ownership transfer, two-factor authentication.


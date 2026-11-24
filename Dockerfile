FROM node:26-bookworm-slim AS base
ENV PNPM_HOME=/pnpm \
    PATH=/pnpm:$PATH \
    CI=true
RUN npm install --global pnpm@12.21.0
WORKDIR /app

FROM base AS deps
COPY pnpm-lock.yaml pnpm-workspace.yaml package.json ./
RUN pnpm fetch --frozen-lockfile
COPY . .
RUN pnpm install --frozen-lockfile --offline

FROM deps AS web-build
ENV VITE_API_URL=/api \
    VITE_API_MOCKING=false
RUN pnpm --filter web build

FROM deps AS api-build
RUN rm -rf node_modules apps/*/node_modules packages/*/node_modules \
 && pnpm install --frozen-lockfile --offline --prod --filter api... \
 && find apps/api/src -name '*.test.ts' -delete \
 && rm -rf apps/api/src/test

FROM node:26-bookworm-slim AS api
RUN rm -rf /usr/local/lib/node_modules/npm /usr/local/lib/node_modules/corepack \
           /usr/local/bin/npm /usr/local/bin/npx /usr/local/bin/corepack \
           /usr/local/bin/yarn /usr/local/bin/yarnpkg /opt/yarn-*
ENV NODE_ENV=production \
    PORT=3000
WORKDIR /app
COPY --from=api-build /app/package.json ./package.json
COPY --from=api-build /app/node_modules ./node_modules
COPY --from=api-build /app/packages/contracts/package.json ./packages/contracts/package.json
COPY --from=api-build /app/packages/contracts/src ./packages/contracts/src
COPY --from=api-build /app/packages/contracts/node_modules ./packages/contracts/node_modules
COPY --from=api-build /app/apps/api/package.json ./apps/api/package.json
COPY --from=api-build /app/apps/api/node_modules ./apps/api/node_modules
COPY --from=api-build /app/apps/api/src ./apps/api/src
WORKDIR /app/apps/api
USER node
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD ["node", "-e", "fetch(`http://127.0.0.1:${process.env.PORT}/api/health/live`).then((r) => process.exit(r.ok ? 0 : 1), () => process.exit(1))"]
CMD ["node", "src/server.ts"]

FROM caddy:2.11-alpine AS web
RUN addgroup -S caddy \
 && adduser -S -D -H -G caddy caddy \
 && chown -R caddy:caddy /data /config
COPY deploy/Caddyfile /etc/caddy/Caddyfile
COPY --from=web-build /app/apps/web/dist /srv
ENV API_UPSTREAM=api:3000 \
    SITE_ADDRESS=localhost
USER caddy
EXPOSE 80 443 443/udp
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD ["wget", "-q", "-O", "/dev/null", "http://127.0.0.1:2019/config/"]
CMD ["caddy", "run", "--config", "/etc/caddy/Caddyfile", "--adapter", "caddyfile"]

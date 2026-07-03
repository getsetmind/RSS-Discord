FROM oven/bun:1.3.14-alpine AS deps
WORKDIR /src
COPY package.json bun.lock ./
RUN bun install --frozen-lockfile --production

FROM oven/bun:1.3.14-alpine
WORKDIR /app
COPY --from=deps /src/node_modules ./node_modules
COPY package.json bun.lock ./
COPY src ./src
VOLUME ["/app/logs", "/app/data"]
ENTRYPOINT ["bun", "src/cli.ts"]

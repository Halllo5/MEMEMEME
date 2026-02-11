FROM oven/bun:slim AS builder
WORKDIR /app
COPY package.json .
COPY bun.lock .
RUN bun install
COPY . .
RUN bun run build

# New Stage: Install production dependencies only
FROM oven/bun:slim AS prod-deps
WORKDIR /app
COPY package.json .
COPY bun.lock .
RUN bun install --production

# Final Stage
FROM oven/bun:slim
WORKDIR /app

# 1. Include package.json (Important for runtime metadata)
COPY --from=builder /app/package.json ./package.json

# 2. Include production node_modules
COPY --from=prod-deps /app/node_modules ./node_modules

COPY --from=builder /app/server ./server
COPY --from=builder /app/dist ./dist

ENV NODE_ENV=production
EXPOSE 3000

CMD ["bun", "/app/server/entry.bun.js"]

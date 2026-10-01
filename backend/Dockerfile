# Production image for the API and socket server
FROM node:22-alpine AS deps
WORKDIR /app
RUN corepack enable
COPY package.json pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile --prod

FROM node:22-alpine
WORKDIR /app
ENV NODE_ENV=production
COPY --from=deps /app/node_modules ./node_modules
COPY . .
USER node
EXPOSE 5000
HEALTHCHECK --interval=15s --timeout=3s --start-period=10s \
    CMD wget -qO- "http://127.0.0.1:${PORT:-5000}/healthz" > /dev/null || exit 1
CMD ["node", "server.js"]

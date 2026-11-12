FROM --platform=$BUILDPLATFORM node:24-bookworm-slim AS builder
WORKDIR /app

COPY package.json package-lock.json* ./
RUN npm ci

COPY tsconfig.json tsconfig.server.json vite.config.ts index.html ./
COPY public ./public
COPY src ./src

RUN npm run build

FROM node:24-bookworm-slim AS runner
WORKDIR /app

COPY package.json package-lock.json* ./
RUN npm ci --omit=dev && npm cache clean --force

COPY --from=builder /app/dist ./dist

RUN mkdir -p /app/data /app/data/projects /app/logs /app/temp

ENV NODE_ENV=production
ENV PORT=3000
ENV HOST=0.0.0.0
ENV CRONBASE_DATA_DIR=/app/data
ENV CRONBASE_LOGS_DIR=/app/logs
ENV CRONBASE_TEMP_DIR=/app/temp

VOLUME ["/app/data", "/app/logs"]
EXPOSE 3000

CMD ["node", "--max-old-space-size=192", "dist/server/index.js"]

# syntax=docker/dockerfile:1

# ---- builder ----
FROM node:20-bookworm-slim AS builder
WORKDIR /app

# Enable corepack (pnpm)
RUN corepack enable && corepack prepare pnpm@latest --activate

# Copy lockfiles first for better layer caching
COPY pnpm-lock.yaml pnpm-workspace.yaml package.json .npmrc* ./* ./
COPY packages/dnsweeper/package.json packages/dnsweeper/package.json

# Install workspace dependencies
RUN pnpm install --frozen-lockfile

# Copy the rest of the source
COPY . .

# Build CLI
RUN pnpm -C packages/dnsweeper run build

# Prune dev deps to reduce size
RUN pnpm prune --prod

# ---- runner ----
FROM gcr.io/distroless/nodejs20-debian12:nonroot AS runner
ENV NODE_ENV=production
WORKDIR /app

# Copy minimal runtime: node_modules (prod), package, dist, bin
COPY --from=builder /app/node_modules /app/node_modules
COPY --from=builder /app/packages/dnsweeper/dist /app/packages/dnsweeper/dist
COPY --from=builder /app/packages/dnsweeper/package.json /app/packages/dnsweeper/package.json
COPY --from=builder /app/packages/dnsweeper/bin /app/packages/dnsweeper/bin

# Default entrypoint runs the CLI (distroless runs as nonroot by default)
ENTRYPOINT ["/nodejs/bin/node", "packages/dnsweeper/dist/cli/index.js"]
CMD ["--help"]

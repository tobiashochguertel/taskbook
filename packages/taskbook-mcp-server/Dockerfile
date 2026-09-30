# Taskbook MCP Server — multi-stage Dockerfile
# Stage 1: Build standalone binary with bun build --compile
# Stage 2: Minimal runtime image (distroless-like)

FROM oven/bun:1.3-slim AS builder

WORKDIR /app

# Copy package files first for better caching
COPY packages/taskbook-mcp-server/package.json packages/taskbook-mcp-server/bun.lock* ./
RUN bun install --frozen-lockfile 2>/dev/null || bun install

# Copy source
COPY packages/taskbook-mcp-server/src ./src
COPY packages/taskbook-mcp-server/tsconfig.json ./

# Build standalone binary
RUN bun build src/index.ts --compile --outfile taskbook-mcp

# Stage 2: Minimal runtime
FROM gcr.io/distroless/cc-debian12:latest

COPY --from=builder /app/taskbook-mcp /usr/local/bin/taskbook-mcp

# Default to HTTP transport
ENV TB_MCP_TRANSPORT=http
ENV TB_MCP_HOST=0.0.0.0
ENV TB_MCP_PORT=3100

EXPOSE 3100

ENTRYPOINT ["/usr/local/bin/taskbook-mcp"]

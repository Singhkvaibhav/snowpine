# Multi-stage: the build toolchain never reaches the runtime image.
FROM node:20-slim AS deps
WORKDIR /app
COPY package*.json ./
# `npm ci` (not install): installs exactly the lockfile, so an image built
# today matches one built last month rather than silently picking up a new
# transitive dependency.
RUN npm ci --omit=dev

# --- Runtime -------------------------------------------------------------
FROM node:20-slim AS runtime

# curl is for the container healthcheck below. Nothing else is added.
RUN apt-get update && apt-get install -y --no-install-recommends curl \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .

# Run as an unprivileged user - the node image ships a `node` user for
# exactly this; the default is root, which means a remote-code-execution
# bug in any dependency becomes root in the container.
RUN chown -R node:node /app
USER node

ENV NODE_ENV=production
EXPOSE 4000

HEALTHCHECK --interval=30s --timeout=3s --start-period=20s --retries=3 \
  CMD curl -fsS http://localhost:4000/api/health || exit 1

CMD ["node", "server.js"]

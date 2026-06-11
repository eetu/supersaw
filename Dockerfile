# syntax=docker/dockerfile:1

# --- Stage 1: Build frontend (native, output is platform-independent) ---
FROM --platform=$BUILDPLATFORM node:26-alpine AS frontend-build
WORKDIR /app
COPY frontend/package.json frontend/yarn.lock frontend/.yarnrc.yml ./
COPY frontend/.yarn/releases ./.yarn/releases
# Yarn is vendored (.yarn/releases/*.cjs + yarnPath in .yarnrc.yml) and invoked
# via node — no corepack, so the build is independent of the node version
# (node 25+ dropped the bundled corepack; vendoring sidesteps that entirely).
RUN node .yarn/releases/yarn-*.cjs install --immutable --network-timeout 1000000
COPY frontend/ .
# adapter-static is configured to emit to ./dist (see svelte.config.js).
RUN node .yarn/releases/yarn-*.cjs build

# --- Stage 2: Runtime (nginx serving the static bundle) ---
# Browser-only app: all audio is client-side Web Audio, so there is no app
# backend — nginx serves the SPA with an index.html fallback and /status for
# liveness probes (the family's gatus contract).
FROM nginx:alpine AS runner
LABEL org.opencontainers.image.description="supersaw — browser synth: supersaw oscillator, ADSR, grid sequencer"
LABEL org.opencontainers.image.source="https://github.com/eetu/supersaw"

COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=frontend-build /app/dist /usr/share/nginx/html

EXPOSE 3013

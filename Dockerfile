# T150h (EPIC-014 F-11.3) — the application image.
#
# One image serving both `/v1` and the built web client on one origin
# (`R-014-1`). There is no second container for the client and no reverse
# proxy: the client assumes `/v1` is same-origin, `vite.config.ts`'s dev proxy
# makes that true in development, and here it simply IS true.
#
# Decisions this file implements, with the reasoning in ../specs/014-devops-release/research.md:
#   R-014-3  runs from source through `tsx` — NO compiler is added
#   R-014-4  Prisma Client is generated INSIDE the image, never copied in
#   R-014-6  the seed is never run here, and no credential is ever baked
#
# Conformance: tests/governance/container-secrets.spec.ts (T150a)

# --------------------------------------------------------------- base
# Debian slim rather than Alpine: Prisma's query engine needs OpenSSL and the
# glibc build is the better-trodden path. `R-014-4` keeps the default `native`
# binary target correct by generating in this same image, so the base choice
# stays a base choice rather than becoming a schema edit.
FROM node:22-bookworm-slim AS base

# OpenSSL is NOT optional and `-slim` does not carry it. Prisma's schema and
# query engines link against libssl, and without it the engine falls back to a
# guess and then fails:
#
#   prisma:warn Prisma failed to detect the libssl/openssl version to use…
#   Error: Schema engine error:
#   undefined
#
# — a diagnostic that names nothing. `R-014-4` identified the requirement and
# the first build did not act on it; the stack came up, the migration failed,
# and the API correctly refused to start (which is `R-014-5` working).
RUN apt-get update \
  && apt-get install -y --no-install-recommends openssl ca-certificates \
  && rm -rf /var/lib/apt/lists/*

ENV PNPM_HOME=/pnpm
ENV PATH="$PNPM_HOME:$PATH"
RUN corepack enable && corepack prepare pnpm@9.15.9 --activate
WORKDIR /app

# --------------------------------------------------------------- deps
# Manifests first, so a source-only change does not re-resolve the workspace.
FROM base AS deps
# `tsconfig.base.json` is not optional: every package's tsconfig extends
# `../tsconfig.base.json`, and vite resolves it while building `index.html`.
# Without it the client build fails with
# `failed to resolve "extends":"../tsconfig.base.json"` — a message that names
# the file but not the reason it is absent.
COPY pnpm-workspace.yaml pnpm-lock.yaml package.json tsconfig.base.json ./
COPY backend/package.json ./backend/
COPY frontend/package.json ./frontend/
COPY worker/package.json ./worker/
COPY e2e/package.json ./e2e/
COPY packages ./packages
COPY engine-adapters ./engine-adapters
COPY agent-adapters ./agent-adapters
COPY execution-providers ./execution-providers

# The Prisma schema is copied to ./backend/prisma with its structure PRESERVED,
# and BEFORE the install that triggers generation. Prisma's own deployment
# guidance calls out the wrong-path case specifically: copying the contents to
# the root leaves postinstall unable to find the schema, or generating it into
# the wrong place.
COPY backend/prisma ./backend/prisma

RUN pnpm install --frozen-lockfile

# --------------------------------------------------------------- client build
FROM deps AS client
COPY frontend ./frontend
RUN pnpm --filter @pmi/frontend build

# --------------------------------------------------------------- runtime
FROM deps AS runtime

# `prisma generate` runs HERE, in the image that will run it, so the default
# `native` binary target resolves against this platform (`R-014-4`). A client
# generated on a developer's machine and copied in is the classic way to ship a
# query engine that cannot load.
RUN pnpm --filter @pmi/backend exec prisma generate

COPY backend ./backend
COPY worker ./worker
COPY docker/entrypoint.sh ./docker/entrypoint.sh
RUN chmod +x ./docker/entrypoint.sh

# The built client, from the stage above. The API reads this path via
# CLIENT_DIST (see backend/src/app.module.ts).
COPY --from=client /app/frontend/dist ./client
ENV CLIENT_DIST=/app/client

# NOT set here, deliberately, and asserted by T150a:
#   DATABASE_URL, VALKEY_URL  — supplied by compose; they name a host this
#                               image knows nothing about
#   SEED_USER_PASSWORD        — never. The seed is a command a person runs
#                               (R-014-6), and backend/prisma/seed.ts throws
#                               without it rather than inventing one
#   AI_PROVIDER_TOKEN         — passed through from the developer's .env
ENV NODE_ENV=production
ENV PORT=3000
EXPOSE 3000

# `NODE_ENV=production` above is what the API runs under. Note that
# backend/prisma/seed.ts REFUSES to run under it — that refusal is the point,
# not an obstacle, and this image must never work around it.

ENTRYPOINT ["./docker/entrypoint.sh"]

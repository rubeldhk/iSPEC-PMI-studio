#!/bin/sh
# T150j (EPIC-014 F-11.3) — migrate, then start. In that order, and only in
# that order.
#
# `R-014-5`. Prisma's deployment guidance is explicit that migrations must
# complete before the app starts, "otherwise the app may hit errors when it
# queries a database that doesn't have the expected tables". `migrate deploy`
# only applies migration files — it does not read the schema to fetch models,
# detect drift, reset the database, or need a shadow database — which is what
# makes it safe to run unattended here.
#
# **The abort is half the requirement.** An API that starts against an
# unmigrated database does not fail; it runs, and answers 500 to everything.
# Whoever meets that sees a broken API rather than a missing migration, and
# looks in the wrong place. `set -e` is what keeps the failure where it belongs.
#
# Unit test: backend/tests/unit/core/entrypoint.spec.ts (T150d)

set -eu

echo "entrypoint: applying migrations"
pnpm --filter @pmi/backend exec prisma migrate deploy

# NO seed here, and that is deliberate (`R-014-6`). Seeding would mean this
# image carrying or inventing a credential, and backend/prisma/seed.ts exists
# to refuse exactly that: it throws without SEED_USER_PASSWORD and refuses
# NODE_ENV=production outright. Both refusals must survive containerisation.
# Seeding stays a command a person runs, with the password supplied then.

echo "entrypoint: starting the API on ${PORT:-3000}"
exec pnpm --filter @pmi/backend exec tsx src/main.ts

/**
 * T831 — the API's one Prisma client, created only when first asked for.
 *
 * Lazy on purpose, twice over:
 *
 * - `DATABASE_URL` is read when the client is CONSTRUCTED, so construction must
 *   wait until the composition root runs — a module-load-time client would
 *   capture whatever the environment held at import, which in tests is the
 *   runner's shell rather than the Testcontainers database (`T830` boots the
 *   real `AppModule` exactly this way).
 * - Unit suites import application modules without a database. A client that
 *   sprang to life on import would try to connect from tests that never touch
 *   persistence.
 *
 * One client, not one per adapter: each `PrismaClient` owns a connection pool,
 * and the number of adapters should not multiply the number of pools. The full
 * store-by-store composition (PrismaProjectStore and siblings, today bound to
 * their in-memory defaults) is EPIC-014's recorded deferral — this file gives
 * it the client to compose with.
 */
import { PrismaClient } from '@prisma/client';

let client: PrismaClient | undefined;

export function prismaClient(): PrismaClient {
  return (client ??= new PrismaClient());
}

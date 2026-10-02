/**
 * EPIC-045 `DEF-045-001` — the request body limit.
 *
 * The framework's default JSON limit is about 100 KB. One governed command's
 * finish hook sends the Epic's whole markdown set in one request, and a real
 * Epic's four core files alone run past 110 KB, so with the default nothing an
 * Epic actually produces could be synced. The per-file limit
 * (`PMI_ARTIFACT_MAX_BYTES`, 1 MiB) and the per-sync file count
 * (`PMI_ARTIFACT_MAX_FILES`, 200) were both documented while the transport
 * refused anything above 100 KB before either was consulted.
 *
 * ## One limit for the API, from configuration
 *
 * `PMI_ARTIFACT_SYNC_BODY_BYTES` (default 16 MiB) is the JSON body limit for the
 * whole API. It is global rather than per route because the body parser runs
 * before routing and before authentication, and the routes that could carry a
 * large body are exactly the ones whose limits this Epic already configures.
 * A body above it is refused as `413 payload_too_large` by `ErrorFilter`,
 * never as a 500.
 *
 * Both `main.ts` and the test helper that composes the application call this,
 * so the limit an integration test observes is the limit a deployment gets.
 */
import type { NestExpressApplication } from '@nestjs/platform-express';

export const DEFAULT_SYNC_BODY_BYTES = 16 * 1024 * 1024;

/** A positive integer from the environment, or the default — never zero, which would refuse everything. */
export function syncBodyLimitBytes(): number {
  const raw = process.env['PMI_ARTIFACT_SYNC_BODY_BYTES'];
  if (raw === undefined) return DEFAULT_SYNC_BODY_BYTES;
  const value = Number(raw);
  return Number.isSafeInteger(value) && value > 0 ? value : DEFAULT_SYNC_BODY_BYTES;
}

/**
 * Install the body parsers with the configured limit. The application must be
 * created with `bodyParser: false`, or the framework's default parser runs
 * first and this one never sees the body.
 */
export function configureBodyParsing(app: NestExpressApplication): void {
  app.useBodyParser('json', { limit: syncBodyLimitBytes() });
  app.useBodyParser('urlencoded', { extended: true, limit: '100kb' });
}

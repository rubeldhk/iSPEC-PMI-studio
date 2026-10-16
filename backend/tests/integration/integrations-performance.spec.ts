/**
 * `T2222` (EPIC-039, `R-039-15`, `R-039-18`) — the Hub's performance targets,
 * measured against PostgreSQL through the composed `AppModule`.
 *
 * | Measure | Target | Measured as |
 * |---|---|---|
 * | resolution decision | p95 < 40 ms | `hub.resolver.resolve` — catalog, registry, configuration, credential presence, derived health, one policy read |
 * | request overhead | p95 < 120 ms | `hub.requests.request` end to end against `fixture-ci`, whose provider time is ~0 — so the figure **bounds** the overhead from above |
 * | `embed()` overhead | p95 < 15 ms | `HubEmbeddingPort.embed` bound to `fixture-embed` (provider time ~0), one deployment-scope resolution recorded per call |
 * | JUnit parse | < 2 s at 20,000 cases | `parseJUnitArtifact` on a stored zip of one 20,000-case report |
 * | registry read | p95 < 250 ms at 50 entries | `GET /integrations/registry?projectId=` over HTTP |
 * | entry detail | p95 < 350 ms | `GET /integrations/registry/:id?projectId=` with 100 health rows and ≥ 50 resolutions |
 *
 * 50 iterations each after 5 warm-up calls. **The `EPIC-031` convention**: a
 * p95 above its target but within 25 % is *reported* (printed, and named in the
 * closing report), not failed; beyond 25 % it fails. The figures are printed so
 * the closing report records what was measured rather than that a test passed.
 * On a shared machine (another agent's Testcontainers) a miss is re-run alone
 * before anything is concluded from it.
 */
import { performance } from 'node:perf_hooks';
import { crc32 } from 'node:zlib';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { parseJUnitArtifact } from '@pmi/capability-adapter-github';
import { startIntegrationsApp, type IntegrationsApp } from '../helpers/integrations-app.js';

const noRuntime = process.env['DOCKER_UNAVAILABLE'] === '1';
const suite = noRuntime ? describe.skip : describe;
const WS = 'ws_perf_hub';
const SHA = 'c'.repeat(40);
const ITERATIONS = 50;
const WARMUP = 5;
const TOLERANCE = 1.25;

const figures: Record<string, { p95: number; target: number; verdict: string }> = {};

function p95(samples: number[]): number {
  const sorted = [...samples].sort((a, b) => a - b);
  return sorted[Math.min(sorted.length - 1, Math.ceil(sorted.length * 0.95) - 1)]!;
}

async function measure(fn: () => Promise<unknown>): Promise<number> {
  for (let i = 0; i < WARMUP; i++) await fn();
  const samples: number[] = [];
  for (let i = 0; i < ITERATIONS; i++) {
    const start = performance.now();
    await fn();
    samples.push(performance.now() - start);
  }
  return p95(samples);
}

/** Within target: pass. Within 25 % over: pass and REPORT. Beyond: fail. */
function judge(name: string, value: number, target: number): void {
  const verdict = value < target ? 'met' : value < target * TOLERANCE ? 'MISSED within 25% — reported, not blocking' : 'MISSED beyond 25%';
  figures[name] = { p95: Math.round(value * 10) / 10, target, verdict };
  expect(value, `${name}: p95 ${value.toFixed(1)} ms against ${target} ms (${verdict})`).toBeLessThan(target * TOLERANCE);
}

/** A stored (uncompressed) zip of one file — enough for the parser, with no zip library in the backend. */
function storedZip(name: string, content: string): Uint8Array {
  const data = Buffer.from(content, 'utf8');
  const file = Buffer.from(name, 'utf8');
  const crc = crc32(data) >>> 0;
  const local = Buffer.alloc(30);
  local.writeUInt32LE(0x04034b50, 0);
  local.writeUInt16LE(20, 4);
  local.writeUInt32LE(crc, 14);
  local.writeUInt32LE(data.length, 18);
  local.writeUInt32LE(data.length, 22);
  local.writeUInt16LE(file.length, 26);
  const central = Buffer.alloc(46);
  central.writeUInt32LE(0x02014b50, 0);
  central.writeUInt16LE(20, 4);
  central.writeUInt16LE(20, 6);
  central.writeUInt32LE(crc, 16);
  central.writeUInt32LE(data.length, 20);
  central.writeUInt32LE(data.length, 24);
  central.writeUInt16LE(file.length, 28);
  const centralOffset = local.length + file.length + data.length;
  const end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50, 0);
  end.writeUInt16LE(1, 8);
  end.writeUInt16LE(1, 10);
  end.writeUInt32LE(central.length + file.length, 12);
  end.writeUInt32LE(centralOffset, 16);
  return new Uint8Array(Buffer.concat([local, file, data, central, file, end]));
}

let t: IntegrationsApp;
let ci = '';

beforeAll(async () => {
  if (noRuntime) return;
  t = await startIntegrationsApp({ workspaceId: WS, userId: 'u_perf_hub' }, { PMI_EMBED_ADAPTER: 'fixture-embed' });
  ci = await t.register('fixture-ci');
  // The in-test policy binding: EPIC-031's approval is a person's act, not a
  // latency this Epic owns (`R-039-7`). One decision read per resolution remains.
  t.bindPolicy();
  await t.configure(t.projectA, 'ReadBuildStatus', [{ registryEntryId: ci }]).expect(200);
  await t.tick();
  // 50 entries in the workspace: six seeded/registered, the rest listed keys this build does not contain.
  const existing = await t.sql<{ n: number }>(`SELECT count(*)::int AS n FROM "integration_registry_entries" WHERE "workspaceId" = $1`, [WS]);
  for (let i = existing[0]!.n; i < 50; i++) {
    await t.sql(
      `INSERT INTO "integration_registry_entries" ("id","workspaceId","key","direction","status","listedOrder","registeredBy","registeredAt") VALUES ($1,$2,$3,'outbound','active',$4,'u_perf_hub',now())`,
      [`perf_${i}`, WS, `perf-adapter-${i}`, 1000 + i],
    );
  }
  // 100 health rows for the entry the detail reads.
  for (let i = 0; i < 100; i++) {
    await t.hub.deps.store.appendCheck({ workspaceId: WS, projectId: t.projectA, registryEntryId: ci, state: 'healthy', adapterVersion: '0.1.0', source: 'request', checkedAt: new Date(Date.now() - i * 1000), durationMs: 1 });
  }
}, 600_000);

afterAll(async () => {
  if (Object.keys(figures).length > 0) console.log(`[T2222] R-039-15 figures (p95, ms):\n${JSON.stringify(figures, null, 2)}`);
  await t?.stop();
}, 120_000);

suite('T2222 · R-039-15 / R-039-18 — the Hub meets its performance targets', () => {
  it('resolution decision p95 < 40 ms', async () => {
    const value = await measure(() =>
      t.hub.resolver.resolve({ workspaceId: WS, projectId: t.projectA, capability: 'ReadBuildStatus', major: 1, caller: 'room:change', actorPrincipalId: 'u_perf_hub', executionId: null }),
    );
    judge('resolution', value, 40);
  });

  it('request overhead p95 < 120 ms (an upper bound: fixture provider time is ~0)', async () => {
    const value = await measure(async () => {
      const res = await t.hub.requests.request({ workspaceId: WS, userId: 'u_perf_hub' }, t.projectA, { capability: 'ReadBuildStatus', major: 1, caller: 'room:change', input: { revision: SHA } }, { http: false });
      if (res.outcome !== 'resolved') throw new Error(`refused: ${JSON.stringify(res.refusal)}`);
    });
    judge('request overhead', value, 120);
  });

  it('embed() overhead p95 < 15 ms (fixture-embed; provider time ~0)', async () => {
    const value = await measure(() => t.hub.embedding.embed(['booking notification sent twice']));
    judge('embed overhead', value, 15);
  });

  it('JUnit parse < 2 s at 20,000 cases', () => {
    const cases = Array.from({ length: 20_000 }, (_, i) => `<testcase classname="perf.Suite" name="case_${i}" time="0.001"/>`).join('');
    const zip = storedZip('report.xml', `<?xml version="1.0"?><testsuite name="perf" tests="20000">${cases}</testsuite>`);
    const start = performance.now();
    const parsed = parseJUnitArtifact(zip);
    const elapsed = performance.now() - start;
    expect(parsed.ok, JSON.stringify(parsed).slice(0, 200)).toBe(true);
    judge('JUnit parse (20,000 cases, single run)', elapsed, 2000);
  });

  it('registry read p95 < 250 ms at 50 entries', async () => {
    const res = await request(t.api).get(`/v1/integrations/registry?projectId=${t.projectA}`).set('Cookie', t.cookie).expect(200);
    expect(res.body.entries.length).toBeGreaterThanOrEqual(50);
    const value = await measure(() => request(t.api).get(`/v1/integrations/registry?projectId=${t.projectA}`).set('Cookie', t.cookie).expect(200));
    judge('registry read', value, 250);
  });

  it('entry detail p95 < 350 ms with 100 health rows and at least 50 resolutions', async () => {
    const res = await request(t.api).get(`/v1/integrations/registry/${ci}?projectId=${t.projectA}`).set('Cookie', t.cookie).expect(200);
    expect(res.body.healthHistory.length).toBeGreaterThanOrEqual(100);
    expect(res.body.resolutions.length).toBeGreaterThanOrEqual(50);
    const value = await measure(() => request(t.api).get(`/v1/integrations/registry/${ci}?projectId=${t.projectA}`).set('Cookie', t.cookie).expect(200));
    judge('entry detail', value, 350);
  });
});

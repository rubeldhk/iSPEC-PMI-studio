/**
 * `T2159` (EPIC-039, `R-039-9`) — `ReadTestResults` over GitHub Actions.
 *
 * GitHub has no first-class test-results API, so the adapter reads the JUnit
 * XML the project's workflow uploads as an artifact (default name
 * `test-results`) for the runs of that commit. JUnit XML is what every
 * mainstream runner emits, which keeps the adapter provider-specific and
 * runner-neutral.
 *
 * The artifact is untrusted input:
 *
 * - `fflate.unzipSync` with a filter that accepts only `*.xml` entries whose
 *   declared expanded size is ≤ 50 MiB (the zip-bomb bound);
 * - `fast-xml-parser` with `processEntities: false` — no entity from the
 *   artifact is expanded;
 * - more than 20,000 test names → `result-too-large`, never truncated.
 *
 * Any run of the commit not `completed` → `final: false` and nothing read
 * (`FR-HUB-054`); completed runs without the artifact → `results-not-found`.
 */
import { unzipSync } from 'fflate';
import { XMLParser } from 'fast-xml-parser';
import type { AdapterResult } from '@pmi/capability-contract';
import { GitHubError } from './auth.js';
import { githubGet } from './http.js';
import type { ReadContext } from './read-repository.js';

export const MAX_EXPANDED_BYTES = 50 * 1024 * 1024;
export const MAX_TEST_NAMES = 20_000;

export type JUnitParse =
  | { ok: true; suites: number; passedTests: string[]; failedTests: string[]; skippedTests: string[] }
  | { ok: false; errorCategory: 'results-not-found' | 'results-malformed' | 'result-too-large'; message: string };

const parser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: '@_',
  processEntities: false,
  isArray: (name) => name === 'testsuite' || name === 'testcase',
});

interface Suite {
  '@_name'?: string;
  testcase?: { '@_name'?: string; '@_classname'?: string; failure?: unknown; error?: unknown; skipped?: unknown }[];
  testsuite?: Suite[];
}

export function parseJUnitArtifact(zipBytes: Uint8Array): JUnitParse {
  let entries: Record<string, Uint8Array>;
  try {
    entries = unzipSync(zipBytes, { filter: (f) => /\.xml$/i.test(f.name) && f.originalSize <= MAX_EXPANDED_BYTES });
  } catch {
    return { ok: false, errorCategory: 'results-malformed', message: 'the test-results artifact is not a readable zip' };
  }
  const xmls = Object.entries(entries);
  if (xmls.length === 0) return { ok: false, errorCategory: 'results-not-found', message: 'the test-results artifact holds no JUnit XML' };
  const out = { suites: 0, passedTests: [] as string[], failedTests: [] as string[], skippedTests: [] as string[] };
  const visit = (suite: Suite): void => {
    out.suites += 1;
    const suiteName = suite['@_name'] ?? '';
    for (const tc of suite.testcase ?? []) {
      const name = `${suiteName || tc['@_classname'] || '(suite)'} > ${tc['@_name'] ?? '(unnamed)'}`;
      if (tc.failure !== undefined || tc.error !== undefined) out.failedTests.push(name);
      else if (tc.skipped !== undefined) out.skippedTests.push(name);
      else out.passedTests.push(name);
    }
    for (const nested of suite.testsuite ?? []) visit(nested);
  };
  for (const [file, bytes] of xmls) {
    let doc: { testsuites?: { testsuite?: Suite[] } | string; testsuite?: Suite[] };
    try {
      const text = Buffer.from(bytes).toString('utf8');
      const valid = XMLValidatorLike(text);
      if (!valid) throw new Error('malformed');
      doc = parser.parse(text) as typeof doc;
    } catch {
      return { ok: false, errorCategory: 'results-malformed', message: `${file} is not well-formed JUnit XML` };
    }
    const roots = typeof doc.testsuites === 'object' ? (doc.testsuites.testsuite ?? []) : (doc.testsuite ?? []);
    if (roots.length === 0 && doc.testsuites === undefined) return { ok: false, errorCategory: 'results-malformed', message: `${file} has no testsuites or testsuite element` };
    for (const s of roots) visit(s);
    if (out.passedTests.length + out.failedTests.length + out.skippedTests.length > MAX_TEST_NAMES) {
      return { ok: false, errorCategory: 'result-too-large', message: `more than ${MAX_TEST_NAMES} test names; refused, never truncated` };
    }
  }
  return { ok: true, ...out };
}

/** fast-xml-parser parses leniently; refuse a document that is not even balanced. */
function XMLValidatorLike(text: string): boolean {
  const stack: string[] = [];
  const re = /<(\/?)([A-Za-z_][\w:.-]*)[^>]*?(\/?)>/g;
  const body = text.replace(/<\?[\s\S]*?\?>/g, '').replace(/<!DOCTYPE[\s\S]*?\]>/i, '').replace(/<!--[\s\S]*?-->/g, '').replace(/<!\[CDATA\[[\s\S]*?\]\]>/g, '');
  if ((body.match(/</g) ?? []).length !== (body.match(/>/g) ?? []).length) return false;
  for (let m = re.exec(body); m !== null; m = re.exec(body)) {
    if (m[3] === '/') continue;
    if (m[1] === '/') {
      if (stack.pop() !== m[2]) return false;
    } else stack.push(m[2]!);
  }
  return stack.length === 0;
}

export function rollUp(runs: readonly { status: string }[]): { final: false } | { final: true; none: boolean } {
  if (runs.some((r) => r.status !== 'completed')) return { final: false };
  return { final: true, none: runs.length === 0 };
}

export async function readTestResults(ctx: ReadContext, revision: string, artifactName: string): Promise<AdapterResult> {
  const runsRes = await githubGet(ctx.fetch, `${ctx.base}/repos/${ctx.repository}/actions/runs?head_sha=${revision}&per_page=100`, ctx.bearer, ctx.signal, ctx.now);
  if (runsRes.status === 404 || runsRes.status === 422) throw new GitHubError('revision-not-found', `no workflow runs can be read for ${revision}`);
  if (runsRes.status !== 200) throw new GitHubError('provider-unavailable', `GitHub answered ${runsRes.status} listing workflow runs`);
  const runs = ((await runsRes.json()) as { workflow_runs?: { id: number; status: string; html_url?: string }[] }).workflow_runs ?? [];
  const observedAt = ctx.now.toISOString();
  const base = { revision, source: { artifactName, format: 'junit-xml' as const }, observedAt };
  const rolled = rollUp(runs);
  if (!rolled.final) return { ok: true, output: { ...base, final: false, result: 'NONE', suites: 0, passedTests: [], failedTests: [], skippedTests: [] } };
  if (rolled.none) return { ok: false, errorCategory: 'results-not-found', message: `no workflow run exists for ${revision}` };

  const totals = { suites: 0, passedTests: [] as string[], failedTests: [] as string[], skippedTests: [] as string[] };
  let runUrl: string | undefined;
  let found = false;
  for (const run of runs) {
    const arts = await githubGet(ctx.fetch, `${ctx.base}/repos/${ctx.repository}/actions/runs/${run.id}/artifacts?per_page=100`, ctx.bearer, ctx.signal, ctx.now);
    if (arts.status !== 200) throw new GitHubError('provider-unavailable', `GitHub answered ${arts.status} listing artifacts`);
    const artifact = (((await arts.json()) as { artifacts?: { id: number; name: string; expired?: boolean }[] }).artifacts ?? []).find((a) => a.name === artifactName && a.expired !== true);
    if (artifact === undefined) continue;
    const zip = await githubGet(ctx.fetch, `${ctx.base}/repos/${ctx.repository}/actions/artifacts/${artifact.id}/zip`, ctx.bearer, ctx.signal, ctx.now, 'application/vnd.github+json');
    if (zip.status !== 200) throw new GitHubError('provider-unavailable', `GitHub answered ${zip.status} downloading the artifact`);
    const parsed = parseJUnitArtifact(await zip.bytes());
    if (!parsed.ok) return { ok: false, errorCategory: parsed.errorCategory, message: parsed.message };
    found = true;
    runUrl ??= run.html_url;
    totals.suites += parsed.suites;
    totals.passedTests.push(...parsed.passedTests);
    totals.failedTests.push(...parsed.failedTests);
    totals.skippedTests.push(...parsed.skippedTests);
    if (totals.passedTests.length + totals.failedTests.length + totals.skippedTests.length > MAX_TEST_NAMES) {
      return { ok: false, errorCategory: 'result-too-large', message: `more than ${MAX_TEST_NAMES} test names; refused, never truncated` };
    }
  }
  if (!found) return { ok: false, errorCategory: 'results-not-found', message: `the completed runs for ${revision} uploaded no "${artifactName}" artifact` };
  const result = totals.failedTests.length > 0 ? 'FAILED' : totals.passedTests.length > 0 ? 'PASSED' : 'NONE';
  return { ok: true, output: { ...base, source: { ...base.source, ...(runUrl ? { runUrl } : {}) }, final: true, result, ...totals } };
}

/**
 * `T2157` (EPIC-039) — `ReadBuildStatus` over GitHub: check runs and the
 * combined commit status for one full commit id, rolled up.
 *
 * Roll-up (`contracts/capability-contract.md` §1): any failure → `failure`;
 * otherwise any check still running → `pending`; no checks → `none`; else
 * `success` (or `neutral` when nothing succeeded). `final` is false whenever any
 * check is still running (`FR-HUB-054`).
 */
import type { AdapterResult } from '@pmi/capability-contract';
import { GitHubError } from './auth.js';
import { githubGet } from './http.js';
import type { ReadContext } from './read-repository.js';

type CheckState = 'pending' | 'success' | 'failure' | 'neutral';

interface Check {
  name: string;
  state: CheckState;
  final: boolean;
  url?: string;
  completedAt?: string;
}

function fromCheckRun(r: { name: string; status: string; conclusion: string | null; html_url?: string; completed_at?: string | null }): Check {
  const final = r.status === 'completed';
  let state: CheckState = 'pending';
  if (final) {
    if (r.conclusion === 'success') state = 'success';
    else if (r.conclusion === 'neutral' || r.conclusion === 'skipped') state = 'neutral';
    else state = 'failure';
  }
  return { name: r.name, state, final, ...(r.html_url ? { url: r.html_url } : {}), ...(r.completed_at ? { completedAt: r.completed_at } : {}) };
}

function fromStatus(s: { context: string; state: string; target_url?: string | null; updated_at?: string }): Check {
  const final = s.state !== 'pending';
  const state: CheckState = s.state === 'success' ? 'success' : s.state === 'pending' ? 'pending' : 'failure';
  return { name: s.context, state, final, ...(s.target_url ? { url: s.target_url } : {}), ...(final && s.updated_at ? { completedAt: s.updated_at } : {}) };
}

export async function readBuildStatus(ctx: ReadContext, revision: string): Promise<AdapterResult> {
  const runs = await githubGet(ctx.fetch, `${ctx.base}/repos/${ctx.repository}/commits/${revision}/check-runs?per_page=100`, ctx.bearer, ctx.signal, ctx.now);
  if (runs.status === 404 || runs.status === 422) throw new GitHubError('revision-not-found', `no commit ${revision} in the bound repository`);
  if (runs.status !== 200) throw new GitHubError('provider-unavailable', `GitHub answered ${runs.status} reading check runs`);
  const status = await githubGet(ctx.fetch, `${ctx.base}/repos/${ctx.repository}/commits/${revision}/status`, ctx.bearer, ctx.signal, ctx.now);
  if (status.status === 404 || status.status === 422) throw new GitHubError('revision-not-found', `no commit ${revision} in the bound repository`);
  if (status.status !== 200) throw new GitHubError('provider-unavailable', `GitHub answered ${status.status} reading the combined status`);
  const checkRuns = ((await runs.json()) as { check_runs?: Parameters<typeof fromCheckRun>[0][] }).check_runs ?? [];
  const statuses = ((await status.json()) as { statuses?: Parameters<typeof fromStatus>[0][] }).statuses ?? [];
  const checks = [...checkRuns.map(fromCheckRun), ...statuses.map(fromStatus)];
  const final = checks.every((c) => c.final);
  let state: 'pending' | 'success' | 'failure' | 'neutral' | 'none';
  if (checks.length === 0) state = 'none';
  else if (checks.some((c) => c.state === 'failure')) state = 'failure';
  else if (!final) state = 'pending';
  else state = checks.some((c) => c.state === 'success') ? 'success' : 'neutral';
  return { ok: true, output: { revision, state, final, checks, observedAt: ctx.now.toISOString() }, ...(runs.requestId ? { providerRequestId: runs.requestId } : {}) };
}

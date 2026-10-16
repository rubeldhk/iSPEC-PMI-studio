/**
 * `T2157` (EPIC-039) — `ReadRepository` over GitHub: resolve the revision to a
 * commit, then the recursive tree, or the named files at that commit.
 *
 * Files over 1 MiB, or a response over 5 MiB, are refused `content-too-large`
 * naming the path — never truncated silently.
 */
import type { AdapterResult } from '@pmi/capability-contract';
import { GitHubError } from './auth.js';
import { githubGet } from './http.js';

export const MAX_FILE_BYTES = 1024 * 1024;
export const MAX_RESPONSE_BYTES = 5 * 1024 * 1024;

export interface ReadContext {
  readonly fetch: Parameters<typeof githubGet>[0];
  readonly base: string;
  readonly repository: string;
  readonly bearer: string;
  readonly signal: AbortSignal;
  readonly now: Date;
}

const enc = (s: string): string => s.split('/').map(encodeURIComponent).join('/');

export async function resolveCommit(ctx: ReadContext, revision: string): Promise<{ sha: string; requestId?: string }> {
  const res = await githubGet(ctx.fetch, `${ctx.base}/repos/${ctx.repository}/commits/${enc(revision)}`, ctx.bearer, ctx.signal, ctx.now);
  if (res.status === 404 || res.status === 422) throw new GitHubError('revision-not-found', `no commit for ${revision} in the bound repository`);
  if (res.status !== 200) throw new GitHubError('provider-unavailable', `GitHub answered ${res.status} resolving the revision`);
  const body = (await res.json()) as { sha?: string };
  if (typeof body.sha !== 'string') throw new GitHubError('adapter-fault', 'GitHub returned a commit without a sha');
  return { sha: body.sha, ...(res.requestId ? { requestId: res.requestId } : {}) };
}

function decode(b64: string): { encoding: 'utf8' | 'base64'; content: string; bytes: number } {
  const buf = Buffer.from(b64.replace(/\n/g, ''), 'base64');
  const text = buf.toString('utf8');
  return Buffer.from(text, 'utf8').equals(buf) && !text.includes('\u0000') ? { encoding: 'utf8', content: text, bytes: buf.length } : { encoding: 'base64', content: buf.toString('base64'), bytes: buf.length };
}

export async function readRepository(ctx: ReadContext, input: { revision: string; mode: 'tree' | 'files'; paths?: string[] }): Promise<AdapterResult> {
  const { sha, requestId } = await resolveCommit(ctx, input.revision);
  const revision = { requested: input.revision, resolvedCommit: sha };
  if (input.mode === 'tree') {
    const res = await githubGet(ctx.fetch, `${ctx.base}/repos/${ctx.repository}/git/trees/${sha}?recursive=1`, ctx.bearer, ctx.signal, ctx.now);
    if (res.status !== 200) throw new GitHubError(res.status === 404 ? 'revision-not-found' : 'provider-unavailable', `GitHub answered ${res.status} reading the tree`);
    const body = (await res.json()) as { tree?: { path: string; type: string; size?: number }[]; truncated?: boolean };
    const entries = (body.tree ?? [])
      .filter((t) => t.type === 'blob' || t.type === 'tree')
      .map((t) => ({ path: t.path, kind: t.type === 'tree' ? ('dir' as const) : ('file' as const), ...(t.type === 'blob' && typeof t.size === 'number' ? { sizeBytes: t.size } : {}) }));
    return { ok: true, output: { revision, entries, truncated: body.truncated === true }, ...(requestId ? { providerRequestId: requestId } : {}) };
  }
  const files: { path: string; encoding: 'utf8' | 'base64'; content: string; sizeBytes: number }[] = [];
  const missing: string[] = [];
  let total = 0;
  for (const path of input.paths ?? []) {
    const res = await githubGet(ctx.fetch, `${ctx.base}/repos/${ctx.repository}/contents/${enc(path)}?ref=${sha}`, ctx.bearer, ctx.signal, ctx.now);
    if (res.status === 404) {
      missing.push(path);
      continue;
    }
    if (res.status !== 200) throw new GitHubError('provider-unavailable', `GitHub answered ${res.status} reading ${path}`);
    const body = (await res.json()) as { type?: string; size?: number; content?: string; encoding?: string };
    if (body.type !== 'file') {
      missing.push(path);
      continue;
    }
    if ((body.size ?? 0) > MAX_FILE_BYTES || typeof body.content !== 'string' || body.encoding !== 'base64') {
      return { ok: false, errorCategory: 'content-too-large', message: `${path} is larger than ${MAX_FILE_BYTES} bytes; it is refused, not truncated` };
    }
    const d = decode(body.content);
    total += d.bytes;
    if (total > MAX_RESPONSE_BYTES) return { ok: false, errorCategory: 'content-too-large', message: `the files requested exceed ${MAX_RESPONSE_BYTES} bytes at ${path}; refused, not truncated` };
    files.push({ path, encoding: d.encoding, content: d.content, sizeBytes: d.bytes });
  }
  return { ok: true, output: { revision, files, missing }, ...(requestId ? { providerRequestId: requestId } : {}) };
}

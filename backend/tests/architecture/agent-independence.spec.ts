/**
 * T560, T581 — agent and execution independence enforcement.
 *
 * The third member of a family. `engine-independence.spec.ts` fails the build
 * when `backend/src` names an engine; `transport-independence.spec.ts` fails it
 * when a service imports an HTTP type. This fails it when anything names an AI
 * provider or reaches a container runtime directly.
 *
 * WHY IT EXISTS: before EPIC-028, `engine-adapters/speckit/src/speckit.adapter.ts`
 * hardcoded `claude` in four places. That was *legal* — the architecture test
 * guarded `backend/**` against engine references, and an adapter is permitted to
 * be engine-specific — but it meant **swapping the AI provider and swapping the
 * specification engine were the same edit**, the merge Native §3 forbids. The
 * violation was invisible precisely because no check looked for it.
 *
 * `ADR-0001`'s reasoning, applied to two more axes: a claim decays silently
 * unless something fails when it stops being true. This is that something.
 */
import { readFileSync, readdirSync, statSync, existsSync } from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const here = dirname(fileURLToPath(import.meta.url));
const REPO = resolve(here, '../../..');

function walk(dir: string): string[] {
  if (!existsSync(dir)) return [];
  return readdirSync(dir).flatMap((entry) => {
    if (entry === 'node_modules' || entry === 'dist') return [];
    const p = join(dir, entry);
    return statSync(p).isDirectory() ? walk(p) : p.endsWith('.ts') ? [p] : [];
  });
}

function sources(dir: string): { rel: string; body: string }[] {
  return walk(join(REPO, dir)).map((p) => ({
    rel: relative(REPO, p).replace(/\\/g, '/'),
    // Comments stripped: these files *explain* the rules they obey, and a naive
    // search matches the very sentence describing the prohibition.
    body: readFileSync(p, 'utf8')
      .replace(/\/\*[\s\S]*?\*\//g, ' ')
      .replace(/\/\/.*$/gm, ' '),
  }));
}

/**
 * Providers an agent adapter may name — inside its own package only.
 *
 * `anthropic` is deliberately included: `api.anthropic.com` appears in the
 * egress profile, which is a *destination*, and that belongs to the execution
 * contract rather than to any agent.
 */
const PROVIDER_NAMES = /\b(claude|cursor|codex|copilot|gemini)\b/i;

const backend = sources('backend/src');
const engineAdapters = sources('engine-adapters');
const executionContract = sources('packages/execution-contract/src');

describe('T560 · no component names an AI provider (FR-AGT-004)', () => {
  it('has sources to check', () => {
    expect(backend.length + engineAdapters.length).toBeGreaterThan(0);
  });

  it('backend/src never names a provider', () => {
    const offenders = backend.filter((f) => PROVIDER_NAMES.test(f.body));
    expect(offenders.map((o) => o.rel)).toEqual([]);
  });

  it('NO engine adapter names a provider — the finding this epic was built on', () => {
    // Four literals lived in speckit.adapter.ts. `--integration` now takes
    // `agent.descriptor.specKitIntegrationName`, and the agent_run steps go
    // through `agent.execute()`.
    const offenders = engineAdapters
      .filter((f) => !f.rel.includes('/tests/'))
      .filter((f) => PROVIDER_NAMES.test(f.body));
    expect(offenders.map((o) => o.rel)).toEqual([]);
  });

  it('backend/src never imports an agent adapter', () => {
    const offenders = backend.filter(
      (f) => /@pmi\/agent-adapter-/.test(f.body) || /from\s+['"][^'"]*agent-adapters\//.test(f.body),
    );
    expect(offenders.map((o) => o.rel)).toEqual([]);
  });

  it('backend/src never dynamically imports an agent adapter', () => {
    // `await import('...agent-adapter-claude')` would slip past an import-only
    // check — the same widening T142a made for engines.
    const offenders = backend.filter((f) =>
      /import\s*\(\s*['"][^'"]*agent-adapter/.test(f.body),
    );
    expect(offenders.map((o) => o.rel)).toEqual([]);
  });
});

describe('T581 · no component reaches a container runtime directly (FR-AGT-009)', () => {
  it('backend/src never imports an execution provider', () => {
    const offenders = backend.filter(
      (f) =>
        /@pmi\/execution-provider-/.test(f.body) ||
        /from\s+['"][^'"]*execution-providers\//.test(f.body),
    );
    expect(offenders.map((o) => o.rel)).toEqual([]);
  });

  it('backend/src never names a container runtime', () => {
    const offenders = backend.filter((f) => /\b(dockerode|docker\.sock|containerd)\b/i.test(f.body));
    expect(offenders.map((o) => o.rel)).toEqual([]);
  });
});

describe('T560 · the layering runs agent → execution and never back', () => {
  it('execution-contract does not import the agent contract', () => {
    // plan.md's build order rests on this: an agent runs INSIDE an environment,
    // and the environment knows nothing about agents. Reversing it would make
    // the execution layer depend on the AI layer — the coupling this epic
    // exists to remove, reintroduced at a new seam.
    const offenders = executionContract.filter((f) => /@pmi\/agent-contract/.test(f.body));
    expect(offenders.map((o) => o.rel)).toEqual([]);
  });
});

describe('T560 · the boundary is a seam, not a wall', () => {
  it('SOMETHING depends on the agent contract — otherwise this suite is vacuous', () => {
    // A false pass would be a repository where the agent layer is simply unused.
    const users = [...engineAdapters, ...sources('worker/src')].filter((f) =>
      /@pmi\/agent-contract/.test(f.body),
    );
    expect(users.length).toBeGreaterThan(0);
  });

  it('an agent adapter IS allowed to name its own provider', () => {
    // The restriction is on the engine and the application, not on the adapter
    // whose entire job is to speak to one provider.
    const claude = sources('agent-adapters/claude/src');
    expect(claude.some((f) => PROVIDER_NAMES.test(f.body))).toBe(true);
  });
});

/**
 * `T2332` (EPIC-048) — one write path into knowledge (`FR-LRN-001`, `FR-LRN-002`,
 * `SC-LRN-001`; `R-048-4` fence 1; `MP-1a`'s guard).
 *
 * Asserted over **every** source file of the backend, so it holds for files that
 * do not exist yet — a boundary checked only against today's code is one the
 * next file crosses (`EPIC-038`'s `T1236`).
 *
 * 1. Only `materialiser.ts` calls `insertVersion`; besides it, only the
 *    composition root and the two writer implementations import the writer, and
 *    the root injects `KNOWLEDGE_WRITER` into the materialiser and nothing else.
 * 2. No controller and no job maps to a knowledge write: no `POST`/`PUT`/`PATCH`/
 *    `DELETE` route under `knowledge`, anywhere in the composed application.
 * 3. `supply.ts` — what `EPIC-038` reads — reads knowledge versions and never a
 *    candidate. A candidate is not supplied as knowledge in any state.
 */
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const here = dirname(fileURLToPath(import.meta.url));
const SRC = resolve(here, '../../src');
const LEARNING = join(SRC, 'modules', 'learning');

interface Source {
  readonly rel: string;
  readonly code: string;
}

function strip(text: string): string {
  return text.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');
}

function sources(dir: string): Source[] {
  const out: Source[] = [];
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) out.push(...sources(full));
    else if (entry.endsWith('.ts')) out.push({ rel: relative(SRC, full).replace(/\\/g, '/'), code: strip(readFileSync(full, 'utf8')) });
  }
  return out;
}

const ALL = sources(SRC);
const WRITER_IMPORTERS_ALLOWED = new Set([
  'modules/learning/materialiser.ts',
  // The composition root constructs the writer and hands it to the materialiser.
  'modules/learning/learning.module.ts',
  // The PostgreSQL writer implements the interface it imports.
  'modules/learning/learning.store.prisma.ts',
]);

describe('T2332 · only the materialiser writes knowledge', () => {
  it('only materialiser.ts calls insertVersion', () => {
    // Scoped to code that can reach the writer: the learning module, and any file
    // that imports it or names its token. (EPIC-045's artifact store has an
    // unrelated `insertVersion` of its own.)
    const reaches = (f: Source): boolean =>
      f.rel.startsWith('modules/learning/') || /knowledge\.writer|KNOWLEDGE_WRITER|KnowledgeWriter/.test(f.code);
    const callers = ALL.filter((f) => reaches(f) && /\.insertVersion\s*\(/.test(f.code)).map((f) => f.rel);
    expect(callers.filter((r) => r !== 'modules/learning/materialiser.ts')).toEqual([]);
  });

  it('nothing else imports knowledge.writer', () => {
    const importers = ALL.filter((f) => /from\s+['"][^'"]*knowledge\.writer(\.js)?['"]/.test(f.code)).map((f) => f.rel);
    expect(importers.filter((r) => !WRITER_IMPORTERS_ALLOWED.has(r))).toEqual([]);
  });

  it('the composition root injects KNOWLEDGE_WRITER into the materialiser and nothing else', () => {
    const moduleFile = ALL.find((f) => f.rel === 'modules/learning/learning.module.ts');
    expect(moduleFile, 'learning.module.ts').toBeDefined();
    const injections = [...(moduleFile?.code ?? '').matchAll(/provide:\s*([A-Za-z_]+)[\s\S]*?inject:\s*\[([^\]]*)\]/g)]
      .filter((m) => /KNOWLEDGE_WRITER/.test(m[2] ?? ''))
      .map((m) => m[1]);
    expect(injections).toEqual(['Materialiser']);
  });

  it('the store services receive has no version insert', () => {
    const store = ALL.find((f) => f.rel === 'modules/learning/learning.store.ts');
    const iface = /export interface LearningAppends\s*{([\s\S]*?)\n}/.exec(store?.code ?? '')?.[1] ?? '';
    expect(iface).not.toMatch(/insertVersion|insertStatus|appendStatus|Version\s*\(/);
  });
});

describe('T2332 · no route or job maps to a knowledge write', () => {
  it('no controller in the application declares a write verb on a knowledge path', () => {
    const offenders: string[] = [];
    for (const f of ALL.filter((s) => s.rel.endsWith('.controller.ts'))) {
      const controllerBase = /@Controller\(\s*'([^']*)'/.exec(f.code)?.[1] ?? '';
      for (const m of f.code.matchAll(/@(Post|Put|Patch|Delete)\(\s*'([^']*)'/g)) {
        const path = `${controllerBase}/${m[2]}`;
        if (/knowledge/i.test(path)) offenders.push(`${f.rel}: ${m[1]} ${path}`);
      }
    }
    expect(offenders).toEqual([]);
  });

  it('no controller or job file imports the writer or the materialiser’s write', () => {
    const offenders = ALL.filter((f) => (f.rel.endsWith('.controller.ts') || f.rel.endsWith('.jobs.ts')) && /knowledge\.writer|insertVersion/.test(f.code)).map((f) => f.rel);
    expect(offenders).toEqual([]);
  });
});

describe('T2332 · supply reads versions, never candidates (FR-LRN-002)', () => {
  const supplyPath = join(LEARNING, 'supply.ts');

  it('supply.ts exists — EPIC-038 has something to call', () => {
    expect(existsSync(supplyPath)).toBe(true);
  });

  it('names no candidate read', () => {
    const code = existsSync(supplyPath) ? strip(readFileSync(supplyPath, 'utf8')) : '';
    const reads = ['candidate(', 'candidateByIdempotencyKey', 'openCandidateFor', 'citations(', 'corroborations(', 'candidatesInStates', 'transitions(', 'currentTransition', 'learning_candidates', 'CandidateRecord'];
    expect(reads.filter((r) => code.includes(r))).toEqual([]);
  });
});

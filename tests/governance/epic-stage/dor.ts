/**
 * T507 … T512 — the Definition of Ready.
 *
 * Twelve conditions, each a predicate over one Epic. `FR-ESK-011` requires every
 * one to be **mechanically checkable**: a condition needing human judgement is
 * rejected from the set, not softened into it. A gate with one subjective
 * condition is a gate somebody argues with, and the argument is always won by
 * whoever wants to start.
 *
 * That constraint is why these read poorly as prose and well as predicates.
 * `DOR-03` does not ask *"is the traceability good"*; it asks *"does the table
 * have rows, and where requirements are uncovered, is a back-fill owner named"*.
 * The second question has an answer.
 *
 * **Evaluation is total** (`FR-ESK-013`) and **fresh, never stamped**: readiness
 * is a function of current state, so amending a spec after the DOR passed
 * withdraws readiness on the next run with no explicit invalidation step.
 *
 * Not a `.spec.ts`, so vitest never collects it.
 */
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { REPO_ROOT } from '../helpers';
import { loadStageConfig } from './derive';
import { validateAnalysisRecord } from './analysis-record';
import type { DeclarationsFile, EpicKind } from './declarations';

export interface DorContext {
  readonly epicPath: string;
  readonly directory: string;
  readonly declarations: DeclarationsFile;
}

export interface ConditionResult {
  readonly id: string;
  readonly passed: boolean;
  readonly detail: string;
}

// ------------------------------------------------------------- file access

function read(epicPath: string, file: string): string {
  const path = join(epicPath, file);
  return existsSync(path) ? readFileSync(path, 'utf8') : '';
}

function filesIn(epicPath: string, folder: string): string[] {
  const dir = join(epicPath, folder);
  if (!existsSync(dir) || !statSync(dir).isDirectory()) return [];
  return readdirSync(dir, { withFileTypes: true })
    .filter((entry) => entry.isFile() && entry.name.endsWith('.md'))
    .map((entry) => entry.name)
    .sort();
}

/**
 * Strip inline code and fenced blocks before scanning prose.
 *
 * `DOR-02` looks for an unresolved `[NEEDS CLARIFICATION` marker, and this
 * repository's templates and governance documents **quote** that marker while
 * explaining the convention. Flagging a document for describing the rule would
 * make the condition unusable in exactly the documents that define it.
 */
function prose(text: string): string {
  return text.replace(/```[\s\S]*?```/g, '').replace(/`[^`\n]*`/g, '');
}

function hasHeading(text: string, pattern: RegExp): boolean {
  return text.split(/\r?\n/).some((line) => /^#{2,3}\s/.test(line) && pattern.test(line));
}

// ------------------------------------------------------------- conditions

const CONDITIONS: Record<string, (ctx: DorContext) => ConditionResult> = {
  'DOR-01': (ctx) => {
    const passed = existsSync(join(ctx.epicPath, 'spec.md'));
    return { id: 'DOR-01', passed, detail: passed ? 'spec.md present' : 'spec.md is absent' };
  },

  'DOR-02': (ctx) => {
    const found = /\[NEEDS CLARIFICATION/.test(prose(read(ctx.epicPath, 'spec.md')));
    return {
      id: 'DOR-02',
      passed: !found,
      detail: found ? 'spec.md carries an unresolved [NEEDS CLARIFICATION marker' : 'no markers',
    };
  },

  'DOR-03': (ctx) => {
    const spec = read(ctx.epicPath, 'spec.md');
    if (!hasHeading(spec, /SRS Traceability/i)) {
      return { id: 'DOR-03', passed: false, detail: 'spec.md has no SRS Traceability section' };
    }
    // Constitution II's escape hatch, closed. "Not yet covered" is legitimate —
    // EPIC-018 and EPIC-026 are both owner-originated — but only with a name
    // against it, or the gap has no route back.
    const uncovered = /not yet covered by SRS/i.test(spec);
    const owned = /back-fill owner/i.test(spec);
    const passed = !uncovered || owned;
    return {
      id: 'DOR-03',
      passed,
      detail: passed
        ? 'traceability populated'
        : 'requirements are uncovered and no back-fill owner is named',
    };
  },

  'DOR-04': (ctx) => {
    const passed = hasHeading(read(ctx.epicPath, 'spec.md'), /Principle Conformance/i);
    return {
      id: 'DOR-04',
      passed,
      // Decision D-6 requires each Epic to record where it differs. Silence is
      // not "no deltas"; it is nobody having looked.
      detail: passed ? 'principle position recorded' : 'spec.md records no principle conformance',
    };
  },

  'DOR-05': (ctx) => {
    const files = filesIn(ctx.epicPath, 'checklists');
    if (files.length === 0) {
      return { id: 'DOR-05', passed: false, detail: 'no requirements checklist' };
    }
    const open = files.filter((file) =>
      /^\s*-\s*\[ \]/m.test(readFileSync(join(ctx.epicPath, 'checklists', file), 'utf8')),
    );
    return {
      id: 'DOR-05',
      passed: open.length === 0,
      detail: open.length === 0 ? 'checklists resolved' : `unresolved items in ${open.join(', ')}`,
    };
  },

  'DOR-06': (ctx) => {
    const plan = read(ctx.epicPath, 'plan.md');
    if (!plan) return { id: 'DOR-06', passed: false, detail: 'plan.md is absent' };
    // A QUALIFIED gate is a recorded deviation, not a failure. Conflating them
    // would block every Epic honest enough to write one down.
    const failed = /\|\s*(?:❌\s*)?FAIL\b/i.test(plan);
    return {
      id: 'DOR-06',
      passed: !failed,
      detail: failed ? 'plan.md Constitution Check records a FAIL' : 'Constitution Check clean',
    };
  },

  'DOR-07': (ctx) => {
    const passed = existsSync(join(ctx.epicPath, 'tasks.md'));
    return { id: 'DOR-07', passed, detail: passed ? 'tasks.md present' : 'tasks.md is absent' };
  },

  'DOR-08': (ctx) => {
    const tasks = read(ctx.epicPath, 'tasks.md');
    const lines = tasks.split(/\r?\n/).filter((line) => /^\s*-\s*\[[xX ]\]\s*T\d{3}/.test(line));
    if (lines.length === 0) {
      return { id: 'DOR-08', passed: false, detail: 'tasks.md lists no tasks' };
    }
    // A test-writing task IS the test; requiring it to reference another one
    // would make the condition unsatisfiable by construction. Everything else
    // must name a unit test or a conformance check (constitution v1.2.0 accepts
    // either).
    const unpaired = lines.filter((line) => {
      if (/write\s+(?:a\s+)?failing/i.test(line) || /\btests?\s+for\b/i.test(line)) return false;
      return !/\((?:[^)]*(?:unit test|integration test|check|checks)\s*:)/i.test(line);
    });
    return {
      id: 'DOR-08',
      passed: unpaired.length === 0,
      detail:
        unpaired.length === 0
          ? 'every implementation task names a test or check'
          : `${unpaired.length} implementation task(s) pair with no test or check (Constitution V)`,
    };
  },

  'DOR-09': (ctx) => {
    const analysis = read(ctx.epicPath, 'analysis.md');
    if (!analysis) {
      return { id: 'DOR-09', passed: false, detail: 'no analysis record (FR-ESK-019)' };
    }
    const validation = validateAnalysisRecord(analysis);
    if (!validation.valid) {
      return { id: 'DOR-09', passed: false, detail: `malformed: ${validation.problems.join('; ')}` };
    }
    // Blocking means CRITICAL or HIGH. If every severity blocked, the honest
    // response to a LOW nit would be to stop writing findings down.
    const blocking = analysis
      .split(/\r?\n/)
      .filter((row) => /^\|\s*F\d+\s*\|/.test(row))
      .filter((row) => /\|\s*(CRITICAL|HIGH)\s*\|/.test(row));
    return {
      id: 'DOR-09',
      passed: blocking.length === 0,
      detail: blocking.length === 0 ? 'analysis recorded, no blocking findings' : `${blocking.length} blocking finding(s)`,
    };
  },

  'DOR-10': (ctx) => {
    const passed = hasHeading(read(ctx.epicPath, 'spec.md'), /Epic Exit Criteria/i);
    return {
      id: 'DOR-10',
      passed,
      detail: passed ? 'exit criteria stated' : 'spec.md states no Epic Exit Criteria',
    };
  },

  'DOR-11': (ctx) => {
    const dir = join(ctx.epicPath, 'defects');
    if (!existsSync(dir)) {
      // Constitution VI requires the folder. Its absence means no defect COULD
      // have been recorded, which is not the same as none having occurred.
      return { id: 'DOR-11', passed: false, detail: 'defects/ does not exist (Constitution VI)' };
    }
    const open = filesIn(ctx.epicPath, 'defects').filter((file) => {
      const content = readFileSync(join(dir, file), 'utf8');
      // Deferred-with-an-owner is a decision, and DEF-004-001 closed exactly
      // that way. Treating it as open would punish recording the decision.
      return /\*\*Status\*\*:\s*\**\s*OPEN\b/i.test(content);
    });
    return {
      id: 'DOR-11',
      passed: open.length === 0,
      detail: open.length === 0 ? 'no open defect records' : `open: ${open.join(', ')}`,
    };
  },

  'DOR-12': (ctx) => {
    const posture = ctx.declarations.epics?.[ctx.directory]?.posture;
    const kinds = loadStageConfig().postureKinds;
    const blocking = posture ? Object.hasOwn(kinds, posture.kind) : false;
    return {
      id: 'DOR-12',
      passed: !blocking,
      detail: blocking ? `posture ${posture?.kind} blocks readiness` : 'no blocking posture',
    };
  },
};

/** One condition, by id. Exported so each can be tested in isolation. */
export function evaluateCondition(id: string, ctx: DorContext): ConditionResult {
  const condition = CONDITIONS[id];
  if (!condition) {
    // Never reported as passing — Constitution IX's honesty rule applied to a
    // condition nobody implemented.
    return { id, passed: false, detail: `no evaluator implemented for ${id}` };
  }
  return condition(ctx);
}

export interface DorResult {
  readonly results: ConditionResult[];
  /** Condition ids that failed, in configuration order. */
  readonly failed: string[];
  /** Human-readable failures, each carrying its condition text. */
  readonly failures: string[];
}

/**
 * All twelve, always (`FR-ESK-013`).
 *
 * A gate reporting the first failure makes readiness an unbounded number of
 * rounds — fix one, rerun, find the next — and the natural response is to stop
 * asking until the end, which is when the answer is most expensive.
 */
export function evaluateDor(ctx: DorContext): DorResult {
  const config = loadStageConfig();
  const results = config.dorConditions.map((definition) => evaluateCondition(definition.id, ctx));
  const failed = results.filter((result) => !result.passed);
  return {
    results,
    failed: failed.map((result) => result.id),
    failures: failed.map((result) => {
      const definition = config.dorConditions.find((entry) => entry.id === result.id);
      return `${result.id} — ${definition?.condition ?? 'unknown condition'}: ${result.detail}`;
    }),
  };
}

// ---------------------------------------------------------------- waivers

export interface WaiverDeclaration {
  readonly epic: string;
  readonly condition: string;
  readonly owner: string;
  readonly reason: string;
  readonly expires: string;
}

export interface WaiverContext {
  /** Injected, never read from the clock — see `readiness.spec.ts` on determinism. */
  readonly today: string;
  readonly epicsOnDisk: readonly string[];
}

export interface WaiverValidation {
  readonly problems: string[];
  readonly expired: boolean;
  /** Valid AND unexpired. Anything else grants nothing. */
  readonly grantsCover: boolean;
}

/** The three programme roles, read from governance rather than restated (`DF-5`). */
function permittedOwners(): string[] {
  const config = JSON.parse(
    readFileSync(join(REPO_ROOT, 'governance/governance.config.json'), 'utf8'),
  ) as { owners?: string[] };
  return config.owners ?? [];
}

export function validateWaiver(
  waiver: WaiverDeclaration | undefined,
  ctx: WaiverContext,
): WaiverValidation {
  const problems: string[] = [];
  const known = loadStageConfig().dorConditions.map((condition) => condition.id);

  if (!waiver) {
    return { problems: ['waiver is absent'], expired: false, grantsCover: false };
  }

  if (!waiver.epic || !ctx.epicsOnDisk.includes(waiver.epic)) {
    problems.push(`waiver names "${waiver.epic}", which is not an Epic directory on disk`);
  }

  // DF-5 — "no arrays of conditions, no wildcard, no waiver of the DOR."
  // Waiving one named condition is a decision someone can review; waiving a
  // gate is a decision nobody can.
  if (Array.isArray(waiver.condition)) {
    problems.push('a waiver covers exactly one condition, never a list (DF-5)');
  } else if (!waiver.condition) {
    problems.push('waiver names no condition');
  } else if (!known.includes(waiver.condition)) {
    problems.push(`waiver names "${waiver.condition}", which is not in the current DOR set`);
  }

  const owners = permittedOwners();
  if (!waiver.owner || !owners.includes(waiver.owner)) {
    problems.push(`waiver owner "${waiver.owner ?? '(none)'}" is not one of ${owners.join(', ')}`);
  }

  if (!waiver.reason?.trim()) {
    problems.push('waiver carries no reason');
  }

  let expired = false;
  if (!waiver.expires || !/^\d{4}-\d{2}-\d{2}$/.test(waiver.expires)) {
    // An exception with no end is a rule change wearing a costume.
    problems.push(`waiver expiry "${waiver.expires ?? '(none)'}" is not a YYYY-MM-DD date`);
  } else {
    // The expiry date itself is still valid — the alternative makes the last
    // day of an exception unusable and surprises whoever relied on it.
    expired = waiver.expires < ctx.today;
  }

  return { problems, expired, grantsCover: problems.length === 0 && !expired };
}

// -------------------------------------------------------------- readiness

export type Readiness = 'Ready' | 'Ready (waived)' | 'Not ready' | 'n/a';

export interface ReadinessInput {
  readonly directory: string;
  readonly kind: EpicKind;
  readonly failures: readonly string[];
  readonly waivers: readonly WaiverDeclaration[];
  readonly today: string;
  readonly epicsOnDisk: readonly string[];
}

export interface ReadinessResult {
  readonly readiness: Readiness;
  /** Failing conditions no valid waiver covers. */
  readonly uncovered: string[];
  /** Build-failing problems — expired waivers (`DF-6`, `FR-ESK-023`). */
  readonly blocking: string[];
  /** Reported but not build-failing — malformed waivers. */
  readonly reported: string[];
}

export function resolveReadiness(input: ReadinessInput): ReadinessResult {
  // FR-ESK-024 — a parent design is never evaluated. The DOR requires a task
  // list, and reporting a permanent failure for its absence trains readers to
  // ignore the column.
  if (input.kind === 'parent-design') {
    return { readiness: 'n/a', uncovered: [], blocking: [], reported: [] };
  }

  const mine = input.waivers.filter((waiver) => waiver.epic === input.directory);
  const blocking: string[] = [];
  const reported: string[] = [];
  const covering = new Set<string>();

  for (const waiver of mine) {
    const validation = validateWaiver(waiver, {
      today: input.today,
      epicsOnDisk: input.epicsOnDisk,
    });
    if (validation.expired) {
      // DF-6 — an expired waiver FAILS THE BUILD. Someone is still relying on
      // an exception past its agreed end, which is more dangerous than a
      // recording error.
      blocking.push(
        `${input.directory}: waiver on ${waiver.condition} expired ${waiver.expires} — renew it as a fresh dated record or fix the condition`,
      );
    }
    reported.push(...validation.problems.map((problem) => `${input.directory}: ${problem}`));
    if (validation.grantsCover) covering.add(waiver.condition);
  }

  const uncovered = input.failures.filter((failure) => !covering.has(failure));

  // There is no combination producing an unqualified `Ready` while a waiver is
  // active. That is what stops waivers becoming a second, weaker DOR.
  const readiness: Readiness =
    uncovered.length > 0 ? 'Not ready' : covering.size > 0 ? 'Ready (waived)' : 'Ready';

  return { readiness, uncovered, blocking, reported };
}

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
import { RESOLVED_FINDING, findingRows, findingSeverity, validateAnalysisRecord } from './analysis-record';
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
  /**
   * False when this Epic's kind is outside the condition's declared scope
   * (`T683`).
   *
   * Deliberately a **third state**, not a pass. `FR-ESK-024` defines a parent
   * design as carrying no tasks, so `DOR-07` and `DOR-08` do not reach it — but
   * Constitution IX forbids reporting an unrun check as passing, and a count of
   * passing conditions would be wrong the moment it included these.
   */
  readonly applicable?: boolean;
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

/**
 * The status word of every Constitution Check row in a plan (`DEF-026-009`).
 *
 * Reads the **last cell** of each table row under a `Constitution Check`
 * heading, strips decoration — emoji, bold, italic, code — drops any trailing
 * explanation after a dash, and returns the leading word upper-cased.
 *
 * Scoped to the section, and to the cell, for two different reasons. To the
 * SECTION, because a plan's other tables use the same row shape and none of
 * them carry gate statuses. To the CELL, because `DOR-06` previously matched
 * the whole row and so could not distinguish a gate that FAILED from one whose
 * status merely says `PASS — no FAIL conditions remain`.
 */
function planStatusCells(plan: string): string[] {
  const statuses: string[] = [];
  let inCheck = false;
  for (const line of plan.split(/\r?\n/)) {
    if (/^#{2,3}\s/.test(line)) {
      inCheck = /constitution check/i.test(line);
      continue;
    }
    if (!inCheck || !line.trimStart().startsWith('|')) continue;
    const cells = line.split('|').map((cell) => cell.trim()).filter((cell) => cell !== '');
    if (cells.length < 2) continue;
    const raw = cells[cells.length - 1] ?? '';
    // Separator row (`|---|---|`).
    if (/^[-: ]+$/.test(raw)) continue;
    const word = raw
      .replace(/[*_`]/g, '')
      .split(/\s[-—–]\s/)[0]
      ?.replace(/[^A-Za-z ]/g, '')
      .trim()
      .split(/\s+/)[0];
    if (word) statuses.push(word.toUpperCase());
  }
  return statuses;
}

// ------------------------------------------------------------- conditions

/**
 * Where application code lives (`DEF-026-001`, `T679`).
 *
 * The same list `G-27-09` uses for product source, plus `scripts/` — which
 * `T576`'s own note calls application code in as many words: *"`scripts/` is not
 * on Constitution I's exempt list, so this is application code and V is
 * NON-NEGOTIABLE."*
 *
 * `tests/**` is deliberately absent. Nothing in it ships; it IS the
 * verification, and a check does not need a check. Constitution I's rule that
 * `tests/governance/**` is not exempt concerns the COMMAND GATE — how a file may
 * be authored — not Constitution V.
 */
const APPLICATION_CODE_PATHS = [
  'backend/',
  'worker/',
  'packages/',
  'engine-adapters/',
  'agent-adapters/',
  'execution-providers/',
  'frontend/',
  'scripts/',
];

const CODE_EXTENSIONS = ['.ts', '.tsx', '.mts', '.cts', '.js', '.jsx', '.mjs', '.cjs'];

/**
 * Does this task line produce or change application code?
 *
 * Constitution V's actual wording is *"every task producing or changing
 * application code"*. `DOR-08` as first written applied to every task line, so
 * registering a path in a markdown file and publishing a closing report both
 * demanded a unit test — 12 false positives against EPIC-026, and a waiver to
 * close the epic (`DEF-026-001`).
 *
 * The test is deliberately narrow: a path that both **lives under an
 * application-code root** and **ends in a code extension**. A task citing a
 * design document alongside the file it writes is still caught, because the
 * document fails the extension test rather than excusing the file.
 */
function producesApplicationCode(line: string): boolean {
  // Paths appear in backticks by convention, but do not require them — a task
  // that omitted them would otherwise escape the condition entirely.
  const candidates = line.match(/[\w./-]+\.[A-Za-z]{1,4}\b/g) ?? [];
  return candidates.some((candidate) => {
    const path = candidate.replace(/^`|`$/g, '');
    if (!CODE_EXTENSIONS.some((extension) => path.endsWith(extension))) return false;
    if (!APPLICATION_CODE_PATHS.some((root) => path.startsWith(root))) return false;
    // A `.spec.ts` under `backend/tests/` is application-adjacent but is itself
    // the verification. EPIC-004 `T052` — "Integration test asserting ... in
    // backend/tests/integration/workspace-isolation.spec.ts" — is the test, and
    // demanding it name another one is the unsatisfiable-by-construction case.
    return !isTestArtifact(path);
  });
}

/**
 * A verification keyword followed by a real task reference.
 *
 * Not anchored to parentheses: this repository writes the pairing inside them,
 * after an em dash, and occasionally neither.
 */
const PAIRING =
  /(?:unit tests?|integration tests?|conformance(?:\s+checks?)?|checks?|tests?)\s*:\s*T\d{3}/i;

/**
 * A test named by its path rather than by a task id (`DEF-026-004`).
 *
 * Running the narrowed condition across all 28 Epics reported eight unpaired
 * tasks, and every one already had a real test. Three name that test in the task
 * line itself, as a path:
 *
 *     … ; unit test: `execution-providers/docker/tests/unit/egress-network-preflight.spec.ts`
 *
 * The `Tnnn` requirement exists to reject prose. A `.spec.ts` path is not prose
 * — it is a **stronger** reference than an id, naming the artifact instead of a
 * number that has to be looked up. Naming a second non-test file still fails.
 */
const PAIRING_BY_PATH = /[\w./-]+\.(?:spec|test)\.[A-Za-z]+\b/;

/** A file that IS a test, wherever it lives. */
function isTestArtifact(path: string): boolean {
  return /\.(?:spec|test)\.[A-Za-z]+$/.test(path) || /(?:^|\/)tests?\//.test(path);
}

/**
 * Which tasks a sibling test task declares it covers.
 *
 * This repository writes the pairing in **both** directions. EPIC-004 `T674`
 * names no test on its own line; its sibling `T674a` ends *"(Constitution V;
 * covers T674)"*. The pairing exists — it is recorded on the test rather than on
 * the implementation — and a check reading only one direction reports a gap that
 * is not there.
 */
function tasksCoveredBySiblings(lines: readonly string[]): Set<string> {
  const covered = new Set<string>();
  for (const line of lines) {
    for (const match of line.matchAll(/\bcovers?\s+(T\d{3}[a-z]?)/gi)) {
      if (match[1]) covered.add(match[1]);
    }
  }
  return covered;
}

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
    //
    // DEF-026-006 — read the ANSWER, not the label. This tested
    // `/not yet covered by SRS/` against the whole document, which matches the
    // field heading whatever follows it. A spec answering "none" scored exactly
    // like one listing sixteen uncovered requirements with nobody named, so
    // EPIC-017, EPIC-027 and EPIC-028 were refused for declaring full coverage.
    // The incentive ran backwards: deleting the sentence passed, answering it
    // honestly failed.
    const declared = /not yet covered by SRS\**\s*:\s*(.*)/i.exec(spec);
    const declaresNone = /^\**\s*(none|n\/a)\b/i.test(declared?.[1]?.trim() ?? '');
    const uncovered = declared !== null && !declaresNone;
    const owned = /back-fill owner/i.test(spec);
    const passed = !uncovered || owned;
    return {
      id: 'DOR-03',
      passed,
      detail: passed
        ? declaresNone
          ? 'traceability populated; no uncovered requirements declared'
          : 'traceability populated'
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
    //
    // DEF-026-009 — this was `/\|\s*(?:❌\s*)?FAIL\b/i`, which permits exactly
    // one marker before the word. `\s*` does not match `⚠️`, so `⚠️ FAIL`
    // scored as "Constitution Check clean". EPIC-029 carried that row — another
    // session live on the checkout — and reached `Ready` against the
    // instruction in the document DOR-06 had just read.
    //
    // Read the STATUS CELL rather than the row: a gate whose status says
    // "PASS — no FAIL conditions remain" is not a failure, and a row-wide match
    // cannot tell the difference.
    //
    // Statuses outside any vocabulary (`CANNOT ASSERT`, `PASS WITH DEBT`,
    // `PARTIAL` — 17 phrasings across 28 plans) keep their existing behaviour.
    // Rejecting them is `D-43`, and worth roughly forty rows of judgement that
    // does not belong inside a regex fix.
    const failedRows = planStatusCells(plan).filter((status) => status === 'FAIL');
    const failed = failedRows.length > 0;
    return {
      id: 'DOR-06',
      passed: !failed,
      detail: failed
        ? `plan.md Constitution Check records a FAIL (${failedRows.length})`
        : 'Constitution Check clean',
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
    // that produces APPLICATION CODE must name a unit test or a conformance
    // check (constitution v1.2.0 accepts either).
    const coveredBySibling = tasksCoveredBySiblings(lines);

    const unpaired = lines.filter((line) => {
      if (/write\s+(?:a\s+)?failing/i.test(line) || /\btests?\s+for\b/i.test(line)) return false;
      if (!producesApplicationCode(line)) return false;

      // The pairing, in whatever form this repository writes it.
      //
      // Chasing formats one at a time is how a detector accumulates epicycles.
      // Running the narrowed condition across all 28 Epics turned up four
      // spellings in real task lines:
      //
      //   (unit test: T002)                  the common case
      //   (unit tests: T053, T054)           plural
      //   (conformance: T556)                EPIC-028 T563
      //   … (partial) — unit test: T658      EPIC-001 T657, no parentheses
      //
      // So the rule is a verification keyword followed by a REAL task
      // reference, anywhere in the line. Requiring the `Tnnn` is what keeps it
      // precise: "check the output carefully" is prose, not a pairing.
      if (PAIRING.test(line) || PAIRING_BY_PATH.test(line)) return false;

      const id = /\bT\d{3}[a-z]?\b/.exec(line)?.[0];
      return !(id && coveredBySibling.has(id));
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
    //
    // DEF-026-008 — match ANY letter prefix, not `F` alone. This read `F\d+`,
    // while `/speckit-analyze` instructs authors to "generate stable IDs
    // prefixed by category initial" and demonstrates `A1`. Following the
    // command produced `D1`, `C1`, `U1` — none of which matched, so EPIC-029's
    // CRITICAL `D1` was reported as no blocking findings at all. The reader was
    // widened rather than the template changed, because that leaves every
    // record already written valid.
    // A resolved finding is history, not a blocker. Without this the widening
    // above would block every Epic that keeps its remediated findings in the
    // table — EPIC-026, closed since 2026-08-18, was the case that showed it.
    const blocking = findingRows(analysis)
      .filter((row) => !RESOLVED_FINDING.test(row))
      .filter((row) => {
        const severity = findingSeverity(row);
        return severity === 'CRITICAL' || severity === 'HIGH';
      });
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
export function evaluateDor(ctx: DorContext, kind: EpicKind = 'delivery'): DorResult {
  const config = loadStageConfig();

  const results = config.dorConditions.map((definition) => {
    // T683 — a condition declares which Epic kinds it reaches. Absence means
    // every kind: absence is not an exemption, or any Epic could escape a
    // condition by saying nothing.
    if (definition.appliesTo && !definition.appliesTo.includes(kind)) {
      return {
        id: definition.id,
        passed: false,
        applicable: false,
        detail: `not applicable to a ${kind} Epic — ${definition.reads} is not part of this kind`,
      };
    }
    return evaluateCondition(definition.id, ctx);
  });

  const failed = results.filter((result) => !result.passed && result.applicable !== false);
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

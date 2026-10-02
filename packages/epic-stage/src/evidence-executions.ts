/**
 * `T1563` (EPIC-044, `FR-EPB-002`–`FR-EPB-009`, `R-044-3`, `R-044-4`) — the
 * product's evidence adapter: execution records in, an evidence map out, fed to
 * the same contiguity rule the register uses (`deriveStageFromEvidence`).
 *
 * Only governed executions reach this function — provisional records are files
 * on a developer's machine and never rows here (`FR-EPB-002`). Every rule reads
 * what the hooks record — lifecycle states and the completion comment whose
 * format `EPIC-042`'s finish hook fixed — and nothing else.
 */
import type { StageDefinition } from './config.js';

export interface ExecutionRow {
  readonly executionId: string;
  readonly command: string;
  /** `registered | started | blocked | completed | partially-completed | failed | cancelled | timed-out`. */
  readonly state: string;
  readonly registeredAt: string;
  readonly completedAt: string | null;
  readonly completionComment: string | null;
}

export interface ExecutionEvidence {
  readonly evidence: Record<string, boolean>;
  /** The newest execution, whatever its outcome — what the card shows as last. */
  readonly last: ExecutionRow | null;
  /** The newest non-terminal execution, or null. */
  readonly running: ExecutionRow | null;
  /**
   * Commands of these executions that no stage's `reachedBy` names, in first-seen order. They
   * derive nothing; the card shows them as *unrecognised command* rather than a wrong stage
   * (spec §Edge Cases — the stage configuration changes; `T1617`).
   */
  readonly unrecognised: string[];
}

const NON_TERMINAL = new Set(['registered', 'started', 'blocked']);
const IMPLEMENT = 'implement';
const CONVERGE = 'converge';
const IMPLEMENTING = 'Implementing';
const CONVERGED = 'Converged';
/** The finish hook's completion comment names the files that changed or are new. */
const TASKS_FILE = /\btasks\.md\b/;

function byRegistration(a: ExecutionRow, b: ExecutionRow): number {
  return a.registeredAt.localeCompare(b.registeredAt) || a.executionId.localeCompare(b.executionId);
}

function reached(row: ExecutionRow): boolean {
  return row.state === 'completed' || (row.command === IMPLEMENT && row.state === 'partially-completed');
}

export function evidenceFromExecutions(rows: readonly ExecutionRow[], stages: readonly StageDefinition[]): ExecutionEvidence {
  // Oldest first, then id — the same answer for any arrival order (FR-EPB-009).
  const ordered = [...rows].sort(byRegistration);
  const latestOf = (command: string): ExecutionRow | null => [...ordered].reverse().find((r) => r.command === command) ?? null;

  const evidence: Record<string, boolean> = {};
  for (const stage of stages) {
    if (!stage.reachedBy) {
      evidence[stage.name] = false;
      continue;
    }
    let present = ordered.some((r) => r.command === stage.reachedBy && reached(r));
    if (stage.name === IMPLEMENTING) {
      const latest = latestOf(IMPLEMENT);
      if (latest && NON_TERMINAL.has(latest.state)) present = true;
    }
    if (stage.name === CONVERGED) {
      const latest = latestOf(CONVERGE);
      present = false;
      if (latest && latest.state === 'completed' && !TASKS_FILE.test(latest.completionComment ?? '')) {
        const after = latest.completedAt ?? latest.registeredAt;
        const implementAfter = ordered.some((r) => r.command === IMPLEMENT && r.registeredAt > after);
        present = !implementAfter;
      }
    }
    evidence[stage.name] = present;
  }

  const last = ordered.length > 0 ? ordered[ordered.length - 1]! : null;
  const running = [...ordered].reverse().find((r) => NON_TERMINAL.has(r.state)) ?? null;
  const known = new Set(stages.map((s) => s.reachedBy).filter((c): c is string => typeof c === 'string'));
  const unrecognised = [...new Set(ordered.map((r) => r.command).filter((c) => !known.has(c)))];
  return { evidence, last, running, unrecognised };
}

export interface BindableEpic {
  readonly id: string;
  readonly number: number;
  readonly parentNumber?: number | null | undefined;
  readonly splitSuffix?: string | null | undefined;
}

export interface BoundExecutions<R extends ExecutionRow & { readonly targetId: string }> {
  readonly byEpic: Map<string, R[]>;
  /** Executions whose target names no Epic of the project — listed, never attached (FR-EPB-008). */
  readonly unbound: R[];
}

/**
 * Which Epic an execution belongs to: a plain integer by `number`; `<number><letter>`
 * through the child whose parent has that number and whose split suffix is that
 * letter (`R-044-3`). Anything else is unbound.
 */
export function bindExecutions<R extends ExecutionRow & { readonly targetId: string }>(rows: readonly R[], epics: readonly BindableEpic[]): BoundExecutions<R> {
  const byNumber = new Map(epics.map((e) => [e.number, e.id]));
  const bySuffix = new Map(epics.filter((e) => e.parentNumber !== null && e.parentNumber !== undefined && e.splitSuffix).map((e) => [`${e.parentNumber}${e.splitSuffix}`, e.id]));
  const byEpic = new Map<string, R[]>();
  const unbound: R[] = [];
  for (const row of [...rows].sort(byRegistration)) {
    const numeric = /^(\d+)$/.exec(row.targetId);
    const suffixed = /^(\d+)([a-z])$/.exec(row.targetId);
    const id = numeric ? byNumber.get(Number(numeric[1])) : suffixed ? bySuffix.get(row.targetId) : undefined;
    if (!id) {
      unbound.push(row);
      continue;
    }
    const list = byEpic.get(id) ?? [];
    list.push(row);
    byEpic.set(id, list);
  }
  return { byEpic, unbound };
}

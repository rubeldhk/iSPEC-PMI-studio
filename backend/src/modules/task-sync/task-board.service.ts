/**
 * `T1713` (EPIC-046, data-model.md §8, `contracts/board-contract.md`) — the
 * board projection.
 *
 * Everything here is derived on read. There is no board table and no stored
 * column: `FR-KAN-056` requires every surface to show the same value from the
 * same derivation, and the only way to hold that is to have one derivation and
 * no cache beside it.
 *
 * ## It reads rows, never files
 *
 * The `tasks.md` content belongs to `EPIC-045`'s artifact store; the board has
 * no business fetching it, and `SC-KAN-007`'s two-second budget assumes it does
 * not. The store this service is given exposes no content method at all, and
 * `task-board.service.spec.ts` asserts that absence rather than trusting it.
 *
 * ## The header is what the board is a view OF
 *
 * `FR-KAN-052`. A board with no provenance is a list of assertions: the header
 * names the execution, the digest and the time of the latest parse, and the
 * counts that make `SC-KAN-001`'s arithmetic checkable by eye.
 */
import type {
  StatusSource,
  SyncedTaskRecord,
  TaskStatusValue,
  TaskSyncRecord,
  TaskSyncStore,
} from './task-sync.store.js';
import type { RefusalCode } from './task-sync.store.js';
import type { ProgressReport, TaskEventService } from './task-event.service.js';
import type { ExecutionReader } from './task-sync.service.js';
import {
  foldProposalState,
  latestAppliedProposal,
  type AppliedProposal,
  type OutstandingProposal,
  type ProposalVerdictEvent,
} from './proposal-state.js';

/** The column order of `contracts/board-contract.md` §3. Configuration, not a literal in a screen. */
export const BOARD_COLUMNS: readonly TaskStatusValue[] = ['not_started', 'in_progress', 'done', 'blocked'];

export interface BoardColumn {
  readonly status: TaskStatusValue;
  readonly taskKeys: readonly string[];
}

export interface BoardCard {
  readonly id: string;
  readonly taskKey: string | null;
  readonly description: string;
  readonly status: TaskStatusValue;
  readonly parallel: boolean;
  readonly sourceLine: number | null;
  readonly sourcePaths: readonly string[];
  /** What last moved it — a parse, an event, a completion or an applied proposal. */
  readonly movedBy: StatusSource;
  readonly movedAt: Date | null;
  readonly movedByActorId: string | null;
  /** The latest parse did not contain this key; it is kept and marked (`FR-KAN-025`). */
  readonly notInLatestParse: boolean;
  /**
   * A proposal that did NOT apply (`FR-KAN-014`, `FR-KAN-015`).
   *
   * Awaiting approval, refused, inconsistent — each leaves the card where it was
   * and must say so ON the card. Before `T1782` the verdict lived in one HTTP
   * response and vanished with the dialog, so a person who looked away lost it.
   */
  readonly outstandingProposal: OutstandingProposal | null;
  /**
   * The file overruled a manual status (`FR-KAN-022`).
   *
   * Names the proposal, its verdict and the **digest of the parse that
   * superseded it**, because *a manual status was superseded* with no way to see
   * which parse did it is a sentence a reader cannot act on. The proposal record
   * itself is untouched — that is the other half of the requirement, and the one
   * a screen cannot show.
   */
  readonly supersededByFile: {
    readonly proposalId: string;
    readonly requestedStatus: TaskStatusValue;
    readonly verdict: string;
    readonly proposerId: string;
    readonly supersedingDigest: string;
  } | null;
}

export interface LatestParse {
  readonly syncId: string;
  readonly executionId: string;
  readonly digest: string;
  readonly syncedAt: Date;
  /** The run this parse came from. Null when the execution cannot be read. */
  readonly command: string | null;
  /**
   * Its terminal outcome — `completed`, `partially-completed`, and the rest.
   *
   * Shown BESIDE the cards, never applied to them: a terminal outcome never
   * moves a card (`FR-KAN-045`). `partially-completed` says a run stopped
   * early; the file and the events say what is done, and conflating the two
   * is how a board starts asserting things no file says.
   */
  readonly outcome: string | null;
}

/**
 * The Epic's latest execution, whether or not it synced anything
 * (`FR-KAN-048`).
 *
 * `at` is the run's **registration** — when the run began, which is the time
 * an execution *is*. A run that never reached its finish sequence has no
 * later time to offer, and that is exactly the run this exists to notice.
 */
export interface EpicRunRow {
  readonly executionId: string;
  readonly command: string;
  readonly at: string;
}

export interface EpicRunReader {
  latestForEpic(workspaceId: string, epicId: string): Promise<EpicRunRow | null>;
}

/**
 * The board is behind the Epic (`FR-KAN-048`).
 *
 * A run that could not reach PMI Studio at its finish — or whose file was
 * refused whole — leaves an execution with no parse behind it. Nothing is
 * guessed from such a run and no card is partially built from one: the only
 * thing added is this note, which stops a reader taking an out-of-date board
 * for a current one.
 *
 * Both times are named because a note that says only *stale* invites the
 * reader to guess how stale. `parsedAt` is the `Date` of `latestParse`,
 * `executionAt` the ISO string the run reader gives; they meet as the same
 * instant on the wire.
 */
export interface BoardStaleness {
  readonly executionId: string;
  readonly command: string;
  readonly executionAt: string;
  readonly parsedAt: Date;
}

export interface BoardCounts {
  readonly linesConsidered: number;
  readonly parsed: number;
  readonly refused: number;
  readonly duplicates: number;
}

export interface BoardView {
  readonly epicId: string;
  readonly columns: readonly BoardColumn[];
  readonly tasks: readonly BoardCard[];
  readonly latestParse: LatestParse | null;
  readonly counts: BoardCounts;
  readonly diff: { readonly added: number; readonly changed: number; readonly unchanged: number; readonly disappeared: number };
  readonly refusedLines: readonly { line: number; code: RefusalCode; text: string }[];
  readonly outOfBandEdit: boolean;
  /**
   * The run this board's latest parse came from, and — for `implement` — how
   * many tasks the file it synced still leaves unchecked (`FR-KAN-044`).
   *
   * A terminal outcome NEVER moves a card (`FR-KAN-045`): `partially-completed`
   * is a fact about the run, and the file and the events are the facts about
   * the tasks. It is shown so a reader can see both, not so one implies the
   * other.
   */
  readonly remainingUnchecked: number;
  /** Reports naming an identifier no row carries yet — listed, never invented. */
  readonly unmatchedProgress: readonly ProgressReport[];
  /**
   * Set when the latest parse is older than the Epic's latest execution
   * (`FR-KAN-048`). Null means level, never synced, or not knowable —
   * the board claims staleness only when it can name the run it is behind.
   */
  readonly staleness: BoardStaleness | null;
  /**
   * Whether the reader may move a card (`BR-0003`, `T1789`).
   *
   * On the READ, so the board can render read-only rather than offering a
   * control that submits and comes back refused. Defaults to `false` when the
   * caller resolves no permission: a board that assumes permission it was not
   * told about is the hardcoded `canMove: true` this replaced.
   */
  readonly canMove: boolean;
}

/**
 * `EPIC-045`'s stored `tasks.md` for an execution, by digest (`FR-KAN-036`).
 *
 * Optional: an Epic whose artifacts were never synced has nothing to compare
 * against, and absence is not disagreement.
 */
export interface ArtifactDigestPort {
  digestForExecution(workspaceId: string, executionId: string): Promise<string | null>;
}

export interface Disagreements {
  readonly aheadOfFile: readonly { taskKey: string; status: TaskStatusValue }[];
  readonly notInLatestParse: readonly { taskKey: string }[];
  readonly unmatchedProgress: readonly ProgressReport[];
  readonly refusedLines: readonly { line: number; code: RefusalCode; text: string }[];
  readonly outOfBandEdit: boolean;
  /** The parse and the stored `tasks.md` disagree about which bytes were read. */
  readonly digestMismatch: { parsed: string; artifact: string } | null;
  /** So the header can state a number rather than a vague 'some'. */
  readonly total: number;
}

/**
 * `EPIC-045`'s stored `tasks.md` for an execution, by digest (`FR-KAN-036`).
 *
 * Optional: an Epic whose artifacts were never synced has nothing to compare
 * against, and absence is not disagreement.
 */
/**
 * A task sync that found no Epic (`FR-KAN-032`, `T1793`).
 *
 * `FR-EPB-008`'s rule, inherited: an unbound execution is **listed, never
 * attached**. Enough to recognise the run and see what it parsed, without
 * pretending it belongs anywhere.
 */
export interface UnboundTaskSync {
  readonly syncId: string;
  readonly executionId: string;
  readonly command: string | null;
  readonly tasksDigest: string;
  readonly syncedAt: Date;
  readonly counts: BoardCounts;
  /** The identifiers this sync parsed — what is stranded, by name. */
  readonly taskKeys: readonly string[];
}

export interface UnboundTaskSyncs {
  readonly projectId: string;
  readonly syncs: readonly UnboundTaskSync[];
}

export interface TaskBoardDeps {
  readonly store: TaskSyncStore;
  readonly artifacts?: ArtifactDigestPort | undefined;
  /** Reads the run behind the latest parse. Optional; absent means unknown, not zero. */
  readonly executions?: ExecutionReader | undefined;
  /**
   * The unmatched progress reports (`FR-KAN-042`). Optional so the board's own
   * unit suite can render without an event source; the module supplies it.
   */
  readonly events?: Pick<TaskEventService, 'unmatched'> | undefined;
  /**
   * The Epic's latest execution, for the staleness note (`FR-KAN-048`).
   * Optional: with no run source the board reports no staleness, because
   * absence of a reading is not a claim that the board is behind.
   */
  readonly runs?: EpicRunReader | undefined;
  /**
   * The recorded verdicts of the Epic's proposals (`T1782`). Optional: with no
   * source, no card claims an outstanding proposal — absence is not *awaiting
   * approval*, which is the one thing this must never invent.
   */
  readonly verdicts?: { verdictsForEpic(workspaceId: string, epicId: string): Promise<ProposalVerdictEvent[]> } | undefined;
}

const NO_COUNTS: BoardCounts = { linesConsidered: 0, parsed: 0, refused: 0, duplicates: 0 };

function card(
  row: SyncedTaskRecord,
  outstanding: OutstandingProposal | null = null,
  superseded: BoardCard['supersededByFile'] = null,
): BoardCard {
  return {
    id: row.id,
    taskKey: row.taskKey,
    description: row.description,
    status: row.status,
    parallel: row.parallel,
    sourceLine: row.sourceLine,
    sourcePaths: row.sourcePaths,
    movedBy: row.statusSource,
    movedAt: row.lastMovedAt,
    movedByActorId: row.lastMovedBy,
    notInLatestParse: !row.presentInLatestParse,
    outstandingProposal: outstanding,
    supersededByFile: superseded,
  };
}

export class TaskBoardService {
  constructor(private readonly deps: TaskBoardDeps) {}

  async board(workspaceId: string, epicId: string, canMove = false): Promise<BoardView> {
    const [rows, latest] = await Promise.all([
      this.deps.store.tasksForEpic(workspaceId, epicId),
      this.deps.store.latestSyncForEpic(workspaceId, epicId),
    ]);
    // `FR-KAN-014`/`FR-KAN-015`: what a person asked for and has not been
    // answered on. Two reads and a pure fold — no per-card query.
    const outstanding = await this.outstandingProposals(workspaceId, epicId);
    // `FR-KAN-022`: which tasks the latest parse overruled, and with what.
    const superseded = await this.supersessions(workspaceId, epicId, latest);
    const tasks = rows.map((row) =>
      card(row, outstanding.get(row.id) ?? null, superseded.get(row.id) ?? null),
    );
    const header = latest === null ? null : await this.header(workspaceId, latest);

    return {
      epicId,
      columns: BOARD_COLUMNS.map((status) => ({
        status,
        // Every task in exactly one column, in the file's own order.
        taskKeys: tasks.filter((t) => t.status === status).map((t) => t.taskKey ?? t.id),
      })),
      tasks,
      latestParse: header,
      counts: latest === null ? NO_COUNTS : {
        linesConsidered: latest.linesConsidered,
        parsed: latest.parsed,
        refused: latest.refused,
        duplicates: latest.duplicates,
      },
      diff: latest === null
        ? { added: 0, changed: 0, unchanged: 0, disappeared: 0 }
        : { added: latest.added, changed: latest.changed, unchanged: latest.unchanged, disappeared: latest.disappeared },
      refusedLines: latest === null ? [] : await this.refusedLines(latest.id),
      outOfBandEdit: latest?.outOfBandEdit ?? false,
      // Counted from the ROWS, not from the run's outcome: `partially-completed`
      // says a run stopped early, which is not the same claim as a task being
      // unchecked, and conflating them is how a board starts asserting things
      // no file says (FR-KAN-045).
      remainingUnchecked: tasks.filter((t) => !t.notInLatestParse && t.status !== 'done').length,
      unmatchedProgress: (await this.deps.events?.unmatched(workspaceId, epicId)) ?? [],
      staleness: await this.staleness(workspaceId, epicId, header),
      canMove,
    };
  }

  /**
   * Whether the board is behind the Epic (`FR-KAN-048`), and by how far.
   *
   * An Epic that has never synced is **empty**, not stale: it has no parse to
   * be behind with, and calling it stale would tell a reader something is
   * missing when nothing has been read yet.
   */
  private async staleness(workspaceId: string, epicId: string, header: LatestParse | null): Promise<BoardStaleness | null> {
    if (header === null || this.deps.runs === undefined) return null;
    const run = await this.deps.runs.latestForEpic(workspaceId, epicId);
    if (run === null) return null;
    const at = new Date(run.at);
    if (Number.isNaN(at.getTime()) || at.getTime() <= header.syncedAt.getTime()) return null;
    return { executionId: run.executionId, command: run.command, executionAt: run.at, parsedAt: header.syncedAt };
  }

  /**
   * The project's task syncs that found no Epic (`FR-KAN-032`, `T1793`).
   *
   * Per PROJECT, not per Epic, because there is no Epic to hang it on — that is
   * the whole condition. An Epic-keyed read can never surface a sync that
   * belongs to none, which is how these stayed invisible: every other read this
   * module offers is scoped to an Epic.
   *
   * Reading it attaches nothing. `FR-EPB-008` says listed, never attached, and
   * a read that quietly bound a stranded sync to a plausible Epic would be
   * guessing at exactly the point the rule exists to stop guessing.
   */
  async unbound(workspaceId: string, projectId: string): Promise<UnboundTaskSyncs> {
    const rows = await this.deps.store.unboundSyncs(workspaceId, projectId);
    const ordered = [...rows].sort(
      (a, b) => b.syncedAt.getTime() - a.syncedAt.getTime() || b.id.localeCompare(a.id),
    );
    const syncs = await Promise.all(
      ordered.map(async (row) => {
        const [run, lines] = await Promise.all([
          this.deps.executions?.find(workspaceId, row.executionId) ?? null,
          this.deps.store.linesFor(row.id),
        ]);
        return {
          syncId: row.id,
          executionId: row.executionId,
          command: run?.command ?? null,
          tasksDigest: row.tasksDigest,
          syncedAt: row.syncedAt,
          counts: {
            linesConsidered: row.linesConsidered,
            parsed: row.parsed,
            refused: row.refused,
            duplicates: row.duplicates,
          },
          taskKeys: lines
            .filter((l) => l.outcome === 'parsed' && l.taskKey !== null)
            .map((l) => l.taskKey as string),
        };
      }),
    );
    return { projectId, syncs };
  }

  /**
   * The open disagreements (`FR-KAN-024`).
   *
   * Every entry names both sides. Nothing here resolves anything: `FR-KAN-020`
   * requires a disagreement be **surfaced**, and a projection that quietly
   * picked a winner would be the silent resolution the requirement forbids.
   */
  async disagreements(workspaceId: string, epicId: string): Promise<Disagreements> {
    const [rows, latest] = await Promise.all([
      this.deps.store.tasksForEpic(workspaceId, epicId),
      this.deps.store.latestSyncForEpic(workspaceId, epicId),
    ]);

    // A status a person set that the file cannot confirm. Read from the ROW's
    // own source rather than the manifest marker, so a task that has been
    // ahead of the file for several syncs still says so.
    const aheadOfFile = rows
      .filter((r) => r.statusSource === 'proposal' && (r.status === 'in_progress' || r.status === 'blocked'))
      .map((r) => ({ taskKey: r.taskKey ?? r.id, status: r.status }));

    const notInLatestParse = rows.filter((r) => !r.presentInLatestParse).map((r) => ({ taskKey: r.taskKey ?? r.id }));
    const unmatchedProgress = (await this.deps.events?.unmatched(workspaceId, epicId)) ?? [];
    const refusedLines = latest === null ? [] : await this.refusedLines(latest.id);

    let digestMismatch: { parsed: string; artifact: string } | null = null;
    if (latest !== null && this.deps.artifacts !== undefined) {
      const artifact = await this.deps.artifacts.digestForExecution(workspaceId, latest.executionId);
      // Absence is not disagreement: an Epic whose artifacts were never synced
      // has nothing to compare against, and saying otherwise would fill the
      // list with findings about a feature nobody used.
      if (artifact !== null && artifact !== latest.tasksDigest) {
        digestMismatch = { parsed: latest.tasksDigest, artifact };
      }
    }

    const outOfBandEdit = latest?.outOfBandEdit ?? false;
    return {
      aheadOfFile,
      notInLatestParse,
      unmatchedProgress,
      refusedLines,
      outOfBandEdit,
      digestMismatch,
      total:
        aheadOfFile.length +
        notInLatestParse.length +
        unmatchedProgress.length +
        refusedLines.length +
        (outOfBandEdit ? 1 : 0) +
        (digestMismatch === null ? 0 : 1),
    };
  }

  /**
   * The outstanding proposal per task (`T1782`, data-model.md §8).
   *
   * With no verdict source, every card reports none. That is deliberate: an
   * unadjudicated proposal and an unreadable one look identical from here, and
   * calling either *awaiting approval* would state a verdict nobody gave.
   */
  private async outstandingProposals(workspaceId: string, epicId: string): Promise<Map<string, OutstandingProposal>> {
    if (this.deps.verdicts === undefined) return new Map();
    const [proposals, verdicts] = await Promise.all([
      this.deps.store.proposalsForEpic(workspaceId, epicId),
      this.deps.verdicts.verdictsForEpic(workspaceId, epicId),
    ]);
    return foldProposalState(proposals, verdicts);
  }

  /**
   * The tasks the latest parse superseded, with what it superseded (`T1788`).
   *
   * Read from the **latest parse's manifest**, not from the row: supersession is
   * a fact about one parse, and a task superseded three syncs ago has long since
   * settled. The marker is on the line because that is where the sync recorded
   * it; the proposal and its verdict come from the same fold the outstanding
   * projection uses; the digest is the parse's own.
   */
  private async supersessions(
    workspaceId: string,
    epicId: string,
    latest: TaskSyncRecord | null,
  ): Promise<Map<string, NonNullable<BoardCard['supersededByFile']>>> {
    const out = new Map<string, NonNullable<BoardCard['supersededByFile']>>();
    if (latest === null || this.deps.verdicts === undefined) return out;

    const lines = await this.deps.store.linesFor(latest.id);
    const supersededKeys = new Set(
      lines.filter((l) => l.marker === 'supersededByFile' && l.taskKey !== null).map((l) => l.taskKey as string),
    );
    if (supersededKeys.size === 0) return out;

    const [rows, proposals, verdicts] = await Promise.all([
      this.deps.store.tasksForEpic(workspaceId, epicId),
      this.deps.store.proposalsForEpic(workspaceId, epicId),
      this.deps.verdicts.verdictsForEpic(workspaceId, epicId),
    ]);
    const applied = latestAppliedProposal(proposals, verdicts);

    for (const row of rows) {
      if (row.taskKey === null || !supersededKeys.has(row.taskKey)) continue;
      const proposal: AppliedProposal | undefined = applied.get(row.id);
      // No applied proposal behind it means nothing was overruled. The marker
      // without the proposal is a claim this cannot substantiate, so it is not
      // made — reporting *superseded* with nothing to name is the vagueness
      // `FR-KAN-022` exists to forbid.
      if (proposal === undefined) continue;
      out.set(row.id, {
        proposalId: proposal.proposalId,
        requestedStatus: proposal.requestedStatus,
        verdict: proposal.verdict,
        proposerId: proposal.proposerId,
        supersedingDigest: latest.tasksDigest,
      });
    }
    return out;
  }

  private async header(workspaceId: string, sync: TaskSyncRecord): Promise<LatestParse> {
    const run = (await this.deps.executions?.find(workspaceId, sync.executionId)) ?? null;
    return {
      syncId: sync.id,
      executionId: sync.executionId,
      digest: sync.tasksDigest,
      syncedAt: sync.syncedAt,
      command: run?.command ?? null,
      outcome: run?.state ?? null,
    };
  }

  /**
   * `contracts/board-contract.md` §2a. Both a refused line and a duplicate carry
   * a code, and both are shown: a duplicate that vanished from the board would
   * be exactly the silent drop `FR-KAN-003` exists to prevent.
   */
  private async refusedLines(syncId: string): Promise<{ line: number; code: RefusalCode; text: string }[]> {
    const manifest = await this.deps.store.linesFor(syncId);
    return manifest
      .filter((m) => m.refusalCode !== null)
      .map((m) => ({ line: m.lineNumber, code: m.refusalCode as RefusalCode, text: m.rawText }));
  }
}

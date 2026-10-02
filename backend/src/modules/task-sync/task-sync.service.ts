/**
 * `T1704` (EPIC-046, data-model.md §9) — the sync, step by step.
 *
 * One governed `tasks` or `implement` command's finish hook calls this once,
 * with the Epic's `tasks.md` as text. What comes back is a **diff**: what was
 * added, what changed, what did not, what is no longer there, and every line the
 * grammar refused with its code.
 *
 * ## The Epic comes from the execution, never from the path
 *
 * `FR-KAN-030`. `bindExecutions` decides, so the Epic a task sync attaches to
 * and the Epic the Spec Journey Board attaches the same execution to cannot
 * disagree — the rule `EPIC-045` established and this Epic restates rather than
 * re-derives. Unresolvable is `null`: stored unbound, never guessed.
 *
 * ## Idempotence is the store's job, not a check here
 *
 * `FR-KAN-038`. This service never asks "does this sync exist?" before writing
 * one — two syncs running at once would both be told *no*. It calls
 * `recordSync`, which inserts and reads back on the unique violation.
 * `DEF-045-002` was exactly the other shape, one Epic ago.
 *
 * ## A whole file, or none of it
 *
 * `FR-KAN-039`. Unlike the artifact sync, a bad file refuses the **whole** sync:
 * a half-parsed task list is a board that lies about a denominator. Per-*line*
 * refusals are different and cost one line each (`FR-KAN-003`).
 *
 * ## The status is `reconcile`'s to decide, never this file's
 *
 * Every status written here comes from `task-reconcile.ts`. That is the point of
 * having it: the rules are reviewable as a table because nothing else sets a
 * status behind their back.
 */
import { bindExecutions, type BindableEpic } from '@pmi/epic-stage';
import { NotFoundError, ValidationFailedError } from '../../core/errors.js';
import { parseTasks, type ParsedTaskLine, type TaskGrammarConfig } from './task-grammar.js';
import { reconcile, type Previous } from './task-reconcile.js';
import { deriveSyncKey, tasksDigest, validateTasksFile, type TaskSyncLimits } from './task-validation.js';
import type {
  ChangeKind,
  NewTaskSyncLine,
  RefusalCode,
  SyncedTaskRecord,
  TaskStatusValue,
  TaskSyncStore,
} from './task-sync.store.js';

/**
 * The text a refused line may be reported with.
 *
 * `FR-KAN-073`. A credential-bearing line is never quoted — not in the manifest
 * row, and not in the answer that goes back over MCP. One function, used by
 * both, because the first version of this file redacted only the row and the
 * integration test caught the answer still carrying the secret.
 */
function safeText(line: ParsedTaskLine): string {
  return line.refusalCode === 'credential_in_description' ? '<redacted: a credential shape was found>' : line.rawText;
}

/** The commands whose completion carries a `tasks.md` (`FR-KAN-033`). */
const TASK_BEARING_COMMANDS = new Set(['tasks', 'implement']);

export interface ExecutionLookupRow {
  readonly executionId: string;
  readonly workspaceId: string;
  readonly projectId: string | null;
  readonly command: string;
  readonly initiatorId: string;
  readonly state: string;
  readonly registeredAt: string;
  readonly completedAt: string | null;
  readonly completionComment: string | null;
  readonly targetType: string | null;
  readonly targetId: string | null;
  readonly agentAdapter: string | null;
  readonly agentVersion: string | null;
}

export interface ExecutionReader {
  find(workspaceId: string, executionId: string): Promise<ExecutionLookupRow | null>;
}

export interface EpicLister {
  list(workspaceId: string, projectId: string): Promise<readonly (BindableEpic & { readonly slug: string })[]>;
}

export interface SyncCommentPort {
  add(input: {
    workspaceId: string;
    executionId: string;
    authorId: string;
    authorType: 'service';
    commentType: 'system';
    body: string;
    idempotencyKey: string;
  }): Promise<{ commentId: string }>;
}

export interface SyncAuditPort {
  record(row: {
    workspaceId: string;
    actorId: string | null;
    action: 'create' | 'update';
    targetType: string;
    targetId: string;
    outcome: 'success';
    detail: Record<string, unknown>;
  }): Promise<void>;
}

/**
 * `T1783` — a synced task resolves back to its Epic (plan touch-point).
 *
 * `EPIC-011`'s traceability graph knew task→specification only. `Q1` made a
 * synced task's specification optional, so a task parsed from an Epic whose
 * `spec.md` had not synced resolved back to **nothing**. This writes the edge
 * the plan called for; the specification edge, where one exists, stays
 * `EPIC-012`'s to write.
 *
 * Optional, and failures are swallowed: a traceability link is a derived
 * convenience and the parse is the fact. A sync that refused to record a file
 * because a graph edge could not be written would trade the authoritative
 * record for the derived one.
 */
export interface TaskLinkPort {
  linkTasksToEpic(input: { workspaceId: string; epicId: string; taskIds: string[] }): Promise<unknown>;
}

/** The Epic's specification, when it has one. Optional by `Q1`: a task's home is its Epic. */
export interface EpicSpecificationPort {
  findForEpic(workspaceId: string, epicId: string): Promise<{ id: string } | null>;
}

export interface TaskSyncDeps {
  readonly store: TaskSyncStore;
  /**
   * Brings the Epic's rows into line with its progress reports after a sync
   * has rewritten them (`FR-KAN-047`). Optional so the unit suites can drive
   * the parse without an event source; the module always supplies it.
   */
  readonly progress?: { applyFor(workspaceId: string, epicId: string): Promise<unknown> };
  readonly executions: ExecutionReader;
  readonly epics: EpicLister;
  readonly comments: SyncCommentPort;
  readonly audit: SyncAuditPort;
  readonly specifications?: EpicSpecificationPort;
  /** Writes task→Epic traceability (`T1783`). Optional; absence links nothing. */
  readonly links?: TaskLinkPort | undefined;
  readonly grammar: TaskGrammarConfig;
  readonly limits: () => TaskSyncLimits;
}

export interface SyncContext {
  readonly workspaceId: string;
  readonly projectId: string;
  readonly actorId: string | null;
}

export interface DiffEntry {
  readonly taskKey: string;
  readonly line?: number;
  readonly from?: string;
  readonly to?: string;
}

export interface SyncAnswer {
  readonly syncId: string;
  readonly epicId: string | null;
  readonly tasksDigest: string;
  readonly counts: { linesConsidered: number; parsed: number; refused: number; duplicates: number };
  readonly diff: {
    readonly added: DiffEntry[];
    readonly descriptionChanged: DiffEntry[];
    readonly checkboxChanged: DiffEntry[];
    readonly unchanged: number;
    readonly noLongerPresent: DiffEntry[];
  };
  readonly refusedLines: { line: number; code: RefusalCode; text: string }[];
  readonly markers: { aheadOfFile: string[]; supersededByFile: string[] };
  readonly outOfBandEdit: boolean;
}

export class TaskSyncService {
  constructor(private readonly deps: TaskSyncDeps) {}

  async sync(ctx: SyncContext, input: { executionId: string; tasksMarkdown: string }): Promise<SyncAnswer> {
    // 1 · the execution, and that it is this project's and task-bearing.
    const execution = await this.deps.executions.find(ctx.workspaceId, input.executionId);
    if (execution === null || execution.projectId !== ctx.projectId) {
      // Absence, not "forbidden": nothing about another project is disclosed.
      throw new NotFoundError('execution', input.executionId);
    }
    if (!TASK_BEARING_COMMANDS.has(execution.command)) {
      // FR-KAN-066: no NEW top-level refusal code. The specific code rides in
      // `details`, exactly as EPIC-045's per-file codes do, so a client that
      // already handles `validation_failed` needs no change to handle this.
      throw new ValidationFailedError(
        `A task sync belongs to a \`tasks\` or \`implement\` execution; this one is \`${execution.command}\`.`,
        { code: 'command_not_task_bearing', fields: [{ field: 'executionId', message: 'a task-bearing execution' }] },
      );
    }

    // 2 · the derived key. A replay returns the stored answer and writes nothing.
    const key = deriveSyncKey(input.executionId, input.tasksMarkdown);
    const replayed = await this.deps.store.findSyncByKey(ctx.workspaceId, key);
    if (replayed !== null) return this.answerFrom(replayed);

    // 3 · whole-file validation, BEFORE anything is written (FR-KAN-039).
    const file = validateTasksFile(input.tasksMarkdown, this.deps.limits());
    if (!file.ok) {
      throw new ValidationFailedError(file.detail, { code: file.code, fields: [{ field: 'tasksMarkdown', message: file.detail }] });
    }

    // 4 · the Epic, from the binding.
    const epicId = await this.resolveEpic(ctx, execution);

    // 5 · the parse.
    const parsed = parseTasks(input.tasksMarkdown, this.deps.grammar);
    const digest = tasksDigest(input.tasksMarkdown);

    // 6–7 · reconcile and upsert, then flag what the parse no longer contains.
    const existing = epicId === null ? [] : await this.deps.store.tasksForEpic(ctx.workspaceId, epicId);
    const byKey = new Map(existing.filter((t) => t.taskKey !== null).map((t) => [t.taskKey as string, t]));
    const lines: NewTaskSyncLine[] = [];
    // The moves this parse makes, held until the sync row exists: the audit
    // action names the sync as the CAUSE (data-model.md §11), and there is no
    // id to name until step 8. An added task is not a move — it is the create,
    // and the sync's own row already accounts for it.
    const moves: { taskId: string; taskKey: string; from: TaskStatusValue; to: TaskStatusValue }[] = [];
    const answer = this.emptyDiff();
    const seenKeys: string[] = [];

    for (const line of parsed.lines) {
      if (line.outcome !== 'parsed') {
        lines.push(this.refusedLine(line));
        if (line.refusalCode !== null) {
          // The SAME redaction the manifest row gets. The answer travels back
          // over MCP into the agent's transcript, so quoting the match here
          // would defeat the refusal in the one place it is most visible.
          answer.refusedLines.push({ line: line.lineNumber, code: line.refusalCode, text: safeText(line) });
        }
        continue;
      }
      const key2 = line.taskKey as string;
      seenKeys.push(key2);
      const before = byKey.get(key2) ?? null;
      const previous: Previous | null = before === null ? null : { status: before.status, statusSource: before.statusSource };
      const decided = reconcile(previous, { checked: line.checked });

      if (epicId !== null) {
        await this.deps.store.upsertTask({
          workspaceId: ctx.workspaceId,
          epicId,
          specificationId: (await this.deps.specifications?.findForEpic(ctx.workspaceId, epicId))?.id ?? before?.specificationId ?? null,
          taskKey: key2,
          description: line.description,
          status: decided.status,
          statusSource: decided.statusSource,
          // The AGENT that produced the file, from the execution's identity
          // snapshot — never a fabricated engine (BR-0035, FR-KAN-034).
          engineName: execution.agentAdapter ?? 'unknown',
          engineVersion: execution.agentVersion ?? 'unknown',
          sourceLine: line.lineNumber,
          sourceDigest: digest,
          parallel: line.parallel,
          sourcePaths: line.sourcePaths,
          presentInLatestParse: true,
          lastParsedExecutionId: execution.executionId,
          lastMovedAt: before?.lastMovedAt ?? null,
          lastMovedBy: before?.lastMovedBy ?? null,
        });
      }

      if (before !== null && before.status !== decided.status) {
        moves.push({ taskId: before.id, taskKey: key2, from: before.status, to: decided.status });
      }

      const changeKind = this.classify(before, line, decided.status);
      lines.push({
        lineNumber: line.lineNumber,
        rawText: line.rawText,
        outcome: 'parsed',
        refusalCode: null,
        taskKey: key2,
        changeKind,
        previousStatus: before?.status ?? null,
        newStatus: decided.status,
        marker: decided.marker,
      });
      this.tally(answer, changeKind, key2, line, before, decided.status);
      if (decided.marker === 'aheadOfFile') answer.markers.aheadOfFile.push(key2);
      if (decided.marker === 'supersededByFile') answer.markers.supersededByFile.push(key2);
    }

    const gone = existing.filter((t) => t.taskKey !== null && !seenKeys.includes(t.taskKey));
    if (epicId !== null) await this.deps.store.markAbsent(ctx.workspaceId, epicId, seenKeys);
    answer.diff.noLongerPresent = gone.map((t) => ({ taskKey: t.taskKey as string }));

    // 8 · the sync row and its manifest, with the out-of-band flag.
    const previousSync = epicId === null ? null : await this.deps.store.latestSyncForEpic(ctx.workspaceId, epicId);
    // FR-KAN-023, R-05. One governed command produces exactly one task sync —
    // `runFinish` calls the tool once — so a SECOND sync from the SAME execution
    // whose digest differs means the file moved with no new command to account
    // for it. Two syncs from different executions mean a command ran between
    // them, and flagging that would cry wolf on every `implement`.
    //
    // What it cannot see, stated rather than implied: a hand-edit made BETWEEN
    // two governed commands. The second command's sync is the first observation
    // of the new content, and a legitimate edit by that command is
    // indistinguishable from one made just before it. `FR-KAN-036`'s digest
    // cross-check against the artifact version is the other half of that story.
    const outOfBandEdit = previousSync !== null && previousSync.tasksDigest !== digest && previousSync.executionId === execution.executionId;
    const { row } = await this.deps.store.recordSync(
      {
        workspaceId: ctx.workspaceId,
        projectId: ctx.projectId,
        epicId,
        executionId: execution.executionId,
        actorId: ctx.actorId,
        idempotencyKey: key,
        tasksDigest: digest,
        linesConsidered: parsed.counts.linesConsidered,
        parsed: parsed.counts.parsed,
        refused: parsed.counts.refused,
        duplicates: parsed.counts.duplicates,
        added: answer.diff.added.length,
        changed: answer.diff.descriptionChanged.length + answer.diff.checkboxChanged.length,
        unchanged: answer.diff.unchanged,
        disappeared: gone.length,
        outOfBandEdit,
      },
      lines,
    );

    // 8b · a sync rewrote the rows, so the Epic's progress reports are applied
    // again over them. This is what makes `FR-KAN-042`'s *retained and matched
    // later* work without an inbox: a task the file has only just introduced
    // picks up the event that named it before it existed.
    //
    // It runs AFTER the sync row, not before, and the ordering is load-bearing:
    // the Epic's executions are found THROUGH `task_syncs`, so a reconciliation
    // that ran first could not see the events of the very run performing it.
    // `T1725` caught exactly that — the cards moved, but were attributed to the
    // file rather than to the implement events that reported them.
    if (epicId !== null && this.deps.progress !== undefined) {
      await this.deps.progress.applyFor(ctx.workspaceId, epicId);
    }

    // 9 · one `system` comment, so the developer sees a refusal on the timeline
    // rather than in a log nobody reads (EPIC-045's pattern).
    if (answer.refusedLines.length > 0) {
      await this.deps.comments.add({
        workspaceId: ctx.workspaceId,
        executionId: execution.executionId,
        authorId: execution.initiatorId,
        authorType: 'service',
        commentType: 'system',
        body: this.refusalComment(answer.refusedLines, parsed.counts),
        idempotencyKey: `tasks-sync-refusals:${row.id}`,
      });
    }

    // 9b · traceability: every task of this parse resolves back to its Epic
    // (`T1783`). Derived, so a failure here is recorded and never fails the
    // sync — the file's content is the fact and it is already stored.
    if (epicId !== null && this.deps.links !== undefined && seenKeys.length > 0) {
      const linked = (await this.deps.store.tasksForEpic(ctx.workspaceId, epicId))
        .filter((t) => t.taskKey !== null && seenKeys.includes(t.taskKey))
        .map((t) => t.id);
      try {
        await this.deps.links.linkTasksToEpic({ workspaceId: ctx.workspaceId, epicId, taskIds: linked });
      } catch {
        // Swallowed deliberately. See `TaskLinkPort`.
      }
    }

    // 10 · audit, then the diff.
    for (const move of moves) {
      await this.deps.audit.record({
        workspaceId: ctx.workspaceId,
        actorId: ctx.actorId,
        action: 'update',
        targetType: 'task',
        targetId: move.taskId,
        outcome: 'success',
        detail: { taskKey: move.taskKey, from: move.from, to: move.to, source: 'parse', causeId: row.id },
      });
    }
    await this.deps.audit.record({
      workspaceId: ctx.workspaceId,
      actorId: ctx.actorId,
      action: 'create',
      targetType: 'task_sync',
      targetId: row.id,
      outcome: 'success',
      detail: {
        executionId: execution.executionId,
        epicId,
        tasksDigest: digest,
        counts: parsed.counts,
        diff: { added: answer.diff.added.length, changed: answer.diff.descriptionChanged.length + answer.diff.checkboxChanged.length, unchanged: answer.diff.unchanged, disappeared: gone.length },
        refusalCodes: answer.refusedLines.map((r) => r.code),
        outOfBandEdit,
      },
    });

    return { ...answer, syncId: row.id, epicId, tasksDigest: digest, counts: parsed.counts, outOfBandEdit };
  }

  // ------------------------------------------------------------- internals

  private emptyDiff(): SyncAnswer & { diff: { added: DiffEntry[]; descriptionChanged: DiffEntry[]; checkboxChanged: DiffEntry[]; unchanged: number; noLongerPresent: DiffEntry[] } } {
    return {
      syncId: '',
      epicId: null,
      tasksDigest: '',
      counts: { linesConsidered: 0, parsed: 0, refused: 0, duplicates: 0 },
      diff: { added: [], descriptionChanged: [], checkboxChanged: [], unchanged: 0, noLongerPresent: [] },
      refusedLines: [],
      markers: { aheadOfFile: [], supersededByFile: [] },
      outOfBandEdit: false,
    };
  }

  private refusedLine(line: ParsedTaskLine): NewTaskSyncLine {
    return {
      lineNumber: line.lineNumber,
      rawText: safeText(line),
      outcome: line.outcome,
      refusalCode: line.refusalCode,
      taskKey: line.taskKey,
      changeKind: null,
      previousStatus: null,
      newStatus: null,
      marker: null,
    };
  }

  private classify(before: SyncedTaskRecord | null, line: ParsedTaskLine, status: TaskStatusValue): ChangeKind {
    if (before === null) return 'added';
    if (before.description !== line.description) return 'description-changed';
    if (before.status !== status) return 'checkbox-changed';
    return 'unchanged';
  }

  private tally(
    answer: SyncAnswer & { diff: { added: DiffEntry[]; descriptionChanged: DiffEntry[]; checkboxChanged: DiffEntry[]; unchanged: number; noLongerPresent: DiffEntry[] } },
    kind: ChangeKind,
    taskKey: string,
    line: ParsedTaskLine,
    before: SyncedTaskRecord | null,
    status: TaskStatusValue,
  ): void {
    if (kind === 'added') answer.diff.added.push({ taskKey, line: line.lineNumber });
    else if (kind === 'description-changed') answer.diff.descriptionChanged.push({ taskKey, from: before?.description, to: line.description });
    else if (kind === 'checkbox-changed') answer.diff.checkboxChanged.push({ taskKey, from: before?.status, to: status });
    else answer.diff.unchanged += 1;
  }

  private refusalComment(refused: { line: number; code: RefusalCode }[], counts: { parsed: number; linesConsidered: number }): string {
    const detail = refused.map((r) => `line ${r.line}: ${r.code}`).join('; ');
    return `Task sync: ${counts.parsed} of ${counts.linesConsidered} considered lines parsed. Refused — ${detail}.`;
  }

  /** The stored answer for a replayed key — the counts as they were, not as the replay claims. */
  private async answerFrom(row: { id: string; epicId: string | null; tasksDigest: string; linesConsidered: number; parsed: number; refused: number; duplicates: number; unchanged: number; outOfBandEdit: boolean }): Promise<SyncAnswer> {
    const manifest = await this.deps.store.linesFor(row.id);
    return {
      syncId: row.id,
      epicId: row.epicId,
      tasksDigest: row.tasksDigest,
      counts: { linesConsidered: row.linesConsidered, parsed: row.parsed, refused: row.refused, duplicates: row.duplicates },
      // A replay changed nothing, so its diff is empty by definition — the
      // manifest of the original sync is where "what happened" still lives.
      diff: { added: [], descriptionChanged: [], checkboxChanged: [], unchanged: row.unchanged, noLongerPresent: [] },
      refusedLines: manifest
        .filter((m) => m.refusalCode !== null)
        .map((m) => ({ line: m.lineNumber, code: m.refusalCode as RefusalCode, text: m.rawText })),
      markers: {
        aheadOfFile: manifest.filter((m) => m.marker === 'aheadOfFile').map((m) => m.taskKey as string),
        supersededByFile: manifest.filter((m) => m.marker === 'supersededByFile').map((m) => m.taskKey as string),
      },
      outOfBandEdit: row.outOfBandEdit,
    };
  }

  /**
   * `bindExecutions` decides, so the Epic a task sync attaches to and the Epic
   * the board attaches the same execution to cannot disagree (`FR-KAN-030`).
   * Unresolvable is `null` — listed as unbound, never guessed.
   */
  private async resolveEpic(ctx: SyncContext, execution: ExecutionLookupRow): Promise<string | null> {
    if (execution.targetType !== 'epic' || execution.targetId === null) return null;
    const epics = await this.deps.epics.list(ctx.workspaceId, ctx.projectId);
    const row = {
      executionId: execution.executionId,
      command: execution.command,
      state: execution.state,
      registeredAt: execution.registeredAt,
      completedAt: execution.completedAt,
      completionComment: execution.completionComment,
      targetId: execution.targetId,
    };
    const { byEpic } = bindExecutions([row], epics);
    for (const [epicId, rows] of byEpic) {
      if (rows.some((r) => r.executionId === execution.executionId)) return epicId;
    }
    return null;
  }
}

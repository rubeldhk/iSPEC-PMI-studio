/**
 * T083b — the specification read surface: list, detail, edit (F-04.6,
 * **FR-012**).
 *
 * FR-012 had zero task coverage until the closing cross-artifact analysis finding
 * **E1** (RAID I-02) added F-04.6. This is that coverage.
 *
 * This file also holds the module's RECORD TYPES and its persistence port. They
 * live with the read service deliberately: it is the specification module's
 * persistence-facing service, and the alternative — a types file no task names
 * — would be application code produced outside a governed task (Constitution I).
 * The models themselves are `T077`, in `schema.prisma`; these are their
 * TypeScript shadow.
 *
 * Framework-free (PC-1). Wired in `specifications.module.ts`.
 */
import { randomUUID } from 'node:crypto';
import { NotFoundError, ValidationFailedError } from '../../core/errors.js';
import { assertSameWorkspace, type RefusalRecord } from '../../core/workspace.guard.js';
import type { EngineFailureReason } from '@pmi/engine-contract';

// ------------------------------------------------------------------ records

export const SPEC_LIFECYCLE_STATES = [
  'draft',
  'review',
  'approved',
  'baselined',
  'implemented',
  'archived',
] as const;

export type SpecLifecycleState = (typeof SPEC_LIFECYCLE_STATES)[number];

export interface SpecificationRecord {
  id: string;
  workspaceId: string;
  /** FR-010: exactly one project. */
  projectId: string;
  title: string;
  lifecycleState: SpecLifecycleState;
  currentVersionId: string | null;
  /** FR-022: never null, never blank. */
  engineName: string;
  engineVersion: string;
  generatedAt: Date;
  /** FR-032: flagged on a source-requirement change; never auto-corrected. */
  isOutOfDate: boolean;
  createdAt: Date;
  createdById: string;
  updatedAt: Date;
  updatedById: string;
}

export interface SpecificationVersionRecord {
  id: string;
  workspaceId: string;
  specificationId: string;
  versionNumber: number;
  /** R-007: the engine's output verbatim. */
  contentRaw: string;
  contentParsed: Record<string, unknown>;
  lifecycleStateAtCreation: SpecLifecycleState;
  authoredById: string;
  authoredAt: Date;
}

/**
 * The one edge this epic writes: `specification --generated_from--> requirement`.
 *
 * The link WRITER and the `TraceabilityLink` model are EPIC-011 (`T078`,
 * `T081`). What EPIC-008 owns is that the links are handed to the same commit
 * as the specification, complete — which is what makes SC-002 structural.
 */
export interface SpecificationTraceLink {
  workspaceId: string;
  sourceType: 'specification';
  sourceId: string;
  targetType: 'requirement';
  targetId: string;
  relationship: 'generated_from';
}

export interface SpecificationDetail extends SpecificationRecord {
  currentVersion: SpecificationVersionRecord | null;
}

export interface Page<T> {
  rows: T[];
  total: number;
  page: number;
  pageSize: number;
}

export interface ActingContext {
  workspaceId: string;
  userId: string;
}

/** A generated specification, its first version, its links, and the job — as ONE unit. */
export interface GenerationCommit {
  specification: Omit<SpecificationRecord, 'createdAt' | 'updatedAt'>;
  version: Omit<SpecificationVersionRecord, 'authoredAt'>;
  links: SpecificationTraceLink[];
  /**
   * T845 — `resultRef` points the job at what it produced, which is what the
   * contract's job body promises and Quickstart V4 step 4 ("open the resulting
   * specification") depends on. It is written in the SAME transaction as the
   * artifact, so a job can never claim a result that was rolled back.
   */
  job: { id: string; state: 'succeeded'; resultRef: string };
}

export interface JobOutcomeRecord {
  jobId: string;
  state: 'failed' | 'cancelled' | 'timed_out';
  failureReason: EngineFailureReason;
}

/** What search needs: a scoped candidate and the text to match against. */
export interface SearchCandidate {
  specification: SpecificationRecord;
  content: string;
}

// -------------------------------------------------------------------- ports

/**
 * The persistence port.
 *
 * There is deliberately NO delete: a specification is archived (FR-011b), and
 * a version is append-only (FR-013, SC-007). A port with no destructive
 * operation cannot regress into one.
 */
export interface SpecificationStore {
  /**
   * ONE call, ONE transaction: specification, version, links and the job's
   * terminal state. Not a sequence a caller could interleave — SC-002 ("zero
   * orphaned specifications") is a property of this signature.
   */
  commitGeneration(commit: GenerationCommit): Promise<SpecificationRecord>;

  /** A non-success terminal state, and NOTHING else (FR-027, SC-006). */
  recordJobOutcome(outcome: JobOutcomeRecord): Promise<void>;

  /**
   * Unscoped BY DESIGN — tenancy on id-fetches is enforced by
   * `assertSameWorkspace` in the service (EPIC-004 convergence F2), which is
   * what lets a refusal be RECORDED rather than collapsing into "no row".
   */
  findById(id: string): Promise<SpecificationRecord | null>;
  findVersion(id: string): Promise<SpecificationVersionRecord | null>;
  listForProject(
    workspaceId: string,
    projectId: string,
    window: { offset: number; limit: number },
  ): Promise<{ rows: SpecificationRecord[]; total: number }>;
  /** Newest version first. */
  listVersions(workspaceId: string, specificationId: string): Promise<SpecificationVersionRecord[]>;
  appendVersion(
    version: Omit<SpecificationVersionRecord, 'id' | 'authoredAt'>,
  ): Promise<SpecificationVersionRecord>;
  updateSpecification(
    workspaceId: string,
    id: string,
    data: Partial<Pick<SpecificationRecord, 'title' | 'currentVersionId' | 'updatedById'>>,
  ): Promise<SpecificationRecord>;

  /**
   * T113 (EPIC-009) — the ONE write path for lifecycle state. Deliberately not
   * part of `updateSpecification`: PATCH strips `lifecycleState` because state
   * moves only through the transition endpoints, where the permitted set and
   * the FR-014 record are enforced. A second writer would bypass both.
   */
  setLifecycleState(
    workspaceId: string,
    id: string,
    state: SpecificationRecord['lifecycleState'],
    actorId: string,
  ): Promise<SpecificationRecord>;

  /** Search scope, applied BEFORE matching (T083f). */
  findScoped(workspaceId: string, projectId: string | null): Promise<SearchCandidate[]>;

  /** FR-032: which specifications derive from a requirement. */
  findIdsForRequirement(workspaceId: string, requirementId: string): Promise<string[]>;
  /** Sets the flag and NOTHING else. Returns the ids newly flagged. */
  flagOutOfDate(ids: string[]): Promise<string[]>;
}

// ---------------------------------------------------------------- validation

const PAGE_SIZE_DEFAULT = 25;
const PAGE_SIZE_MAX = 100;
const TITLE_MAX = 300;
const OPAQUE = 'Not found.';

export interface ListQuery {
  page?: number;
  pageSize?: number;
}

function refuse(fields: { field: string; reason: string }[]): never {
  throw new ValidationFailedError('Specification query cannot be run.', { fields });
}

export function validatePaging(query: ListQuery = {}): { page: number; pageSize: number } {
  const fields: { field: string; reason: string }[] = [];
  const page = query.page ?? 1;
  const pageSize = query.pageSize ?? PAGE_SIZE_DEFAULT;

  if (!Number.isInteger(page) || page < 1) fields.push({ field: 'page', reason: 'a whole number from 1' });
  if (!Number.isInteger(pageSize) || pageSize < 1 || pageSize > PAGE_SIZE_MAX) {
    fields.push({ field: 'pageSize', reason: `a whole number from 1 to ${PAGE_SIZE_MAX}` });
  }
  if (fields.length > 0) refuse(fields);

  return { page, pageSize };
}

export interface EditSpecificationInput {
  title?: string;
  contentRaw?: string;
  contentParsed?: Record<string, unknown>;
}

// ------------------------------------------------------------------ service

export interface SpecificationReadApi {
  list(workspaceId: string, projectId: string, query?: ListQuery): Promise<Page<SpecificationRecord>>;
  get(workspaceId: string, id: string): Promise<SpecificationDetail>;
  edit(ctx: ActingContext, id: string, input: EditSpecificationInput): Promise<SpecificationRecord>;
}

export interface SpecificationsReadServiceOptions {
  /** Refusal hook (FR-033): wired to the audit service at the composition root. */
  onRefused?: (record: RefusalRecord) => void;
}

export class SpecificationsReadService implements SpecificationReadApi {
  private readonly onRefused: ((record: RefusalRecord) => void) | undefined;

  constructor(
    private readonly store: SpecificationStore,
    options: SpecificationsReadServiceOptions = {},
  ) {
    this.onRefused = options.onRefused;
  }

  /** FR-012 — the project's specifications, scoped then paged. */
  async list(
    workspaceId: string,
    projectId: string,
    query: ListQuery = {},
  ): Promise<Page<SpecificationRecord>> {
    const { page, pageSize } = validatePaging(query);
    const { rows, total } = await this.store.listForProject(workspaceId, projectId, {
      offset: (page - 1) * pageSize,
      limit: pageSize,
    });
    return { rows, total, page, pageSize };
  }

  /** FR-012 — detail, including engine provenance and the out-of-date flag. */
  async get(workspaceId: string, id: string): Promise<SpecificationDetail> {
    const specification = await this.load(workspaceId, id);
    const currentVersion = specification.currentVersionId
      ? await this.store.findVersion(specification.currentVersionId)
      : null;
    return { ...specification, currentVersion };
  }

  /** FR-013 — edit history, newest first. */
  async versions(workspaceId: string, id: string): Promise<SpecificationVersionRecord[]> {
    await this.load(workspaceId, id);
    return this.store.listVersions(workspaceId, id);
  }

  /**
   * FR-012 / FR-013 — edit.
   *
   * A CONTENT change appends a version and moves the pointer; the prior version
   * stays retrievable, unaltered (SC-007). A title change renames the
   * specification and appends nothing, because a version is a snapshot of
   * content and appending an identical one would make the history claim a
   * change that never happened — the same judgement the requirement register
   * makes for a no-op edit.
   *
   * The out-of-date flag is never cleared here. FR-032 says a human decides,
   * and "the human edited something" is not the same decision as "the
   * specification now reflects the changed requirement".
   *
   * Lifecycle rules — baselined immutability (FR-011a), archive (FR-011b) — are
   * EPIC-009 `T099b`. This is the FR-012 edit path, and it does not pretend to
   * be the lifecycle machine.
   */
  async edit(
    ctx: ActingContext,
    id: string,
    input: EditSpecificationInput,
  ): Promise<SpecificationRecord> {
    const fields: { field: string; reason: string }[] = [];
    const touched = ['title', 'contentRaw', 'contentParsed'].filter((k) => k in input);
    if (touched.length === 0) {
      fields.push({ field: 'body', reason: 'at least one of title, contentRaw, contentParsed' });
    }
    if ('title' in input && (typeof input.title !== 'string' || input.title.trim() === '')) {
      fields.push({ field: 'title', reason: 'required' });
    }
    if (typeof input.title === 'string' && input.title.length > TITLE_MAX) {
      fields.push({ field: 'title', reason: `at most ${TITLE_MAX} characters` });
    }
    if ('contentRaw' in input && (typeof input.contentRaw !== 'string' || input.contentRaw.trim() === '')) {
      // Empty content is a failure at generation (FR-026); it is not a valid
      // edit either. There is no path that stores an empty specification.
      fields.push({ field: 'contentRaw', reason: 'required' });
    }
    if ('contentParsed' in input && !isPlainObject(input.contentParsed)) {
      fields.push({ field: 'contentParsed', reason: 'an object' });
    }
    if (fields.length > 0) {
      throw new ValidationFailedError('Specification cannot be saved.', { fields });
    }

    const existing = await this.load(ctx.workspaceId, id);
    const current = existing.currentVersionId
      ? await this.store.findVersion(existing.currentVersionId)
      : null;

    const nextRaw = input.contentRaw ?? current?.contentRaw ?? '';
    const nextParsed = input.contentParsed ?? current?.contentParsed ?? {};
    const contentChanged =
      current === null ||
      nextRaw !== current.contentRaw ||
      ('contentParsed' in input && !sameJson(nextParsed, current.contentParsed));

    const update: Partial<Pick<SpecificationRecord, 'title' | 'currentVersionId' | 'updatedById'>> = {
      updatedById: ctx.userId,
    };
    if (typeof input.title === 'string') update.title = input.title.trim();

    if (contentChanged) {
      const appended = await this.store.appendVersion({
        workspaceId: existing.workspaceId,
        specificationId: existing.id,
        versionNumber: (current?.versionNumber ?? 0) + 1,
        contentRaw: nextRaw,
        contentParsed: nextParsed,
        lifecycleStateAtCreation: existing.lifecycleState,
        authoredById: ctx.userId,
      });
      update.currentVersionId = appended.id;
    } else if (update.title === undefined) {
      // Nothing changed at all. A no-op is not history, and not an update.
      return existing;
    }

    return this.store.updateSpecification(ctx.workspaceId, id, update);
  }

  private async load(workspaceId: string, id: string): Promise<SpecificationRecord> {
    const specification = await this.store.findById(id);
    assertSameWorkspace(workspaceId, specification, {
      targetType: 'specification',
      ...(this.onRefused ? { onRefused: this.onRefused } : {}),
    });
    return specification as SpecificationRecord;
  }
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function sameJson(a: unknown, b: unknown): boolean {
  return JSON.stringify(a) === JSON.stringify(b);
}

// ------------------------------------------------------------ in-memory store

/**
 * In-memory store, for tests and database-less runs.
 *
 * Explicit rather than implicit, for the same reason `NullJobStore` is: "no
 * store was supplied" and "this deployment deliberately has no database" are
 * different states, and only one of them is a configuration mistake.
 */
export class InMemorySpecificationStore implements SpecificationStore {
  private readonly specifications = new Map<string, SpecificationRecord>();
  private readonly versions = new Map<string, SpecificationVersionRecord>();
  private readonly links: SpecificationTraceLink[] = [];
  private seq = 0;
  private nextCommitError: Error | null = null;

  /** Observable by tests: what was committed, and what the jobs ended as. */
  readonly commits: GenerationCommit[] = [];
  readonly jobOutcomes: JobOutcomeRecord[] = [];
  readonly scopedCalls: { workspaceId: string; projectId: string | null }[] = [];

  /** Force the next commit to fail — proving nothing partial survives it. */
  failNextCommit(error: Error): void {
    this.nextCommitError = error;
  }

  async commitGeneration(commit: GenerationCommit): Promise<SpecificationRecord> {
    if (this.nextCommitError) {
      const error = this.nextCommitError;
      this.nextCommitError = null;
      // Nothing is applied: the whole unit is staged and discarded together.
      throw error;
    }

    const at = this.tick();
    const specification: SpecificationRecord = {
      ...commit.specification,
      createdAt: at,
      updatedAt: at,
    };
    const version: SpecificationVersionRecord = { ...commit.version, authoredAt: at };

    this.specifications.set(specification.id, specification);
    this.versions.set(version.id, version);
    this.links.push(...dedupeLinks(commit.links));
    this.commits.push(commit);
    return specification;
  }

  async recordJobOutcome(outcome: JobOutcomeRecord): Promise<void> {
    this.jobOutcomes.push(outcome);
  }

  async findById(id: string): Promise<SpecificationRecord | null> {
    return this.specifications.get(id) ?? null;
  }

  async findVersion(id: string): Promise<SpecificationVersionRecord | null> {
    return this.versions.get(id) ?? null;
  }

  async listForProject(
    workspaceId: string,
    projectId: string,
    window: { offset: number; limit: number },
  ): Promise<{ rows: SpecificationRecord[]; total: number }> {
    const scoped = [...this.specifications.values()]
      .filter((s) => s.workspaceId === workspaceId && s.projectId === projectId)
      .sort(byRecency);
    return { rows: scoped.slice(window.offset, window.offset + window.limit), total: scoped.length };
  }

  async listVersions(
    workspaceId: string,
    specificationId: string,
  ): Promise<SpecificationVersionRecord[]> {
    return [...this.versions.values()]
      .filter((v) => v.workspaceId === workspaceId && v.specificationId === specificationId)
      .sort((a, b) => b.versionNumber - a.versionNumber);
  }

  async appendVersion(
    version: Omit<SpecificationVersionRecord, 'id' | 'authoredAt'>,
  ): Promise<SpecificationVersionRecord> {
    const stamped: SpecificationVersionRecord = {
      ...version,
      id: randomUUID(),
      authoredAt: this.tick(),
    };
    this.versions.set(stamped.id, stamped);
    return stamped;
  }

  async updateSpecification(
    workspaceId: string,
    id: string,
    data: Partial<Pick<SpecificationRecord, 'title' | 'currentVersionId' | 'updatedById'>>,
  ): Promise<SpecificationRecord> {
    const row = this.specifications.get(id);
    if (!row || row.workspaceId !== workspaceId) throw new NotFoundError(OPAQUE);
    const updated: SpecificationRecord = { ...row, ...data, updatedAt: this.tick() };
    this.specifications.set(id, updated);
    return updated;
  }

  async setLifecycleState(
    workspaceId: string,
    id: string,
    state: SpecificationRecord['lifecycleState'],
    actorId: string,
  ): Promise<SpecificationRecord> {
    const row = this.specifications.get(id);
    if (!row || row.workspaceId !== workspaceId) throw new NotFoundError(OPAQUE);
    const updated: SpecificationRecord = {
      ...row,
      lifecycleState: state,
      updatedById: actorId,
      updatedAt: this.tick(),
    };
    this.specifications.set(id, updated);
    return updated;
  }

  async findScoped(workspaceId: string, projectId: string | null): Promise<SearchCandidate[]> {
    this.scopedCalls.push({ workspaceId, projectId });
    return [...this.specifications.values()]
      .filter((s) => s.workspaceId === workspaceId)
      .filter((s) => projectId === null || s.projectId === projectId)
      .map((specification) => ({
        specification,
        content: specification.currentVersionId
          ? (this.versions.get(specification.currentVersionId)?.contentRaw ?? '')
          : '',
      }));
  }

  async findIdsForRequirement(workspaceId: string, requirementId: string): Promise<string[]> {
    return this.links
      .filter((l) => l.workspaceId === workspaceId && l.targetId === requirementId)
      .map((l) => l.sourceId);
  }

  async flagOutOfDate(ids: string[]): Promise<string[]> {
    const flagged: string[] = [];
    for (const id of ids) {
      const row = this.specifications.get(id);
      if (!row || row.isOutOfDate) continue;
      // The flag, and nothing else: no content, no state, no pointer, no
      // `updatedAt` — a flag is not an edit (FR-032).
      this.specifications.set(id, { ...row, isOutOfDate: true });
      flagged.push(id);
    }
    return flagged;
  }

  // -- test affordances -----------------------------------------------------

  all(): SpecificationRecord[] {
    return [...this.specifications.values()];
  }

  allVersions(): SpecificationVersionRecord[] {
    return [...this.versions.values()];
  }

  allLinks(): SpecificationTraceLink[] {
    return [...this.links];
  }

  byId(id: string): SpecificationRecord | undefined {
    return this.specifications.get(id);
  }

  linksFor(specificationId: string): SpecificationTraceLink[] {
    return this.links.filter((l) => l.sourceId === specificationId);
  }

  versionsFor(specificationId: string): SpecificationVersionRecord[] {
    return [...this.versions.values()]
      .filter((v) => v.specificationId === specificationId)
      .sort((a, b) => a.versionNumber - b.versionNumber);
  }

  async touch(id: string, updatedAt: Date): Promise<void> {
    const row = this.specifications.get(id);
    if (row) this.specifications.set(id, { ...row, updatedAt });
  }

  /** Monotonic instants so ordering is deterministic in tests. */
  private tick(): Date {
    this.seq += 1;
    return new Date(Date.now() + this.seq);
  }
}

function byRecency(a: SpecificationRecord, b: SpecificationRecord): number {
  const delta = b.updatedAt.getTime() - a.updatedAt.getTime();
  return delta !== 0 ? delta : a.id.localeCompare(b.id);
}

/** A selection naming the same requirement twice is one link, not two. */
export function dedupeLinks(links: SpecificationTraceLink[]): SpecificationTraceLink[] {
  const seen = new Set<string>();
  return links.filter((l) => {
    const key = `${l.sourceId}|${l.targetType}|${l.targetId}|${l.relationship}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

// -------------------------------------------------------------- prisma store

/** The subset of a Prisma delegate the store uses (T651 precedent). */
export interface SpecificationDelegate {
  findFirst(args: { where: Record<string, unknown> }): Promise<SpecificationRecord | null>;
  findMany(args: {
    where: Record<string, unknown>;
    orderBy?: Record<string, string>;
    skip?: number;
    take?: number;
  }): Promise<SpecificationRecord[]>;
  count(args: { where: Record<string, unknown> }): Promise<number>;
  create(args: { data: Record<string, unknown> }): Promise<SpecificationRecord>;
  updateMany(args: {
    where: Record<string, unknown>;
    data: Record<string, unknown>;
  }): Promise<{ count: number }>;
}

export interface SpecificationVersionDelegate {
  findFirst(args: { where: Record<string, unknown> }): Promise<SpecificationVersionRecord | null>;
  findMany(args: {
    where: Record<string, unknown>;
    orderBy?: Record<string, string>;
  }): Promise<SpecificationVersionRecord[]>;
  create(args: { data: Record<string, unknown> }): Promise<SpecificationVersionRecord>;
}

export interface TraceabilityLinkDelegate {
  createMany(args: { data: Record<string, unknown>[] }): Promise<unknown>;
  findMany(args: { where: Record<string, unknown> }): Promise<{ sourceId: string }[]>;
}

export interface GenerationJobDelegate {
  updateMany(args: {
    where: Record<string, unknown>;
    data: Record<string, unknown>;
  }): Promise<{ count: number }>;
}

export interface SpecificationDelegates {
  specification: SpecificationDelegate;
  specificationVersion: SpecificationVersionDelegate;
  generationJob: GenerationJobDelegate;
  /**
   * EPIC-011 `T078` owns the `TraceabilityLink` model. It is supplied at the
   * composition root, not built here — and its ABSENCE is fatal rather than
   * silent: a commit that dropped its links would create exactly the orphaned
   * specification SC-002 forbids.
   */
  traceabilityLink?: TraceabilityLinkDelegate;
}

export class TraceabilityUnavailableError extends Error {
  readonly code = 'traceability_unavailable' as const;
  constructor() {
    super(
      'Refusing to commit a generated specification without a traceability link writer. ' +
        'A specification with no links is the orphan SC-002 forbids (EPIC-011 T078/T081).',
    );
    this.name = 'TraceabilityUnavailableError';
  }
}

export class PrismaSpecificationStore implements SpecificationStore {
  constructor(
    private readonly db: SpecificationDelegates,
    /** `PrismaClient.$transaction`, supplied at the composition root. */
    private readonly transaction: <T>(fn: (tx: SpecificationDelegates) => Promise<T>) => Promise<T>,
  ) {}

  async commitGeneration(commit: GenerationCommit): Promise<SpecificationRecord> {
    if (!this.db.traceabilityLink) throw new TraceabilityUnavailableError();

    return this.transaction(async (tx) => {
      if (!tx.traceabilityLink) throw new TraceabilityUnavailableError();

      // The version FIRST: `specifications.currentVersionId` references it. The
      // FK is DEFERRABLE either way, so the order is for readability, not for
      // the database's benefit.
      const version = await tx.specificationVersion.create({ data: { ...commit.version } });
      const specification = await tx.specification.create({
        data: { ...commit.specification, currentVersionId: version.id },
      });
      await tx.traceabilityLink.createMany({
        data: dedupeLinks(commit.links).map((l) => ({ ...l, sourceId: specification.id })),
      });
      await tx.generationJob.updateMany({
        where: { id: commit.job.id },
        data: {
          state: commit.job.state,
          resultRef: commit.job.resultRef,
          endedAt: new Date(),
        },
      });
      return specification;
    });
  }

  async recordJobOutcome(outcome: JobOutcomeRecord): Promise<void> {
    // ONLY the terminal state. There is no artifact write on this path at all
    // (FR-027, SC-006) — not a conditional one, not a cleaned-up one.
    await this.db.generationJob.updateMany({
      where: { id: outcome.jobId },
      data: { state: outcome.state, failureReason: outcome.failureReason, endedAt: new Date() },
    });
  }

  async findById(id: string): Promise<SpecificationRecord | null> {
    return this.db.specification.findFirst({ where: { id } });
  }

  async findVersion(id: string): Promise<SpecificationVersionRecord | null> {
    return this.db.specificationVersion.findFirst({ where: { id } });
  }

  async listForProject(
    workspaceId: string,
    projectId: string,
    window: { offset: number; limit: number },
  ): Promise<{ rows: SpecificationRecord[]; total: number }> {
    const where = { workspaceId, projectId };
    const [rows, total] = await Promise.all([
      this.db.specification.findMany({
        where,
        orderBy: { updatedAt: 'desc' },
        skip: window.offset,
        take: window.limit,
      }),
      this.db.specification.count({ where }),
    ]);
    return { rows, total };
  }

  async listVersions(
    workspaceId: string,
    specificationId: string,
  ): Promise<SpecificationVersionRecord[]> {
    return this.db.specificationVersion.findMany({
      where: { workspaceId, specificationId },
      orderBy: { versionNumber: 'desc' },
    });
  }

  async appendVersion(
    version: Omit<SpecificationVersionRecord, 'id' | 'authoredAt'>,
  ): Promise<SpecificationVersionRecord> {
    return this.db.specificationVersion.create({ data: { ...version } });
  }

  async updateSpecification(
    workspaceId: string,
    id: string,
    data: Partial<Pick<SpecificationRecord, 'title' | 'currentVersionId' | 'updatedById'>>,
  ): Promise<SpecificationRecord> {
    // updateMany so the workspace filter participates in the WRITE (T456).
    const { count } = await this.db.specification.updateMany({ where: { workspaceId, id }, data });
    if (count === 0) throw new NotFoundError(OPAQUE);
    const updated = await this.findById(id);
    /* c8 ignore next — the row was just written under this scope. */
    if (updated === null) throw new NotFoundError(OPAQUE);
    return updated;
  }

  async setLifecycleState(
    workspaceId: string,
    id: string,
    state: SpecificationRecord['lifecycleState'],
    actorId: string,
  ): Promise<SpecificationRecord> {
    const { count } = await this.db.specification.updateMany({
      where: { workspaceId, id },
      data: { lifecycleState: state, updatedById: actorId },
    });
    if (count === 0) throw new NotFoundError(OPAQUE);
    const updated = await this.findById(id);
    /* c8 ignore next — the row was just written under this scope. */
    if (updated === null) throw new NotFoundError(OPAQUE);
    return updated;
  }

  async findScoped(workspaceId: string, projectId: string | null): Promise<SearchCandidate[]> {
    // Scope in the WHERE clause — the candidate set never contains a row the
    // caller may not see, whatever the matcher then does with it.
    const rows = await this.db.specification.findMany({
      where: { workspaceId, ...(projectId === null ? {} : { projectId }) },
      orderBy: { updatedAt: 'desc' },
    });
    const contents = await Promise.all(
      rows.map(async (specification) =>
        specification.currentVersionId
          ? await this.db.specificationVersion.findFirst({
              where: { id: specification.currentVersionId },
            })
          : null,
      ),
    );
    return rows.map((specification, i) => ({
      specification,
      content: contents[i]?.contentRaw ?? '',
    }));
  }

  async findIdsForRequirement(workspaceId: string, requirementId: string): Promise<string[]> {
    if (!this.db.traceabilityLink) throw new TraceabilityUnavailableError();
    const links = await this.db.traceabilityLink.findMany({
      where: {
        workspaceId,
        targetType: 'requirement',
        targetId: requirementId,
        sourceType: 'specification',
      },
    });
    return links.map((l) => l.sourceId);
  }

  async flagOutOfDate(ids: string[]): Promise<string[]> {
    if (ids.length === 0) return [];
    // `isOutOfDate: false` in the filter makes this idempotent AND makes the
    // count meaningful: it reports what CHANGED, not what matched.
    const alreadyFlagged = await this.db.specification.findMany({
      where: { id: { in: ids }, isOutOfDate: true },
    });
    const already = new Set(alreadyFlagged.map((s) => s.id));
    const target = ids.filter((id) => !already.has(id));
    if (target.length === 0) return [];
    await this.db.specification.updateMany({
      where: { id: { in: target } },
      data: { isOutOfDate: true },
    });
    return target;
  }
}

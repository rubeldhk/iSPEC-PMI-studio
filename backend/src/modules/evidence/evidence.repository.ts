/**
 * `EPIC-032` — persistence for attestations, bindings and completion attempts.
 *
 * **Append-only, all three.** There is no update and no delete on this port, and
 * the migration's `reject_mutation()` triggers refuse them at the database for
 * anything that goes around it. Re-evaluation is a new attempt; a new subject
 * version is a new binding; evidence for a superseded version stays readable
 * and is never pruned (`R-032-7`).
 *
 * **Every read is workspace-scoped in the query** (`FR-EVS-016`) — the
 * workspace is in the `where`, not a filter applied afterwards.
 *
 * Two implementations: in-memory for unit tests and for a deployment with no
 * `DATABASE_URL`, and Prisma for everything else.
 */
import { randomUUID } from 'node:crypto';
import { Prisma, type PrismaClient } from '@prisma/client';
import type { EvidenceReference, SubjectDigest } from '@pmi/evidence-contract';
import { digestOf, sameDigest } from './integrity.js';
import type {
  AttachableKind,
  CompletionAttempt,
  IntegrityRecord,
  NewAttempt,
  NewAttestation,
  NewBinding,
  StoredAttestation,
  WorkBinding,
  WorkRef,
} from './evidence.types.js';

/**
 * What the rollup needs from one attestation — and nothing it does not. No
 * payload: the predicate's `result` is read by the database (`FR-EVS-036`), and
 * integrity is the write-time verdict (see `assessForRollup`).
 */
export interface RollupEvidence {
  readonly id: string;
  readonly predicateType: string;
  readonly attestedArtifactId: string;
  readonly attestedVersion: number;
  readonly storage: 'stored' | 'referenced';
  readonly reference: EvidenceReference | null;
  readonly integrityValid: boolean;
  readonly predicateResult: string | null;
  readonly attachedTo: WorkRef;
}

export interface EvidenceRepository {
  appendAttestation(input: NewAttestation): Promise<StoredAttestation>;
  /** Evidence attached to one piece of work, oldest first. */
  attachedTo(workspaceId: string, ref: WorkRef): Promise<StoredAttestation[]>;
  /**
   * Evidence attached to many pieces of work in ONE query, keyed by `refKey`.
   * The rollup's path: per-work queries took 3.8 s at 10,000 items against a
   * 500 ms target (`T862f`).
   */
  attachedToMany(workspaceId: string, refs: readonly WorkRef[]): Promise<Map<string, StoredAttestation[]>>;
  /**
   * The rollup's read (`FR-EVS-006`, `SC-EVS-008`): many pieces of work in one
   * query, carrying only what a status needs. Reading 10,000 full rows and
   * re-hashing every payload missed the 500 ms target on CI (599 ms).
   */
  rollupEvidence(workspaceId: string, refs: readonly WorkRef[]): Promise<Map<string, RollupEvidence[]>>;
  appendBinding(input: NewBinding): Promise<WorkBinding>;
  /** Every binding for one piece of work, oldest first. The last is current. */
  bindings(workspaceId: string, ref: WorkRef): Promise<WorkBinding[]>;
  /** Every binding in a workspace, optionally one project. For the rollup and in-flight checks. */
  allBindings(workspaceId: string, projectId?: string): Promise<WorkBinding[]>;
  appendAttempt(input: NewAttempt): Promise<CompletionAttempt>;
  attempts(workspaceId: string, ref: WorkRef): Promise<CompletionAttempt[]>;
  /** Every workRef in the workspace with an accepted attempt. */
  completedRefs(workspaceId: string): Promise<Set<string>>;
  /**
   * `FR-EVS-024` — `workClass@contractVersion` for every Contract version with
   * work bound to it and not yet accepted, across **all** workspaces: the
   * definitions are shared, so work in flight anywhere holds them.
   */
  inFlightContractVersions(): Promise<Set<string>>;
}

function inFlight(bindings: readonly WorkBinding[], accepted: ReadonlySet<string>): Set<string> {
  const first = new Map<string, WorkBinding>();
  for (const b of bindings) {
    const key = `${b.workspaceId}|${refKey(b.workRef)}`;
    if (!first.has(key)) first.set(key, b);
  }
  const versions = new Set<string>();
  for (const [key, b] of first) if (!accepted.has(key)) versions.add(`${b.workClass}@${b.contractVersion}`);
  return versions;
}

export function refKey(ref: WorkRef): string {
  return `${ref.type}:${ref.id}`;
}

/** Evidence grouped under each requested ref — type AND id, so `task:1` never collects `outcome:1`. */
function group<T extends { attachedTo: WorkRef }>(refs: readonly WorkRef[], rows: readonly T[]): Map<string, T[]> {
  const out = new Map<string, T[]>(refs.map((r) => [refKey(r), []]));
  for (const row of rows) out.get(refKey(row.attachedTo))?.push(row);
  return out;
}

/**
 * Integrity at write (`FR-EVS-013`): the server digests what arrived. If the
 * contributor also claimed a digest and it disagrees, the row is still written
 * — refusing would lose the record that something was substituted — and it
 * reads integrity-failed, which is not met (`FR-EVS-034`).
 */
function integrityAtWrite(input: NewAttestation): { integrity: IntegrityRecord; integrityValid: boolean } {
  if (input.storage === 'stored') {
    const computed = digestOf(input.payload);
    const claimed = input.claimedIntegrity;
    return { integrity: claimed ?? computed, integrityValid: claimed === undefined || sameDigest(claimed, computed) };
  }
  // A referenced payload cannot be read back (storage-contract S4). Its digest
  // is the contributor's claim, checked against the provider when it can say.
  const claimed = input.claimedIntegrity;
  return claimed === undefined
    ? { integrity: { algorithm: 'sha256', value: '' }, integrityValid: false }
    : { integrity: claimed, integrityValid: true };
}

// ─────────────────────────────────────────────────────────────── in-memory

export class InMemoryEvidenceRepository implements EvidenceRepository {
  private readonly items: StoredAttestation[] = [];
  private readonly bindingRows: WorkBinding[] = [];
  private readonly attemptRows: CompletionAttempt[] = [];

  async appendAttestation(input: NewAttestation): Promise<StoredAttestation> {
    const { claimedIntegrity: _claimed, ...rest } = input;
    const row: StoredAttestation = {
      ...rest,
      ...integrityAtWrite(input),
      id: randomUUID(),
      createdAt: new Date(),
    };
    this.items.push(row);
    return row;
  }

  async attachedTo(workspaceId: string, ref: WorkRef): Promise<StoredAttestation[]> {
    return this.items.filter(
      (i) => i.workspaceId === workspaceId && i.attachedTo.type === ref.type && i.attachedTo.id === ref.id,
    );
  }

  async attachedToMany(workspaceId: string, refs: readonly WorkRef[]): Promise<Map<string, StoredAttestation[]>> {
    return group(refs, await Promise.all(refs.map((ref) => this.attachedTo(workspaceId, ref))).then((r) => r.flat()));
  }

  async rollupEvidence(workspaceId: string, refs: readonly WorkRef[]): Promise<Map<string, RollupEvidence[]>> {
    const full = await this.attachedToMany(workspaceId, refs);
    const out = new Map<string, RollupEvidence[]>();
    for (const [key, rows] of full) {
      out.set(
        key,
        rows.map((a) => ({
          id: a.id,
          predicateType: a.predicateType,
          attestedArtifactId: a.attestedArtifactId,
          attestedVersion: a.attestedVersion,
          storage: a.storage,
          reference: a.reference,
          integrityValid: a.integrityValid,
          predicateResult:
            typeof a.payload === 'object' && a.payload !== null
              ? (((a.payload as { predicate?: { result?: unknown } }).predicate?.result as string | undefined) ?? null)
              : null,
          attachedTo: a.attachedTo,
        })),
      );
    }
    return out;
  }

  async appendBinding(input: NewBinding): Promise<WorkBinding> {
    const row: WorkBinding = { ...input, id: randomUUID(), createdAt: new Date() };
    this.bindingRows.push(row);
    return row;
  }

  async bindings(workspaceId: string, ref: WorkRef): Promise<WorkBinding[]> {
    return this.bindingRows.filter(
      (b) => b.workspaceId === workspaceId && b.workRef.type === ref.type && b.workRef.id === ref.id,
    );
  }

  async allBindings(workspaceId: string, projectId?: string): Promise<WorkBinding[]> {
    return this.bindingRows.filter(
      (b) => b.workspaceId === workspaceId && (projectId === undefined || b.projectId === projectId),
    );
  }

  async appendAttempt(input: NewAttempt): Promise<CompletionAttempt> {
    if (input.outcome === 'refused' && (input.unmetItems === null || input.unmetItems.length === 0)) {
      // The in-memory twin of the migration's fence 3.
      throw new Error('a refused attempt names its unmet items (FR-EVS-032)');
    }
    const row: CompletionAttempt = { ...input, id: randomUUID(), declaredAt: new Date() };
    this.attemptRows.push(row);
    return row;
  }

  async attempts(workspaceId: string, ref: WorkRef): Promise<CompletionAttempt[]> {
    return this.attemptRows.filter(
      (a) => a.workspaceId === workspaceId && a.workRef.type === ref.type && a.workRef.id === ref.id,
    );
  }

  async inFlightContractVersions(): Promise<Set<string>> {
    const accepted = new Set(
      this.attemptRows
        .filter((a) => a.outcome === 'accepted')
        .map((a) => `${a.workspaceId}|${refKey(a.workRef)}`),
    );
    return inFlight(this.bindingRows, accepted);
  }

  async completedRefs(workspaceId: string): Promise<Set<string>> {
    return new Set(
      this.attemptRows
        .filter((a) => a.workspaceId === workspaceId && a.outcome === 'accepted')
        .map((a) => refKey(a.workRef)),
    );
  }
}

// ─────────────────────────────────────────────────────────────── Prisma

interface ItemRow {
  id: string;
  workspaceId: string;
  projectId: string | null;
  type: string;
  subjectName: string | null;
  subjectDigest: unknown;
  attestsArtifactId: string;
  attestsArtifactVersion: number;
  producedAt: Date;
  source: string;
  sourceVersion: string | null;
  storage: string | null;
  payload: unknown;
  reference: unknown;
  integrity: unknown;
  integrityValid: boolean;
  attachedToType: string | null;
  attachedToId: string | null;
  createdAt: Date;
}

/**
 * `T1800`, `SC-EVS-002` — *"a missing field fails a check rather than reading as
 * blank."* An attestation row that has lost a provenance field is refused here,
 * not defaulted to `''` or `'_'`: a blank would look like a value, and the gate
 * would judge a row nobody can say the origin of. The read throws, and the gate
 * turns that into an unevaluated Contract, which refuses (`FR-EVS-035`).
 */
function required<T>(row: ItemRow, field: keyof ItemRow, value: T | null | undefined): T {
  if (value === null || value === undefined || value === '') {
    throw new Error(`evidence item ${row.id} has no ${String(field)} (SC-EVS-002)`);
  }
  return value;
}

function toAttestation(row: ItemRow): StoredAttestation {
  return {
    id: row.id,
    workspaceId: row.workspaceId,
    projectId: required(row, 'projectId', row.projectId),
    predicateType: row.type,
    subjectName: required(row, 'subjectName', row.subjectName),
    subjectDigest: required(row, 'subjectDigest', row.subjectDigest) as SubjectDigest,
    attestedArtifactId: row.attestsArtifactId,
    attestedVersion: row.attestsArtifactVersion,
    producedAt: row.producedAt,
    sourceUri: required(row, 'source', row.source),
    sourceVersion: row.sourceVersion,
    storage: required(row, 'storage', row.storage) === 'referenced' ? 'referenced' : 'stored',
    payload: row.payload,
    reference: (row.reference as EvidenceReference | null) ?? null,
    integrity: required(row, 'integrity', row.integrity) as IntegrityRecord,
    integrityValid: row.integrityValid,
    attachedTo: {
      type: required(row, 'attachedToType', row.attachedToType) as AttachableKind,
      id: required(row, 'attachedToId', row.attachedToId),
    },
    createdAt: row.createdAt,
  };
}

interface BindingRow {
  id: string;
  workspaceId: string;
  projectId: string;
  workRefType: string;
  workRefId: string;
  workClass: string;
  contractVersion: number;
  subjectArtifactType: string;
  subjectArtifactId: string;
  subjectVersion: number;
  createdAt: Date;
}

function toBinding(row: BindingRow): WorkBinding {
  return {
    id: row.id,
    workspaceId: row.workspaceId,
    projectId: row.projectId,
    workRef: { type: row.workRefType as AttachableKind, id: row.workRefId },
    workClass: row.workClass,
    contractVersion: row.contractVersion,
    subjectArtifactType: row.subjectArtifactType,
    subjectArtifactId: row.subjectArtifactId,
    subjectVersion: row.subjectVersion,
    createdAt: row.createdAt,
  };
}

interface AttemptRow {
  id: string;
  workspaceId: string;
  workRefType: string;
  workRefId: string;
  declaredBy: string;
  declaredAt: Date;
  outcome: string;
  unmetItems: unknown;
  contractVersion: number;
  trigger: string;
}

function toAttempt(row: AttemptRow): CompletionAttempt {
  return {
    id: row.id,
    workspaceId: row.workspaceId,
    workRef: { type: row.workRefType as AttachableKind, id: row.workRefId },
    declaredBy: row.declaredBy,
    declaredAt: row.declaredAt,
    outcome: row.outcome === 'accepted' ? 'accepted' : 'refused',
    unmetItems: (row.unmetItems as string[] | null) ?? null,
    contractVersion: row.contractVersion,
    trigger: row.trigger === 'evidence-arrival' ? 'evidence-arrival' : 'declaration',
  };
}

/** SQL NULL, not JSON `null` — the stored/referenced CHECK reads `IS NULL`. */
function jsonOrNull(value: unknown): Prisma.InputJsonValue | typeof Prisma.DbNull {
  return value === null || value === undefined ? Prisma.DbNull : (value as Prisma.InputJsonValue);
}

export class PrismaEvidenceRepository implements EvidenceRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async appendAttestation(input: NewAttestation): Promise<StoredAttestation> {
    const { integrity, integrityValid } = integrityAtWrite(input);
    const row = await this.prisma.evidenceItem.create({
      data: {
        workspaceId: input.workspaceId,
        projectId: input.projectId,
        type: input.predicateType,
        subjectName: input.subjectName,
        subjectDigest: input.subjectDigest as Prisma.InputJsonValue,
        attestsArtifactId: input.attestedArtifactId,
        attestsArtifactVersion: input.attestedVersion,
        producedAt: input.producedAt,
        source: input.sourceUri,
        sourceVersion: input.sourceVersion,
        storage: input.storage,
        payload: input.storage === 'stored' ? jsonOrNull(input.payload ?? {}) : Prisma.DbNull,
        reference: input.storage === 'referenced' ? jsonOrNull(input.reference) : Prisma.DbNull,
        integrity: integrity as unknown as Prisma.InputJsonValue,
        integrityValid,
        attachedToType: input.attachedTo.type,
        attachedToId: input.attachedTo.id,
      },
    });
    return toAttestation(row as unknown as ItemRow);
  }

  async attachedTo(workspaceId: string, ref: WorkRef): Promise<StoredAttestation[]> {
    const rows = await this.prisma.evidenceItem.findMany({
      where: { workspaceId, attachedToType: ref.type, attachedToId: ref.id },
      orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
    });
    return (rows as unknown as ItemRow[]).map(toAttestation);
  }

  async attachedToMany(workspaceId: string, refs: readonly WorkRef[]): Promise<Map<string, StoredAttestation[]>> {
    if (refs.length === 0) return new Map();
    // Raw SQL, and only the columns `toAttestation` reads. Through the Prisma
    // query builder this read was ~1.1 s at 10,000 rows — the row and JSON
    // mapping, not the database — against the 500 ms rollup target (T862f).
    // Parameterised: the ids travel as one array, never as interpolated text.
    const rows = await this.prisma.$queryRaw<ItemRow[]>`
      SELECT "id", "workspaceId", "projectId", "type", "subjectName", "subjectDigest",
             "attestsArtifactId", "attestsArtifactVersion", "producedAt", "source", "sourceVersion",
             "storage", "payload", "reference", "integrity", "integrityValid",
             "attachedToType", "attachedToId", "createdAt"
        FROM "evidence_items"
       WHERE "workspaceId" = ${workspaceId}
         AND "attachedToId" = ANY(${[...new Set(refs.map((r) => r.id))]}::text[])
       ORDER BY "createdAt" ASC, "id" ASC`;
    return group(refs, rows.map(toAttestation));
  }

  async rollupEvidence(workspaceId: string, refs: readonly WorkRef[]): Promise<Map<string, RollupEvidence[]>> {
    if (refs.length === 0) return new Map();
    // Only attestation rows (subjectDigest present) — the rows the full read
    // admits — and only the columns a status is derived from.
    const rows = await this.prisma.$queryRaw<
      Array<{
        id: string;
        type: string;
        attestsArtifactId: string;
        attestsArtifactVersion: number;
        storage: string;
        reference: EvidenceReference | null;
        integrityValid: boolean;
        predicateResult: string | null;
        attachedToType: string;
        attachedToId: string;
      }>
    >`
      SELECT "id", "type", "attestsArtifactId", "attestsArtifactVersion", "storage", "reference",
             "integrityValid", ("payload" -> 'predicate' ->> 'result') AS "predicateResult",
             "attachedToType", "attachedToId"
        FROM "evidence_items"
       WHERE "workspaceId" = ${workspaceId}
         AND "subjectDigest" IS NOT NULL
         AND "attachedToId" = ANY(${[...new Set(refs.map((r) => r.id))]}::text[])`;
    return group(
      refs,
      rows.map((r) => ({
        id: r.id,
        predicateType: r.type,
        attestedArtifactId: r.attestsArtifactId,
        attestedVersion: r.attestsArtifactVersion,
        storage: r.storage === 'referenced' ? ('referenced' as const) : ('stored' as const),
        reference: r.reference,
        integrityValid: r.integrityValid,
        predicateResult: r.predicateResult,
        attachedTo: { type: r.attachedToType as AttachableKind, id: r.attachedToId },
      })),
    );
  }

  async appendBinding(input: NewBinding): Promise<WorkBinding> {
    const row = await this.prisma.workEvidenceBinding.create({
      data: {
        workspaceId: input.workspaceId,
        projectId: input.projectId,
        workRefType: input.workRef.type,
        workRefId: input.workRef.id,
        workClass: input.workClass,
        contractVersion: input.contractVersion,
        subjectArtifactType: input.subjectArtifactType,
        subjectArtifactId: input.subjectArtifactId,
        subjectVersion: input.subjectVersion,
      },
    });
    return toBinding(row as BindingRow);
  }

  async bindings(workspaceId: string, ref: WorkRef): Promise<WorkBinding[]> {
    const rows = await this.prisma.workEvidenceBinding.findMany({
      where: { workspaceId, workRefType: ref.type, workRefId: ref.id },
      orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
    });
    return (rows as BindingRow[]).map(toBinding);
  }

  async allBindings(workspaceId: string, projectId?: string): Promise<WorkBinding[]> {
    const rows = await this.prisma.workEvidenceBinding.findMany({
      where: { workspaceId, ...(projectId !== undefined ? { projectId } : {}) },
      orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
    });
    return (rows as BindingRow[]).map(toBinding);
  }

  async appendAttempt(input: NewAttempt): Promise<CompletionAttempt> {
    const row = await this.prisma.evidenceCompletionAttempt.create({
      data: {
        workspaceId: input.workspaceId,
        workRefType: input.workRef.type,
        workRefId: input.workRef.id,
        declaredBy: input.declaredBy,
        outcome: input.outcome,
        unmetItems: jsonOrNull(input.unmetItems),
        contractVersion: input.contractVersion,
        trigger: input.trigger,
      },
    });
    return toAttempt(row as AttemptRow);
  }

  async attempts(workspaceId: string, ref: WorkRef): Promise<CompletionAttempt[]> {
    const rows = await this.prisma.evidenceCompletionAttempt.findMany({
      where: { workspaceId, workRefType: ref.type, workRefId: ref.id },
      orderBy: [{ declaredAt: 'asc' }, { id: 'asc' }],
    });
    return (rows as AttemptRow[]).map(toAttempt);
  }

  async completedRefs(workspaceId: string): Promise<Set<string>> {
    const rows = await this.prisma.evidenceCompletionAttempt.findMany({
      where: { workspaceId, outcome: 'accepted' },
      select: { workRefType: true, workRefId: true },
    });
    return new Set(rows.map((r) => `${r.workRefType}:${r.workRefId}`));
  }

  async inFlightContractVersions(): Promise<Set<string>> {
    const [bindings, accepted] = await Promise.all([
      this.prisma.workEvidenceBinding.findMany({ orderBy: [{ createdAt: 'asc' }, { id: 'asc' }] }),
      this.prisma.evidenceCompletionAttempt.findMany({
        where: { outcome: 'accepted' },
        select: { workspaceId: true, workRefType: true, workRefId: true },
      }),
    ]);
    return inFlight(
      (bindings as BindingRow[]).map(toBinding),
      new Set(accepted.map((a) => `${a.workspaceId}|${a.workRefType}:${a.workRefId}`)),
    );
  }
}

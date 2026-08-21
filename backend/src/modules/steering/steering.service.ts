/**
 * T233 — steering content: create, edit, version, retire (FR-ENH-003).
 *
 * The edit history is append-only, modelled the way RequirementVersion is: a
 * meaningful change appends a new version row; nothing ever rewrites a prior
 * one. Retire is a status change, never a delete.
 *
 * Framework-free (PC-1); persistence behind a port supplied at the
 * composition root.
 */
import { NotFoundError, ValidationFailedError } from '../../core/errors.js';
import type { ScopeDescriptor } from './scope-resolver.js';
import { assertSteeringSubject, type SteeringSubject } from './steering.validation.js';

const OPAQUE = 'Not found.';

export interface SteeringDocumentRecord {
  id: string;
  workspaceId: string;
  /** Stable across versions — the identity of the document lineage. */
  lineageId: string;
  subject: SteeringSubject;
  scope: ScopeDescriptor;
  content: string;
  version: number;
  status: 'active' | 'retired';
  createdById: string;
  createdAt: Date;
}

export interface CreateSteeringInput {
  scope: ScopeDescriptor;
  subject: string;
  content: string;
  createdById: string;
}

/** Persistence port. `findLineage` returns every version, oldest first. */
export interface SteeringStore {
  append(row: SteeringDocumentRecord): Promise<SteeringDocumentRecord>;
  /** Resolve any version id (or lineage id) to its lineage, oldest first — UNSCOPED. */
  findLineage(idOrLineageId: string): Promise<SteeringDocumentRecord[]>;
  listForWorkspace(workspaceId: string): Promise<SteeringDocumentRecord[]>;
  setStatus(lineageId: string, status: 'active' | 'retired'): Promise<void>;
}

export class SteeringService {
  constructor(private readonly store: SteeringStore) {}

  async create(workspaceId: string, input: CreateSteeringInput): Promise<SteeringDocumentRecord> {
    const subject = assertSteeringSubject(input.subject);
    if (input.content.trim().length === 0) {
      throw new ValidationFailedError('content must not be empty.');
    }
    const id = newId();
    return this.store.append({
      id,
      workspaceId,
      lineageId: id,
      subject,
      scope: input.scope,
      content: input.content,
      version: 1,
      status: 'active',
      createdById: input.createdById,
      createdAt: new Date(),
    });
  }

  /** A meaningful change appends a new version; an identical edit is a no-op. */
  async edit(
    workspaceId: string,
    id: string,
    content: string,
    editorId: string,
  ): Promise<SteeringDocumentRecord> {
    const lineage = await this.loadLineage(workspaceId, id);
    const head = lineage[lineage.length - 1] as SteeringDocumentRecord;
    if (head.status === 'retired') {
      throw new ValidationFailedError('This steering document is retired and may not be edited.');
    }
    if (content.trim().length === 0) {
      throw new ValidationFailedError('content must not be empty.');
    }
    if (content === head.content) return head;
    return this.store.append({
      ...head,
      id: newId(),
      content,
      version: head.version + 1,
      createdById: editorId,
      createdAt: new Date(),
    });
  }

  async retire(workspaceId: string, id: string, _actorId: string): Promise<SteeringDocumentRecord> {
    const lineage = await this.loadLineage(workspaceId, id);
    const head = lineage[lineage.length - 1] as SteeringDocumentRecord;
    await this.store.setStatus(head.lineageId, 'retired');
    return { ...head, status: 'retired' };
  }

  /** Every version, oldest first — the append-only history (FR-ENH-003). */
  async history(workspaceId: string, id: string): Promise<SteeringDocumentRecord[]> {
    return this.loadLineage(workspaceId, id);
  }

  async get(workspaceId: string, id: string): Promise<SteeringDocumentRecord> {
    const lineage = await this.loadLineage(workspaceId, id);
    return lineage[lineage.length - 1] as SteeringDocumentRecord;
  }

  async list(workspaceId: string): Promise<SteeringDocumentRecord[]> {
    return this.store.listForWorkspace(workspaceId);
  }

  /** Tenancy: an id from another workspace is the SAME opaque 404 as absence. */
  private async loadLineage(workspaceId: string, id: string): Promise<SteeringDocumentRecord[]> {
    const lineage = await this.store.findLineage(id);
    const first = lineage[0];
    if (!first || first.workspaceId !== workspaceId) throw new NotFoundError(OPAQUE);
    return lineage;
  }
}

// ------------------------------------------------------------- in-memory

let seq = 0;
function newId(): string {
  return `sd_${++seq}_${Math.random().toString(36).slice(2, 8)}`;
}

export class InMemorySteeringStore implements SteeringStore {
  private readonly rows: SteeringDocumentRecord[] = [];

  async append(row: SteeringDocumentRecord): Promise<SteeringDocumentRecord> {
    this.rows.push({ ...row });
    return { ...row };
  }

  async findLineage(idOrLineageId: string): Promise<SteeringDocumentRecord[]> {
    const hit = this.rows.find((r) => r.id === idOrLineageId || r.lineageId === idOrLineageId);
    if (!hit) return [];
    return this.rows
      .filter((r) => r.lineageId === hit.lineageId)
      .sort((a, b) => a.version - b.version)
      .map((r) => ({ ...r }));
  }

  async listForWorkspace(workspaceId: string): Promise<SteeringDocumentRecord[]> {
    // The latest version of each lineage.
    const heads = new Map<string, SteeringDocumentRecord>();
    for (const row of this.rows) {
      if (row.workspaceId !== workspaceId) continue;
      const head = heads.get(row.lineageId);
      if (!head || row.version > head.version) heads.set(row.lineageId, row);
    }
    return [...heads.values()].map((r) => ({ ...r }));
  }

  async setStatus(lineageId: string, status: 'active' | 'retired'): Promise<void> {
    for (const row of this.rows) {
      if (row.lineageId === lineageId) row.status = status;
    }
  }
}

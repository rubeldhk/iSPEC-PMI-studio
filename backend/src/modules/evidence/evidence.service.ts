/**
 * `EPIC-032` — the evidence store's capabilities, callable without HTTP (PC-1).
 *
 * The controller is a transport over this; Rooms and the loop call it
 * in-process. Every capability is workspace-scoped by the caller's session
 * (`FR-EVS-016`) and every read goes through the `AccessPolicy` port
 * (`FR-EVS-015`).
 */
import type {
  AccessPolicy,
  AttestationSource,
  ContractStatus,
  EvidenceReference,
} from '@pmi/evidence-contract';
import { parseAttestation } from '@pmi/evidence-contract';
import {
  ConflictError,
  GovernanceSeamUnboundError,
  NotFoundError,
  ProviderUnavailableError,
  ValidationFailedError,
} from '../../core/errors.js';
import { CompletionGate, type AttachedEvidence } from './completion.gate.js';
import type { ContractCatalog } from './contract.loader.js';
import { refKey, type EvidenceRepository } from './evidence.repository.js';
import {
  isAttachableKind,
  type IntegrityRecord,
  type StoredAttestation,
  type WorkBinding,
  type WorkRef,
} from './evidence.types.js';

export interface Principal {
  readonly workspaceId: string;
  readonly userId: string;
}

/** Sources the platform itself runs. Anything else arrives through an adapter (`FR-EVS-040`). */
const PLATFORM_SOURCE = /^pmi:/;

function record(value: unknown, what: string): Record<string, unknown> {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    throw new ValidationFailedError(`${what} is required.`);
  }
  return value as Record<string, unknown>;
}

function text(value: unknown, what: string): string {
  if (typeof value !== 'string' || value.trim() === '') throw new ValidationFailedError(`${what} is required.`);
  return value;
}

function positiveInt(value: unknown, what: string): number {
  if (typeof value !== 'number' || !Number.isInteger(value) || value < 1) {
    throw new ValidationFailedError(`${what} is a positive integer.`);
  }
  return value;
}

export function parseWorkRef(value: unknown, what = 'workRef'): WorkRef {
  const ref = record(value, what);
  if (!isAttachableKind(ref['type'])) {
    throw new ValidationFailedError(`${what}.type is one of artifact, task, decision, outcome (FR-EVS-004).`);
  }
  return { type: ref['type'], id: text(ref['id'], `${what}.id`) };
}

/** `:workRef` in a path is `type:id`. */
export function workRefFromPath(raw: string): WorkRef {
  const cut = raw.indexOf(':');
  if (cut < 1) throw new ValidationFailedError('A work reference in a path is type:id.');
  return parseWorkRef({ type: raw.slice(0, cut), id: raw.slice(cut + 1) });
}

export interface ContributionSummary {
  readonly id: string;
  readonly predicateType: string;
  readonly attachedTo: WorkRef;
  readonly attestedArtifact: { id: string; version: number };
  readonly integrityValid: boolean;
}

export interface Rollup {
  readonly projectId: string | null;
  /** Work bound to a Contract and not yet accepted. */
  readonly inFlight: number;
  readonly completed: number;
  /** `BG-08` — completed work whose Contract is satisfied when read now. */
  readonly completedSatisfied: number;
  readonly satisfactionRate: number | null;
  /** `FR-EVS-006` — unmet items across the scope, counted by itemId. */
  readonly unmetByItem: Readonly<Record<string, number>>;
  /** Work whose Contract could not be evaluated — counted, never hidden. */
  readonly unevaluated: number;
}

export class EvidenceService {
  private readonly gate: CompletionGate;

  constructor(
    private readonly repository: EvidenceRepository,
    private readonly catalog: ContractCatalog,
    gate: CompletionGate,
    private readonly access: AccessPolicy | null,
    private readonly sources: AttestationSource | null,
  ) {
    this.gate = gate;
  }

  // ───────────────────────────────────────────────────────────── reads

  private async requireReadable(principal: Principal, binding: WorkBinding): Promise<void> {
    // FR-EVS-015. An absent AccessPolicy refuses; an unreadable subject is
    // indistinguishable from absent work (403 would confirm it exists).
    const readable =
      this.access !== null &&
      (await this.access.canRead(principal, { type: binding.subjectArtifactType, id: binding.subjectArtifactId }));
    if (!readable) throw new NotFoundError(`No governed work ${refKey(binding.workRef)}.`);
  }

  private async currentBinding(principal: Principal, ref: WorkRef): Promise<WorkBinding> {
    let bindings: WorkBinding[];
    try {
      bindings = await this.repository.bindings(principal.workspaceId, ref);
    } catch {
      throw new ProviderUnavailableError('The evidence store could not be reached (FR-EVS-035).');
    }
    const binding = bindings.at(-1);
    if (binding === undefined) throw new NotFoundError(`No governed work ${refKey(ref)}.`);
    await this.requireReadable(principal, binding);
    return binding;
  }

  /**
   * `FR-EVS-027` — the projection a Room's Evidence region renders: the
   * Contract's items and unmet list, and (`T1798`) the attached evidence with
   * its provenance and trust. Never the payloads.
   */
  async status(
    principal: Principal,
    ref: WorkRef,
  ): Promise<ContractStatus & { workRef: WorkRef; evidence: readonly AttachedEvidence[] }> {
    await this.currentBinding(principal, ref);
    const evaluation = await this.gate.evaluate(principal.workspaceId, ref);
    if (!evaluation.evaluated) throw new ProviderUnavailableError(evaluation.reason);
    return { workRef: ref, ...evaluation.status, evidence: evaluation.attached };
  }

  /** `FR-EVS-022`, `SC-EVS-003` — the unmet items, without opening each piece of evidence. */
  async unmet(
    principal: Principal,
    ref: WorkRef,
  ): Promise<{ workRef: WorkRef; contractVersion: number; unmet: readonly string[]; reasons: Record<string, string> }> {
    const status = await this.status(principal, ref);
    const reasons: Record<string, string> = {};
    for (const item of status.items) if (item.state !== 'met') reasons[item.itemId] = item.reason ?? item.state;
    return { workRef: ref, contractVersion: status.contractVersion, unmet: status.unmet, reasons };
  }

  // ───────────────────────────────────────────────────────────── binding

  /**
   * `FR-EVS-020`, `FR-EVS-021`, `FR-EVS-023` — attach the Contract when the
   * work is created, every item unmet. Binding the same work again — to a new
   * version of its subject — keeps the class and the Contract version it began
   * under; the Contract a piece of work is judged against does not move.
   */
  async bind(principal: Principal, body: unknown): Promise<WorkBinding & { status: ContractStatus }> {
    const input = record(body, 'A binding');
    const workRef = parseWorkRef(input['workRef']);
    const workClass = text(input['workClass'], 'workClass');
    const projectId = text(input['projectId'], 'projectId');
    const subject = record(input['subject'], 'subject');
    const subjectArtifactType = text(subject['type'], 'subject.type');
    const subjectArtifactId = text(subject['id'], 'subject.id');
    const subjectVersion = positiveInt(subject['version'], 'subject.version');

    // FR-EVS-015 — checked BEFORE anything is written. Refusing after the row
    // exists would tell the caller "not found" while governed work had quietly
    // been created about an artifact they cannot see.
    const readable =
      this.access !== null &&
      (await this.access.canRead(principal, { type: subjectArtifactType, id: subjectArtifactId }));
    if (!readable) throw new NotFoundError(`No ${subjectArtifactType} ${subjectArtifactId}.`);

    const existing = await this.repository.bindings(principal.workspaceId, workRef);
    const first = existing[0];
    let contractVersion: number;
    if (first !== undefined) {
      if (first.workClass !== workClass) {
        throw new ConflictError(
          `${refKey(workRef)} is governed as ${first.workClass}; its work class does not change (FR-EVS-023).`,
        );
      }
      contractVersion = first.contractVersion;
    } else {
      const latest = this.catalog.latest(workClass);
      if (latest === null) throw new ValidationFailedError(`No Evidence Contract is defined for ${workClass}.`);
      contractVersion = latest.contractVersion;
    }

    const binding = await this.repository.appendBinding({
      workspaceId: principal.workspaceId,
      projectId,
      workRef,
      workClass,
      contractVersion,
      subjectArtifactType,
      subjectArtifactId,
      subjectVersion,
    });
    return { ...binding, status: await this.status(principal, workRef) };
  }

  // ───────────────────────────────────────────────────────────── contribution

  /**
   * `FR-EVS-001`, `FR-EVS-040`–`FR-EVS-042`. One route for every kind of
   * evidence; the kind is the `predicateType`.
   */
  async contribute(principal: Principal, body: unknown): Promise<ContributionSummary> {
    const input = record(body, 'A contribution');
    const parsed = parseAttestation(input['attestation']);
    if (!parsed.ok) throw new ValidationFailedError(parsed.message, { reason: parsed.reason });

    const attested = record(input['attestedArtifact'], 'attestedArtifact');
    // FR-EVS-042 — the version is named, never inferred from "current".
    const attestedVersion = positiveInt(attested['version'], 'attestedArtifact.version');
    const attachedTo = parseWorkRef(input['attachedTo'], 'attachedTo');
    const source = record(input['source'], 'source');
    const sourceUri = text(source['uri'], 'source.uri');
    const producedAt = new Date(text(input['producedAt'], 'producedAt'));
    if (Number.isNaN(producedAt.getTime())) throw new ValidationFailedError('producedAt is a timestamp.');

    let sourceVersion = typeof source['version'] === 'string' ? source['version'] : null;
    if (!PLATFORM_SOURCE.test(sourceUri)) {
      // FR-EVS-040 — external tools arrive through an authorised adapter, never a
      // bespoke route. FR-EVS-041 — and are recorded with their version.
      if (this.sources === null) {
        throw new GovernanceSeamUnboundError(
          'AttestationSource is not bound (EPIC-013 / U-13), so no external tool can contribute evidence (FR-EVS-040).',
        );
      }
      const authorised = await this.sources.authorise(sourceUri, principal.workspaceId);
      if (authorised === null) {
        throw new ValidationFailedError(`${sourceUri} is not an authorised evidence source (FR-EVS-040).`);
      }
      sourceVersion = authorised.version;
    }

    const storage = input['reference'] === undefined ? 'stored' : 'referenced';
    let reference: EvidenceReference | null = null;
    if (storage === 'referenced') {
      const ref = record(input['reference'], 'reference');
      reference = { provider: text(ref['provider'], 'reference.provider'), location: text(ref['location'], 'reference.location') };
    }
    let claimedIntegrity: IntegrityRecord | undefined;
    if (input['integrity'] !== undefined) {
      const claimed = record(input['integrity'], 'integrity');
      if (claimed['algorithm'] !== 'sha256') throw new ValidationFailedError('integrity.algorithm is sha256.');
      claimedIntegrity = { algorithm: 'sha256', value: text(claimed['value'], 'integrity.value') };
    }

    const subject = parsed.value.subject[0];
    let stored: StoredAttestation;
    try {
      stored = await this.repository.appendAttestation({
        workspaceId: principal.workspaceId,
        projectId: text(input['projectId'], 'projectId'),
        predicateType: parsed.value.predicateType,
        subjectName: subject.name,
        subjectDigest: subject.digest,
        attestedArtifactId: text(attested['id'], 'attestedArtifact.id'),
        attestedVersion,
        producedAt,
        sourceUri,
        sourceVersion,
        storage,
        // The Statement itself is the payload: subject and predicate together
        // are what the digest protects (FR-EVS-013).
        payload: storage === 'stored' ? parsed.value : null,
        reference,
        attachedTo,
        ...(claimedIntegrity !== undefined ? { claimedIntegrity } : {}),
      });
    } catch (error) {
      if (error instanceof ValidationFailedError) throw error;
      throw new ProviderUnavailableError('The evidence store could not be reached (FR-EVS-035).');
    }

    await this.reevaluateOnArrival(principal.workspaceId, attachedTo);
    return {
      id: stored.id,
      predicateType: stored.predicateType,
      attachedTo: stored.attachedTo,
      attestedArtifact: { id: stored.attestedArtifactId, version: stored.attestedVersion },
      integrityValid: stored.integrityValid,
    };
  }

  /**
   * `T858h`, `FR-EVS-031` — completion re-evaluated when evidence arrives,
   * without the declaration being repeated by hand. Only where a declaration was
   * refused and none has since been accepted: evidence arriving does not
   * declare completion for anybody who has not. The re-evaluation is a **new**
   * attempt, on behalf of whoever declared.
   */
  private async reevaluateOnArrival(workspaceId: string, ref: WorkRef): Promise<void> {
    try {
      const attempts = await this.repository.attempts(workspaceId, ref);
      if (attempts.some((a) => a.outcome === 'accepted')) return;
      const lastRefused = attempts.at(-1);
      if (lastRefused === undefined) return;
      await this.gate.complete(workspaceId, ref, lastRefused.declaredBy, 'evidence-arrival');
    } catch {
      // The contribution is recorded; a failed re-evaluation leaves the work
      // refused, which is the safe direction, and the next read re-derives.
    }
  }

  // ───────────────────────────────────────────────────────────── the gate

  /** `FR-EVS-030` — the completion gate behind `POST /evidence/:workRef/complete`. */
  async complete(principal: Principal, ref: WorkRef): Promise<{ ok: true }> {
    await this.currentBinding(principal, ref);
    const result = await this.gate.complete(principal.workspaceId, ref, `user:${principal.userId}`);
    if (!result.ok) {
      throw new ConflictError(
        `Completion refused: ${result.unmet.length} Evidence Contract item(s) unmet (FR-EVS-030).`,
        { unmet: result.unmet },
      );
    }
    return { ok: true };
  }

  // ───────────────────────────────────────────────────────────── aggregate

  /** `FR-EVS-006`, `SC-EVS-008` — computed from the store, not estimated. */
  async rollup(principal: Principal, projectId?: string): Promise<Rollup> {
    let all: WorkBinding[];
    let completed: Set<string>;
    try {
      all = await this.repository.allBindings(principal.workspaceId, projectId);
      completed = await this.repository.completedRefs(principal.workspaceId);
    } catch {
      throw new ProviderUnavailableError('The evidence store could not be reached (FR-EVS-035).');
    }

    const current = new Map<string, WorkBinding>();
    for (const binding of all) current.set(refKey(binding.workRef), binding);

    // FR-EVS-015 — the rollup counts only what the reader could open.
    const readable: WorkBinding[] = [];
    for (const binding of current.values()) {
      if (
        this.access !== null &&
        (await this.access.canRead(principal, { type: binding.subjectArtifactType, id: binding.subjectArtifactId }))
      ) {
        readable.push(binding);
      }
    }
    const evaluations = await this.gate.evaluateMany(principal.workspaceId, readable);

    let inFlight = 0;
    let done = 0;
    let doneSatisfied = 0;
    let unevaluated = 0;
    const unmetByItem: Record<string, number> = {};
    for (const binding of readable) {
      const evaluation = evaluations.get(refKey(binding.workRef))!;
      const isDone = completed.has(refKey(binding.workRef));
      if (isDone) done += 1;
      else inFlight += 1;
      if (!evaluation.evaluated) {
        unevaluated += 1;
        continue;
      }
      if (isDone && evaluation.status.satisfied) doneSatisfied += 1;
      if (!isDone) for (const itemId of evaluation.status.unmet) unmetByItem[itemId] = (unmetByItem[itemId] ?? 0) + 1;
    }

    return {
      projectId: projectId ?? null,
      inFlight,
      completed: done,
      completedSatisfied: doneSatisfied,
      satisfactionRate: done === 0 ? null : doneSatisfied / done,
      unmetByItem,
      unevaluated,
    };
  }
}

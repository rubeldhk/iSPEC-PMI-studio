/**
 * `T1924`, `T1928` (EPIC-047) — the Expert registry.
 *
 * `FR-EXP-001`…`FR-EXP-009`, `FR-EXP-072`. Register, version, submit, retire,
 * read and compare. Every act passes through `Authoring` first (`FR-EXP-009`)
 * and records who and when (`FR-EXP-007`).
 *
 * A new version is a **whole** contract, never a patch: an approved version is
 * immutable, so the only way to change what an Expert may do is a new version
 * that goes through approval again (`FR-EXP-004`, `FR-EXP-005`).
 */
import { randomUUID } from 'node:crypto';
import { ConflictError, NotFoundError, ValidationFailedError } from '../../core/errors.js';
import { effectiveVersion, statusOf } from './approval.js';
import type { Authoring } from './authoring.js';
import { checkReferences, validateContract } from './contract.validation.js';
import {
  CONTRACT_ELEMENTS,
  type ContractVersion,
  type EngineeringExpert,
  type ExpertContract,
  type RiskBand,
  type VersionStatus,
} from './expert.types.js';
import type { ExpertsStore } from './experts.store.js';
import type { ContractApprovals, EvidenceContracts } from './experts.tokens.js';

export interface RegistryDeps {
  readonly authoring: Authoring;
  /** Read at call time — the module passes getters over its ports holder. */
  readonly approvals: ContractApprovals;
  readonly evidence: EvidenceContracts;
  readonly clock?: () => string;
  readonly ids?: () => string;
}

export interface ExpertSummary {
  readonly id: string;
  readonly key: string;
  readonly name: string;
  readonly status: EngineeringExpert['status'];
  readonly rolePurpose: string;
  readonly riskClass: RiskBand;
  /** The highest approved version, or null — nothing runs without one. */
  readonly effectiveVersion: number | null;
  readonly latestVersion: number;
}

export interface VersionView extends ContractVersion {
  readonly status: VersionStatus;
}

export interface ExpertView {
  readonly expert: EngineeringExpert;
  readonly versions: readonly VersionView[];
  readonly effectiveVersion: VersionView | null;
}

export interface ElementDifference {
  readonly element: string;
  readonly changed: boolean;
  readonly from: Partial<ExpertContract>;
  readonly to: Partial<ExpertContract>;
}

/** Lowercase words joined by hyphens: `test-engineer`. */
const KEY = /^[a-z][a-z0-9]*(?:-[a-z0-9]+)*$/;

/** `FR-EXP-072` — all twelve elements, unchanged ones included. */
export function compareContracts(from: ExpertContract, to: ExpertContract): ElementDifference[] {
  return CONTRACT_ELEMENTS.map(({ element, fields }) => {
    const pick = (c: ExpertContract): Partial<ExpertContract> =>
      Object.fromEntries(fields.map((f) => [f, c[f]])) as Partial<ExpertContract>;
    const a = pick(from);
    const b = pick(to);
    return { element, changed: JSON.stringify(a) !== JSON.stringify(b), from: a, to: b };
  });
}

export class RegistryService {
  readonly #clock: () => string;
  readonly #ids: () => string;

  constructor(
    private readonly store: ExpertsStore,
    private readonly deps: RegistryDeps,
  ) {
    this.#clock = deps.clock ?? (() => new Date().toISOString());
    this.#ids = deps.ids ?? randomUUID;
  }

  async register(
    workspaceId: string,
    actorId: string,
    input: { key: unknown; name: unknown; contract: unknown },
  ): Promise<{ expert: EngineeringExpert; version: ContractVersion }> {
    await this.deps.authoring.requireAuthor(workspaceId, actorId);
    const key = typeof input.key === 'string' ? input.key.trim() : '';
    const name = typeof input.name === 'string' ? input.name.trim() : '';
    if (!KEY.test(key)) {
      throw new ValidationFailedError('an Expert key must be lowercase words joined by hyphens, e.g. test-engineer');
    }
    if (name === '') throw new ValidationFailedError('an Expert needs a name');
    const contract = validateContract(input.contract);
    await checkReferences(workspaceId, contract, { evidence: this.deps.evidence, store: this.store });

    const at = this.#clock();
    const expert = await this.store.addExpert({
      id: this.#ids(),
      workspaceId,
      key,
      name,
      status: 'active',
      registeredBy: actorId,
      registeredAt: at,
      retiredBy: null,
      retiredAt: null,
    });
    const version = await this.store.addVersion({
      id: this.#ids(),
      workspaceId,
      expertId: expert.id,
      version: 1,
      contract,
      decisionId: null,
      createdBy: actorId,
      createdAt: at,
    });
    return { expert, version };
  }

  async newVersion(workspaceId: string, actorId: string, expertId: string, input: unknown): Promise<ContractVersion> {
    await this.deps.authoring.requireAuthor(workspaceId, actorId);
    const expert = await this.#expert(workspaceId, expertId);
    if (expert.status === 'retired') {
      throw new ConflictError(`Expert '${expert.key}' is retired and takes no new contract versions (FR-EXP-006)`);
    }
    const contract = validateContract(input);
    await checkReferences(workspaceId, contract, { evidence: this.deps.evidence, store: this.store });
    const versions = await this.store.versionsFor(workspaceId, expertId);
    const next = versions.reduce((max, v) => Math.max(max, v.version), 0) + 1;
    return this.store.addVersion({
      id: this.#ids(),
      workspaceId,
      expertId,
      version: next,
      contract,
      decisionId: null,
      createdBy: actorId,
      createdAt: this.#clock(),
    });
  }

  /** `FR-EXP-005` — to `EPIC-031`, with the contract's own risk class selecting the approval band. */
  async submit(workspaceId: string, actorId: string, expertId: string, versionNumber: number): Promise<VersionView> {
    await this.deps.authoring.requireAuthor(workspaceId, actorId);
    const expert = await this.#expert(workspaceId, expertId);
    if (expert.status === 'retired') {
      throw new ConflictError(`Expert '${expert.key}' is retired; its versions are not submitted (FR-EXP-006)`);
    }
    const version = await this.#version(workspaceId, expertId, versionNumber);
    if (version.decisionId !== null) {
      throw new ConflictError(`version ${versionNumber} was already submitted (decision ${version.decisionId})`);
    }
    const { decisionId } = await this.deps.approvals.submit({
      workspaceId,
      actionType: 'expert-contract.approve',
      targetType: 'expert-contract-version',
      targetId: version.id,
      objectVersion: version.version,
      riskClass: version.contract.riskClass,
      actorId,
    });
    await this.store.recordDecision(workspaceId, version.id, decisionId);
    const submitted = { ...version, decisionId };
    return { ...submitted, status: await statusOf(submitted, this.deps.approvals) };
  }

  async retire(workspaceId: string, actorId: string, expertId: string): Promise<EngineeringExpert> {
    await this.deps.authoring.requireAuthor(workspaceId, actorId);
    await this.#expert(workspaceId, expertId);
    await this.store.retireExpert(workspaceId, expertId, actorId, this.#clock());
    return this.#expert(workspaceId, expertId);
  }

  async list(workspaceId: string, actorId: string): Promise<ExpertSummary[]> {
    await this.deps.authoring.requireReader(workspaceId, actorId);
    const out: ExpertSummary[] = [];
    for (const expert of await this.store.listExperts(workspaceId)) {
      const versions = await this.store.versionsFor(workspaceId, expert.id);
      const latest = versions[versions.length - 1]!;
      const effective = await effectiveVersion(versions, this.deps.approvals);
      const shown = effective ?? latest;
      out.push({
        id: expert.id,
        key: expert.key,
        name: expert.name,
        status: expert.status,
        rolePurpose: shown.contract.rolePurpose,
        riskClass: shown.contract.riskClass,
        effectiveVersion: effective?.version ?? null,
        latestVersion: latest.version,
      });
    }
    return out;
  }

  async get(workspaceId: string, actorId: string, expertId: string): Promise<ExpertView> {
    await this.deps.authoring.requireReader(workspaceId, actorId);
    const expert = await this.#expert(workspaceId, expertId);
    const versions: VersionView[] = [];
    for (const v of await this.store.versionsFor(workspaceId, expertId)) {
      versions.push({ ...v, status: await statusOf(v, this.deps.approvals) });
    }
    const effective = [...versions].reverse().find((v) => v.status === 'approved') ?? null;
    return { expert, versions, effectiveVersion: effective };
  }

  async compare(
    workspaceId: string,
    actorId: string,
    expertId: string,
    from: number,
    to: number,
  ): Promise<ElementDifference[]> {
    await this.deps.authoring.requireReader(workspaceId, actorId);
    await this.#expert(workspaceId, expertId);
    const a = await this.#version(workspaceId, expertId, from);
    const b = await this.#version(workspaceId, expertId, to);
    return compareContracts(a.contract, b.contract);
  }

  async #expert(workspaceId: string, expertId: string): Promise<EngineeringExpert> {
    const expert = await this.store.findExpert(workspaceId, expertId);
    if (expert === null) throw new NotFoundError('Not found.');
    return expert;
  }

  async #version(workspaceId: string, expertId: string, versionNumber: number): Promise<ContractVersion> {
    const found = (await this.store.versionsFor(workspaceId, expertId)).find((v) => v.version === versionNumber);
    if (!found) throw new NotFoundError(`version ${versionNumber} of this Expert does not exist`);
    return found;
  }
}

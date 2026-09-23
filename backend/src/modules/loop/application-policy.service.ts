/**
 * T1118 (EPIC-030 C2D) — explicit auto-application policy.
 *
 * ## Why this exists
 *
 * `X15`. C2C changed `autoApplyPermitted`'s default from `false` to `true` so
 * the end-to-end proof could reach `applied`. The reasoning offered at the time
 * — that gates and authority already carry the governance — was not wrong about
 * the brakes, but it was answering the wrong question. With no way to configure
 * a rule, "nobody has decided whether this may apply automatically" and
 * "somebody has authorised it" became the same state, and the second is not
 * something a default may assert on anyone's behalf.
 *
 * The default is `false` again. Application now requires an **effective policy
 * row** that names the transition, was created by someone, and — because
 * auto-application is an authorised act — carries an approver.
 *
 * ## Fail closed, and why unreadable is not the same as absent
 *
 * A policy that cannot be read is not a policy that says no. Both refuse
 * application, but they are different facts: absent means nobody configured it,
 * unreadable means the store did not answer. {@link PolicyUnavailableError} is
 * raised for the second so an operator is not told their configuration is
 * missing when the database is simply down.
 */

export type PolicyState = 'effective' | 'disabled';

export interface ApplicationPolicyRecord {
  readonly id: string;
  readonly workspaceId: string;
  readonly targetArtifactType: string;
  readonly fromStatus: string;
  readonly toStatus: string;
  readonly requiredAuthorities: readonly string[];
  readonly autoApplyPermitted: boolean;
  readonly policyVersion: number;
  readonly state: PolicyState;
  readonly createdById: string;
  readonly approvedById: string | null;
  readonly effectiveFrom: Date;
}

/** The store did not answer. Distinct from "no policy is configured". */
export class PolicyUnavailableError extends Error {
  readonly code = 'policy_unavailable' as const;
  constructor(cause: string) {
    super(
      `Application policy could not be read (${cause}). Refusing to apply: an unreadable ` +
        'policy is not a policy that permits.',
    );
    this.name = 'PolicyUnavailableError';
  }
}

export interface ApplicationPolicyStore {
  /**
   * The LATEST version for this transition, whatever its state.
   *
   * "Effective" is derived from it rather than stored as a standing flag: the
   * table is append-only, so a withdrawal cannot flip an earlier row — it
   * appends a higher version saying `disabled`. Asking for "the row marked
   * effective" would keep finding the superseded one.
   */
  findLatest(
    workspaceId: string,
    targetArtifactType: string,
    fromStatus: string,
    toStatus: string,
  ): Promise<ApplicationPolicyRecord | null>;
  /** Highest version seen for this transition, effective or not. */
  highestVersion(
    workspaceId: string,
    targetArtifactType: string,
    fromStatus: string,
    toStatus: string,
  ): Promise<number>;
  append(row: Record<string, unknown>): Promise<ApplicationPolicyRecord>;
}

export interface ConfigurePolicyInput {
  workspaceId: string;
  targetArtifactType: string;
  fromStatus: string;
  toStatus: string;
  requiredAuthorities?: readonly string[];
  autoApplyPermitted: boolean;
  createdById: string;
  createdBySnapshotId?: string;
  /** Required when `autoApplyPermitted` is true — enforced here and by CHECK. */
  approvedById?: string;
  approvedBySnapshotId?: string;
  correlationId: string;
}

/**
 * EPIC-030's policy capability. Configuration only — it decides nothing about
 * any particular proposal, which remains the adjudicator's job.
 */
export class ApplicationPolicyService {
  constructor(private readonly store: ApplicationPolicyStore) {}

  /**
   * Append a new version, superseding whatever was effective.
   *
   * Never an update: the row an earlier adjudication was decided under has to
   * keep reading the same way, or the audit answers nothing.
   */
  async configure(input: ConfigurePolicyInput): Promise<ApplicationPolicyRecord> {
    if (input.autoApplyPermitted && !input.approvedById) {
      throw new Error(
        'Auto-application must be approved by a named identity. A permissive policy nobody ' +
          'approved is the state X15 was raised about.',
      );
    }
    const highest = await this.store.highestVersion(
      input.workspaceId,
      input.targetArtifactType,
      input.fromStatus,
      input.toStatus,
    );
    const current = await this.store.findLatest(
      input.workspaceId,
      input.targetArtifactType,
      input.fromStatus,
      input.toStatus,
    );
    return this.store.append({
      workspaceId: input.workspaceId,
      targetArtifactType: input.targetArtifactType,
      fromStatus: input.fromStatus,
      toStatus: input.toStatus,
      requiredAuthorities: [...(input.requiredAuthorities ?? [])],
      autoApplyPermitted: input.autoApplyPermitted,
      policyVersion: highest + 1,
      state: 'effective',
      createdById: input.createdById,
      createdBySnapshotId: input.createdBySnapshotId ?? null,
      approvedById: input.approvedById ?? null,
      approvedBySnapshotId: input.approvedBySnapshotId ?? null,
      correlationId: input.correlationId,
      supersedesId: current?.id ?? null,
    });
  }

  /** Withdraw auto-application without configuring a replacement. */
  async disable(
    input: Omit<ConfigurePolicyInput, 'autoApplyPermitted' | 'approvedById'>,
  ): Promise<ApplicationPolicyRecord | null> {
    const current = await this.store.findLatest(
      input.workspaceId,
      input.targetArtifactType,
      input.fromStatus,
      input.toStatus,
    );
    if (!current || current.state === 'disabled') return null;
    const highest = await this.store.highestVersion(
      input.workspaceId,
      input.targetArtifactType,
      input.fromStatus,
      input.toStatus,
    );
    return this.store.append({
      workspaceId: input.workspaceId,
      targetArtifactType: input.targetArtifactType,
      fromStatus: input.fromStatus,
      toStatus: input.toStatus,
      requiredAuthorities: [...current.requiredAuthorities],
      autoApplyPermitted: false,
      policyVersion: highest + 1,
      state: 'disabled',
      createdById: input.createdById,
      approvedById: current.approvedById,
      correlationId: input.correlationId,
      supersedesId: current.id,
    });
  }

  /**
   * Read the effective policy, translating a store failure into a distinct
   * error rather than into "nothing configured".
   */
  async effectiveFor(
    workspaceId: string,
    targetArtifactType: string,
    fromStatus: string,
    toStatus: string,
  ): Promise<ApplicationPolicyRecord | null> {
    try {
      const latest = await this.store.findLatest(
        workspaceId,
        targetArtifactType,
        fromStatus,
        toStatus,
      );
      return latest && latest.state === 'effective' ? latest : null;
    } catch (error) {
      throw new PolicyUnavailableError(error instanceof Error ? error.message : 'unknown');
    }
  }
}

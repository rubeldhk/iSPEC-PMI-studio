/**
 * T338d — the `RequirementRegister` seam, bound to `EPIC-007`. `FR-RQR-002`,
 * `D-33`. Unit test: `T338c`.
 *
 * **Named explicitly, and this file exists because of a defect in another
 * Epic.** `EPIC-031`'s analysis found the equivalent binding *missing*: a port
 * declared, a token registered, and nothing on the other end. That failure is
 * invisible from inside the consuming module — every call site type-checks
 * against the port — so the binding gets its own file, its own task and its own
 * test against the **real** `RequirementsService` rather than a fake.
 *
 * **The Room reads and writes requirement text only through here.** Everywhere
 * else it holds ids. `requirement-room.tokens.ts` calls this the boundary this
 * Epic is most likely to cross *"because a local cache of requirement text
 * would feel convenient every single day"* — so there is deliberately no
 * in-memory implementation of this port in this module, not even for tests.
 * `T338c` asserts that by scanning this file's exports: a fallback cannot be
 * added quietly.
 *
 * **Two methods, and `freeze` is the one that needs explaining.** A baseline
 * stores `EPIC-007` requirement **version ids** (`R-033-5`, data-model §5).
 * `EPIC-007` appends a version row on *edit* — the state a requirement moved
 * *from* — so a requirement never edited has no version row, and a baseline
 * over it would have nothing immutable to point at. `freeze` appends the
 * requirement **as it stands** through `EPIC-007`'s own version service, which
 * is what that table is defined to hold, and returns the id of the row it
 * created. Those rows are immutable by the `requirement_versions_immutable`
 * trigger, which is what makes a frozen set actually frozen. The Room mints no
 * identifier and stores no text.
 *
 * Framework-free (PC-1).
 */
import type {
  ActingContext,
  RequirementsService,
} from '../requirements/requirements.service.js';
import type { RequirementVersionService } from '../requirements/requirement-version.service.js';
import type {
  RequirementPriority,
  RequirementType,
} from '../requirements/requirement.validation.js';

/** What a candidate needs to become a requirement. Text in, id out. */
export interface PromoteInput {
  /** The candidate's normalized text. Becomes the requirement's description. */
  readonly text: string;
  readonly type: RequirementType;
  readonly priority: RequirementPriority;
  /** Optional human reference; `EPIC-007` allocates one when absent. */
  readonly reference?: string;
}

export interface PromotedRequirement {
  readonly requirementId: string;
  /** `EPIC-007`'s hash, returned rather than recomputed — `R-033-5`. */
  readonly contentHash: string;
}

export interface FrozenRequirement {
  readonly requirementVersionId: string;
  readonly requirementId: string;
  readonly contentHash: string;
}

/**
 * The port. Bound at the composition root to `EpicSevenRequirementRegister`
 * under `ROOM_REQUIREMENT_REGISTER`, and to nothing else, ever.
 */
export interface RequirementRegister {
  promote(
    ctx: ActingContext,
    projectId: string,
    input: PromoteInput,
  ): Promise<PromotedRequirement>;
  /** The requirement as it stands, as an immutable `EPIC-007` version row. */
  freeze(ctx: ActingContext, requirementId: string): Promise<FrozenRequirement>;
  /**
   * `T1213` — the requirement's **current** frozen version, read not appended.
   *
   * `freeze` appends a version; this reads the latest one. A screen rebuilding
   * baseline members after a reload must not append a version every time
   * somebody opens the page.
   */
  currentVersion(ctx: ActingContext, requirementId: string): Promise<FrozenRequirement | null>;
}

/**
 * Raised when the seam has no implementation bound.
 *
 * Deliberately **not** a `PlatformError`: the platform's status table documents
 * nine codes and none of them means *"a governance seam is unbound"*, and
 * `DEF-008-001` records what happens when an Epic that does not own
 * `platform-api.md` invents a status. `ROOM_PORTS` declares this seam `refuse`;
 * this is that refusal, carrying the Epic that was supposed to fill it so the
 * operator reads a wiring fault rather than a user error.
 */
export class RegisterUnavailableError extends Error {
  constructor() {
    super(
      'the RequirementRegister seam is unbound — EPIC-007 supplies it, and FR-RQR-002 forbids ' +
        'substituting a local requirement store',
    );
    this.name = 'RegisterUnavailableError';
  }
}

/** `absentBehaviourOf('RequirementRegister') === 'refuse'`, at the call site. */
export function requireRegister(
  register: RequirementRegister | undefined | null,
): RequirementRegister {
  if (!register) throw new RegisterUnavailableError();
  return register;
}

export class EpicSevenRequirementRegister implements RequirementRegister {
  constructor(
    private readonly requirements: RequirementsService,
    private readonly versions: RequirementVersionService,
  ) {}

  async promote(
    ctx: ActingContext,
    projectId: string,
    input: PromoteInput,
  ): Promise<PromotedRequirement> {
    const created = await this.requirements.create(ctx, projectId, {
      description: input.text,
      type: input.type,
      priority: input.priority,
      ...(input.reference === undefined ? {} : { reference: input.reference }),
    });
    return { requirementId: created.id, contentHash: created.contentHash };
  }

  async currentVersion(
    ctx: ActingContext,
    requirementId: string,
  ): Promise<FrozenRequirement | null> {
    // `get` applies `EPIC-007`'s tenancy guard, so a cross-workspace read is
    // refused there and comes back opaque. Same posture as `freeze`.
    const current = await this.requirements.get(ctx.workspaceId, requirementId);
    const versions = await this.versions.listForRequirement(ctx.workspaceId, requirementId);
    const latest = versions[versions.length - 1];
    if (latest === undefined) return null;
    return {
      requirementVersionId: latest.id,
      requirementId: current.id,
      // The hash lives on the requirement; the id on its latest version. A
      // member is made of both.
      contentHash: current.contentHash,
    };
  }

  async freeze(ctx: ActingContext, requirementId: string): Promise<FrozenRequirement> {
    // `get` applies EPIC-007's own tenancy guard, so a cross-workspace freeze
    // is refused there and comes back opaque (FR-002 / SC-004). The adapter
    // does not soften it and does not add a message of its own.
    const current = await this.requirements.get(ctx.workspaceId, requirementId);
    const version = await this.versions.append({
      workspaceId: current.workspaceId,
      requirementId: current.id,
      description: current.description,
      type: current.type,
      priority: current.priority,
      authoredById: ctx.userId,
    });
    return {
      requirementVersionId: version.id,
      requirementId: current.id,
      contentHash: current.contentHash,
    };
  }
}

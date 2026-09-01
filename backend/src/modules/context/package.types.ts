/**
 * `T1226` (EPIC-038) — what a Context Package is, as types.
 *
 * `FR-CTX-040`–`FR-CTX-044`, `FR-CTX-064`.
 *
 * ## Two guarantees live in this file rather than in a validator
 *
 * **An item is a reference, never a copy.** There is no `content`, `body`,
 * `payload` or `text` field, and `T1225` asserts their absence. A copy here
 * would be a second source that can disagree with the artifact it came from,
 * and it would sit under this Epic's access rules rather than the artifact's —
 * which is how a classified specification becomes readable by everyone who can
 * open a context package. `EPIC-035`'s `T997m` bans the same thing one Room
 * over, for the same reason.
 *
 * **`authoritativeStatus` cannot be omitted or defaulted.** It answers *"is
 * this still true?"* about material a model is about to be given. A default of
 * `current` fills the column for every item nobody resolved, and the reader
 * cannot distinguish *checked and current* from *never checked*. A superseded
 * requirement quoted as current is worse than one not quoted at all: the model
 * treats it as authoritative and so does the reviewer.
 *
 * The union's two non-trivial arms carry the field that explains them, so an
 * item marked superseded with nothing to point at **does not typecheck** — a
 * validator runs where somebody remembered to call it, and this is the check
 * most worth skipping when a call site is awkward.
 *
 * Framework-free (PC-1).
 */

/** `FR-CTX-042` — the three, and there is no fourth. */
export const AUTHORITATIVE_STATUSES = Object.freeze([
  'current',
  'superseded',
  'undetermined',
] as const);

export type AuthoritativeStatus = (typeof AUTHORITATIVE_STATUSES)[number];

/** What every item carries regardless of its status. */
interface PackageItemBase {
  readonly id: string;
  /** `FR-002` — its own tenant, so isolation is a predicate rather than a join. */
  readonly workspaceId: string;
  readonly packageId: string;
  /** `FR-CTX-040` — the reference, never the material. */
  readonly sourceType: string;
  readonly sourceId: string;
  readonly sourceVersion: string;
  /**
   * `FR-CTX-064`, `PP-016` — the objective term or selection rule that put this
   * item here.
   *
   * Required, and recorded at the moment of selection: a reason reconstructed
   * afterwards is a guess about what the assembler was thinking. `plan.md`
   * declares `PP-016` satisfied on the strength of this field, so leaving it
   * unfilled would make a principle row false rather than merely leave a
   * column null.
   */
  readonly inclusionReason: string;
  /** `FR-CTX-014` — the score that ranked it. */
  readonly relevanceScore: number;
  /** `FR-CTX-052` — true only for an authorised reusable source. */
  readonly crossBoundary: boolean;
  /** Required when `crossBoundary` — the authorisation that permitted it. */
  readonly authorisationRef?: string;
}

/**
 * `FR-CTX-042`–`FR-CTX-044` — an item, and what its status obliges it to say.
 *
 * A discriminated union rather than one shape with optional members, so the
 * three cases cannot be mixed and none can be half-filled.
 */
export type PackageItem =
  | (PackageItemBase & { readonly authoritativeStatus: 'current' })
  | (PackageItemBase & {
      readonly authoritativeStatus: 'superseded';
      /** `FR-CTX-043` — carried, not referenced. There is no superseded without it. */
      readonly supersededBy: string;
    })
  | (PackageItemBase & {
      readonly authoritativeStatus: 'undetermined';
      /**
       * `FR-CTX-044` — why nobody could resolve it.
       *
       * *"I could not look"* and *"nobody has decided"* are both undetermined,
       * and the reason is what distinguishes them for whoever reads this later.
       */
      readonly undeterminedReason: string;
    });

/** `state` for a package: assembled, or refused with a reason. */
export type PackageState = 'assembled' | 'refused';

export interface ContextPackage {
  readonly id: string;
  readonly workspaceId: string;
  readonly projectId: string;
  /** `FR-CTX-062` — the execution this fed. Null only while assembly is in flight. */
  readonly executionId: string | null;
  /** `FR-CTX-032` — what it was assembled for, in the requester's words. */
  readonly objective: string;
  readonly actorId: string;
  readonly actorRole: string;
  readonly budgetTokens: number;
  readonly budgetCost: number;
  readonly state: PackageState;
  /** `FR-CTX-065` — required when refused; a refusal is a row, not an absence. */
  readonly refusalReason: string | null;
  /** `R-038-4` — which model ranked this package's candidates. */
  readonly embeddingModelId: string;
  readonly assembledAt: Date;
}

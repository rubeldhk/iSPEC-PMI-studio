/**
 * T338h (`EPIC-033`) — the veto seam on `EPIC-007`'s edit path. `FR-RQR-051`,
 * `RULE-02`, `BR-0042`.
 *
 * **Here, and generic, so `EPIC-007` learns nothing about baselines.** This
 * register holds requirements; whether a particular one is frozen into an
 * approved set is the Requirement Room's business, and `FR-RQR-003` keeps it
 * there. So the register asks *"may this be edited?"* and does not know who
 * answers or why.
 *
 * **A registry rather than a constructor argument, because of the direction of
 * the dependency.** `RequirementRoomModule` imports `RequirementsModule` — it
 * needs `RequirementsService` for its register adapter (`T338d`). Passing the
 * Room's guard into `RequirementsService` at construction would point the
 * dependency back the other way and make the two modules circular. The Room
 * writes into this holder instead, and `EPIC-007` never imports the Room.
 *
 * **An empty registry permits every edit, and that is not a default that
 * permits.** The seams `ROOM_PORTS` declares `refuse` are governance
 * evaluations that must not be skipped. This is different in kind: with no Room
 * installed there are no baselines, so there is nothing to freeze a requirement
 * and `EPIC-007` behaves exactly as it did before this file existed. The
 * refusal is absent because the *feature* is absent, not because a check was
 * unbound.
 *
 * Framework-free (PC-1).
 */
import type { ActingContext } from './requirements.service.js';

/** What an authority needs to decide. Deliberately not the whole record. */
export interface EditableRequirement {
  readonly id: string;
  readonly workspaceId: string;
  readonly projectId: string;
}

/**
 * Throws to refuse. A boolean return would force this file to decide what the
 * refusal *means*, and the authority is the only thing that knows — the
 * Requirement Room's refusal carries the baseline and the Change Request route
 * (`BR-0042`), which no shared signature could express.
 */
export type EditAuthority = (
  ctx: ActingContext,
  requirement: EditableRequirement,
) => Promise<void> | void;

export class EditAuthorityRegistry {
  private readonly authorities: EditAuthority[] = [];

  register(authority: EditAuthority): void {
    this.authorities.push(authority);
  }

  /**
   * Every authority, in registration order, and the first refusal wins.
   *
   * A list rather than one slot: `EPIC-034` will have its own reason to refuse
   * an edit, and a second registration silently replacing the first is how one
   * of the two rules would stop being enforced without anything failing.
   */
  async assertEditable(ctx: ActingContext, requirement: EditableRequirement): Promise<void> {
    for (const authority of this.authorities) {
      await authority(ctx, requirement);
    }
  }
}

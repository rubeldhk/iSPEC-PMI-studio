/**
 * `T994g` (EPIC-034) — the baseline delta. `FR-CHR-063`, `R-034-4`.
 *
 * *"Readable as a delta, not only as two full versions"* — three lines a reader
 * can take in, rather than two member lists to compare by eye.
 *
 * ## A set diff over version ids, never a text diff
 *
 * `EPIC-033`'s `R-033-5` stores a baseline as member requirement **version
 * ids** plus a set hash, and never copies of requirement text. A text diff
 * would re-derive content the baseline deliberately does not hold, and would
 * then disagree with the set hash — presentation-layer output masquerading as
 * the delta. There is no text parameter here, so it is not something a caller
 * could ask for by mistake.
 *
 * ## Why version-changed needs a join
 *
 * Added and removed fall out of a set difference. **Version-changed** does not:
 * `rv_2` becoming `rv_2b` is one requirement moving forward, not one
 * disappearing and another arriving, and telling those apart means knowing
 * which requirement each version belongs to. That join is `EPIC-007`'s
 * (`FR-RQR-002`), so the caller supplies it as a function — the same rule
 * `assertEditable` follows, for the same reason: doing it here would mean this
 * Room holding the register.
 *
 * A pure function. No store, no clock, no dependencies.
 */

export interface VersionChange {
  readonly requirementId: string;
  readonly from: string;
  readonly to: string;
}

export interface BaselineDelta {
  readonly fromBaselineVersion: number;
  readonly toBaselineVersion: number;
  /** Version ids present only in the new set. */
  readonly added: readonly string[];
  /** Version ids present only in the old set. */
  readonly removed: readonly string[];
  /** One requirement, two versions. Not an add plus a remove. */
  readonly versionChanged: readonly VersionChange[];
}

export interface DeltaInput {
  readonly fromBaselineVersion: number;
  readonly toBaselineVersion: number;
  readonly from: readonly string[];
  readonly to: readonly string[];
  /**
   * `EPIC-007`'s join, supplied by the caller.
   *
   * `null` means the register does not know this version. Pairing it with
   * something on a hunch would invent a requirement history, so an unresolvable
   * version is reported as a plain addition or removal.
   */
  requirementOf(versionId: string): string | null;
}

export function computeBaselineDelta(input: DeltaInput): BaselineDelta {
  if (input.toBaselineVersion <= input.fromBaselineVersion) {
    // `change_baseline_deltas_move_forward` says the same thing in SQL. A delta
    // that goes nowhere is not a delta.
    throw new Error(
      `a baseline delta moves forward: v${input.fromBaselineVersion} → ` +
        `v${input.toBaselineVersion} does not (FR-CHR-063)`,
    );
  }

  const from = new Set(input.from);
  const to = new Set(input.to);

  const goneIds = [...from].filter((id) => !to.has(id)).sort();
  const newIds = [...to].filter((id) => !from.has(id)).sort();

  // Requirement id → the version that left, for the ones whose owner is known.
  const goneByRequirement = new Map<string, string>();
  for (const id of goneIds) {
    const requirementId = input.requirementOf(id);
    if (requirementId !== null) goneByRequirement.set(requirementId, id);
  }

  const versionChanged: VersionChange[] = [];
  const added: string[] = [];
  const pairedOff = new Set<string>();

  for (const id of newIds) {
    const requirementId = input.requirementOf(id);
    const previous = requirementId === null ? undefined : goneByRequirement.get(requirementId);
    if (requirementId !== null && previous !== undefined) {
      versionChanged.push({ requirementId, from: previous, to: id });
      pairedOff.add(previous);
      continue;
    }
    added.push(id);
  }

  return {
    fromBaselineVersion: input.fromBaselineVersion,
    toBaselineVersion: input.toBaselineVersion,
    // Sorted throughout: this delta is stored and later re-read, so two
    // computations of the same move must not disagree about order.
    added,
    removed: goneIds.filter((id) => !pairedOff.has(id)),
    versionChanged: versionChanged.sort((a, b) => a.requirementId.localeCompare(b.requirementId)),
  };
}

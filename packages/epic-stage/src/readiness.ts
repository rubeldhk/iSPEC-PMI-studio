/**
 * `T1560` (EPIC-044) — readiness and waiver validation, moved from
 * `tests/governance/epic-stage/dor.ts` (T505, T511, DF-5, DF-6) and made pure:
 * the known conditions and the permitted owners are inputs, because this
 * package knows no repository. The governance shim supplies them from
 * `governance/`; the product supplies an empty condition set (`FR-EPB-046`).
 */

export type EpicKind = 'delivery' | 'parent-design';

export interface WaiverDeclaration {
  readonly epic: string;
  readonly condition: string;
  readonly owner: string;
  readonly reason: string;
  readonly expires: string;
}

export interface WaiverContext {
  /** Injected, never read from the clock — determinism. */
  readonly today: string;
  readonly epicsOnDisk: readonly string[];
  /** The condition ids a waiver may name — the consumer's DOR set. */
  readonly knownConditions: readonly string[];
  /** The roles that may own a waiver — the consumer's governance. */
  readonly permittedOwners: readonly string[];
}

export interface WaiverValidation {
  readonly problems: string[];
  readonly expired: boolean;
  /** Valid AND unexpired. Anything else grants nothing. */
  readonly grantsCover: boolean;
}

export function validateWaiver(waiver: WaiverDeclaration | undefined, ctx: WaiverContext): WaiverValidation {
  const problems: string[] = [];

  if (!waiver) {
    return { problems: ['waiver is absent'], expired: false, grantsCover: false };
  }

  if (!waiver.epic || !ctx.epicsOnDisk.includes(waiver.epic)) {
    problems.push(`waiver names "${waiver.epic}", which is not an Epic directory on disk`);
  }

  // DF-5 — "no arrays of conditions, no wildcard, no waiver of the DOR."
  // Waiving one named condition is a decision someone can review; waiving a
  // gate is a decision nobody can.
  if (Array.isArray(waiver.condition)) {
    problems.push('a waiver covers exactly one condition, never a list (DF-5)');
  } else if (!waiver.condition) {
    problems.push('waiver names no condition');
  } else if (!ctx.knownConditions.includes(waiver.condition)) {
    problems.push(`waiver names "${waiver.condition}", which is not in the current DOR set`);
  }

  if (!waiver.owner || !ctx.permittedOwners.includes(waiver.owner)) {
    problems.push(`waiver owner "${waiver.owner ?? '(none)'}" is not one of ${ctx.permittedOwners.join(', ')}`);
  }

  if (!waiver.reason?.trim()) {
    problems.push('waiver carries no reason');
  }

  let expired = false;
  if (!waiver.expires || !/^\d{4}-\d{2}-\d{2}$/.test(waiver.expires)) {
    // An exception with no end is a rule change wearing a costume.
    problems.push(`waiver expiry "${waiver.expires ?? '(none)'}" is not a YYYY-MM-DD date`);
  } else {
    // The expiry date itself is still valid — the alternative makes the last
    // day of an exception unusable and surprises whoever relied on it.
    expired = waiver.expires < ctx.today;
  }

  return { problems, expired, grantsCover: problems.length === 0 && !expired };
}

export type Readiness = 'Ready' | 'Ready (waived)' | 'Not ready' | 'n/a';

export interface ReadinessInput {
  readonly directory: string;
  readonly kind: EpicKind;
  readonly failures: readonly string[];
  readonly waivers: readonly WaiverDeclaration[];
  readonly today: string;
  readonly epicsOnDisk: readonly string[];
}

export interface ReadinessResult {
  readonly readiness: Readiness;
  /** Failing conditions no valid waiver covers. */
  readonly uncovered: string[];
  /** Build-failing problems — expired waivers (`DF-6`, `FR-ESK-023`). */
  readonly blocking: string[];
  /** Reported but not build-failing — malformed waivers. */
  readonly reported: string[];
}

export function resolveReadiness(input: ReadinessInput, validate: (waiver: WaiverDeclaration) => WaiverValidation): ReadinessResult {
  // FR-ESK-024 — a parent design is never evaluated. The DOR requires a task
  // list, and reporting a permanent failure for its absence trains readers to
  // ignore the column.
  if (input.kind === 'parent-design') {
    return { readiness: 'n/a', uncovered: [], blocking: [], reported: [] };
  }

  const mine = input.waivers.filter((waiver) => waiver.epic === input.directory);
  const blocking: string[] = [];
  const reported: string[] = [];
  const covering = new Set<string>();

  for (const waiver of mine) {
    const validation = validate(waiver);
    if (validation.expired) {
      // DF-6 — an expired waiver FAILS THE BUILD. Someone is still relying on
      // an exception past its agreed end, which is more dangerous than a
      // recording error.
      blocking.push(`${input.directory}: waiver on ${waiver.condition} expired ${waiver.expires} — renew it as a fresh dated record or fix the condition`);
    }
    reported.push(...validation.problems.map((problem) => `${input.directory}: ${problem}`));
    if (validation.grantsCover) covering.add(waiver.condition);
  }

  const uncovered = input.failures.filter((failure) => !covering.has(failure));

  // There is no combination producing an unqualified `Ready` while a waiver is
  // active. That is what stops waivers becoming a second, weaker DOR.
  const readiness: Readiness = uncovered.length > 0 ? 'Not ready' : covering.size > 0 ? 'Ready (waived)' : 'Ready';

  return { readiness, uncovered, blocking, reported };
}

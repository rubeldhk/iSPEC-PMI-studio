/**
 * `T1250`, `T1252` (EPIC-038) — where an item came from, and whether it still
 * holds.
 *
 * `FR-CTX-040`–`FR-CTX-044`.
 *
 * ## The failure this service exists to prevent
 *
 * A superseded requirement quoted as **current** is worse than one not quoted
 * at all. Omitted, it is a gap somebody may notice. Included and unmarked, it
 * is authority — the model reasons from it, the reviewer reads it as the rule,
 * and nothing in the output distinguishes it from material that still holds.
 *
 * So `current` is never a fallback. It is only ever something a reader
 * affirmatively said.
 *
 * ## Two undetermineds, one status, two reasons
 *
 * *"Nobody has decided"* and *"the reader was unreachable"* both mean the item
 * must not claim to be current, so they share a status. They do **not** share a
 * reason, because they send a person to different places: one to ask somebody,
 * one to fix a service.
 *
 * `EPIC-035` kept the equivalent pair apart as separate outcomes, because there
 * the consequences differed — a Requirement Gap is filed, an outage is not.
 * Here the consequence is identical and only the diagnosis differs, so the
 * distinction lives in the reason rather than in the type. That is a
 * deliberate difference from the sibling Epic, not an oversight.
 *
 * ## Why a failing reader does not refuse the package
 *
 * One unreachable lookup should not lose the other nine items. The package is
 * still worth having, the item is marked, and the reason names the outage. A
 * refusal here would trade a fully-labelled package for nothing at all.
 *
 * Framework-free (PC-1).
 */
import { ValidationFailedError } from '../../core/errors.js';
import type { AuthoritativeStatus } from './package.types.js';

/** The source being asked about. */
export interface SourceCitation {
  readonly sourceType: string;
  readonly sourceId: string;
  readonly sourceVersion: string;
}

/**
 * What `EPIC-033` answers about a version.
 *
 * There is deliberately **no `undetermined` arm**: a reader says what it knows,
 * and *not knowing* is this service's conclusion rather than the reader's
 * answer. A reader that could return `undetermined` would let the two
 * unresolvable cases arrive indistinguishable.
 */
export type SourceStatus =
  | { readonly status: 'current' }
  | { readonly status: 'superseded'; readonly supersededBy: string }
  | { readonly status: 'unknown' };

export interface BaselineReaderPort {
  statusOf(input: { workspaceId: string } & SourceCitation): Promise<SourceStatus>;
}

/** What provenance resolution puts on an item: a pointer and a status. */
export type ResolvedProvenance = SourceCitation &
  (
    | { readonly authoritativeStatus: Extract<AuthoritativeStatus, 'current'> }
    | {
        readonly authoritativeStatus: Extract<AuthoritativeStatus, 'superseded'>;
        readonly supersededBy: string;
      }
    | {
        readonly authoritativeStatus: Extract<AuthoritativeStatus, 'undetermined'>;
        readonly undeterminedReason: string;
      }
  );

export class ProvenanceService {
  constructor(private readonly baselines: BaselineReaderPort) {}

  async resolve(workspaceId: string, source: SourceCitation): Promise<ResolvedProvenance> {
    let answer: SourceStatus;
    try {
      answer = await this.baselines.statusOf({ workspaceId, ...source });
    } catch (error) {
      // Caught **and recorded**, not swallowed. The reason distinguishes this
      // from "nobody has decided", which is the only thing that tells a reader
      // whether to chase a person or a service.
      return {
        ...source,
        authoritativeStatus: 'undetermined',
        undeterminedReason:
          `the baseline reader could not be reached, so this version's status is unknown: ` +
          `${error instanceof Error ? error.message : 'unknown error'} (FR-CTX-044)`,
      };
    }

    if (answer.status === 'current') {
      return { ...source, authoritativeStatus: 'current' };
    }

    if (answer.status === 'superseded') {
      if (!answer.supersededBy || answer.supersededBy.trim() === '') {
        // The collaborator can be wrong. Passing this through would put a row
        // into the package that the database then rejects — failing at the
        // write, far from the cause, with a constraint name instead of an
        // explanation.
        throw new ValidationFailedError(
          `the baseline reader reported ${source.sourceType} ${source.sourceId}@` +
            `${source.sourceVersion} as superseded without naming a successor. ` +
            '"This is out of date" without "use this instead" stops the work rather than ' +
            'continuing it correctly (FR-CTX-043)',
        );
      }
      return {
        ...source,
        authoritativeStatus: 'superseded',
        supersededBy: answer.supersededBy,
      };
    }

    // `unknown` — the reader looked and has nothing recorded. Distinct from the
    // outage above, and never `current`: `FR-CTX-044`'s whole subject is that a
    // convenient fallback becomes authority downstream.
    return {
      ...source,
      authoritativeStatus: 'undetermined',
      undeterminedReason:
        `no baseline records an authoritative status for ${source.sourceType} ` +
        `${source.sourceId}@${source.sourceVersion} — nobody has decided whether it still ` +
        'holds (FR-CTX-044)',
    };
  }

  /**
   * `T1252`, `R-038-8` — the same question for execution history.
   *
   * An execution record's provenance is the **projection it was read from**,
   * not a baseline: `EPIC-037` makes events authoritative and projections
   * rebuildable, so an execution has no superseding version in the sense a
   * requirement does. It is `current` as of the projection, and saying anything
   * stronger would import a versioning model `EPIC-037` does not have.
   */
  resolveExecution(source: SourceCitation): ResolvedProvenance {
    return { ...source, authoritativeStatus: 'current' };
  }
}

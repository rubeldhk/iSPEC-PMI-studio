/**
 * `T1202` (EPIC-032, scoped) — evaluating an Evidence Contract.
 *
 * The last seam between the Requirement Room and an approved baseline
 * (`DEF-033-002`). `BaselineService.approve` asks exactly one question — *is
 * this Contract satisfied?* — and has refused since Phase 3 because nothing
 * could answer.
 *
 * ## A pure function, deliberately
 *
 * Every rule below is a way an unsatisfied Contract can be made to look
 * satisfied, and each is cheap to get wrong and cheap to test in isolation. The
 * store is a separate concern; this decides.
 *
 * ## The rules, and why each exists
 *
 * - **`FR-EVS-025`** an item declares the evidence types that satisfy it, and
 *   evidence of another type leaves it unmet **and says why**. Evidence is typed
 *   by *what it proves* (`FR-EVS-003`), so a screenshot does not close an item
 *   asking for a test run.
 * - **`FR-EVS-011`, `FR-EVS-012`** evidence attests an artifact **and its
 *   version**. Evidence for a superseded version stays readable and stops being
 *   evidence for the current one — the most plausible route by which stale
 *   evidence passes a gate.
 * - **`FR-EVS-034`** *presence is not validity*. A failed integrity check is
 *   unmet, not "attached".
 * - **`FR-EVS-014`** an unresolvable reference reads as unresolvable, never as
 *   satisfied.
 * - **`FR-EVS-026`** a Contract with zero items satisfies **only** where policy
 *   declared the work class needs none, and that emptiness is reported rather
 *   than passing silently. An empty Contract is otherwise the easiest possible
 *   way to make completion reachable.
 * - **`FR-EVS-035`, `BR-0144`** a Contract that cannot be evaluated refuses. An
 *   unevaluated Contract is not a satisfied one.
 */

/** One requirement of a Contract. `FR-EVS-025` — it names what satisfies it. */
export interface ContractItem {
  readonly id: string;
  readonly description: string;
  readonly acceptedTypes: readonly string[];
}

export interface EvidenceContract {
  readonly ref: string;
  /** `FR-EVS-023` — work is judged against the version it began under. */
  readonly version: number;
  /** `FR-EVS-026` — only policy may declare a work class needs no evidence. */
  readonly declaredEmptyByPolicy: boolean;
  readonly items: readonly ContractItem[];
}

export interface EvidenceItem {
  readonly id: string;
  /** `FR-EVS-003` — what it proves, not which tool produced it. */
  readonly type: string;
  readonly satisfiesItemId: string;
  readonly attestsArtifactId: string;
  /** `FR-EVS-011` — the version, not just the artifact. */
  readonly attestsArtifactVersion: number;
  /** `FR-EVS-013`, `FR-EVS-034` — tampering or substitution detected. */
  readonly integrityValid: boolean;
  /** `FR-EVS-014` — a referenced target that still resolves. */
  readonly resolvable: boolean;
}

export interface EvaluationTarget {
  readonly artifactId: string;
  readonly artifactVersion: number;
}

export interface ContractEvaluation {
  readonly satisfied: boolean;
  /** `FR-EVS-022`, `FR-EVS-032` — enumerable, and named in a refusal. */
  readonly unmet: readonly string[];
  /** Present when something true is worth saying even though nothing is unmet. */
  readonly note?: string;
}

/**
 * Why a candidate piece of evidence does not close an item, or `null` if it does.
 *
 * Ordered by what a reader most needs to know: wrong target first (it is about
 * something else), then integrity (it is not trustworthy), then type.
 */
function rejects(item: ContractItem, evidence: EvidenceItem, target: EvaluationTarget): string | null {
  if (evidence.satisfiesItemId !== item.id) return null;
  if (evidence.attestsArtifactId !== target.artifactId) {
    return `attests ${evidence.attestsArtifactId}, not ${target.artifactId}`;
  }
  if (evidence.attestsArtifactVersion !== target.artifactVersion) {
    return `attests version ${evidence.attestsArtifactVersion}, not ${target.artifactVersion}`;
  }
  if (!evidence.resolvable) return 'its reference is unresolvable';
  if (!evidence.integrityValid) return 'it failed its integrity check';
  if (!item.acceptedTypes.includes(evidence.type)) {
    return `is a ${evidence.type}; this item accepts ${item.acceptedTypes.join(', ')}`;
  }
  return null;
}

export function evaluateContract(
  contract: EvidenceContract | null,
  evidence: readonly EvidenceItem[],
  target: EvaluationTarget,
): ContractEvaluation {
  if (contract === null) {
    return {
      satisfied: false,
      unmet: ['the Evidence Contract was not found, so it cannot be evaluated (FR-EVS-035)'],
    };
  }

  if (contract.items.length === 0) {
    if (!contract.declaredEmptyByPolicy) {
      return {
        satisfied: false,
        unmet: [
          `Contract ${contract.ref} declares no items, and no policy declares this work class ` +
            'needs none (FR-EVS-026)',
        ],
      };
    }
    return {
      satisfied: true,
      unmet: [],
      // Visible, not silent. Someone reading a baseline approved under an empty
      // Contract must be able to see that it was empty on purpose.
      note:
        `Contract ${contract.ref} requires no evidence items; policy declares this work class ` +
        'needs none (FR-EVS-026)',
    };
  }

  const unmet: string[] = [];
  for (const item of contract.items) {
    const candidates = evidence.filter((e) => e.satisfiesItemId === item.id);
    if (candidates.length === 0) {
      unmet.push(`${item.id} (${item.description}): no evidence attached`);
      continue;
    }
    const satisfying = candidates.find((e) => rejects(item, e, target) === null);
    if (satisfying === undefined) {
      // Report against the first candidate: naming *why the evidence someone
      // attached did not count* is more useful than repeating "unmet".
      const reason = rejects(item, candidates[0]!, target);
      unmet.push(`${item.id} (${item.description}): evidence ${candidates[0]!.id} ${reason}`);
    }
  }

  return { satisfied: unmet.length === 0, unmet };
}

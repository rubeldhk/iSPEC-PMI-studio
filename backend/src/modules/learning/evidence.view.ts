/**
 * `T2341` (EPIC-048, `FR-LRN-015`, `FR-LRN-016`, `R-048-8`, `R-048-9`) — each
 * citation with its live state, and withheld from a reader who may not see it.
 *
 * State is **derived on every read**, never stored: `EPIC-032` re-derives
 * integrity for referenced payloads on each resolve, so a later failure is seen.
 *
 * Two views, deliberately separate:
 * - `unfiltered` — the real state of every citation. Eligibility reads this: a
 *   citation hidden from one reviewer is not thereby healthy (`R-048-9`).
 * - `forReader` — what one reader is shown. A citation whose attested target the
 *   reader may not read is `{state: 'withheld'}` with **no id and no digest**,
 *   and is counted (`FR-LRN-016`). This Epic never reads around artifact access.
 *
 * Every absence fails closed: `EvidenceReads` unbound reads `unresolvable`
 * (never `verified`), and `ReaderAccess` unbound withholds.
 *
 * Framework-free (PC-1).
 */
import type { EvidenceState } from '@pmi/learning-contract';
import type { CitationRecord } from './learning.store.js';
import type { LearningPorts, ResolvedEvidence } from './learning.tokens.js';

export type ProducedState = Exclude<EvidenceState, 'withheld' | 'retired'>;

export interface CitationState {
  readonly evidenceId: string;
  readonly digest: string;
  readonly state: ProducedState;
  readonly predicateType: string | null;
  readonly attestedArtifact: ResolvedEvidence['attestedArtifact'];
  readonly attestedTarget: ResolvedEvidence['attestedTarget'] | null;
  /** Why it is unresolvable, when it is. */
  readonly reason?: string;
}

export type ShownCitation = Omit<CitationState, 'attestedTarget'> | { readonly state: 'withheld' };

export interface ReaderView {
  readonly citations: readonly ShownCitation[];
  readonly withheldEvidenceCount: number;
}

export class EvidenceView {
  constructor(private readonly ports: Pick<LearningPorts, 'evidence' | 'readerAccess'>) {}

  /** The real state of each citation, in order. */
  async unfiltered(workspaceId: string, citations: readonly CitationRecord[]): Promise<CitationState[]> {
    let resolved: ReadonlyMap<string, ResolvedEvidence>;
    let unavailable: string | null = null;
    try {
      resolved = await this.ports.evidence.resolve(workspaceId, [...new Set(citations.map((c) => c.evidenceId))]);
    } catch (err) {
      resolved = new Map();
      unavailable = err instanceof Error ? err.message : 'EvidenceReads failed';
    }
    return citations.map((c) => {
      const e = resolved.get(c.evidenceId);
      if (e === undefined || e.resolution === 'unresolvable') {
        return {
          evidenceId: c.evidenceId,
          digest: c.digest,
          state: 'unresolvable' as const,
          predicateType: e?.predicateType ?? null,
          attestedArtifact: e?.attestedArtifact ?? null,
          attestedTarget: e?.attestedTarget ?? null,
          reason: unavailable ?? (e === undefined ? 'not held in this workspace' : 'storage unresolvable'),
        };
      }
      const tampered = e.subjectDigest !== c.digest;
      return {
        evidenceId: c.evidenceId,
        digest: c.digest,
        state: e.integrity === 'failed' || tampered ? ('integrity-failed' as const) : ('verified' as const),
        predicateType: e.predicateType,
        attestedArtifact: e.attestedArtifact,
        attestedTarget: e.attestedTarget,
        ...(tampered ? { reason: 'the cited digest differs from the stored one' } : {}),
      };
    });
  }

  /** What `reader` is shown. Unknown access is no access. */
  async forReader(workspaceId: string, reader: { workspaceId: string; userId: string }, citations: readonly CitationRecord[]): Promise<ReaderView> {
    const states = await this.unfiltered(workspaceId, citations);
    const shown: ShownCitation[] = [];
    let withheld = 0;
    for (const s of states) {
      let readable = false;
      if (s.attestedTarget !== null) {
        try {
          readable = await this.ports.readerAccess.canRead(reader, s.attestedTarget);
        } catch {
          readable = false;
        }
      }
      if (!readable) {
        withheld += 1;
        shown.push({ state: 'withheld' });
        continue;
      }
      const { attestedTarget: _t, ...visible } = s;
      shown.push(visible);
    }
    return { citations: shown, withheldEvidenceCount: withheld };
  }
}

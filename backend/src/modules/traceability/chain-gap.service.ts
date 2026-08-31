/**
 * T306 — first-missing-link reporting (FR-ENH-022, SC-ENH-007).
 *
 * A traversal from any operational artifact either reaches its originating
 * vision statement or NAMES the link that breaks the chain — never a
 * silently shortened result. The gap is the segment nearest the start whose
 * up-chain link is absent.
 */
import {
  CHAIN_STAGES,
  isChainStage,
  type TraceArtifactType,
} from './link-writer.service.js';
import type { ChainLinkShape, ChainNode } from './chain-traversal.service.js';

export interface ChainGapReport {
  complete: boolean;
  /** The FIRST absent segment, by its stages — null when the chain is whole. */
  missingLink: { fromStage: TraceArtifactType; toStage: TraceArtifactType } | null;
  /** The broadest stage the traversal actually reached. */
  reachedStage: TraceArtifactType;
}

/**
 * `null` for the first stage, and for anything that is not a chain stage at all.
 *
 * `change` (EPIC-034, `FR-CHR-064`) is an artifact type with no position in the
 * derivation chain, so it has no parent stage — and asking for one is a
 * question with no correct answer rather than an error.
 */
function parentStage(stage: TraceArtifactType): TraceArtifactType | null {
  if (!isChainStage(stage)) return null;
  const index = CHAIN_STAGES.indexOf(stage);
  return index > 0 ? (CHAIN_STAGES[index - 1] as TraceArtifactType) : null;
}

export function findChainGap(links: readonly ChainLinkShape[], start: ChainNode): ChainGapReport {
  const bySource = new Map<string, ChainLinkShape[]>();
  for (const link of links) {
    const s = `${link.sourceType} ${link.sourceId}`;
    (bySource.get(s) ?? bySource.set(s, []).get(s)!).push(link);
  }

  // Breadth-first up-chain. The FIRST node (nearest the start) with no
  // outgoing link — and a stage above it — is the break.
  const seen = new Set<string>([`${start.artifactType} ${start.artifactId}`]);
  let frontier: ChainNode[] = [start];
  let reached: TraceArtifactType = start.artifactType;
  let firstGap: ChainGapReport['missingLink'] = null;

  while (frontier.length > 0) {
    const next: ChainNode[] = [];
    for (const node of frontier) {
      // A node outside the chain has no position to compare, so it cannot
      // become the broadest stage reached. Skipped explicitly: relying on
      // `indexOf` returning `-1` would give the same result today and a
      // different one the moment somebody sorted the stages differently.
      if (
        isChainStage(node.artifactType) &&
        isChainStage(reached) &&
        CHAIN_STAGES.indexOf(node.artifactType) < CHAIN_STAGES.indexOf(reached)
      ) {
        reached = node.artifactType;
      }
      if (node.artifactType === 'vision') continue; // the root — nothing above
      const outgoing = bySource.get(`${node.artifactType} ${node.artifactId}`) ?? [];
      if (outgoing.length === 0) {
        // Deepest-first: BFS visits nearest-the-start nodes first, so the
        // first recorded gap IS the first missing link.
        if (!firstGap) {
          const toStage = parentStage(node.artifactType);
          firstGap = toStage ? { fromStage: node.artifactType, toStage } : null;
        }
        continue;
      }
      for (const link of outgoing) {
        const onwardKey = `${link.targetType} ${link.targetId}`;
        if (!seen.has(onwardKey)) {
          seen.add(onwardKey);
          next.push({ artifactType: link.targetType, artifactId: link.targetId });
        }
      }
    }
    frontier = next;
  }

  const complete = firstGap === null && reached === 'vision';
  if (!complete && firstGap === null) {
    // Reached no vision and recorded no dead end — every branch cycled back
    // into seen nodes. Report from the broadest stage reached.
    const toStage = parentStage(reached);
    firstGap = toStage ? { fromStage: reached, toStage } : null;
  }
  return { complete, missingLink: complete ? null : firstGap, reachedStage: reached };
}

export class ChainGapService {
  constructor(
    private readonly source: { linksForWorkspace(workspaceId: string): Promise<ChainLinkShape[]> },
  ) {}

  async report(workspaceId: string, start: ChainNode): Promise<ChainGapReport> {
    return findChainGap(await this.source.linksForWorkspace(workspaceId), start);
  }
}

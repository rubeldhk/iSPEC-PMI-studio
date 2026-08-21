/**
 * T304 — twelve-link bidirectional chain traversal (FR-ENH-021).
 *
 * Pure over a link list: UP follows outgoing edges (child → parent, toward
 * the vision), DOWN follows incoming (toward operations). Every intermediate
 * link returns in order — nearest segment first — and an artifact with
 * multiple parents returns all of them. Extends EPIC-011's per-artifact
 * trace (T130) to the full chain.
 */
import type { TraceArtifactType } from './link-writer.service.js';

export interface ChainNode {
  artifactType: TraceArtifactType;
  artifactId: string;
}

export interface ChainLinkShape {
  sourceType: TraceArtifactType;
  sourceId: string;
  targetType: TraceArtifactType;
  targetId: string;
}

export interface ChainTraversalResult {
  links: ChainLinkShape[];
  /** UP only: true when every walked branch reached the vision stage. */
  complete: boolean;
}

function key(type: string, id: string): string {
  return `${type} ${id}`;
}

export function traverseChain(
  links: readonly ChainLinkShape[],
  start: ChainNode,
  direction: 'up' | 'down',
): ChainTraversalResult {
  const bySource = new Map<string, ChainLinkShape[]>();
  const byTarget = new Map<string, ChainLinkShape[]>();
  for (const link of links) {
    const s = key(link.sourceType, link.sourceId);
    const t = key(link.targetType, link.targetId);
    (bySource.get(s) ?? bySource.set(s, []).get(s)!).push(link);
    (byTarget.get(t) ?? byTarget.set(t, []).get(t)!).push(link);
  }

  const ordered: ChainLinkShape[] = [];
  const seen = new Set<string>([key(start.artifactType, start.artifactId)]);
  let frontier: ChainNode[] = [start];
  let complete = true;

  while (frontier.length > 0) {
    const next: ChainNode[] = [];
    for (const node of frontier) {
      const nodeKey = key(node.artifactType, node.artifactId);
      const step = direction === 'up' ? bySource.get(nodeKey) : byTarget.get(nodeKey);
      if ((!step || step.length === 0) && direction === 'up' && node.artifactType !== 'vision') {
        complete = false;
        continue;
      }
      for (const link of step ?? []) {
        ordered.push(link);
        const onward: ChainNode =
          direction === 'up'
            ? { artifactType: link.targetType, artifactId: link.targetId }
            : { artifactType: link.sourceType, artifactId: link.sourceId };
        const onwardKey = key(onward.artifactType, onward.artifactId);
        if (!seen.has(onwardKey)) {
          seen.add(onwardKey);
          next.push(onward);
        }
      }
    }
    frontier = next;
  }

  return { links: ordered, complete };
}

/** The store surface the composed service reads. */
export interface ChainLinkSource {
  linksForWorkspace(workspaceId: string): Promise<ChainLinkShape[]>;
}

export class ChainTraversalService {
  constructor(private readonly source: ChainLinkSource) {}

  async traverse(
    workspaceId: string,
    start: ChainNode,
    direction: 'up' | 'down',
  ): Promise<ChainTraversalResult> {
    return traverseChain(await this.source.linksForWorkspace(workspaceId), start, direction);
  }
}

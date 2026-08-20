/**
 * T083g — specification search and filtering (F-04.6, MPS Volume 2).
 *
 * One rule shapes this whole file: **search is scoped before it is matched.**
 * The candidate set is fetched under the workspace — and the project, when one
 * is named — and only then matched, ranked and paged. A search that matches
 * first and filters second is a leak with a ranking algorithm: the match set
 * has already crossed the tenancy boundary, and any bug in the filter exposes
 * it.
 *
 * Matching is a case-insensitive substring over title and current content. That
 * is what Phase 1 needs and what the in-memory and PostgreSQL paths can both
 * honour identically; full-text ranking is a Phase 2 concern, and pretending to
 * have it here would mean two implementations that disagree.
 *
 * Framework-free (PC-1). Wired in `specifications.module.ts`.
 */
import { ValidationFailedError } from '../../core/errors.js';
import {
  SPEC_LIFECYCLE_STATES,
  validatePaging,
  type Page,
  type SearchCandidate,
  type SpecLifecycleState,
  type SpecificationRecord,
} from './specifications-read.service.js';

export type MatchField = 'title' | 'content';

export interface SpecificationSearchHit extends SpecificationRecord {
  /** Which fields matched — title first when both did. */
  matchedIn: MatchField[];
}

export interface SpecificationSearchQuery {
  term: string;
  projectId?: string;
  lifecycleState?: SpecLifecycleState;
  isOutOfDate?: boolean;
  page?: number;
  pageSize?: number;
}

/** The scoped candidate source. `InMemorySpecificationStore` and the Prisma store both satisfy it. */
export interface SpecificationSearchSource {
  findScoped(workspaceId: string, projectId: string | null): Promise<SearchCandidate[]>;
}

export interface SpecificationSearchApi {
  search(
    workspaceId: string,
    query: SpecificationSearchQuery,
  ): Promise<Page<SpecificationSearchHit>>;
}

/** A title match outranks a content-only match. */
const RANK: Record<string, number> = { title: 0, content: 1 };

export class SpecificationSearchService implements SpecificationSearchApi {
  constructor(private readonly source: SpecificationSearchSource) {}

  async search(
    workspaceId: string,
    query: SpecificationSearchQuery,
  ): Promise<Page<SpecificationSearchHit>> {
    const term = typeof query.term === 'string' ? query.term.trim() : '';
    const fields: { field: string; reason: string }[] = [];
    if (term === '') fields.push({ field: 'q', reason: 'required' });
    if (
      query.lifecycleState !== undefined &&
      !SPEC_LIFECYCLE_STATES.includes(query.lifecycleState)
    ) {
      // Silently ignoring an unknown filter answers a question the caller did
      // not ask, and looks like a working filter that returns everything.
      fields.push({
        field: 'lifecycleState',
        reason: `one of ${SPEC_LIFECYCLE_STATES.join(', ')}`,
      });
    }
    if (fields.length > 0) {
      throw new ValidationFailedError('Specification search cannot be run.', { fields });
    }

    const { page, pageSize } = validatePaging({
      ...(query.page === undefined ? {} : { page: query.page }),
      ...(query.pageSize === undefined ? {} : { pageSize: query.pageSize }),
    });

    // SCOPE FIRST. Everything below operates on rows this workspace may see.
    const candidates = await this.source.findScoped(workspaceId, query.projectId ?? null);

    const needle = term.toLowerCase();
    const hits: SpecificationSearchHit[] = [];
    for (const candidate of candidates) {
      if (query.lifecycleState && candidate.specification.lifecycleState !== query.lifecycleState) {
        continue;
      }
      if (query.isOutOfDate !== undefined && candidate.specification.isOutOfDate !== query.isOutOfDate) {
        continue;
      }
      const matchedIn: MatchField[] = [];
      if (candidate.specification.title.toLowerCase().includes(needle)) matchedIn.push('title');
      if (candidate.content.toLowerCase().includes(needle)) matchedIn.push('content');
      if (matchedIn.length === 0) continue;
      hits.push({ ...candidate.specification, matchedIn });
    }

    hits.sort(byRankThenRecency);

    const offset = (page - 1) * pageSize;
    return { rows: hits.slice(offset, offset + pageSize), total: hits.length, page, pageSize };
  }
}

/**
 * Rank, then recency, then title.
 *
 * The third key is not decoration: without it, two equally-ranked hits updated
 * in the same millisecond would come back in whatever order the store happened
 * to yield, and a paged result set that reorders between pages loses rows.
 */
function byRankThenRecency(a: SpecificationSearchHit, b: SpecificationSearchHit): number {
  const rank = RANK[a.matchedIn[0] as string]! - RANK[b.matchedIn[0] as string]!;
  if (rank !== 0) return rank;
  const recency = b.updatedAt.getTime() - a.updatedAt.getTime();
  if (recency !== 0) return recency;
  return a.title.localeCompare(b.title);
}

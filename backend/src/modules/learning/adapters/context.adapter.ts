/**
 * `T2399` (EPIC-048, Phase 9, `R-048-11`, `R-048-13`) — this Epic's supply,
 * bound to `EPIC-038`.
 *
 * Two directions, one file:
 *
 * - **`KnowledgeIndex` → `IndexService.reindex`.** A pass-through: the version
 *   is the index's `sourceVersion`, the outcome is mapped, and a refusal is
 *   thrown as itself. `RetrievabilityService` records it as
 *   *not yet retrievable* with `EPIC-038`'s own reason — in this programme,
 *   usually that no embedding provider exists (`FR-CTX-013`) — never as a
 *   success (`FR-LRN-053`).
 * - **Reader and admission → `CONTEXT_KNOWLEDGE`.** `EPIC-038` exports a slot
 *   rather than importing this module, because this module already depends on
 *   it. Filling the slot is the binding; its sources adapter and assembly read
 *   it at call time (`A-038-2`).
 *
 * `EPIC-038` assembles; this Epic never does (`FR-LRN-050`).
 *
 * Framework-free (PC-1).
 */
import type { KnowledgeAdmission, KnowledgeSourceReader } from '@pmi/learning-contract';
import type { KnowledgeSupplyBinding } from '../../context/context.tokens.js';
import type { IndexService } from '../../context/retrieval/index.service.js';
import type { KnowledgeIndexPort } from '../learning.tokens.js';

export function knowledgeIndexAdapter(index: Pick<IndexService, 'reindex'>): KnowledgeIndexPort {
  return {
    async reindex(input) {
      const result = await index.reindex({
        workspaceId: input.workspaceId,
        sourceType: input.sourceType,
        sourceId: input.entryId,
        sourceVersion: input.versionId,
      });
      return { outcome: result.status };
    },
  };
}

/** Fill `EPIC-038`'s knowledge slot with this Epic's reader and admission. */
export function bindKnowledgeIntoContext(
  binding: KnowledgeSupplyBinding,
  supply: { readonly reader: KnowledgeSourceReader; readonly admission: KnowledgeAdmission },
): KnowledgeSupplyBinding {
  binding.reader = supply.reader;
  binding.admission = supply.admission;
  return binding;
}

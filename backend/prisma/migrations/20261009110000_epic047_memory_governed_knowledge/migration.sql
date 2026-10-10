-- EPIC-047 T2019 — amendment A-047-1 (2026-10-09, for EPIC-048 Governed Learning).
--
-- FR-EXP-020 now admits 'governed-knowledge' beside 'none': an Expert may submit
-- learning candidates to Governed Learning and receive approved knowledge only
-- through context. It grants no private memory. Every other value is still
-- refused here, so the rule binds the stored contract whatever the application
-- does.
--
-- Existing rows all declare 'none' (the previous CHECK guaranteed it), so they
-- satisfy the new one; the immutability trigger forbids editing them and none
-- needs it.

ALTER TABLE "expert_contract_versions" DROP CONSTRAINT "expert_contract_versions_memory_check";
ALTER TABLE "expert_contract_versions" ADD CONSTRAINT "expert_contract_versions_memory_check"
    CHECK ("contract"->>'memoryPolicy' IN ('none', 'governed-knowledge'));

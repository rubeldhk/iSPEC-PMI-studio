-- `T1863` (EPIC-038) — the classification an item was admitted under.
--
-- `FR-CTX-031`, `US1`: the inputs are consulted *and recorded*. The security
-- classification decided whether an item was admitted, and was then forgotten;
-- after an operator reclassifies a source (`DEF-038-007`), nobody could tell
-- what classification governed material a session was already given.
-- Nullable: rows written before this record nothing.
ALTER TABLE "context_items" ADD COLUMN "securityClassification" TEXT;

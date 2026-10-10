-- `T1839` (EPIC-038) — an item records the workspace that owns its source.
--
-- `FR-CTX-040`, `FR-CTX-017`. A crossed item's source lives in another
-- workspace, and drift was being asked about in the package's — where the
-- source does not exist, so a healthy source read as "no longer resolves".
-- Nullable: rows written before this record nothing, and for them the
-- package's own workspace is the only answer there was.
ALTER TABLE "context_items" ADD COLUMN "sourceWorkspaceId" TEXT;

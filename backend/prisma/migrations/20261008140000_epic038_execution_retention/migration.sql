-- `T1266`, `T1267` (EPIC-038) — a package binds to the execution it fed, and
-- lives exactly as long.
--
-- `FR-CTX-062`, `FR-CTX-066`, `R-038-9`. The binding is a foreign key rather
-- than a column somebody fills: an `executionId` naming nothing is a binding
-- to nothing that looks like one. Retention follows by cascade — two retention
-- policies over one audit trail produce a window in which the execution is
-- inspectable and its context has gone, so this Epic has none of its own.
--
-- Items and exclusions already cascade from the package (`T1231`).
--
-- `executions` refuses deletion while anything RESTRICTs it, and EPIC-037 owns
-- whether executions are ever deleted. This only says that if one is, its
-- context goes with it rather than being orphaned or outliving it.
ALTER TABLE "context_packages"
    ADD CONSTRAINT "context_packages_executionId_fkey"
    FOREIGN KEY ("executionId") REFERENCES "executions" ("id") ON DELETE CASCADE;

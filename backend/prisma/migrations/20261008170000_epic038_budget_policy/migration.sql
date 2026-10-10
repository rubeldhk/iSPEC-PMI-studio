-- `T1802`, `T1804` (EPIC-038) — budget policy is configuration, not code.
--
-- `FR-CTX-031`, `FR-CTX-036`. The per-candidate estimate and the retrieval
-- limit were constants in the code, and the price that turns tokens into cost
-- did not exist at all — so `budgetCost` was recorded and never compared. One
-- row per workspace holds all three, and a workspace with no row refuses
-- assembly rather than running on numbers nobody configured.
CREATE TABLE "context_budget_policies" (
    "id"                    TEXT NOT NULL,
    "workspaceId"           TEXT NOT NULL,
    -- R-038-3 — how many candidates retrieval is asked for.
    "retrievalLimit"        INTEGER NOT NULL,
    -- What one candidate is estimated to cost against the token budget.
    "tokensPerCandidate"    INTEGER NOT NULL,
    -- The price that turns tokens into cost (FR-CTX-031). Zero is a real
    -- price — "this workspace does not meter cost" — and is allowed.
    "costPerThousandTokens" NUMERIC(12,4) NOT NULL,
    "createdAt"             TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"             TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "context_budget_policies_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "context_budget_policies_one_per_workspace" UNIQUE ("workspaceId"),
    CONSTRAINT "context_budget_policies_limit_positive" CHECK ("retrievalLimit" > 0),
    CONSTRAINT "context_budget_policies_estimate_positive" CHECK ("tokensPerCandidate" > 0),
    CONSTRAINT "context_budget_policies_price_not_negative" CHECK ("costPerThousandTokens" >= 0)
);

CREATE INDEX "context_budget_policies_workspaceId_idx" ON "context_budget_policies"("workspaceId");

# EPIC-048 — mutation proofs

**Epic**: `EPIC-048` · **Plan**: [plan.md](./plan.md) *Mutation proofs* · **Checked by**: `T2403`
(`backend/tests/architecture/learning-mutation-proofs.spec.ts`)

Each proof was observed, not reasoned: the file was copied aside, the mutation applied, the named
suites run, the file restored from the copy, and `cmp` run against the copy. The mutation runner is
the session's scratch script; the diffs below are `git diff` of the mutated file, captured while the
mutation was in place. Recorded 2026-10-10 on `epic/048-governed-learning`.

**Completed 2026-10-11** (`T2404`–`T2407`), on the branch merged with `origin/main` (`EPIC-031`,
`-032`, `-038`, `-047` all on `main`). Each section keeps its 2026-10-10 half — run against in-test
recording bindings while the owners were unmerged — and adds the half that needed `EPIC-031`'s real
`DecisionEngine` or the `knowledge_versions_require_decision` trigger (`T2393`), observed against the
Tier 1 suite (`T2402`, `learning-tier1.spec.ts`, every port bound to its real owner) and the fences
suite (`T2392`). The mutation runner (`mut.py` in the session scratchpad) applied each mutation by
exact replacement after copying the file aside, printed the `git diff` below, and restored from the
copy; `cmp` and `git status` confirmed each restore.

---

## MP-1a — add a direct write path (`SC-LRN-001`, `FR-LRN-001`)

```diff
--- a/backend/src/modules/learning/learning.controller.ts
+++ b/backend/src/modules/learning/learning.controller.ts
@@ -17,6 +17,8 @@
 import { ReviewService, type ReviewResult } from './review.service.js';
+import { KNOWLEDGE_WRITER } from './learning.tokens.js';
+import type { KnowledgeWriter, Materialisation } from './knowledge.writer.js';
@@ -52,8 +54,14 @@ export class LearningController {
     @Inject(KnowledgeService) private readonly knowledge: KnowledgeService,
+    @Inject(KNOWLEDGE_WRITER) private readonly writer: KnowledgeWriter,
   ) {}
 
+  @Post('learning/knowledge')
+  direct(@Body() body: Materialisation): Promise<unknown> {
+    return this.writer.insertVersion(body);
+  }
```

- Failed: `architecture` `learning-single-write-path.spec.ts` (T2332) — 4 of 8 failed: only
  `materialiser.ts` calls `insertVersion`; nothing else imports `knowledge.writer`; no controller
  declares a write verb on a knowledge path; no controller imports the writer.
- Failed: `backend-integration` `learning-knowledge-route.spec.ts` (T2370) — 1 of 11 failed: the
  composed application's router maps no write verb to any knowledge path.
- Reverted: cmp `learning.controller.ts` against the copy: identical.

### Completed 2026-10-11 — the third observer, the decision trigger (`T2404`)

The same diff, re-applied on the merged branch:

- Failed: `architecture` `learning-single-write-path.spec.ts` (T2332) — 4 of 8 failed (as on 2026-10-10).
- Failed: `backend-integration` `learning-knowledge-route.spec.ts` (T2370) — 1 of 11 failed: the
  router enumeration finds `POST /v1/learning/knowledge`.
- **The trigger refused** (T2392's fence, `T2393`). A temporary probe — written for this run, deleted
  after it, never committed — submitted a candidate through the connector route (`EPIC-031` recorded
  its decision `pending`), then sent a forged materialisation naming that decision to the mutated
  route. The route answered `500` and wrote nothing — but the JSON body's dates never reached SQL
  (`d2.toISOString is not a function`), so the probe then handed the **same writer instance** the
  route holds the same materialisation with real dates: PostgreSQL refused it,
  `P0001 knowledge_versions_require_decision: the deciding row is pending, not approved (SC-LRN-001)`;
  `knowledge_entry_versions` held 0 rows for it. A direct write path that type-checks still cannot
  create knowledge without an approving decision.
- Reverted: cmp `learning.controller.ts` against the copy: identical (`git status` clean).

**Status**: complete — 2026-10-11 (`T2404`).

## MP-1b — skip the approver guard's verdict (`SC-LRN-001`)

```diff
--- a/backend/src/modules/learning/materialiser.ts
+++ b/backend/src/modules/learning/materialiser.ts
@@ -84,7 +84,6 @@ export class Materialiser {
     const verdict = await this.deps.guard.judge({ candidate, corroborations, resolution });
-    if (!verdict.accepted) return this.returnToProposed(candidate, resolution, verdict);
 
     return this.write(candidate, resolution, verdict);
```

- Failed: `backend-unit` `learning-materialiser.spec.ts` (T2352) — 4 of 20 failed: an unaccepted
  approval writes nothing; the two I1 return-to-proposed cases; a corroborating agent's approval.
- Failed: `backend-integration` `learning-resolve-job.spec.ts` (T2358) — 2 of 10 failed: Q14 (an agent
  recorded by `EPIC-031` as human) and the I1 re-request cap.
- Reverted: cmp `materialiser.ts` against the copy: identical.

Already observed on 2026-10-10: the `knowledge_versions_approver_not_source` trigger refuses the
source's own approval under this mutation (`T2318`).

### Completed 2026-10-11 — the database half, against the real engine (`T2405`)

The same diff, re-applied on the merged branch:

- Failed: `backend-unit` `learning-materialiser.spec.ts` (T2352) — 4 of 20 failed (as on 2026-10-10).
- Failed: `backend-integration` `learning-tier1.spec.ts` (T2402) — 1 of 33 failed: Q14, an agent's
  approval recorded `human` by `EPIC-031`'s real `POST /decisions/:id/approve`. The candidate stayed
  `pending-review` instead of returning to `proposed`: the unguarded materialiser tried to write, and
  PostgreSQL refused the row — `23502` NOT NULL, because a refused verdict names no approver kind.
  0 versions written (read with a temporary `console.log` in Q14, reverted with `git checkout`).
- **Held**: `backend-integration` `learning-knowledge-fences.spec.ts` (T2392) — 16 of 16 passed with the
  code fence removed: the trigger still refuses a pending, refused, foreign or misdirected decision,
  and a human version over an automated approval, whatever the code above it does.
- Reverted: cmp `materialiser.ts` against the copy: identical (`git status` clean).

**What this proof does not show, said plainly**: had the mutation also invented an approver kind, the
database would have accepted Q14's row — `EPIC-031` recorded the agent's approval as `human`, and the
agent is not the candidate's source. That case is fenced by the approver guard alone; MP-3 is its
proof.

**Status**: complete — 2026-10-11 (`T2405`).

## MP-2 — remove the explicit-category check (`SC-LRN-003`, `FR-LRN-022`)

```diff
--- a/backend/src/modules/learning/eligibility.ts
+++ b/backend/src/modules/learning/eligibility.ts
@@ -43,7 +43,7 @@ export function eligibilityOf(input: EligibilityInput): Eligibility {
   const category = input.policy.category(candidate.category);
-  if (category === null || category.lowRisk !== true) failed.push('category-not-declared-low-risk');
+  if (category === null) failed.push('category-not-declared-low-risk');
```

- Failed: `backend-unit` `learning-eligibility.spec.ts` (T2346) — 5 of 19 failed, including *with no
  category opted in, 100% of candidates route to review* (`SC-LRN-008`).
- Failed: `backend-integration` `learning-review-route.spec.ts` (T2362) — 2 of 12 failed: Q6 (an
  `architecture` candidate was sent down the automatic path) and Q11 (after the policy stops declaring
  `test-setup` low-risk, a decision engine willing to auto-execute approved it).
- Reverted: cmp `eligibility.ts` against the copy: identical.

### Completed 2026-10-11 — against `EPIC-031`'s real engine (`T2406`)

The same diff, re-applied on the merged branch:

- Failed: `backend-unit` `learning-eligibility.spec.ts` (T2346) — 5 of 19 failed (as on 2026-10-10).
- Failed: `backend-integration` `learning-tier1.spec.ts` (T2402) — 6 of 33 failed. Two are the
  mutation seen directly:
  - **Q11** — the learning policy no longer declares `test-setup` low-risk while `EPIC-031`'s rule
    still classifies `learning.approve.test-setup` low: the real engine **auto-executed** it and the
    candidate was `approved` (expected `pending-review`). This Epic's check was the only fence.
  - **Q6** — an `architecture` candidate (no `lowRisk` at all) was reported `eligibleForAutomatic`.
  The other four (Q7, the assembly case, Q27, Q18) failed only because they read Q6's candidate.
- **Held**: Q12 (no classification rule) still waited for a human — `EPIC-031` classifies an
  unclassified action `high`, a second, independent fence; Q12a (no tenant policy) still refused.
- Reverted: cmp `eligibility.ts` against the copy: identical (`git status` clean).

**Status**: complete — 2026-10-11 (`T2406`).

## MP-3 — remove the principal-kind check (`FR-LRN-027`, `SC-LRN-003` second clause)

```diff
--- a/backend/src/modules/learning/approver.guard.ts
+++ b/backend/src/modules/learning/approver.guard.ts
@@ -87,11 +87,6 @@ export class ApproverGuard {
-    if (kind !== 'human') {
-      return refuse(
-        `approved by ${resolution.decidedBy}, recorded by EPIC-031 as human, which resolves to ${kind === null ? 'no user of this workspace' : `a ${kind} principal`} (FR-LRN-027).`,
-      );
-    }
     if (aiSourceIdentities(candidate, input.corroborations).has(resolution.decidedBy)) {
```

- Failed: `backend-unit` `learning-approver-guard.spec.ts` (T2350) — 4 of 16 failed: an agent, a
  service and a connector principal recorded as human, and an id that resolves to nobody.
- Failed: `backend-integration` `learning-resolve-job.spec.ts` (T2358) — 1 of 11 failed: *Q14 by an
  agent that is NOT the candidate's source*.
- Reverted: cmp `approver.guard.ts` against the copy: identical.

**What the first run found.** Against the suite as it stood, the integration half **did not fail**
(10 of 10 passed): Q14 approved as the candidate's *own* agent, which the source-identity check — a
second layer — also refuses, so removing the kind check changed nothing observable. Exactly the case
the plan warned of (*"a second test uses a different agent to isolate the guard"*). The isolating
test — another project's connector principal, not the source — was added to `T2358` and the proof
re-run; it is the 1 failure above.

### Completed 2026-10-11 — through `EPIC-031`'s real approve route (`T2407`)

The same diff, re-applied on the merged branch:

- Failed: `backend-unit` `learning-approver-guard.spec.ts` (T2350) — 4 of 16 failed (as on 2026-10-10).
- Failed: `backend-integration` `learning-tier1.spec.ts` (T2402) — 1 of 33 failed: **Q14** — another
  project's connector principal (not the candidate's source) approved through `EPIC-031`'s own
  `POST /decisions/:id/approve`; 031 recorded it `human`; the sweep materialised it and the candidate
  was `approved` — knowledge approved by an agent. Neither the database nor `EPIC-031` stopped it.
- Failed: `backend-integration` `learning-resolve-job.spec.ts` (T2358) — 1 of 11 failed: the isolated
  Q14 (as on 2026-10-10).
- Reverted: cmp `approver.guard.ts` against the copy: identical (`git status` clean).

**Status**: complete — 2026-10-11 (`T2407`). `FR-LRN-027` rests on this guard alone, and this proof is
what keeps it there.

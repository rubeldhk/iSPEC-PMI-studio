# EPIC-048 — mutation proofs

**Epic**: `EPIC-048` · **Plan**: [plan.md](./plan.md) *Mutation proofs* · **Checked by**: `T2403`
(`backend/tests/architecture/learning-mutation-proofs.spec.ts`)

Each proof was observed, not reasoned: the file was copied aside, the mutation applied, the named
suites run, the file restored from the copy, and `cmp` run against the copy. The mutation runner is
the session's scratch script; the diffs below are `git diff` of the mutated file, captured while the
mutation was in place. Recorded 2026-10-10 on `epic/048-governed-learning`.

**What is not proven yet, and why.** Every half that needs `EPIC-031`'s real `DecisionEngine` or the
`knowledge_versions_require_decision` trigger (`T2393`) waits for those merges: `T2404`–`T2407` are
**⛔ BLOCKED** and stay unticked. Each section says which half is outstanding. The halves below were
run against in-test recording bindings for the unmerged ports and the real composed application for
everything on `main`.

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

**Status**: partial — completes with T2404 (the third observer, T2392's
`knowledge_versions_require_decision` trigger refusing the fabricated row, needs `EPIC-031`'s
`policy_decisions` table, `T2393`).

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

**Status**: partial — completes with T2405 (the database half — the decision trigger still refusing a
pending decision with the code fence removed — needs `T2393` and `A-031-1`). Already observed today:
the `knowledge_versions_approver_not_source` trigger, which is on `main`, refuses the source's own
approval under this mutation (`T2318`).

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

**Status**: partial — completes with T2406 (the same mutation against `EPIC-031`'s **real**
`DecisionEngine` with deliberately permissive steering — Q11/Q12 of `T2402`).

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

**Status**: partial — completes with T2407 (Q14 through `EPIC-031`'s real
`DecisionEngine.approve` by `{kind: 'human', id: <agent principal>}`, `T2402`).

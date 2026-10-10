-- EPIC-047 T2005 — the actor who started a session's root run (FR-EXP-034, US3/AC3).
--
-- A delegate inherits its chain's originating actor; its targets are checked
-- against that actor, and nobody else may delegate under the session.
--
-- No session written before this migration knows its actor (none can be
-- dispatched in this deployment — DEF-047-001 — but the column must still be
-- safe if one exists). Such a row is given the empty string, which matches no
-- user, so a delegation under it is refused: unknown fails closed. The CHECK is
-- NOT VALID so it binds every new row without rewriting old ones.

ALTER TABLE "expert_sessions" ADD COLUMN "actorId" TEXT NOT NULL DEFAULT '';
ALTER TABLE "expert_sessions" ALTER COLUMN "actorId" DROP DEFAULT;
ALTER TABLE "expert_sessions" ADD CONSTRAINT "expert_sessions_actor_check" CHECK (length(trim("actorId")) > 0) NOT VALID;

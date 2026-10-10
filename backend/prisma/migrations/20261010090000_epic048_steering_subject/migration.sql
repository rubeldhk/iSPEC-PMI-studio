-- `T2316` (EPIC-048, `A-019-1`, `R-048-3`) — learning policy is a steering document.
--
-- Its own migration because PostgreSQL cannot use a new enum value inside the
-- transaction that adds it, and the next migration's tests write one.
ALTER TYPE "SteeringSubject" ADD VALUE IF NOT EXISTS 'learning_policy';

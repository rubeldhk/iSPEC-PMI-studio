/**
 * T235 — subject validation (FR-ENH-002).
 *
 * The ten subjects the source document names, plus EPIC-048's `learning_policy`
 * (A-019-1), and NOTHING else. The refusal
 * names both the rejected subject and the valid set, so a caller can act on
 * it without reading this file. Framework-free (PC-1).
 */
import { ValidationFailedError } from '../../core/errors.js';

export const STEERING_SUBJECTS = [
  'organization',
  'workspace',
  'product',
  'architecture',
  'coding_standards',
  'security',
  'ui_standards',
  'business_rules',
  'technology_stack',
  'ai_governance',
  // EPIC-031 R-031-1 (clarified 2026-08-22, FR-DPE-005): classification rules
  // are steering documents, so storage, versioning and BR-0071 precedence stay
  // EPIC-019's. The one subject not named by the source document — recorded as
  // DEF-031-001 so FR-ENH-002's "exactly ten" is amended on purpose, not drift.
  'risk-classification',
  // EPIC-048 T2323 (A-019-1, R-048-3) — the learning policy: categories, their
  // explicit low-risk flag and the reuse policy, versioned with actor and instant
  // by this service. Configuration rather than guidance, so it is never rendered
  // into a constitution (governance.module.ts) or handed to an engine.
  'learning_policy',
] as const;

export type SteeringSubject = (typeof STEERING_SUBJECTS)[number];

const SUBJECT_SET: ReadonlySet<string> = new Set(STEERING_SUBJECTS);

export function assertSteeringSubject(subject: string): SteeringSubject {
  if (!SUBJECT_SET.has(subject)) {
    throw new ValidationFailedError(
      `Unknown steering subject "${subject}". Valid subjects: ${STEERING_SUBJECTS.join(', ')}.`,
    );
  }
  return subject as SteeringSubject;
}

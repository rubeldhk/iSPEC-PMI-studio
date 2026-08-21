/**
 * T235 — subject validation (FR-ENH-002).
 *
 * The ten subjects the source document names, and NOTHING else. The refusal
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

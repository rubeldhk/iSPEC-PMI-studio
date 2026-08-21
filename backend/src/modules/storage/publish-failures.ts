/**
 * T393 — the publish failure taxonomy (FR-PUB-035, SC-009).
 *
 * The closed set, re-exported from the storage contract so backend code and
 * the database enum agree by construction. There is deliberately NO
 * `unknown` member and NO generic fallback path: an adapter that cannot map
 * a provider error into this set is defective (contract rule S2), and a
 * generic failure reaching a user is a defect, not a fallback.
 */
import { STORAGE_FAILURE_REASONS, type StorageFailureReason } from '@pmi/storage-contract';

export type PublishFailureReason = StorageFailureReason;

export const PUBLISH_FAILURE_REASONS: readonly PublishFailureReason[] = STORAGE_FAILURE_REASONS;

/**
 * A DISTINCT, user-facing message per reason. Every member is named; a
 * reason outside the set is a type error, not a runtime branch.
 */
const MESSAGES: Record<PublishFailureReason, string> = {
  provider_unavailable:
    'The storage provider could not be reached. Nothing was sent; try again once it is available.',
  authorisation_expired:
    'The connection needs re-authorisation. Re-authorise it, then publish again.',
  quota_exceeded: 'The provider refused for lack of storage quota at the destination.',
  size_limit_exceeded: 'A file exceeds the provider size limit; it was skipped and reported.',
  destination_missing: 'The selected destination no longer exists at the provider.',
};

export function publishFailureMessage(reason: PublishFailureReason): string {
  return MESSAGES[reason];
}

export function isPublishFailureReason(value: string): value is PublishFailureReason {
  return (PUBLISH_FAILURE_REASONS as readonly string[]).includes(value);
}

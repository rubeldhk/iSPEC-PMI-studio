/**
 * T384 — every publish failure reports a DISTINCT named reason, with zero
 * generic failures reaching the user (FR-PUB-035, SC-009).
 */
import { describe, expect, it } from 'vitest';
import { STORAGE_FAILURE_REASONS } from '@pmi/storage-contract';
import {
  PUBLISH_FAILURE_REASONS,
  isPublishFailureReason,
  publishFailureMessage,
} from '../../../src/modules/storage/publish-failures.js';
import { WS, USER, PROJECT, storageHarness, connected } from './helpers.js';

describe('T384 · the closed failure taxonomy', () => {
  it('carries exactly the five reasons and no unknown member', () => {
    expect([...PUBLISH_FAILURE_REASONS].sort()).toEqual([
      'authorisation_expired',
      'destination_missing',
      'provider_unavailable',
      'quota_exceeded',
      'size_limit_exceeded',
    ]);
    expect(isPublishFailureReason('unknown')).toBe(false);
    expect(isPublishFailureReason('generic_error')).toBe(false);
  });

  it('every reason maps to a DISTINCT user-facing message', () => {
    const messages = PUBLISH_FAILURE_REASONS.map(publishFailureMessage);
    expect(new Set(messages).size).toBe(PUBLISH_FAILURE_REASONS.length);
    for (const message of messages) {
      expect(message).not.toMatch(/unknown|unexpected|generic/i);
      expect(message.length).toBeGreaterThan(10);
    }
  });

  it('the taxonomy is the contract taxonomy — one set, agreed by construction', () => {
    expect(PUBLISH_FAILURE_REASONS).toEqual(STORAGE_FAILURE_REASONS);
  });

  it('a failing publish records the named reason, never a generic failure', async () => {
    const h = storageHarness();
    await connected(h, 2);
    h.provider.failWith('quota_exceeded');
    const record = await h.publish.publish(WS, PROJECT, USER);
    expect(record.state).toBe('failed');
    expect(record.failureReason).toBe('quota_exceeded');
    expect(record.failureMessage).toContain('quota');
  });
});

/**
 * T159 — correlation propagation API -> queue -> worker.
 * Written to FAIL before T160 exists (Constitution V).
 *
 * One identifier, generated once at the API edge, CARRIED (never regenerated)
 * across every hop. See PC-3.
 */
import { describe, expect, it } from 'vitest';
import {
  CORRELATION_HEADER,
  attachCorrelation,
  correlationFromHeaders,
  extractCorrelation,
  isValidCorrelationId,
  newCorrelationId,
} from '../../../src/core/observability/correlation.js';

describe('newCorrelationId()', () => {
  it('produces a valid, unique id', () => {
    const a = newCorrelationId();
    const b = newCorrelationId();
    expect(a).not.toBe(b);
    expect(isValidCorrelationId(a)).toBe(true);
  });
});

describe('correlationFromHeaders()', () => {
  it('reuses an inbound id rather than minting a new one', () => {
    const id = newCorrelationId();
    expect(correlationFromHeaders({ [CORRELATION_HEADER]: id })).toBe(id);
  });

  it('mints one when the header is absent', () => {
    expect(isValidCorrelationId(correlationFromHeaders({}))).toBe(true);
  });

  it('rejects a malformed inbound id instead of trusting it', () => {
    const out = correlationFromHeaders({ [CORRELATION_HEADER]: 'not a valid id!!' });
    expect(out).not.toBe('not a valid id!!');
    expect(isValidCorrelationId(out)).toBe(true);
  });

  it('is case-insensitive about the header name', () => {
    const id = newCorrelationId();
    expect(correlationFromHeaders({ 'X-Correlation-Id': id })).toBe(id);
  });
});

describe('queue hop', () => {
  it('carries the id through the job payload, never regenerating it', () => {
    const id = newCorrelationId();
    const payload = attachCorrelation({ jobId: 'job_1' }, id);
    expect(extractCorrelation(payload)).toBe(id);
  });

  it('survives a JSON round trip, as a real queue would do', () => {
    const id = newCorrelationId();
    const payload = JSON.parse(JSON.stringify(attachCorrelation({ jobId: 'job_1' }, id)));
    expect(extractCorrelation(payload)).toBe(id);
  });

  it('throws when a payload arrives without one', () => {
    expect(() => extractCorrelation({ jobId: 'job_1' })).toThrow(/correlation/i);
  });
});

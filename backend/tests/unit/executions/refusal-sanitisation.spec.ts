/**
 * `T1441` (EPIC-043, `FR-PIC-026`, `SC-PIC-003`) — a refusal body never carries
 * a credential value, and neither does an audit detail. The mutation target:
 * make the error body echo the presented credential and this file fails.
 *
 * Written to FAIL before `T1440`.
 */
import { describe, expect, it } from 'vitest';
import { ForbiddenError, NotFoundError, toErrorBody, scrubCredentials } from '../../../src/core/errors.js';
import { scrubDetail } from '../../../src/modules/executions/sanitisation.js';

const CREDENTIAL = 'pmi_ct_abcdefghijklmnopqrstuvwxyz0123456789ABCDEF';

describe('T1441 · scrubCredentials', () => {
  it('replaces our credential shape and the common API-key shapes', () => {
    expect(scrubCredentials(`got ${CREDENTIAL}`)).toBe('got <credential>');
    expect(scrubCredentials('Bearer abcdefghijklmnopqrstuvwxyz0123')).toBe('<credential>');
    expect(scrubCredentials('sk-ant-abcdefghijklmnopqrstuvwxyz')).toBe('<credential>');
    expect(scrubCredentials('nothing to see')).toBe('nothing to see');
  });
});

describe('T1441 · toErrorBody never echoes a credential', () => {
  it('scrubs the message', () => {
    const body = toErrorBody(new ForbiddenError(`The credential ${CREDENTIAL} may not do that.`));
    expect(body.error.message).toBe('The credential <credential> may not do that.');
    expect(JSON.stringify(body)).not.toContain(CREDENTIAL);
  });

  it('scrubs string details at any depth', () => {
    const body = toErrorBody(new NotFoundError('Not found.', { hint: `tried ${CREDENTIAL}`, nested: { values: [CREDENTIAL, 1] } }));
    expect(JSON.stringify(body)).not.toContain(CREDENTIAL);
    expect(body.error.details).toEqual({ hint: 'tried <credential>', nested: { values: ['<credential>', 1] } });
  });
});

describe('T1441 · scrubDetail for audit entries', () => {
  it('scrubs every string in an audit detail and keeps the shape', () => {
    const detail = scrubDetail({ operation: 'execution.register', note: `via ${CREDENTIAL}`, count: 2, nested: { header: `Bearer ${CREDENTIAL}` } });
    expect(detail).toEqual({ operation: 'execution.register', note: 'via <credential>', count: 2, nested: { header: '<credential>' } });
  });
});

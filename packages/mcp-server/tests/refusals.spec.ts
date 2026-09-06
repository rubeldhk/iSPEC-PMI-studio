/**
 * `T1437` (EPIC-043, `FR-PIC-021`, `FR-PIC-026`, `SC-PIC-003`) — one refusal,
 * nothing echoed.
 *
 * The four credential failures produce one identical `structuredContent` on
 * every tool; a credential-shaped value in any argument is refused naming the
 * argument and never its value; every refusal passes through `sanitise()`.
 * The mutation target for `SC-PIC-003`: make a refusal echo the credential and
 * this file fails. Written to FAIL before `T1438`.
 */
import { describe, expect, it } from 'vitest';
import { credentialInArguments, refuse, sanitise } from '../src/refusals.js';
import { connect, stubPlatform, LIVE_TOOLS } from './server.spec.js';

const CREDENTIAL = 'pmi_ct_abcdefghijklmnopqrstuvwxyz0123456789ABCDEF';
const ONE_REFUSAL = { code: 'invalid_connector_credential', message: 'Invalid connector credential.' };

describe('T1437 · sanitise', () => {
  it('replaces every credential shape and leaves ordinary text alone', () => {
    expect(sanitise(`token ${CREDENTIAL} and key sk-ant-abcdefghijklmnopqrstuv and Bearer abcdefghijklmnopqrstuvwxyz`)).toBe(
      'token <credential> and key <credential> and <credential>',
    );
    expect(sanitise('no secrets here, sk-short')).toBe('no secrets here, sk-short');
  });

  it('refuse() sanitises the message and every string detail', () => {
    const r = refuse('platform_error', `failed for ${CREDENTIAL}`, { address: `host of ${CREDENTIAL}`, status: 500 });
    expect(JSON.stringify(r)).not.toContain(CREDENTIAL);
    expect(r.structuredContent).toMatchObject({ code: 'platform_error', message: 'failed for <credential>', address: 'host of <credential>', status: 500 });
  });
});

describe('T1437 · credentialInArguments', () => {
  it('finds a credential anywhere in the arguments and names its path, never its value', () => {
    expect(credentialInArguments({ body: 'fine' })).toBeNull();
    expect(credentialInArguments({ body: CREDENTIAL })).toBe('body');
    expect(credentialInArguments({ payload: { nested: [1, `Bearer ${CREDENTIAL}`] } })).toBe('payload.nested[1]');
  });
});

describe('T1437 · the four credential failures are one refusal on every tool', () => {
  it('absent: refused locally, identically, and the platform is never called', async () => {
    const { port, calls } = stubPlatform();
    port.describe = () => ({ address: 'localhost:3000', credentialPresent: false });
    port.call = async () => ({ ok: false, refusal: ONE_REFUSAL });
    const o = await connect(port);
    try {
      for (const name of LIVE_TOOLS) {
        // EPIC-045 T1640: pmi.artifacts.sync is live and its schema requires an
        // execution and a file list, so the sweep supplies them — the point of
        // the loop is the REFUSAL, not the argument shape.
        const args = name.startsWith('pmi.execution.') ? { executionId: 'e', idempotencyKey: 'k', command: 'specify', argsSanitized: {}, input: { targetType: 'project', targetId: 'p' }, correlationId: 'c', type: 't', payload: {}, occurredAt: 'now', outcome: 'completed', completionComment: 'x', body: 'b', targetRef: 'r', targetVersion: 1, expectedCurrentStatus: 's', proposedState: 'p', rationale: 'r' } : name === 'pmi.artifacts.sync' ? { executionId: 'e', files: [] } : {};
        const result = await o.client.callTool({ name, arguments: args });
        expect(result.isError, name).toBe(true);
        expect(result.structuredContent, name).toMatchObject(ONE_REFUSAL);
      }
      expect(calls).toEqual([]);
    } finally {
      await o.client.close();
      await o.server.close();
    }
  });

  it('malformed, revoked and other-project: the platform\'s one refusal passes through unchanged', async () => {
    const { port } = stubPlatform(() => ({ ok: false, refusal: ONE_REFUSAL }));
    const o = await connect(port);
    try {
      const result = await o.client.callTool({ name: 'pmi.execution.history', arguments: { executionId: 'exec_1' } });
      expect(result.isError).toBe(true);
      expect(result.structuredContent).toEqual(ONE_REFUSAL);
    } finally {
      await o.client.close();
      await o.server.close();
    }
  });

  it('a credential in an argument is refused naming the argument, and the platform is never called', async () => {
    const { port, calls } = stubPlatform();
    const o = await connect(port);
    try {
      const result = await o.client.callTool({ name: 'pmi.execution.comment', arguments: { executionId: 'e', body: `my token is ${CREDENTIAL}`, idempotencyKey: 'k' } });
      expect(result.isError).toBe(true);
      expect(result.structuredContent).toMatchObject({ code: 'credential_in_argument', argument: 'body' });
      expect(JSON.stringify(result)).not.toContain(CREDENTIAL);
      expect(calls).toEqual([]);
    } finally {
      await o.client.close();
      await o.server.close();
    }
  });
});

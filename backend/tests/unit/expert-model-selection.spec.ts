/**
 * `T1931` (EPIC-047) — which model a run uses, and why.
 *
 * `FR-EXP-017`, `FR-EXP-018`, `FR-EXP-023`. The preferred model when a runner
 * for it covers the requested capabilities; otherwise the first declared
 * fallback that does, **with the reason recorded**; otherwise refusal. A runner
 * for a model the contract never named is never chosen, however willing.
 */
import { describe, expect, it } from 'vitest';
import { selectRunner } from '../../src/modules/experts/dispatch.service.js';
import { contract, gatewaysFor, runner } from '../helpers/expert-fixtures.js';

const c = contract({ models: { preferred: 'opus', fallbacks: ['sonnet', 'haiku'] } });

describe('T1931 · model selection', () => {
  it('uses the preferred model when it has a runner', async () => {
    const choice = await selectRunner(c, ['test'], gatewaysFor({ opus: [runner({ model: 'opus' })] }), {});
    expect(choice).toMatchObject({ model: 'opus', usedFallback: false, fallbackReason: null });
  });

  it('falls back in declared order, recording why', async () => {
    const choice = await selectRunner(
      c,
      ['test'],
      gatewaysFor({ sonnet: [runner({ model: 'sonnet' })], haiku: [runner({ model: 'haiku' })] }),
      {},
    );
    expect(choice).toMatchObject({ model: 'sonnet', usedFallback: true });
    expect('fallbackReason' in choice && choice.fallbackReason).toMatch(/opus/);
  });

  it('skips a runner that lacks a requested capability (assertAgentCapabilities)', async () => {
    const choice = await selectRunner(
      c,
      ['test'],
      gatewaysFor({ opus: [runner({ model: 'opus', capabilities: ['analyze'] })], sonnet: [runner({ model: 'sonnet' })] }),
      {},
    );
    expect(choice).toMatchObject({ model: 'sonnet', usedFallback: true });
  });

  it('refuses when no declared model has a runner — never an undeclared one', async () => {
    const choice = await selectRunner(c, ['test'], gatewaysFor({ 'some-other-model': [runner({ model: 'x' })] }), {});
    expect(choice).toMatchObject({ refused: expect.stringMatching(/no declared model.*opus.*sonnet.*haiku/) });
  });

  it('refuses a runner that does not meet the workspace requirements (FR-EXP-019)', async () => {
    const strict = contract({
      models: { preferred: 'opus', fallbacks: [] },
      workspaceRequirements: { executionType: 'headless', repositoryAccess: ['push'] },
    });
    const choice = await selectRunner(strict, ['test'], gatewaysFor({ opus: [runner({ model: 'opus' })] }), {});
    expect(choice).toMatchObject({ refused: expect.stringMatching(/workspace requirement.*push/) });
  });

  it('an unattended run needs a runner that supports unattended work', async () => {
    const choice = await selectRunner(
      contract({ models: { preferred: 'opus', fallbacks: [] } }),
      ['test'],
      gatewaysFor({ opus: [runner({ model: 'opus', supportsUnattended: false })] }),
      { unattended: true },
    );
    expect(choice).toMatchObject({ refused: expect.stringMatching(/unattended/) });
  });
});

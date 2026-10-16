/**
 * `T2670` (EPIC-048 convergence, `FR-LRN-030`, `FR-LRN-037`, `FR-LRN-070`) — the
 * learning sweeps run in the shipped stack.
 *
 * `LearningSweeps` is off unless `PMI_LEARNING_SWEEPS=on` (`learning.sweeps.ts`):
 * the composed application is booted by dozens of integration suites, and a
 * background sweep would race their assertions. That default is right for the
 * suites and wrong for a deployment. Without the sweeps:
 *
 * - a decision taken with the Decision Inbox's own Approve/Reject never becomes
 *   knowledge — only `learning.resolve-decisions` carries it across (`C4`);
 * - nothing ever expires (`FR-LRN-030`) and nothing is flagged (`FR-LRN-037`);
 * - a candidate recorded during a decision-path outage is never asked for again.
 *
 * So the deployment configuration turns them on, and says so.
 */
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const here = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(here, '../../..');
const compose = readFileSync(resolve(ROOT, 'docker-compose.yml'), 'utf8');
const envExample = readFileSync(resolve(ROOT, '.env.example'), 'utf8');

describe('T2670 · the learning sweeps are on in the shipped stack', () => {
  it('docker-compose.yml passes PMI_LEARNING_SWEEPS to the API, defaulting to on', () => {
    expect(compose).toMatch(/^\s+PMI_LEARNING_SWEEPS: \$\{PMI_LEARNING_SWEEPS:-on\}\s*$/m);
  });

  it('.env.example documents it, set to on', () => {
    expect(envExample).toMatch(/^PMI_LEARNING_SWEEPS=on\s*$/m);
    expect(envExample).toMatch(/#.*PMI_LEARNING_SWEEPS/);
  });

  it('the code default stays off, so the suites that boot the app see no background sweep', () => {
    const sweeps = readFileSync(resolve(ROOT, 'backend/src/modules/learning/learning.sweeps.ts'), 'utf8');
    expect(sweeps).toContain(`process.env['PMI_LEARNING_SWEEPS'] === 'on'`);
  });
});

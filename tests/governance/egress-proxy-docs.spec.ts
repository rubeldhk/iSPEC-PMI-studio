/**
 * T708 · the documents that describe egress enforcement track its delivery.
 *
 * Constitution V: documents pair with an executable check that fails when they
 * drift. These three said, correctly, that the proxy was NOT built — `ADR-0013`
 * ("It is not built"), `operator-setup.md` (containment or reachability, never
 * the profile), `quickstart.md` (a proxy "that does not exist yet"). Once D-28
 * is delivered, a document still saying so is worse than silence: it tells an
 * operator the control they are relying on does not exist.
 */
import { readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const here = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(here, '../..');
const read = (p: string): string => readFileSync(join(ROOT, p), 'utf8');

describe('T708 · ADR-0013 records D-28 as delivered', () => {
  const adr = () => read('adr/ADR-0013-controlled-network-egress.md');

  it('no longer records the proxy as unbuilt', () => {
    expect(adr()).not.toContain('It is not built');
  });

  it('names the delivery and how enforcement is expressed', () => {
    expect(adr()).toMatch(/delivered/i);
    expect(adr()).toContain('scripts/egress-proxy-up.mjs');
    expect(adr()).toMatch(/internal/i);
  });
});

describe('T708 · operator-setup tells the operator the conformant bring-up', () => {
  const doc = () => read('docs/operator-setup.md');

  it('names the bring-up script', () => {
    expect(doc()).toContain('node scripts/egress-proxy-up.mjs generation');
  });

  it('no longer presents containment-or-reachability as the only options', () => {
    // The R-028-8 caveat was true and dated; keeping its conclusion after the
    // proxy exists would steer operators around the control.
    expect(doc()).not.toMatch(/containment.*or.*reachability.*not the profile/is);
  });
});

describe('T708 · quickstart V6 runs through the proxy', () => {
  const doc = () => read('specs/028-agent-execution-seam/quickstart.md');

  it('names the bring-up script instead of a proxy "that does not exist yet"', () => {
    expect(doc()).toContain('scripts/egress-proxy-up.mjs');
    expect(doc()).not.toMatch(/does not exist\s+yet/);
  });
});

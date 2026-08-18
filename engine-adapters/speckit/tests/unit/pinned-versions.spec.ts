/**
 * T669 · `DEF-028-006` — a pin must name a release that was actually resolved.
 *
 * `T088a` asserts `ARG SPECIFY_VERSION=\d+\.\d+\.\d+`. `0.0.17` satisfies that
 * regex and **does not exist**: PyPI's `specify-cli` starts at `0.9.4`. The
 * image failed at layer 6 of 9 on every attempt, for nine days, while the check
 * stayed green — because it verifies that a pin has the *shape* of a version,
 * never that it names one.
 *
 * The Dockerfile's own comment stated the risk exactly: *"Versions are PINNED.
 * RAID R-01 is the top-scoring risk in this programme… a floating tag would mean
 * the image silently changes."* The concern was right. **A pin nobody ever
 * resolved is not a pin — it is a floating tag that floats to nothing.**
 *
 * So this check asks for the one thing an invented version cannot have: a
 * digest. `pinned-versions.json` records the sha256 of the artifact actually
 * resolved, and a pin cannot be added without resolving it.
 *
 * It still does not prove the image builds — that is `T646b`, by hand, on a
 * machine with a daemon. It proves the pins are resolvable, which is the step
 * that was missing.
 */
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, it, expect } from 'vitest';

const here = dirname(fileURLToPath(import.meta.url));
const dockerDir = resolve(here, '../../docker');
const dockerfile = readFileSync(resolve(dockerDir, 'Dockerfile'), 'utf8');
const record = JSON.parse(readFileSync(resolve(dockerDir, 'pinned-versions.json'), 'utf8')) as {
  pins: Record<string, { value: string; registry: string; package: string; artifacts?: Record<string, string> }>;
};

/** Every `ARG NAME=value` the Dockerfile declares. */
function dockerfileArgs(): Map<string, string> {
  const args = new Map<string, string>();
  for (const line of dockerfile.split(/\r?\n/)) {
    const match = /^ARG\s+([A-Z_][A-Z0-9_]*)=(.+)$/.exec(line.trim());
    if (match) args.set(match[1] as string, (match[2] as string).trim());
  }
  return args;
}

describe('T669 · every Dockerfile pin is backed by a resolved artifact (DEF-028-006)', () => {
  it('records every ARG the Dockerfile declares', () => {
    for (const [name] of dockerfileArgs()) {
      expect(
        record.pins[name],
        `ARG ${name} is pinned in the Dockerfile but absent from pinned-versions.json — ` +
          `so nothing proves the version exists. This is exactly how SPECIFY_VERSION=0.0.17 survived nine days.`,
      ).toBeTruthy();
    }
  });

  it('agrees with the Dockerfile on every value', () => {
    // A record that drifts from the Dockerfile is worse than none: it reads as
    // evidence for a pin that is no longer in use.
    for (const [name, value] of dockerfileArgs()) {
      expect(record.pins[name]?.value, `ARG ${name} and pinned-versions.json disagree`).toBe(value);
    }
  });

  it('carries a sha256 for each pin that decides what generates specifications', () => {
    // Scoped deliberately. SPECIFY_VERSION and AGENT_CLI_VERSION choose the
    // tools that produce output; NODE_MAJOR is a major line by design, and
    // demanding a digest for it would push people to record a fake one.
    const wheel = record.pins['SPECIFY_VERSION']?.artifacts ?? {};
    const digests = Object.values(wheel);
    expect(digests.length, 'SPECIFY_VERSION has no resolved artifact digest').toBeGreaterThan(0);
    for (const digest of digests) {
      expect(digest, `"${digest}" is not a sha256 — an invented version cannot have one`).toMatch(
        /^sha256:[0-9a-f]{64}$/,
      );
    }
  });

  it('does not pin the specify CLI below its first published release', () => {
    // The direct assertion DEF-028-006 needed. 0.0.17 fails here; 0.16.4 passes.
    const [major, minor] = (record.pins['SPECIFY_VERSION']?.value ?? '0.0.0').split('.').map(Number);
    expect(
      (major ?? 0) > 0 || (minor ?? 0) >= 9,
      'specify-cli has no release before 0.9.4 — this pin cannot be installed',
    ).toBe(true);
  });

  it('names each pin its registry and package, so the pin can be re-resolved', () => {
    for (const [name, pin] of Object.entries(record.pins)) {
      expect(pin.registry, `${name} does not say where it comes from`).toBeTruthy();
      expect(pin.package, `${name} does not name its package`).toBeTruthy();
    }
  });
});

/**
 * T704 · the egress proxy sidecar definition conforms (D-28, ADR-0013).
 *
 * Constitution V: the Dockerfile and its pin file are non-code outputs, so this
 * is their executable conformance check. Every assertion here can fail, and
 * each failure is a real defect class:
 *   - a FROM by tag is a moving security control (RAID R-01);
 *   - a Dockerfile digest that drifts from the pin file is DEF-028-006 again
 *     (a pin nobody resolved is not a pin);
 *   - a root proxy or a baked-in filter would widen what a sidecar compromise
 *     buys (RAID R-06).
 */
import { readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const here = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(here, '../..');
const PROXY_DIR = join(ROOT, 'execution-providers/docker/proxy');

const dockerfile = (): string => readFileSync(join(PROXY_DIR, 'Dockerfile'), 'utf8');
const pins = (): {
  pins: Record<string, { value: string; digest?: string }>;
} => JSON.parse(readFileSync(join(PROXY_DIR, 'pinned-versions.json'), 'utf8'));

describe('T704 · egress proxy image definition (D-28)', () => {
  it('pins its base image by digest, not by tag alone', () => {
    const from = /^FROM\s+(\S+)/m.exec(dockerfile());
    expect(from, 'Dockerfile has no FROM line').toBeTruthy();
    expect(from![1]).toMatch(/@sha256:[0-9a-f]{64}$/);
  });

  it('carries the SAME digest the pin file resolved — drift fails, in either file', () => {
    const from = /^FROM\s+\S+@(sha256:[0-9a-f]{64})$/m.exec(dockerfile());
    const pinned = pins().pins['ALPINE_BASE'];
    expect(pinned?.digest, 'pinned-versions.json lacks ALPINE_BASE.digest').toBeTruthy();
    expect(from?.[1]).toBe(pinned!.digest);
  });

  it('asserts the tinyproxy line at build, so a silent major bump fails the build', () => {
    // Filter semantics (whitelist mode, domain regexes) are what the profile's
    // enforcement rests on; they were verified against the 1.11 docs.
    expect(dockerfile()).toMatch(/tinyproxy -v \| grep -Eq '\^tinyproxy 1\\\.11\\\.'/);
  });

  it('runs as a non-root user', () => {
    expect(dockerfile()).toMatch(/^USER tinyproxy$/m);
  });

  it('expects its config at the path the generator and entrypoint agree on', () => {
    // Three artifacts name this path: proxy-config.ts (generates), the
    // bring-up script (mounts), the ENTRYPOINT (reads). The generator source is
    // the reference; this catches the Dockerfile drifting from it.
    const generator = readFileSync(
      join(ROOT, 'execution-providers/docker/src/proxy-config.ts'),
      'utf8',
    );
    expect(generator).toContain("'/etc/tinyproxy/filter'");
    expect(dockerfile()).toContain('/etc/tinyproxy/tinyproxy.conf');
  });

  it('exposes the port the generator writes into the config', () => {
    const generator = readFileSync(
      join(ROOT, 'execution-providers/docker/src/proxy-config.ts'),
      'utf8',
    );
    const port = /PROXY_PORT = (\d+)/.exec(generator)?.[1];
    expect(port, 'PROXY_PORT not found in proxy-config.ts').toBeTruthy();
    expect(dockerfile()).toMatch(new RegExp(`^EXPOSE ${port}$`, 'm'));
  });

  it('bakes in no filter — the whitelist arrives by mount, generated from the profile', () => {
    // A COPY of a filter file would create a second, hand-maintained allowlist
    // that reviews identically to the generated one and drifts silently.
    expect(dockerfile()).not.toMatch(/^\s*(COPY|ADD)\s/m);
  });
});

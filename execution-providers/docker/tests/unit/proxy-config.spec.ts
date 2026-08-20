/**
 * T701 · `D-28` delivered — the proxy allowlist is GENERATED, never hand-written.
 *
 * `ADR-0013` decided named egress profiles are proxy-enforced and recorded the
 * proxy as undelivered. The dangerous failure mode of delivering it by hand is
 * drift: a profile that says `api.anthropic.com` and a filter file that says
 * something wider, each reviewed separately, each looking right. Generating the
 * filter FROM the profile makes that drift unrepresentable.
 *
 * Filter semantics verified against current Tinyproxy documentation
 * (Context7 `/tinyproxy/tinyproxy.github.io`, 2026-08-19): `FilterDefaultDeny
 * Yes` turns the filter into a whitelist, rules are regexes over DOMAIN names
 * (not URLs) which is exactly what an HTTPS CONNECT carries, and `ConnectPort`
 * restricts tunnel targets.
 */
import { describe, expect, it } from 'vitest';
import {
  GENERATION_EGRESS_PROFILE,
  PolicyRefusedError,
  type EgressProfile,
} from '@pmi/execution-contract';
import {
  PROXY_PORT,
  proxyContainerNameFor,
  proxyConfigFor,
  proxyFilterFor,
  proxyUrlFor,
} from '../../src/proxy-config.js';

const TWO_HOSTS: EgressProfile = Object.freeze({
  name: 'two-hosts',
  allowedDestinations: Object.freeze(['api.anthropic.com', 'registry.npmjs.org']) as readonly string[],
  enforcement: 'proxy',
});

describe('T701 · the filter is the profile, restated (D-28)', () => {
  it('emits exactly one anchored rule per allowed destination', () => {
    const filter = proxyFilterFor(GENERATION_EGRESS_PROFILE);
    const rules = filter.split('\n').filter((l) => l.trim() !== '' && !l.startsWith('#'));
    expect(rules).toEqual(['^api\\.anthropic\\.com$']);
  });

  it('anchors and escapes, so api.anthropic.com.evil.example cannot match', () => {
    // An unanchored or unescaped rule is the whole game: `api.anthropic.com`
    // as a raw regex matches `api-anthropic:com.evil.example` on the dot and
    // `api.anthropic.com.evil.example` on the missing anchor. Either way the
    // allowlist is wider than the profile while reading identically in review.
    const filter = proxyFilterFor(GENERATION_EGRESS_PROFILE);
    const rule = filter.split('\n').find((l) => l.includes('anthropic'))!;
    const re = new RegExp(rule);
    expect(re.test('api.anthropic.com')).toBe(true);
    expect(re.test('api.anthropic.com.evil.example')).toBe(false);
    expect(re.test('evil.example/api.anthropic.com')).toBe(false);
    expect(re.test('apiXanthropicXcom')).toBe(false);
  });

  it('scales with the profile, not with this epic', () => {
    const rules = proxyFilterFor(TWO_HOSTS)
      .split('\n')
      .filter((l) => l.trim() !== '' && !l.startsWith('#'));
    expect(rules).toHaveLength(2);
  });

  it('refuses a wildcard profile with the same rules the contract enforces', () => {
    const wild: EgressProfile = {
      name: 'wild',
      allowedDestinations: ['*'],
      enforcement: 'proxy',
    };
    expect(() => proxyFilterFor(wild)).toThrow(PolicyRefusedError);
  });

  it('refuses an empty destination list rather than emitting an empty whitelist', () => {
    // An empty filter file under FilterDefaultDeny denies everything — which
    // sounds safe but silently converts "enforced reachability" into
    // containment, the exact confusion R-028-8 recorded.
    const empty: EgressProfile = { name: 'none', allowedDestinations: [], enforcement: 'proxy' };
    expect(() => proxyFilterFor(empty)).toThrow(PolicyRefusedError);
  });
});

describe('T701 · the daemon config enforces whitelist-over-CONNECT', () => {
  const config = () => proxyConfigFor(GENERATION_EGRESS_PROFILE);

  it('sets FilterDefaultDeny Yes — a filter that defaults to allow is a blacklist', () => {
    expect(config()).toMatch(/^FilterDefaultDeny Yes$/m);
  });

  it('restricts CONNECT tunnels to 443', () => {
    expect(config()).toMatch(/^ConnectPort 443$/m);
    expect(config()).not.toMatch(/^ConnectPort 0$/m);
  });

  it('filters domains, never URLs — HTTPS hides the URL from the proxy', () => {
    // FilterURLs on would silently match nothing for CONNECT traffic and the
    // whitelist would deny the one host it exists to permit.
    expect(config()).not.toMatch(/^FilterURLs/m);
  });

  it('names the filter file it expects the image to mount', () => {
    expect(config()).toMatch(/^Filter "\/etc\/tinyproxy\/filter"$/m);
  });

  it('listens on the profile port the sandbox env will be pointed at', () => {
    expect(config()).toMatch(new RegExp(`^Port ${PROXY_PORT}$`, 'm'));
  });
});

describe('T701 · one derivation for names and URLs (no independent naming)', () => {
  it('derives the sidecar container name from the profile name', () => {
    expect(proxyContainerNameFor('generation')).toBe('pmi-egress-proxy-generation');
  });

  it('derives the proxy URL from the same name and port', () => {
    // Two places deriving independently is how the env var points at a
    // container that is not there — the same lesson as networkFor (T670).
    expect(proxyUrlFor('generation')).toBe(`http://${proxyContainerNameFor('generation')}:${PROXY_PORT}`);
  });
});

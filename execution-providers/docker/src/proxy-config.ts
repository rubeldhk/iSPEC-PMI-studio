/**
 * T702 · `D-28` delivered — the egress proxy's config, generated from the profile.
 *
 * `ADR-0013` decided named egress profiles are proxy-enforced and recorded the
 * proxy as **not built**. This module is the half that turns a profile into
 * enforcement: the Tinyproxy filter and config are derived from
 * `EgressProfile.allowedDestinations`, never written by hand, so the profile
 * and the proxy cannot say different things while both looking right in review.
 *
 * Tinyproxy semantics (verified against current docs, Context7
 * `/tinyproxy/tinyproxy.github.io`, 2026-08-19):
 *   - `FilterDefaultDeny Yes` makes the filter a WHITELIST.
 *   - Filter rules are regexes over DOMAIN names (with `FilterURLs` off), which
 *     is exactly what an HTTPS CONNECT presents — URL filtering sees nothing.
 *   - `ConnectPort 443` restricts tunnel targets to TLS.
 *
 * The sidecar is dual-homed by `scripts/egress-proxy-up.mjs`: one leg on the
 * profile's `--internal` network (where the sandbox is), one leg with egress.
 * The sandbox reaches it by container name over Docker's embedded DNS — the
 * same single-derivation rule as `networkFor` (T670): names and URLs come from
 * ONE function each, so the preflight, the env var and the bring-up script can
 * never point at different containers.
 */
import { assertEgressProfile, type EgressProfile } from '@pmi/execution-contract';

/** Tinyproxy's default port, kept: one fewer delta from upstream docs. */
export const PROXY_PORT = 8888;

/** Where the image mounts the generated filter. T703's Dockerfile agrees. */
export const PROXY_FILTER_PATH = '/etc/tinyproxy/filter';

/** One derivation for the sidecar's name (see module comment). */
export function proxyContainerNameFor(profileName: string): string {
  return `pmi-egress-proxy-${profileName}`;
}

/** The URL the sandbox's HTTPS_PROXY points at. Carries no secret. */
export function proxyUrlFor(profileName: string): string {
  return `http://${proxyContainerNameFor(profileName)}:${PROXY_PORT}`;
}

/**
 * One anchored, escaped regex per destination.
 *
 * Anchoring and escaping are the whole control: `api.anthropic.com` as a raw
 * regex matches `api.anthropic.com.evil.example` (no anchor) and
 * `apiXanthropicXcom` (unescaped dots). Either widens the allowlist while
 * reading identically to the profile.
 */
export function proxyFilterFor(profile: EgressProfile): string {
  assertEgressProfile(profile);
  const rules = profile.allowedDestinations.map(
    (host) => `^${host.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`,
  );
  return [
    `# GENERATED from egress profile "${profile.name}" (D-28). Do not edit:`,
    `# regenerate via proxyFilterFor() so the filter cannot drift from the profile.`,
    ...rules,
    '',
  ].join('\n');
}

/**
 * The daemon config. Whitelist mode over CONNECT/443, nothing else.
 *
 * Client ACL: the RFC1918 ranges Docker assigns to user-defined networks. The
 * real access control is network membership — only containers on the internal
 * network can reach the sidecar at all — but Tinyproxy's default of
 * localhost-only would refuse them, so the private ranges are stated.
 */
export function proxyConfigFor(profile: EgressProfile): string {
  assertEgressProfile(profile);
  return [
    `# GENERATED for egress profile "${profile.name}" (D-28). Do not edit by hand.`,
    `Port ${PROXY_PORT}`,
    `Listen 0.0.0.0`,
    `Timeout 600`,
    `MaxClients 32`,
    `Allow 10.0.0.0/8`,
    `Allow 172.16.0.0/12`,
    `Allow 192.168.0.0/16`,
    `Filter "${PROXY_FILTER_PATH}"`,
    `FilterDefaultDeny Yes`,
    `ConnectPort 443`,
    `LogLevel Notice`,
    '',
  ].join('\n');
}

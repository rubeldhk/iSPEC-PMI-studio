# T703 · D-28 delivered — the egress proxy sidecar (ADR-0013).
#
# This container is the enforcement half of a named EgressProfile: it is
# dual-homed by scripts/egress-proxy-up.mjs between the profile's --internal
# network (where the sandbox lives, with NO route out) and a routable network.
# The ONLY path from the sandbox to the internet is a CONNECT tunnel through
# this proxy, and the proxy's whitelist is GENERATED from the profile by
# proxy-config.ts — it is mounted at runtime, never baked in, so this image
# stays profile-agnostic and the filter can never drift from the profile.
#
# Base pinned by digest per RAID R-01 (see pinned-versions.json beside this
# file): a tag is a moving target, and this image is a security control.
FROM alpine:3.22@sha256:14358309a308569c32bdc37e2e0e9694be33a9d99e68afb0f5ff33cc1f695dce

# Version-asserted install: apk resolves inside the digest-pinned 3.22 branch,
# and the build FAILS if the resolved tinyproxy leaves the 1.11 line — the
# filter semantics this control depends on (FilterDefaultDeny whitelist mode,
# domain-regex rules) are verified against 1.11 documentation.
RUN apk add --no-cache tinyproxy \
  && tinyproxy -v | grep -Eq '^tinyproxy 1\.11\.'

# The generated config and filter are bind-mounted read-only here by
# scripts/egress-proxy-up.mjs. An image run without them exits immediately,
# which is the correct failure: an unconfigured proxy must not run at all.
#
# Non-root: the package creates the tinyproxy user; there is no reason for a
# proxy that only tunnels CONNECT/443 to hold root.
USER tinyproxy

EXPOSE 8888

ENTRYPOINT ["tinyproxy", "-d", "-c", "/etc/tinyproxy/tinyproxy.conf"]

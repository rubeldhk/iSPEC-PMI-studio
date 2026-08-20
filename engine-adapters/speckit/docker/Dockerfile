# T088 — the Spec Kit engine image.
#
# Contains exactly what the five-step invocation needs (research R-001):
#   git             step 1, `git init`
#   specify CLI     step 2, scaffolds the workspace
#   AI agent CLI    step 4, executes the /speckit-* prompt templates
#
# Versions are PINNED. RAID R-01 is the top-scoring risk in this programme:
# Spec Kit or model output drifts and the parser breaks. A floating tag would
# mean the image silently changes under a running deployment and the first
# symptom is malformed_output on a job someone was waiting for.
#
# The image is only half the containment — the runtime constraints live in
# sandbox.json (T089), because CPU, memory, and egress cannot be expressed here.

FROM python:3.12-slim-bookworm

# Pinned toolchain versions (R-01). Bump deliberately, never automatically.
ARG SPECIFY_VERSION=0.16.4
ARG AGENT_CLI_VERSION=1.0.0
ARG NODE_MAJOR=22

LABEL org.opencontainers.image.title="pmi-studio/speckit-engine" \
      org.opencontainers.image.description="Sandboxed Spec Kit + AI agent runtime for PMI Studio" \
      org.opencontainers.image.source="https://github.com/rubeldhk/iSPEC-PMI-studio" \
      pmi.engine.specify-version="${SPECIFY_VERSION}" \
      pmi.engine.agent-cli-version="${AGENT_CLI_VERSION}"

# git for step 1; ca-certificates so the one permitted egress destination is
# verifiable. curl is build-time only and removed below.
RUN apt-get update \
    && apt-get install --no-install-recommends -y \
        git \
        ca-certificates \
        curl \
        gnupg \
    && curl -fsSL "https://deb.nodesource.com/setup_${NODE_MAJOR}.x" | bash - \
    && apt-get install --no-install-recommends -y nodejs \
    && apt-get purge -y curl gnupg \
    && apt-get autoremove -y \
    && rm -rf /var/lib/apt/lists/*

# The specify CLI (step 2). Scaffolds only — it does not generate.
RUN pip install --no-cache-dir "specify-cli==${SPECIFY_VERSION}"

# The AI coding agent CLI (step 4). This is what actually executes the
# /speckit-* prompt templates; specify never does.
RUN npm install -g --no-fund --no-audit "@anthropic-ai/claude-code@${AGENT_CLI_VERSION}" \
    && npm cache clean --force

# T699 / DEF-028-013 — the Spec Kit scaffold, baked at BUILD time.
#
# `specify init` fetches its templates over the network. At run time the
# generation egress profile permits `api.anthropic.com` and nothing else
# (ADR-0002), so the scaffold could not be fetched and the agent was asked to run
# `/speckit-specify` against a workspace that had no `.specify/` in it.
#
# Baking it here means generation needs no network beyond the AI provider, which
# is exactly the promise that profile makes. The alternatives — a second, wider
# posture for scaffolding, or widening the generation profile — each add a way
# for a generation run to reach further than the provider, which is the one thing
# the profile exists to prevent. This is also what an air-gapped generation
# environment requires, so it stays correct under the strictest future constraint
# rather than the loosest.
#
# Keyed by INTEGRATION, because the scaffold differs per agent: `--integration
# claude` writes Claude's command files, and a run asking for a different agent
# must not silently receive Claude's. A second agent means a second baked
# scaffold — a build-time cost, never a run-time network hole.
#
# The `.git` directory is removed: the adapter runs `git init` in the workspace
# itself, and shipping a build-time repository would put this image's history
# inside every customer workspace.
RUN mkdir -p /opt/pmi/scaffold/claude \
    && cd /opt/pmi/scaffold/claude \
    && git init -q . \
    && specify init --here --force --integration claude --script sh --ignore-agent-tools \
    && rm -rf /opt/pmi/scaffold/claude/.git \
    && chmod -R a+rX /opt/pmi/scaffold

# Non-root by default (sandbox.json user.nonRoot). The uid is fixed so the
# workspace mount's ownership is predictable rather than resolved at run time.
RUN groupadd --gid 10001 engine \
    && useradd --uid 10001 --gid 10001 --create-home --shell /usr/sbin/nologin engine

# The only writable path (sandbox.json filesystem.writableMounts). Everything
# else is read-only at run time.
RUN mkdir -p /workspace && chown 10001:10001 /workspace

USER 10001:10001
WORKDIR /workspace

# No ENTRYPOINT that starts work on its own. The adapter drives the five steps
# explicitly (T091), so a container that starts does nothing until told to —
# which keeps "the container ran" and "generation started" separate events.
ENTRYPOINT ["/bin/sh", "-c"]
CMD ["echo 'pmi-studio speckit-engine: awaiting invocation'"]

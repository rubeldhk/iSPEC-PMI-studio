/**
 * T088a — the engine image definition installs what the five steps need, and
 * declares a non-root default user.
 *
 * Asserted against the Dockerfile source rather than a built image: this runs
 * in CI on every commit, where building the image is exactly the
 * container-in-container problem RAID **R-04** describes. The real image is
 * exercised nightly (EPIC-015 T146), not per commit.
 *
 * So this test proves the definition is right. It does not prove the image
 * builds — and the epic is honest about which of those it has.
 */
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, it, expect } from 'vitest';

const here = dirname(fileURLToPath(import.meta.url));
const dockerfile = readFileSync(resolve(here, '../../docker/Dockerfile'), 'utf8');

/** Instruction lines only — comments explain intent and must not satisfy a test. */
const instructions = dockerfile
  .split(/\r?\n/)
  .filter((line) => line.trim() !== '' && !line.trimStart().startsWith('#'))
  .join('\n');

describe('the three tools the five-step invocation needs (R-001)', () => {
  it('installs git — step 1, `git init`', () => {
    expect(instructions).toMatch(/\bgit\b/);
  });

  it('installs the specify CLI — step 2, scaffolding', () => {
    expect(instructions).toMatch(/specify-cli/);
  });

  it('installs an AI agent CLI — step 4, which is what actually generates', () => {
    // specify only scaffolds; the /speckit-* commands are prompt templates an
    // agent executes. An image with specify and no agent can scaffold and
    // never generate.
    expect(instructions).toMatch(/claude-code|AGENT_CLI_VERSION/);
  });
});

describe('pinned versions (RAID R-01 — the top-scoring risk)', () => {
  it('pins the specify CLI to an exact version', () => {
    expect(instructions).toMatch(/specify-cli==\$\{SPECIFY_VERSION\}/);
    expect(dockerfile).toMatch(/ARG SPECIFY_VERSION=\d+\.\d+\.\d+/);
  });

  it('pins the AI agent CLI to an exact version', () => {
    expect(dockerfile).toMatch(/ARG AGENT_CLI_VERSION=\d+\.\d+\.\d+/);
    expect(instructions).toMatch(/@\$\{AGENT_CLI_VERSION\}/);
  });

  it('uses no floating tag on the base image', () => {
    const from = /^FROM\s+(\S+)/m.exec(instructions)?.[1] ?? '';
    expect(from).not.toMatch(/:latest$/);
    expect(from).toMatch(/:/);
  });

  it('records both pinned versions as image labels, so a running container is identifiable', () => {
    expect(instructions).toMatch(/pmi\.engine\.specify-version/);
    expect(instructions).toMatch(/pmi\.engine\.agent-cli-version/);
  });
});

describe('non-root by default (R-06)', () => {
  it('creates a dedicated user with a fixed uid', () => {
    expect(instructions).toMatch(/useradd\s+--uid\s+10001/);
  });

  it('switches to that user before the entrypoint', () => {
    const userIndex = instructions.search(/^USER\s+10001/m);
    const entrypointIndex = instructions.search(/^ENTRYPOINT/m);
    expect(userIndex).toBeGreaterThan(-1);
    expect(entrypointIndex).toBeGreaterThan(-1);
    expect(userIndex).toBeLessThan(entrypointIndex);
  });

  it('declares no USER root after that point', () => {
    const afterUser = instructions.slice(instructions.search(/^USER\s+10001/m));
    expect(afterUser).not.toMatch(/^USER\s+(root|0)\b/m);
  });

  it('gives the workspace to the same uid the container runs as', () => {
    expect(instructions).toMatch(/chown 10001:10001 \/workspace/);
  });
});

describe('build hygiene', () => {
  it('removes the package lists it created', () => {
    expect(instructions).toMatch(/rm -rf \/var\/lib\/apt\/lists/);
  });

  it('does not leave a network-fetching tool installed', () => {
    // curl is needed to add the Node repository and is a ready-made
    // exfiltration tool if it survives into the running image.
    expect(instructions).toMatch(/apt-get purge -y curl/);
  });

  it('does not start work on its own', () => {
    // "The container started" and "generation started" must stay separate
    // events; the adapter drives the five steps explicitly (T091).
    expect(instructions).not.toMatch(/^ENTRYPOINT\s*\[\s*"specify"/m);
    expect(instructions).toMatch(/^CMD/m);
  });
});

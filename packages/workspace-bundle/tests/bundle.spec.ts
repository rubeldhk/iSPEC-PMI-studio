/**
 * `T1316` (EPIC-041) — the workspace bundle is one versioned thing with two
 * halves and a mapping.
 *
 * `R-041-9`. The setup skill is copied by the API's prepare step **before**
 * initialisation; the extension is copied by the worker's initialise step
 * **after** it. Versioning both together is what stops the halves drifting.
 * `skillsPathFor` (analysis `C4`, `FR-LPW-006`) is configuration here so that
 * provisioning code never names an agent and never defaults to one.
 *
 * Written to FAIL before `T1317` exists.
 */
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  BUNDLE_VERSION,
  SKILLS_PATH_BY_INTEGRATION,
  extensionDir,
  skillsDir,
  skillsPathFor,
  DEFAULT_AGENT_INTEGRATION,
} from '../src/index.js';

describe('T1316 · version', () => {
  it('is semver', () => {
    expect(BUNDLE_VERSION).toMatch(/^\d+\.\d+\.\d+$/);
  });
});

describe('T1316 · the skills half', () => {
  const skill = join(skillsDir(), 'setup-PMIStudio', 'SKILL.md');

  it('carries the setup skill', () => {
    expect(existsSync(skill), `${skill} is missing`).toBe(true);
  });

  it('whose frontmatter names it setup-PMIStudio and makes it user-invocable', () => {
    const text = readFileSync(skill, 'utf8');
    expect(text).toMatch(/^name:\s*"?setup-PMIStudio"?\s*$/m);
    expect(text).toMatch(/^user-invocable:\s*true\s*$/m);
  });

  it('never asks for or prints the credential value', () => {
    const text = readFileSync(skill, 'utf8');
    // The contract's "must not": the skill checks that the variable is SET and
    // says where to mint one. A skill that echoed it would put the value in a
    // transcript.
    expect(text).toMatch(/PMI_STUDIO_TOKEN/);
    expect(text).toMatch(/never (ask for|print)/i);
  });
});

describe('T1316 · the extension half', () => {
  const manifest = join(extensionDir(), 'extension.yml');

  it('carries an extension manifest', () => {
    expect(existsSync(manifest), `${manifest} is missing`).toBe(true);
  });

  it('declares the pmi extension at the bundle version', () => {
    const text = readFileSync(manifest, 'utf8');
    expect(text).toMatch(/^\s*id:\s*"?pmi"?\s*$/m);
    expect(text).toMatch(new RegExp(`^\\s*version:\\s*"?${BUNDLE_VERSION.replace(/\./g, '\\.')}"?\\s*$`, 'm'));
  });

  it('registers three commands and eighteen mandatory hooks in v0.2 (EPIC-042 T1525)', () => {
    // v0.1 shipped the mechanism with no content — a hook calling a command
    // EPIC-042 had not written would have failed the user's next run. v0.2
    // carries the content (contracts/extension-and-hooks.md §1); the
    // conformance test checks it, this asserts the halves match the version.
    const text = readFileSync(manifest, 'utf8');
    expect([...text.matchAll(/^\s+- name: "speckit\.pmi\.(begin|finish|progress)"/gm)]).toHaveLength(3);
    expect([...text.matchAll(/^  (before|after)_[a-z]+: \{ command: "speckit\.pmi\.(begin|finish)", optional: false/gm)]).toHaveLength(18);
  });
});

describe('T1316 · skillsPathFor is configuration, and refuses rather than guesses (FR-LPW-006)', () => {
  it('maps claude to .claude/skills', () => {
    expect(skillsPathFor('claude')).toEqual({ ok: true, path: '.claude/skills' });
  });

  it('returns a typed refusal for an integration with no row', () => {
    const r = skillsPathFor('copilot');
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toMatch(/copilot/);
  });

  it('has a row for every integration it claims to support, and no default', () => {
    expect(Object.keys(SKILLS_PATH_BY_INTEGRATION)).toEqual(['claude']);
    // A '*' or 'default' key would be the silent fallback the requirement forbids.
    expect(SKILLS_PATH_BY_INTEGRATION).not.toHaveProperty('*');
    expect(SKILLS_PATH_BY_INTEGRATION).not.toHaveProperty('default');
  });
});

describe("DEFAULT_AGENT_INTEGRATION (FR-LPW-006)", () => {
  it("is an integration this bundle can place a skill for — the API never names one", () => {
    expect(skillsPathFor(DEFAULT_AGENT_INTEGRATION)).toMatchObject({ ok: true });
  });
});

describe('T1525 · bundle 0.2.0 carries the content (EPIC-042)', () => {
  it('the skills half is the full ten-step skill, not the hand-off', () => {
    const text = readFileSync(join(skillsDir(), 'setup-PMIStudio', 'SKILL.md'), 'utf8');
    expect(text).not.toMatch(/hand-off half/);
    expect([...text.matchAll(/^(\d+)\. \*\*/gm)]).toHaveLength(11);
    expect(text).toMatch(/bundle-version:\s*"?0\.2\.0"?/);
  });

  it('the extension half carries three commands and eighteen mandatory hooks, and the registry fragment', () => {
    for (const command of ['begin', 'finish', 'progress']) expect(existsSync(join(extensionDir(), 'commands', `${command}.md`))).toBe(true);
    expect(existsSync(join(extensionDir(), 'extensions-fragment.yml'))).toBe(true);
    const manifest = readFileSync(join(extensionDir(), 'extension.yml'), 'utf8');
    expect([...manifest.matchAll(/^  (before|after)_[a-z]+: { command: "speckit.pmi.(begin|finish)", optional: false/gm)]).toHaveLength(18);
  });

  it('BUNDLE_VERSION is 0.2.0', () => {
    expect(BUNDLE_VERSION).toBe('0.2.0');
  });
});

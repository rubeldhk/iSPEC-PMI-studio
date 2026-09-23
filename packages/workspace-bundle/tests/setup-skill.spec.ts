/**
 * `T1523` (EPIC-042, `FR-EXT-030`–`FR-EXT-038`, `FR-EXT-004`, `SC-EXT-005`,
 * `contracts/setup-skill.md`) — the full setup skill, as text a machine checks:
 * frontmatter at the bundle version; the ten checks in the contract's order;
 * every install command preceded by *show*; no request for a credential value
 * and no credential shape; only the three `.mcp.json` servers with `${VAR}`
 * references; the six table states; installs only the toolkit, the extension
 * and configuration; the `requires.speckit_version` range check (analysis
 * `U1`); the drift rule on row 10.
 *
 * Mutation owed at closure (`SC-EXT-005`): add a line that prints the variable
 * and observe this fail. Written to FAIL before `T1524`.
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { BUNDLE_VERSION, skillsDir } from '../src/index.js';

const SKILL = join(skillsDir(), 'setup-PMIStudio', 'SKILL.md');
const text = readFileSync(SKILL, 'utf8').replace(/\r\n/g, '\n');
/** The same text with line wraps folded, for phrase checks a wrap must not defeat. */
const flat = text.replace(/\s+/g, ' ');
const steps =[...text.matchAll(/^(\d+)\. \*\*(.+?)\*\*/gm)].map((m) => ({ n: Number(m[1]), title: m[2] as string }));

describe('T1523 · frontmatter', () => {
  it('names setup-PMIStudio, is user-invocable, at the bundle version', () => {
    expect(text).toMatch(/^name:\s*"?setup-PMIStudio"?\s*$/m);
    expect(text).toMatch(/^user-invocable:\s*true\s*$/m);
    expect(text).toMatch(new RegExp(`^\\s*bundle-version:\\s*"?${BUNDLE_VERSION.replace(/\./g, '\\.')}"?\\s*$`, 'm'));
    expect(text).not.toMatch(/hand-off half/);
  });
});

describe('T1523 · the ten checks, in order (contracts/setup-skill.md §2)', () => {
  it('lists eleven numbered steps — ten checks and the table', () => {
    expect(steps.map((s) => s.n)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11]);
  });

  it.each([
    [1, /\.pmi\/project\.json/],
    [2, /`uv` on PATH/],
    [3, /toolkit at the pinned tag/i],
    [4, /`\.specify\/` initialised/],
    [5, /extension.*hooks.*stock skills.*toolkit range/i],
    [6, /PMI_STUDIO_TOKEN.*is set/],
    [7, /`\.mcp\.json` lists `pmi-studio`, `context7` and `github`/],
    [8, /Docker daemon/],
    [9, /Node ≥ 22/],
    [10, /`pmi\.health` succeeds/],
    [11, /The table/],
  ])('step %i is the documented check', (n, pattern) => {
    expect(steps.find((s) => s.n === n)?.title).toMatch(pattern);
  });

  it('row 5 checks the pinned tag against requires.speckit_version and reports refused naming both (FR-EXT-004)', () => {
    const step5 = text.slice(text.indexOf('5. **'), text.indexOf('6. **'));
    expect(step5).toContain('requires.speckit_version');
    expect(step5).toMatch(/refused.*naming the tag and the range/);
    expect(step5).toMatch(/never repair it/i);
  });

  it('row 10 computes the digest the way PMI Studio does and never writes over drift', () => {
    const step10 = text.slice(text.indexOf('10. **'), text.indexOf('11. **'));
    expect(step10).toContain('replaced by 64');
    expect(step10).toContain('constitutionDigest');
    expect(step10).toMatch(/drift.*do not write/);
  });
});

describe('T1523 · what it may and may not do', () => {
  it('shows every install command before running it, and installs only the toolkit, the extension and configuration', () => {
    for (const m of text.matchAll(/run\s+`(uv tool install|specify init)[^`]*`/g)) {
      const before = text.slice(Math.max(0, (m.index ?? 0) - 40), m.index);
      expect(before, `${m[0]} is not preceded by "show"`).toMatch(/\*\*show\*\*/i);
    }
    expect(text).toMatch(/do not run an installer/);
    expect(text).toMatch(/do not install it/);
    expect(flat).toMatch(/never modifies a system setting/i);
  });

  it('never asks for, prints or writes a credential value, and no credential shape appears', () => {
    expect(flat).toMatch(/never asks for the credential value and never prints it/);
    expect(text).not.toMatch(/paste (the|your) (token|credential)/i);
    expect(text).not.toMatch(/pmi_ct_[A-Za-z0-9]{8,}|sk-[A-Za-z0-9]{8,}|sk-ant-/);
    expect(text).not.toMatch(/echo \$PMI_STUDIO_TOKEN|Write-Output \$env:PMI_STUDIO_TOKEN|print\(.*PMI_STUDIO_TOKEN/);
    // The variable is named only as something to CHECK, export or reference — never to read out.
    for (const line of text.split('\n').filter((l) => l.includes('PMI_STUDIO_TOKEN'))) {
      expect(line).toMatch(/is set|in the environment|export|\$\{PMI_STUDIO_TOKEN\}|\$env:PMI_STUDIO_TOKEN = |set in this shell/);
    }
  });

  it('names only the three .mcp.json servers, each with ${VAR} references and never a value', () => {
    const step7 = text.slice(text.indexOf('7. **'), text.indexOf('8. **'));
    for (const server of ['pmi-studio', 'context7', 'github']) expect(step7).toContain(`\`${server}\``);
    expect(step7).toContain('${PMI_STUDIO_TOKEN}');
    expect(step7).toContain('${CONTEXT7_API_KEY}');
    expect(step7).toContain('${GITHUB_TOKEN}');
    expect(step7).toMatch(/never a value/);
    expect(step7.replace(/\s+/g, ' ')).toMatch(/does not parse, leave it exactly as it is/);
  });

  it('ends with the table on every run, with the six states', () => {
    expect(text).toMatch(/End with the table in step 11, even after stopping at step 1/);
    const step11 = text.slice(text.indexOf('11. **'));
    for (const state of ['ok', 'pending', 'missing', 'refused', 'unreachable', 'skipped']) expect(step11).toContain(`\`${state}\``);
  });

  it('is idempotent by statement and writes nothing outside the project directory', () => {
    expect(text).toMatch(/idempotent/);
    expect(flat).toMatch(/writes nothing outside this project directory/);
  });
});

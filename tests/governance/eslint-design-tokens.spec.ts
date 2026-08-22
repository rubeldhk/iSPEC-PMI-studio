/**
 * T876/T877 (EPIC-029) — the literal-value rule, proven able to see and to fail.
 *
 * `FR-DS-051` ("no literal visual values outside the token file") must be
 * enforced by something that fails a build, not by review (research R-029-5).
 * These tests drive the rule through the REPOSITORY'S OWN eslint.config.js —
 * not a hand-assembled config — so what is proven here is what `pnpm lint`
 * actually enforces. The dependency-boundary rule (T541) is the precedent.
 *
 * T877 is the mutation half: a fixture containing a literal MUST produce a
 * violation. The rule is itself a check, and a check that cannot fail is
 * decoration (Constitution V).
 */
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { ESLint } from 'eslint';
import { beforeAll, describe, expect, it } from 'vitest';
import rootConfig from '../../eslint.config.js';

const here = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(here, '../..');

const eslint = new ESLint({
  cwd: ROOT,
  overrideConfigFile: true,
  overrideConfig: rootConfig as never,
});

/** Lint text as if it were the named file, returning rule-error messages. */
async function lintAs(code: string, relativePath: string): Promise<string[]> {
  const [result] = await eslint.lintText(code, { filePath: join(ROOT, relativePath) });
  return (result?.messages ?? [])
    .filter((m) => m.severity === 2)
    .map((m) => `${m.ruleId ?? 'fatal'}: ${m.message}`);
}

const CSS_FIXTURE = 'frontend/src/design/components/__fixture__.css';
const TSX_FIXTURE = 'frontend/src/design/components/__Fixture__.tsx';

describe('T876 · the rule flags literal visual values in stylesheets', () => {
  it('flags a hex colour, naming the value', async () => {
    const messages = await lintAs('.x { color: #ff0000; }\n', CSS_FIXTURE);
    expect(messages.length).toBeGreaterThan(0);
    expect(messages.join('\n')).toContain('#ff0000');
  });

  it('flags rgb() and hsl()', async () => {
    const rgb = await lintAs('.x { color: rgb(255, 0, 0); }\n', CSS_FIXTURE);
    const hsl = await lintAs('.x { color: hsl(0, 100%, 50%); }\n', CSS_FIXTURE);
    expect(rgb.length).toBeGreaterThan(0);
    expect(hsl.length).toBeGreaterThan(0);
  });

  it('flags length units outside the allowlist', async () => {
    for (const bad of ['margin: 4px', 'padding: 0.5rem', 'width: 50%', 'height: 30vh']) {
      const messages = await lintAs(`.x { ${bad}; }\n`, CSS_FIXTURE);
      expect(messages.length, `'${bad}' should be flagged`).toBeGreaterThan(0);
    }
  });

  it('does not flag the allowlist: 0, 1px, 100%, 100vh, auto, currentColor', async () => {
    const css =
      '.x { margin: 0; border-width: 1px; width: 100%; min-height: 100vh; height: auto; color: currentColor; }\n';
    expect(await lintAs(css, CSS_FIXTURE)).toEqual([]);
  });

  it('does not flag token references', async () => {
    const css = '.x { padding: var(--space-3); color: var(--color-text); box-shadow: var(--elevation-1); }\n';
    expect(await lintAs(css, CSS_FIXTURE)).toEqual([]);
  });

  it('does not flag tokens.css or themes.css — the one home literals have', async () => {
    const literal = ':root { --color-text: #1a1d21; --space-3: 0.5625rem; }\n';
    expect(await lintAs(literal, 'frontend/src/design/tokens.css')).toEqual([]);
    expect(await lintAs(literal, 'frontend/src/design/themes.css')).toEqual([]);
  });
});

describe('T876 · the rule flags literal visual values in inline style props', () => {
  it('flags a hex colour in a style object', async () => {
    const messages = await lintAs(
      'export function F(): unknown { return <div style={{ color: "#ff0000" }} />; }\n',
      TSX_FIXTURE,
    );
    expect(messages.length).toBeGreaterThan(0);
    expect(messages.join('\n')).toContain('#ff0000');
  });

  it('flags a numeric length (React numbers are px)', async () => {
    const messages = await lintAs(
      'export function F(): unknown { return <div style={{ padding: 12 }} />; }\n',
      TSX_FIXTURE,
    );
    expect(messages.length).toBeGreaterThan(0);
  });

  it('does not flag 0, 1, or token references in a style object', async () => {
    const messages = await lintAs(
      'export function F(): unknown { return <div style={{ margin: 0, borderWidth: 1, padding: "var(--space-3)" }} />; }\n',
      TSX_FIXTURE,
    );
    expect(messages).toEqual([]);
  });
});

describe('T877 · MUTATION — the rule can fail, on the exact quickstart V2 case', () => {
  // Quickstart V2: "adding `color: #ff0000` to any component makes it fail,
  // naming the file and the value." A rule that passes on this is decoration.
  it('a component stylesheet with color: #ff0000 produces a violation', async () => {
    const messages = await lintAs('.button { color: #ff0000; }\n', CSS_FIXTURE);
    expect(messages.length).toBeGreaterThan(0);
    expect(messages.join('\n')).toContain('#ff0000');
  });

  it('the violation is an error, so `pnpm lint` exits non-zero on it', async () => {
    const [result] = await eslint.lintText('.button { color: #ff0000; }\n', {
      filePath: join(ROOT, CSS_FIXTURE),
    });
    expect(result?.errorCount ?? 0).toBeGreaterThan(0);
  });
});

describe('the rule is actually wired into the repo config', () => {
  beforeAll(() => {
    // Belt and braces: if the config stops registering the rule for the
    // frontend, every test above would "pass" vacuously with zero messages on
    // the negative cases and fail on the positive — this names the real cause.
  });

  it('eslint.config.js applies design/no-literal-visual-values to frontend sources', async () => {
    const config = await eslint.calculateConfigForFile(join(ROOT, TSX_FIXTURE));
    const rules = (config as { rules?: Record<string, unknown> }).rules ?? {};
    expect(Object.keys(rules)).toContain('design/no-literal-visual-values');
  });
});

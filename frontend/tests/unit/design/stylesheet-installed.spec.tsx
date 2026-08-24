/**
 * T866a (EPIC-029) — the stylesheet import is asserted, not assumed.
 *
 * Every component test in this Epic renders in isolation, so none of them can
 * notice that `main.tsx` stopped importing the stylesheets — the sixth
 * built-tested-called-by-nothing in this programme if left unchecked
 * (analysis `D1`). `T662`'s `main.ts` source assertion is the precedent.
 *
 * This is a SOURCE assertion: it proves the import line exists. Whether the
 * composed application actually renders styled is `app-root.spec.tsx` (T899a),
 * which mounts the tree rather than reading it — Constitution XI Tier 1.
 */
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const here = dirname(fileURLToPath(import.meta.url));
const mainTsx = readFileSync(join(here, '../../../src/main.tsx'), 'utf8');

describe('T866a — main.tsx installs the design system stylesheets', () => {
  it("imports './design/tokens.css'", () => {
    expect(mainTsx).toMatch(/import\s+['"]\.\/design\/tokens\.css['"]/);
  });

  it("imports './design/themes.css'", () => {
    expect(mainTsx).toMatch(/import\s+['"]\.\/design\/themes\.css['"]/);
  });
});

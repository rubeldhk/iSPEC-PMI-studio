/**
 * EPIC-029 T900c — type surface for importing the flat config from TypeScript
 * tests (token-sufficiency.spec.tsx, eslint-design-tokens.spec.ts), which
 * drive the repository's OWN config through the ESLint API rather than a
 * hand-assembled copy of it.
 */
import type { Linter } from 'eslint';

declare const config: Linter.Config[];
export default config;

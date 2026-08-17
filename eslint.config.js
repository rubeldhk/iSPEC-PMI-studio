import tseslint from '@typescript-eslint/eslint-plugin';
import tsparser from '@typescript-eslint/parser';

/**
 * T008 — lint plus the dependency-boundary rules.
 *
 * Two boundaries are enforced here, and again by the architecture test (T047,
 * T142a) so a violation fails the BUILD, not just the editor:
 *
 *   backend/**  ->  engine-adapters/**   FORBIDDEN  (FR-017, ADR-0001)
 *   **.service.ts -> @nestjs/common etc. FORBIDDEN  (PC-1, PP-007 deferral)
 */
export default [
  {
    ignores: [
      '**/node_modules/**',
      '**/dist/**',
      '**/build/**',
      '**/coverage/**',
      '**/*.min.js',
      'specs/**',
      'SRS/**',
    ],
  },
  {
    files: ['**/*.ts', '**/*.tsx'],
    languageOptions: {
      parser: tsparser,
      parserOptions: { ecmaVersion: 2023, sourceType: 'module' },
    },
    plugins: { '@typescript-eslint': tseslint },
    rules: {
      '@typescript-eslint/no-unused-vars': [
        'error',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_', ignoreRestSiblings: true },
      ],
    },
  },
  {
    // FR-017 / ADR-0001: the API never holds a reference to a concrete engine.
    // Adapters are supplied at the WORKER's composition root.
    files: ['backend/**/*.ts'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: ['@pmi/engine-adapter-*', '**/engine-adapters/*'],
              message:
                'backend/ must not import an engine adapter. Depend on @pmi/engine-contract only (FR-017, ADR-0001).',
            },
            {
              group: ['@pmi/agent-adapter-*', '**/agent-adapters/*'],
              message:
                'backend/ must not import an agent adapter. Depend on @pmi/agent-contract only — Native §3 forbids merging the specification engine with the AI agent (FR-AGT-004).',
            },
            {
              group: ['@pmi/execution-provider-*', '**/execution-providers/*'],
              message:
                'backend/ must not import an execution provider. Depend on @pmi/execution-contract only — Native §4 forbids business logic depending directly on Docker (FR-AGT-009).',
            },
          ],
        },
      ],
    },
  },
  {
    // The ONE exception, and it is one FILE — not a directory (EPIC-003 T137).
    //
    // `engine-swap.spec.ts` is the acceptance test for SC-008: it proves the
    // platform is not tied to Spec Kit by driving the same caller against two
    // engines. It cannot be written without touching both, and a test that
    // proves engine-independence is the opposite of a breach of it.
    //
    // Scoped to the single file deliberately. Widening this to
    // `backend/tests/**` would let any future test import an adapter for
    // convenience, which is exactly how RAID R-05 ("engine independence erodes
    // under delivery pressure") plays out. The production boundary is
    // unaffected and still enforced twice: by the rule above for
    // `backend/src/**`, and by tests/architecture/engine-independence.spec.ts.
    files: [
      'backend/tests/integration/engine-swap.spec.ts',
      // T561 — the same exception, for the same reason, on the agent axis.
      // `agent-swap.spec.ts` is the acceptance test for SC-AGT-002: it drives
      // one agent-agnostic caller against two adapters and cannot be written
      // without touching both. Scoped to the single FILE, deliberately —
      // widening it to `backend/tests/**` is how RAID R-05 plays out.
      'backend/tests/integration/agent-swap.spec.ts',
    ],
    rules: {
      'no-restricted-imports': 'off',
    },
  },
  {
    // PC-1: services stay callable without HTTP so an MCP transport can be
    // added in Phase 3 without redesign.
    files: ['backend/src/**/*.service.ts', 'backend/src/core/**/*.ts'],
    ignores: ['backend/src/core/*.filter.ts', 'backend/src/core/*.guard.ts'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          paths: [
            {
              name: '@nestjs/common',
              message:
                'Services must not import HTTP types. Keep business logic transport-free (PC-1).',
            },
            {
              name: 'express',
              message: 'Services must not import HTTP types (PC-1).',
            },
          ],
        },
      ],
    },
  },
];

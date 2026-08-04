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
          ],
        },
      ],
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

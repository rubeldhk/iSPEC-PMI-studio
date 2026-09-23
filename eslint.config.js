import tseslint from '@typescript-eslint/eslint-plugin';
import tsparser from '@typescript-eslint/parser';
import design from './eslint-rules/design-tokens.mjs';

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
            {
              // EPIC-041 T1323 (R-041-6): the worker → backend edge exists and
              // points ONE way. backend/ never imports the worker.
              group: ['@pmi/worker', '**/worker/*'],
              message:
                'backend/ must not import the worker. The one permitted edge is worker → @pmi/backend/worker-api (EPIC-041 R-041-6), never the reverse.',
            },
          ],
        },
      ],
    },
  },
  {
    // EPIC-041 T1323 (R-041-6) — the ONE permitted edge from the worker into the
    // backend, two exports wide. `worker/src/main.ts` runs the API's own commit
    // through `@pmi/backend/worker-api` so a generation it completes is
    // persisted by the same code the API uses (FR-LPW-040). Every other
    // backend path stays forbidden: a worker that could import anything from
    // the backend would erode the service/transport separation T142a protects.
    // Asserted by tests/governance/eslint-boundaries.spec.ts (T1322).
    files: ['worker/**/*.ts'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: ['@pmi/backend/*', '**/backend/*', '!@pmi/backend/worker-api'],
              message:
                'worker/ may import only @pmi/backend/worker-api — the two-export barrel (EPIC-041 R-041-6). Nothing else in backend/ is the worker\'s to reach.',
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
      // EPIC-041 T1383 — the same exception, for the same reason, on the
      // API-to-worker axis. The route-through proof drives a real BullMQ
      // consumer running the API's own commit against the fixture engine, and
      // cannot be written without an engine on the worker's side of the
      // queue. Scoped to the single FILE, deliberately.
      'backend/tests/integration/generation-persists-through-route.spec.ts',
      // T572 (EPIC-023) — the same exception, for the same reason, on the
      // default-engine axis. `engine-default.spec.ts` proves engine → agent →
      // environment composes end to end, which cannot be written without
      // the worker's three composition roots. It predates the EPIC-041 rule
      // and was the one file the rule caught that no exception named.
      // Scoped to the single FILE, deliberately.
      'backend/tests/integration/engine-default.spec.ts',
    ],
    rules: {
      'no-restricted-imports': 'off',
    },
  },
  {
    // EPIC-043 T1401 (R-043-1) — the pmi-studio server is a REST client of the
    // platform and runs on the user's machine. It never reaches the backend, a
    // store, Prisma or an adapter in-process; if it could, parity between the
    // REST and MCP bindings would be discipline rather than structure.
    // Asserted by backend/tests/architecture/mcp-server-boundary.spec.ts (T1400).
    files: ['packages/mcp-server/**/*.ts'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: ['@pmi/backend', '@pmi/backend/*', '@pmi/worker', '@pmi/worker/*', '@prisma/client', '**/persistence/*', '**/engine-adapters/*', '**/execution-providers/*', '**/*.store', '**/*.store.js'],
              message:
                'packages/mcp-server is a REST client of the platform (EPIC-043 R-043-1). It may import only the SDK, zod, node built-ins and the two contract packages.',
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
  // ------------------------------------------------------------------------
  // EPIC-029 T878 — no literal visual value outside the token file
  // (FR-DS-051, research R-029-5). The rule and its CSS processor live in
  // eslint-rules/design-tokens.mjs; the mutation test proving the rule can
  // fail is tests/governance/eslint-design-tokens.spec.ts (T876/T877), the
  // dependency-boundary precedent (T541) applied to visual values.
  // ------------------------------------------------------------------------
  {
    // Stylesheets: the processor wraps CSS so the rule can read it. The two
    // token files are the ONE home literals have and are exempt by design.
    files: ['frontend/src/**/*.css'],
    ignores: ['frontend/src/design/tokens.css', 'frontend/src/design/themes.css'],
    plugins: { design },
    processor: 'design/css',
  },
  {
    // The virtual blocks the processor emits from those stylesheets.
    files: ['frontend/src/**/*.css/*.js'],
    plugins: { design },
    rules: { 'design/no-literal-visual-values': 'error' },
  },
  {
    // Inline style= props in application sources.
    files: ['frontend/src/**/*.ts', 'frontend/src/**/*.tsx'],
    plugins: { design },
    rules: { 'design/no-literal-visual-values': 'error' },
  },
];

import { defineWorkspace } from 'vitest/config';

/**
 * T007 — Vitest across all packages.
 *
 * Projects are split so `test:unit`, `test:contract`, `test:integration`, and
 * `test:arch` can run independently. CI runs unit + arch + contract on every
 * commit; integration needs Docker services; the real engine runs nightly only
 * (research R-010).
 */
export default defineWorkspace([
  {
    test: {
      name: 'backend-unit',
      root: './backend',
      include: ['tests/unit/**/*.spec.ts'],
      environment: 'node',
    },
  },
  {
    test: {
      name: 'backend-contract',
      root: './backend',
      include: ['tests/contract/**/*.spec.ts'],
      environment: 'node',
      // Legitimately empty until the held product-surface epics land: every
      // contract test belongs to an epic blocked on PMI-DOC-004 (decision
      // D-10). The step stays wired so it activates the moment the first one
      // appears. NOT set on unit or architecture — an empty suite there would
      // be a real alarm, not an expected state.
      passWithNoTests: true,
    },
  },
  {
    test: {
      name: 'backend-integration',
      root: './backend',
      include: ['tests/integration/**/*.spec.ts'],
      environment: 'node',
      // Empty until T052 lands (needs a generated Prisma client + migrations).
      passWithNoTests: true,
    },
  },
  {
    test: {
      name: 'architecture',
      root: './backend',
      include: ['tests/architecture/**/*.spec.ts'],
      environment: 'node',
    },
  },
  {
    test: {
      name: 'worker-unit',
      root: './worker',
      include: ['tests/unit/**/*.spec.ts'],
      environment: 'node',
    },
  },
  {
    test: {
      name: 'engine-contract',
      root: './packages/engine-contract',
      include: ['tests/**/*.spec.ts'],
      environment: 'node',
    },
  },
  {
    // T661 — observability moved out of `backend/` so both processes can install
    // it (DEF-001-001). Registered here AND in the `test:unit` script; a project
    // that exists in only one of the two runs in `pnpm test` and silently not in
    // CI, which is the gap EPIC-028 T539 names.
    test: {
      name: 'observability',
      root: './packages/observability',
      include: ['tests/**/*.spec.ts'],
      environment: 'node',
    },
  },
  {
    test: {
      name: 'fixture-adapter',
      root: './engine-adapters/fixture',
      include: ['tests/**/*.spec.ts'],
      environment: 'node',
    },
  },
  {
    test: {
      name: 'speckit-adapter',
      root: './engine-adapters/speckit',
      include: ['tests/**/*.spec.ts'],
      environment: 'node',
    },
  },
  {
    test: {
      name: 'execution-contract',
      root: './packages/execution-contract',
      include: ['tests/**/*.spec.ts'],
      environment: 'node',
    },
  },
  {
    test: {
      name: 'agent-contract',
      root: './packages/agent-contract',
      include: ['tests/**/*.spec.ts'],
      environment: 'node',
    },
  },
  {
    test: {
      name: 'agent-adapters',
      root: './agent-adapters',
      include: ['**/tests/**/*.spec.ts'],
      environment: 'node',
    },
  },
  {
    test: {
      name: 'execution-providers',
      root: './execution-providers',
      include: ['**/tests/**/*.spec.ts'],
      environment: 'node',
    },
  },
  {
    test: {
      name: 'governance',
      root: '.',
      include: ['tests/governance/**/*.spec.ts'],
      environment: 'node',
    },
  },
]);

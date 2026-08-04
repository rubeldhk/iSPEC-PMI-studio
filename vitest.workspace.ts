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
    },
  },
  {
    test: {
      name: 'backend-integration',
      root: './backend',
      include: ['tests/integration/**/*.spec.ts'],
      environment: 'node',
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
]);

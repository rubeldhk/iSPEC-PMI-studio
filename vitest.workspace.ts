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
      // `passWithNoTests` was set here while this directory was empty, waiting on
      // T052. T052 landed, five files live here, and EPIC-003 T688 / EPIC-004 T689
      // put them in CI — so the tolerance now protects nothing and hides something:
      // if this glob ever stops matching, the CI step would go green having run no
      // test at all. That is exactly how "two Vitest projects passed with no test
      // files" happened in EPIC-003, recorded in `epic-stage/harness.spec.ts`.
      // Vitest exits non-zero on an empty run, which is the anti-vacuity guard.
      //
      // **Container-suite timeouts (C2D).** Every file here starts its own
      // PostgreSQL container and several boot the whole `AppModule`. Setup
      // hooks already carry explicit timeouts; **teardown hooks do not**, so
      // `afterAll`'s `container.stop()` inherits vitest's 10s default and dies
      // under load — reported as a failed suite, which reads exactly like
      // broken code.
      //
      // That is what was actually happening. Two earlier attempts capped
      // parallelism instead, on the assumption that the host was exhausted;
      // the second made it worse, which is what finally produced the timeout
      // evidence rather than another guess.
      hookTimeout: 180_000,
      testTimeout: 120_000,
      // **Serialised.** Capping workers was not enough: with four in flight —
      // plus the other projects running alongside — Docker itself starved, and
      // a hook that should take seconds exceeded even a 180s timeout. Each file
      // here owns a database and several own a whole application; running them
      // one at a time is the correct configuration for that, not a workaround
      // for flakiness.
      //
      // It costs wall-clock. The alternative is a suite whose result depends on
      // what else the host happens to be doing, which is not a result.
      fileParallelism: false,
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
    // EPIC-025 T431 — the storage fixture adapter and its conformance run.
    // Registered the moment the first spec exists, per the T537/T539 rule.
    test: {
      name: 'storage-adapters',
      root: './packages/storage-adapters',
      include: ['**/tests/**/*.spec.ts'],
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
      // EPIC-037's governed execution registry. Separate from
      // `execution-contract` above, which is EPIC-028's *execution environment*
      // — where code runs, not how governed executions are recorded.
      name: 'execution-registry-contract',
      root: './packages/execution-registry-contract',
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
    // EPIC-033 T337c — the SHARED Room pattern, imported by EPIC-034 and
    // EPIC-035. No `passWithNoTests`: TS-005 makes an empty suite a failure, and
    // an empty suite here would mean the six-region guarantee three Rooms depend
    // on is asserted by nothing.
    test: {
      name: 'room-contract',
      root: './packages/room-contract',
      include: ['tests/**/*.spec.ts'],
      environment: 'node',
    },
  },
  {
    // EPIC-030 T915 — the fifth contract package. No `passWithNoTests`: TS-005
    // makes an empty suite a failure, and this project is registered in the same
    // change as the first spec that fills it (the T537/T539 rule).
    test: {
      name: 'loop-contract',
      root: './packages/loop-contract',
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
    // T576a — the manual runner is application code (Constitution V), and
    // `scripts/` is not on Constitution I's exempt list. Its logic is testable
    // without a daemon; only T646b's execution is not.
    test: {
      name: 'scripts',
      root: './scripts',
      include: ['tests/**/*.spec.mjs'],
      environment: 'node',
    },
  },
  {
    // EPIC-005 T056a — the first frontend tests. The product-surface epics were
    // held on PMI-DOC-004 until 2026-08-20; this project registers the moment
    // the first component test exists, per the T537/T539 rule that a project is
    // added only once it collects something.
    test: {
      name: 'frontend',
      root: './frontend',
      include: ['tests/unit/**/*.spec.{ts,tsx}'],
      environment: 'jsdom',
      // EPIC-029 T867/T899a — process CSS imports so the app-root reachability
      // test can assert the token stylesheets actually reach the document.
      // Without this, `import './design/tokens.css'` is stubbed to an empty
      // module and no test can tell a present stylesheet from a missing one.
      css: true,
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
  {
    // EPIC-041 T1317 — the workspace bundle: the setup skill and the PMI Spec
    // Kit extension, versioned together (R-041-9). Registered in the same
    // change as its first spec, per the T537/T539 rule. No `passWithNoTests`.
    test: {
      name: 'workspace-bundle',
      root: './packages/workspace-bundle',
      include: ['tests/**/*.spec.ts'],
      environment: 'node',
    },
  },
  {
    // EPIC-044 T1550 — the shared stage derivation (R-06): the configuration
    // document, the contiguity rule, readiness and the two evidence adapters the
    // governance register and the product board both import. No `passWithNoTests`.
    test: {
      name: 'epic-stage',
      root: './packages/epic-stage',
      include: ['tests/**/*.spec.ts'],
      environment: 'node',
    },
  },
  {
    // EPIC-043 T1399 — the pmi-studio server: driven through InMemoryTransport by
    // a real Client; the fixture conformance suite runs against it (R-037-10).
    test: {
      name: 'mcp-server',
      root: './packages/mcp-server',
      include: ['tests/**/*.spec.ts'],
      environment: 'node',
    },
  },
]);

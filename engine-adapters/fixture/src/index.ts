/**
 * Package entry point.
 *
 * The adapter itself lives in `fixture.adapter.ts` — the path T037 named, and
 * the path this file existed under until EPIC-003 convergence found the drift
 * (T465). Keeping a thin entry point means the package's public import
 * (`@pmi/engine-adapter-fixture`) is unchanged by that move.
 */
export {
  FixtureEngine,
  FIXTURE_INPUT_CEILING,
  type FixtureOptions,
} from './fixture.adapter.js';

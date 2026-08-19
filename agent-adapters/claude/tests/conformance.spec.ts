/**
 * T565 — `ClaudeAgent` against the shared conformance suite.
 *
 * The same fourteen cases the fixture runs. That is the point: a conformance
 * suite that only ever runs against the adapter it was written beside proves
 * nothing about the contract, and extracting it here is what exposed
 * DEF-028-001 — `FixtureAgent` hung forever on a genuinely hanging session
 * because C2 was driven by a constructor flag.
 *
 * No network call and no container: the suite drives everything through the
 * injected `ExecutionSession`, which is the seam that makes this adapter
 * testable at all.
 */
import { runAgentConformanceSuite } from '@pmi/agent-contract/conformance';
import { ClaudeAgent, invocationFor } from '../src/index.js';

runAgentConformanceSuite({
  name: 'claude',
  create: (descriptor) => new ClaudeAgent(descriptor ? { descriptor } : {}),
  expectedSessionCommand: (command) => invocationFor(command),
});

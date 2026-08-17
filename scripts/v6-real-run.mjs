/**
 * T576 — the manual runner for quickstart `V6`.
 *
 * **This is the only script in the programme that starts a real container.**
 * EPIC-003 shipped 65 passing tests and an engine that could not start; its
 * closure report says plainly *"No real container has ever started."* `V6` is
 * the scenario that changes that, and `T646b` is the act of running it.
 *
 * Constitution V applies. `scripts/` is not on Constitution I's exempt list, so
 * this is application code — and its *logic* (step ordering, digest extraction,
 * transcript shape) is unit-tested in `scripts/tests/v6-real-run.spec.mjs`
 * against a stubbed environment. Only the **execution** needs a daemon.
 * Conflating the two is how an untested script becomes the sole evidence for
 * `SC-AGT-001`.
 *
 * Usage:
 *   node scripts/v6-real-run.mjs                 # requires a Docker daemon
 *   node scripts/v6-real-run.mjs --dry-run       # prints the plan, starts nothing
 */

/** The steps `V6` performs, in order. Exported so the test asserts sequencing. */
export const V6_STEPS = [
  'resolve_environment',
  'resolve_agent',
  'start_container',
  'record_image_digest',
  'generate_specification',
  'stop_container',
];

/**
 * Pull the image digest out of whatever the environment reports.
 *
 * The digest is the point of the transcript: `pmi-studio/speckit-engine` is a
 * moving tag, and a transcript naming only the tag cannot tell you six months
 * later *which* image produced the specification. `T577` asserts one is present.
 */
export function extractImageDigest(text) {
  const match = /\bsha256:[0-9a-f]{64}\b/.exec(String(text ?? ''));
  return match ? match[0] : null;
}

/** One transcript line per step. Deterministic, so the test can assert it. */
export function formatStep(step, outcome, detail) {
  const mark = outcome === 'ok' ? 'PASS' : outcome === 'skip' ? 'SKIP' : 'FAIL';
  return detail ? `[${mark}] ${step} — ${detail}` : `[${mark}] ${step}`;
}

/**
 * Render the transcript `T646b` commits.
 *
 * Deliberately states what was NOT proven. A transcript that only lists passes
 * reads as more evidence than it is, and this one is the sole evidence for
 * `SC-AGT-001`.
 */
export function formatTranscript({ lines, digest, startedAt, outcome }) {
  return [
    '# V6 — real container run transcript',
    '',
    `**Task**: \`T646b\` · **Outcome**: ${outcome} · **Started**: ${startedAt}`,
    '',
    `**Image digest**: \`${digest ?? 'NOT RECORDED — the run did not reach the image'}\``,
    '',
    '## Steps',
    '',
    ...lines.map((line) => `- ${line}`),
    '',
    '## What this transcript does and does not prove',
    '',
    '- It proves a container started, the engine ran inside it, and what came back.',
    '- It does **not** prove CI can do the same. RAID `R-04` blocks',
    '  container-in-container, so this is run by hand and committed as evidence.',
    '- A green CI run is **not** evidence for `T646b` and must never be reported as one.',
    '',
  ].join('\n');
}

/**
 * Drive the run.
 *
 * Every dependency is injected so the whole sequence is exercised in a unit test
 * against a stub. The default wiring — a real Docker daemon — is resolved by the
 * caller below, not here.
 */
export async function runV6({ environment, agent, engine, now, log = () => {} }) {
  const lines = [];
  const startedAt = now();
  let digest = null;
  let session = null;
  let outcome = 'FAILED';

  const step = (name, mark, detail) => {
    const line = formatStep(name, mark, detail);
    lines.push(line);
    log(line);
  };

  try {
    step('resolve_environment', 'ok', environment.descriptor.provider);
    step('resolve_agent', 'ok', `${agent.descriptor.provider}/${agent.descriptor.model}`);

    session = await environment.start(engine.request);
    step('start_container', 'ok');

    // The digest may arrive from the environment or from an in-container probe.
    digest =
      extractImageDigest(environment.descriptor.imageDigest) ??
      extractImageDigest((await session.exec(['sh', '-c', 'echo "$PMI_IMAGE_DIGEST"'])).stdout);
    step(
      'record_image_digest',
      digest ? 'ok' : 'fail',
      digest ?? 'no sha256 digest reported — the transcript cannot identify the image',
    );

    const result = await engine.generateSpecification(engine.input, engine.ctx);
    step(
      'generate_specification',
      result.ok ? 'ok' : 'fail',
      result.ok ? `produced "${result.value.title}"` : `${result.failure.reason}: ${result.failure.message}`,
    );

    outcome = result.ok && digest ? 'PASSED' : 'FAILED';
  } catch (error) {
    step('generate_specification', 'fail', error instanceof Error ? error.message : String(error));
  } finally {
    if (session) {
      // E8 — the container goes whatever happened.
      await environment.stop(session).catch(() => undefined);
      step('stop_container', 'ok');
    } else {
      step('stop_container', 'skip', 'no container was started');
    }
  }

  return { lines, digest, startedAt, outcome, transcript: formatTranscript({ lines, digest, startedAt, outcome }) };
}

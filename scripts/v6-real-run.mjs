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
  'probe_refused_destination',
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
/**
 * T698 / DEF-028-013 — the operator-facing half of a failure.
 *
 * `agentFail` and `engineFail` carry a `diagnostics` field holding the agent's
 * stderr, and the runner printed only `reason: message`. So every failing run
 * said WHAT failed and never WHY, and three separate causes in one day —
 * an unreadable credential, a retired model, a read-only HOME — each had to be
 * reproduced by hand against the image to be named.
 *
 * Redacted, because stderr carries whatever the command line and environment
 * held, which on this adapter includes a provider token (PC-3). Printed to the
 * CONSOLE and deliberately never written to the transcript: the transcript is
 * committed as evidence, so a redaction bug there is a credential in git
 * history, while the same bug on a terminal is a line that scrolls away. Only
 * one of those is recoverable.
 */
export function redactDiagnostics(text) {
  if (!text) return '';
  return String(text)
    .replace(/\bsk-[A-Za-z0-9_-]{8,}/g, 'sk-[redacted]')
    .replace(/\bBearer\s+[A-Za-z0-9._-]{8,}/gi, 'Bearer [redacted]')
    .replace(/\b(AI_PROVIDER_TOKEN|DATABASE_URL|SESSION_SECRET|JWT_SECRET)\s*=\s*\S+/gi, '$1=[redacted]')
    .replace(/\b(password|token|secret|apikey|api_key)\s*[=:]\s*\S+/gi, '$1=[redacted]');
}

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
    // T710 / D-28 — stated only on a PASSED run, and it is a derivation, not
    // an assertion: since T706 the provider REFUSES to start on a non-internal
    // network or one missing its sidecar (DEF-028-015), so a container that
    // started is itself the evidence the shape conformed. The refused probe in
    // the steps above is the other half: the allowlist permits nothing more.
    ...(outcome === 'PASSED'
      ? [
          '## Egress enforcement (D-28)',
          '',
          '- The run rode `pmi-egress-generation`, which the provider verified **internal** with',
          '  the proxy sidecar `pmi-egress-proxy-generation` attached — the preflight refuses to',
          '  start otherwise (`DEF-028-015`), so the started container is the proof of shape.',
          '- The agent reached `api.anthropic.com` only through the sidecar, whose whitelist is',
          '  generated from the profile; the refused probe above shows there was no other way out.',
          '',
        ]
      : []),
    '## What this transcript does and does not prove',
    '',
    ...provenBy(lines),
    '- It does **not** prove CI can do the same. RAID `R-04` blocks',
    '  container-in-container, so this is run by hand and committed as evidence.',
    '- A green CI run is **not** evidence for `T646b` and must never be reported as one.',
    '',
  ].join('\n');
}

/**
 * What this particular run proves — derived from the steps, never asserted.
 *
 * The original wording was fixed text: *"It proves a container started, the
 * engine ran inside it, and what came back."* On the first real run the engine
 * refused before starting, so that sentence would have claimed something that
 * did not happen — in the one document that is the sole evidence for
 * `SC-AGT-001`. A transcript that overstates is worse than no transcript,
 * because it reads as evidence.
 */
export function provenBy(lines) {
  const passed = (step) => lines.some((line) => line.startsWith(`[PASS] ${step}`));
  const proven = [];

  proven.push(
    passed('start_container')
      ? '- It proves a **real container started** on a real daemon.'
      : '- It does **not** prove a container started — the run failed before that.',
  );

  if (passed('record_image_digest')) {
    proven.push('- It identifies **which image** ran, by digest, rather than by a moving tag.');
  }

  proven.push(
    passed('generate_specification')
      ? '- It proves the engine ran **inside that container** and produced a specification.'
      : '- It does **not** prove a specification was generated. The engine did not complete, so ' +
          '`SC-AGT-001` is **NOT** satisfied by this run — see the failing step above for where it stopped.',
  );

  return proven;
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

    // DEF-028-010 — the session first: the provider is the only component that
    // knows which image the daemon actually resolved. The other two sources are
    // kept because a future provider may legitimately know its digest up front,
    // but neither was ever populated here, which is how `T577`'s requirement
    // came to have no source at all.
    digest =
      extractImageDigest(session.imageDigest) ??
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

    // T698 — the diagnostics go to the operator, never to the committed transcript.
    if (!result.ok) {
      const why = redactDiagnostics(result.failure.diagnostics);
      console.log(why ? ['', '  diagnostics (redacted):', why, ''].join('\n') : '');
      if (!why) console.log('  no diagnostics were carried with this failure.');
    }

    // T709 / T710 (D-28) — reachability alone is half the control. The agent
    // reaching api.anthropic.com proves the allowlist permits enough; only a
    // REFUSED probe of something else proves it permits nothing more. On the
    // enforced shape (internal network, proxy sidecar) a direct fetch has no
    // route out and fails; on a bridge network it succeeds — which is exactly
    // the run that must not read as enforced (DEF-028-015). Node is in the
    // engine image by pin (NODE_MAJOR), so the probe assumes no other tool.
    const probe = await session.exec([
      'node',
      '-e',
      "fetch('https://example.com',{signal:AbortSignal.timeout(5000)}).then(()=>process.exit(0),()=>process.exit(7))",
    ]);
    const probeRefused = probe.exitCode !== 0;
    step(
      'probe_refused_destination',
      probeRefused ? 'ok' : 'fail',
      probeRefused
        ? 'probe of https://example.com was refused — no direct route out; the profile is enforced (D-28)'
        : 'probe of https://example.com was REACHED — the network permits general egress and the profile is NOT enforced (DEF-028-015)',
    );

    outcome = result.ok && digest && probeRefused ? 'PASSED' : 'FAILED';
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

/**
 * DEF-028-005 — the entry point that makes `T646b` a thing you can do.
 *
 * `runV6` above was tested and **never called**. `T576a` supplies the
 * dependencies itself, so no test could notice that nothing in the repository
 * composed the real ones: `node scripts/v6-real-run.mjs` exited 0 having done
 * nothing at all, for the entire period the epic reported the runner as built.
 *
 * The composition happens HERE and nowhere else. `runV6` is untouched, so every
 * `T576a` assertion still applies to the path the real run takes — which is the
 * whole reason the split exists.
 *
 * Dependencies come from `worker/src/*-composition.ts`, the real composition
 * root, rather than being re-assembled locally. A runner that wires its own
 * objects would prove that *a* container can start; this proves that the
 * container **the worker would start** starts.
 *
 * Usage:
 *   pnpm v6:real-run              # requires a Docker daemon
 *   pnpm v6:real-run --dry-run    # prints the plan, starts nothing
 */

/** The one requirement `V6` generates from. Small on purpose: this is a smoke test of the seam, not of the model. */
export const V6_INPUT = Object.freeze({
  projectName: 'Apollo',
  requirements: [
    Object.freeze({
      reference: 'FR-001',
      description:
        'A signed-in user can select requirements and generate a specification from them.',
      type: 'functional',
      priority: 'p1',
    }),
  ],
});

async function main(argv) {
  const dryRun = argv.includes('--dry-run');
  const { randomUUID } = await import('node:crypto');
  const { writeFile, mkdtemp } = await import('node:fs/promises');
  const { tmpdir } = await import('node:os');
  const { join, dirname, resolve } = await import('node:path');
  const { fileURLToPath } = await import('node:url');

  const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
  const transcriptPath = join(root, 'specs/028-agent-execution-seam/v6-transcript.md');

  const [{ composeExecutionRegistry }, { composeAgentRegistry }, { composeEngineRegistry }] =
    await Promise.all([
      import('../worker/src/execution-composition.ts'),
      import('../worker/src/agent-composition.ts'),
      import('../worker/src/engine-composition.ts'),
    ]);
  const { GENERATION_EGRESS_PROFILE } = await import('../packages/execution-contract/src/index.ts');
  const { DEFAULT_ENGINE_IMAGE, DEFAULT_RESOURCE_LIMITS } = await import(
    '../engine-adapters/speckit/src/index.ts'
  );

  const environment = composeExecutionRegistry().resolve();

  // Resolved BY NAME, and then checked. `composeAgentRegistry` registers the
  // fixture agent as default (`T564`), so a plain `.resolve()` here would run
  // V6 against a fixture and write a transcript claiming a real agent run —
  // the precise kind of evidence this task exists to stop being fabricated.
  // The registry's `resolve` falls back silently when a name is unknown, so
  // the fallback is caught here rather than trusted.
  const wanted = process.env['V6_AGENT'] ?? 'claude';
  const agent = composeAgentRegistry().resolve(wanted);
  if (agent.descriptor.name !== wanted) {
    throw new Error(
      `V6 asked for the "${wanted}" agent and the registry returned "${agent.descriptor.name}". ` +
        `A transcript produced by a fixture is not evidence for SC-AGT-001.`,
    );
  }

  const speckit = composeEngineRegistry({ environment, agent }).resolve();

  // T162/PC-3 — the engine refuses a correlation id that is not a UUID, because
  // an unparseable id means a run nobody can trace back. A readable label like
  // "v6-real-run" is exactly what it refuses, and rightly.
  const correlationId = randomUUID();
  const timeoutMs = Number(process.env['V6_TIMEOUT_MS'] ?? 10 * 60 * 1000);
  const controller = new AbortController();
  const scratchPath = await mkdtemp(join(tmpdir(), 'pmi-v6-'));

  const engine = {
    // The probe container: the same shape the engine builds internally, so the
    // digest recorded is the digest generation actually ran on.
    request: {
      lifecycle: 'ephemeral',
      image: process.env['ENGINE_IMAGE'] ?? DEFAULT_ENGINE_IMAGE,
      env: { PMI_CORRELATION_ID: correlationId },
      workspace: { kind: 'ephemeral', scratchPath },
      egressProfile: GENERATION_EGRESS_PROFILE,
      credentials: [],
      resourceLimits: DEFAULT_RESOURCE_LIMITS,
      timeoutMs,
      signal: controller.signal,
    },
    input: V6_INPUT,
    ctx: {
      signal: controller.signal,
      timeoutMs,
      correlationId,
      onProgress: (note) => console.log(`  · ${note}`),
    },
    generateSpecification: (input, ctx) => speckit.generateSpecification(input, ctx),
  };

  if (dryRun) {
    console.log('V6 dry run — nothing will be started.\n');
    console.log(`  environment : ${environment.descriptor.provider}`);
    console.log(`  agent       : ${agent.descriptor.provider}/${agent.descriptor.model}`);
    console.log(`  engine      : ${speckit.descriptor.name} ${speckit.descriptor.version}`);
    console.log(`  image       : ${engine.request.image}`);
    console.log(`  steps       : ${V6_STEPS.join(' → ')}`);
    console.log(`  transcript  : ${transcriptPath}`);
    return 0;
  }

  const run = await runV6({
    environment,
    agent,
    engine,
    now: () => new Date().toISOString(),
    log: (line) => console.log(line),
  });

  await writeFile(transcriptPath, run.transcript, 'utf8');
  console.log(`\nTranscript written to ${transcriptPath}`);
  console.log(`Outcome: ${run.outcome}`);

  // The exit status and the transcript must never disagree. A failed run that
  // exits 0 is how "we ran it" becomes evidence for something that did not work.
  return run.outcome === 'PASSED' ? 0 : 1;
}

/**
 * Runs only when invoked directly, never on import — `T576a` imports this file.
 */
export function isDirectInvocation(argv1, moduleUrl) {
  if (!argv1 || !moduleUrl) return false;
  // Windows makes this comparison awkward: argv[1] is a backslash path and
  // import.meta.url is `file:///C:/path/to/x.mjs`. Compare normalised tails
  // rather than trusting either form.
  const normalise = (value) =>
    decodeURIComponent(String(value))
      .toLowerCase()
      .replace(/^file:\/\//, '')
      .replace(/\\/g, '/')
      .replace(/^\/*[a-z]:/, '')
      .replace(/^\/+/, '');

  return normalise(moduleUrl).endsWith(normalise(argv1));
}

if (isDirectInvocation(process.argv[1], import.meta.url)) {
  main(process.argv.slice(2)).then(
    (code) => process.exit(code),
    (error) => {
      console.error(error);
      process.exit(1);
    },
  );
}

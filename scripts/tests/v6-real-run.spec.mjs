/**
 * T576a — the manual runner's LOGIC, tested without a daemon.
 *
 * Added by the analyse pass of 2026-08-14, which found `T576` producing a
 * script with no test at all. Constitution V is NON-NEGOTIABLE and `scripts/`
 * is not on Constitution I's exempt list.
 *
 * The split matters: step ordering, digest extraction and transcript shape are
 * testable here; only `T646b`'s **execution** needs Docker. Without this file,
 * an untested script would be the sole evidence for `SC-AGT-001`.
 */
import { describe, expect, it } from 'vitest';
import {
  extractImageDigest,
  formatStep,
  formatTranscript,
  runV6,
  V6_STEPS,
} from '../v6-real-run.mjs';

const DIGEST = 'sha256:' + 'a'.repeat(64);

function stub(over = {}) {
  const session = {
    exec: async () => ({ exitCode: 0, stdout: over.probeDigest ?? '', stderr: '' }),
    writeFile: async () => undefined,
    listFiles: async () => [],
    readFile: async () => '',
  };
  return {
    environment: {
      descriptor: { provider: 'docker', imageDigest: over.imageDigest },
      start: async () => {
        if (over.startThrows) throw over.startThrows;
        return session;
      },
      stop: async () => {
        over.stopped?.push('stopped');
      },
    },
    agent: { descriptor: { provider: 'anthropic', model: 'claude-opus-5' } },
    engine: {
      request: {},
      input: {},
      ctx: {},
      generateSpecification: async () =>
        over.result ?? { ok: true, value: { title: 'Feature Specification: Apollo' } },
    },
    now: () => '2026-08-17T00:00:00.000Z',
  };
}

describe('T576a · digest extraction', () => {
  it('finds a sha256 digest anywhere in the text', () => {
    expect(extractImageDigest(`Digest: ${DIGEST}\n`)).toBe(DIGEST);
  });

  it('returns null rather than a plausible-looking substring', () => {
    // The digest is what identifies the image six months later. A wrong one is
    // worse than none, because the transcript would look complete.
    expect(extractImageDigest('sha256:tooshort')).toBeNull();
    expect(extractImageDigest('')).toBeNull();
    expect(extractImageDigest(undefined)).toBeNull();
  });
});

describe('T576a · transcript formatting', () => {
  it('marks passes, failures and skips distinctly', () => {
    expect(formatStep('start_container', 'ok')).toBe('[PASS] start_container');
    expect(formatStep('start_container', 'fail', 'boom')).toBe('[FAIL] start_container — boom');
    expect(formatStep('stop_container', 'skip', 'none started')).toBe(
      '[SKIP] stop_container — none started',
    );
  });

  it('names the digest, because the tag alone identifies nothing', () => {
    const text = formatTranscript({ lines: [], digest: DIGEST, startedAt: 'x', outcome: 'PASSED' });
    expect(text).toContain(DIGEST);
  });

  it('says so loudly when no digest was recorded', () => {
    const text = formatTranscript({ lines: [], digest: null, startedAt: 'x', outcome: 'FAILED' });
    expect(text).toContain('NOT RECORDED');
  });

  it('states what the run does NOT prove', () => {
    // The transcript is the sole evidence for SC-AGT-001. One that lists only
    // passes reads as more evidence than it is.
    const text = formatTranscript({ lines: [], digest: DIGEST, startedAt: 'x', outcome: 'PASSED' });
    expect(text).toMatch(/does \*\*not\*\* prove|R-04/);
    expect(text).toContain('A green CI run is **not** evidence');
  });
});

describe('T576a · step sequencing', () => {
  it('runs the six steps in the documented order', async () => {
    const { lines } = await runV6(stub({ imageDigest: DIGEST }));
    const names = lines.map((l) => l.replace(/^\[\w+\]\s*/, '').split(' — ')[0]);
    expect(names).toEqual(V6_STEPS);
  });

  it('falls back to an in-container probe when the descriptor carries no digest', async () => {
    const { digest } = await runV6(stub({ probeDigest: `${DIGEST}\n` }));
    expect(digest).toBe(DIGEST);
  });

  it('reports PASSED only when the spec was produced AND a digest was recorded', async () => {
    expect((await runV6(stub({ imageDigest: DIGEST }))).outcome).toBe('PASSED');
    // A run that generated a specification but could not identify its image is
    // not a pass: the transcript could not answer what produced it.
    expect((await runV6(stub({}))).outcome).toBe('FAILED');
  });

  it('reports the engine failure reason rather than a generic error', async () => {
    const { lines, outcome } = await runV6(
      stub({
        imageDigest: DIGEST,
        result: { ok: false, failure: { reason: 'engine_unavailable', message: 'no daemon' } },
      }),
    );
    expect(outcome).toBe('FAILED');
    expect(lines.join('\n')).toContain('engine_unavailable');
  });

  it('stops the container even when generation throws (E8)', async () => {
    const stopped = [];
    await runV6({
      ...stub({ imageDigest: DIGEST, stopped }),
      engine: {
        request: {},
        input: {},
        ctx: {},
        generateSpecification: async () => {
          throw new Error('boom');
        },
      },
    });
    expect(stopped).toEqual(['stopped']);
  });

  it('skips teardown honestly when no container ever started', async () => {
    const { lines } = await runV6(stub({ startThrows: new Error('daemon down') }));
    expect(lines.join('\n')).toContain('[SKIP] stop_container');
  });
});

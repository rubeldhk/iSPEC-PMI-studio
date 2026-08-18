/**
 * T670 · `DEF-028-007` and `DEF-028-008` — both found by the first real run.
 *
 * `T570` drives this provider against a mocked daemon and asserts the network
 * name is *constructed* correctly. It is. Nothing asserted the named network
 * **exists**, because a mock has no networks — so the first real `start()` in
 * this programme's history came back with:
 *
 *     failed to set up container networking: network pmi-egress-generation not found
 *
 * classified as `image_unavailable`, which tells an operator to rebuild an image
 * that was fine.
 *
 * These tests use a fake daemon that can answer the network question, which is
 * the capability the old fixture lacked.
 */
import { describe, expect, it } from 'vitest';
import { DockerExecutionEnvironment, type DockerEngineApi } from '../../src/index';
import { GENERATION_EGRESS_PROFILE } from '@pmi/execution-contract';

const REQUEST = {
  lifecycle: 'ephemeral' as const,
  image: 'pmi-studio/speckit-engine',
  env: {},
  workspace: { kind: 'ephemeral' as const, scratchPath: '/tmp/x' },
  egressProfile: GENERATION_EGRESS_PROFILE,
  credentials: [],
  resourceLimits: { cpus: 1, memoryMb: 512, pids: 128, wallClockMs: 60_000 },
  timeoutMs: 60_000,
};

function fakeApi(over: Partial<DockerEngineApi> = {}): DockerEngineApi & { created: unknown[] } {
  const created: unknown[] = [];
  return {
    created,
    createContainer: async (config) => {
      created.push(config);
      return { id: 'c1' };
    },
    startContainer: async () => undefined,
    exec: async () => ({ exitCode: 0, stdout: '', stderr: '' }),
    removeContainer: async () => undefined,
    ...over,
  };
}

describe('T670 · egress network preflight (DEF-028-007)', () => {
  it('refuses with policy_refused when the network is absent', async () => {
    const env = new DockerExecutionEnvironment(fakeApi({ networkExists: async () => false }));
    await expect(env.start(REQUEST)).rejects.toMatchObject({ reason: 'policy_refused' });
  });

  it('creates no container when the network is absent', async () => {
    // E7 — a doomed run costs nothing. Before this, the daemon created a
    // container and failed at start, and the provider had to clean it up.
    const api = fakeApi({ networkExists: async () => false });
    const env = new DockerExecutionEnvironment(api);
    await env.start(REQUEST).catch(() => undefined);
    expect(api.created).toHaveLength(0);
  });

  it('names the network, the profile and how to create a contained one', async () => {
    // A refusal an operator cannot act on is only a slower failure.
    const env = new DockerExecutionEnvironment(fakeApi({ networkExists: async () => false }));
    const error = await env.start(REQUEST).catch((e: Error) => e);
    const message = String((error as Error).message);
    expect(message).toContain('pmi-egress-generation');
    expect(message).toContain('generation');
    expect(message).toContain('api.anthropic.com');
    expect(message).toContain('docker network create --internal pmi-egress-generation');
  });

  it('never offers to create the network itself', async () => {
    // The load-bearing assertion. A provider that auto-created the network
    // would create a bridge network with unrestricted egress, and the run would
    // report the profile as enforced while the sandbox had the open internet
    // (RAID R-06, SC-AGT-005). The refusal must stay a refusal.
    const env = new DockerExecutionEnvironment(fakeApi({ networkExists: async () => false }));
    const error = await env.start(REQUEST).catch((e: Error) => e);
    expect(String((error as Error).message)).toMatch(/does not create it/i);
  });

  it('proceeds when the network exists', async () => {
    const api = fakeApi({ networkExists: async () => true });
    const env = new DockerExecutionEnvironment(api);
    await expect(env.start(REQUEST)).resolves.toBeTruthy();
    expect(api.created).toHaveLength(1);
  });

  it('asks about the same network the container is attached to', async () => {
    // Two places naming a network independently is how they drift. The
    // preflight would pass and the container would still fail to attach.
    let asked = '';
    const api = fakeApi({
      networkExists: async (name) => {
        asked = name;
        return true;
      },
    });
    await new DockerExecutionEnvironment(api).start(REQUEST);
    const config = api.created[0] as { HostConfig: { NetworkMode: string } };
    expect(config.HostConfig.NetworkMode).toBe(asked);
  });

  it('skips the preflight against a daemon that cannot answer, rather than refusing', async () => {
    // T570's mocked daemon omits networkExists. Treating "cannot answer" as
    // "absent" would fail every existing test for a question a mock cannot be
    // meaningfully asked.
    const env = new DockerExecutionEnvironment(fakeApi());
    await expect(env.start(REQUEST)).resolves.toBeTruthy();
  });
});

describe('T670 · what a 404 actually means (DEF-028-008)', () => {
  // The daemon's real words from the first real run, not a fixture invented
  // alongside the code being tested.
  const NETWORK_404 = Object.assign(
    new Error(
      'start container: {"message":"failed to set up container networking: network pmi-egress-generation not found"}',
    ),
    { statusCode: 404 },
  );
  const IMAGE_404 = Object.assign(
    new Error('create container: {"message":"No such image: pmi-studio/speckit-engine:latest"}'),
    { statusCode: 404 },
  );

  it('reads a missing network as a policy failure, not a missing image', async () => {
    const env = new DockerExecutionEnvironment(
      fakeApi({
        startContainer: async () => {
          throw NETWORK_404;
        },
      }),
    );
    await expect(env.start(REQUEST)).rejects.toMatchObject({ reason: 'policy_refused' });
  });

  it('still reads a missing image as a missing image', async () => {
    // The default must survive the fix: telling an operator to build the image
    // is right in the common case, and losing it would trade one wrong
    // direction for another.
    const env = new DockerExecutionEnvironment(
      fakeApi({
        createContainer: async () => {
          throw IMAGE_404;
        },
      }),
    );
    await expect(env.start(REQUEST)).rejects.toMatchObject({ reason: 'image_unavailable' });
  });

  it('leaves a daemon that is not running as provider_unavailable', async () => {
    const env = new DockerExecutionEnvironment(
      fakeApi({
        createContainer: async () => {
          throw Object.assign(new Error('connect ENOENT'), { code: 'ENOENT' });
        },
      }),
    );
    await expect(env.start(REQUEST)).rejects.toMatchObject({ reason: 'provider_unavailable' });
  });
});

describe('T671 · the container stays alive long enough to be exec-ed into (DEF-028-009)', () => {
  async function createdConfig(): Promise<Record<string, unknown>> {
    const api = fakeApi({ networkExists: async () => true });
    await new DockerExecutionEnvironment(api).start(REQUEST);
    return api.created[0] as Record<string, unknown>;
  }

  it('resets the image entrypoint', async () => {
    // The whole defect. `pmi-studio/speckit-engine` declares
    // ENTRYPOINT ["/bin/sh","-c"], which turned ['sleep','300'] into
    // `sh -c "sleep" "300"` — sleep with no operand. The container exited
    // instantly and every exec failed with "container is not running".
    expect(await createdConfig()).toHaveProperty('Entrypoint', []);
  });

  it('keeps Cmd in exec form rather than a shell string', async () => {
    // A single shell string would work against this image and make the
    // provider's containment depend on the image's shell — and re-open the
    // interpolation surface `writeFile` base64-encodes to avoid.
    const config = await createdConfig();
    expect(Array.isArray(config['Cmd'])).toBe(true);
    expect(config['Cmd']).toEqual(['sleep', '60']);
  });

  it('idles for the run’s own timeout, so the container cannot outlive it', async () => {
    const api = fakeApi({ networkExists: async () => true });
    await new DockerExecutionEnvironment(api).start({ ...REQUEST, timeoutMs: 90_000 });
    expect((api.created[0] as { Cmd: string[] }).Cmd).toEqual(['sleep', '90']);
  });
});

describe('T672 · the session reports which image ran (DEF-028-010)', () => {
  const DIGEST = 'sha256:' + 'c'.repeat(64);

  it('carries the digest the daemon resolved', async () => {
    // Before this, `T577`'s required digest had no source anywhere in the
    // system: the descriptor has no such field and PMI_IMAGE_DIGEST is set by
    // nothing. The gate could never open.
    const api = fakeApi({
      networkExists: async () => true,
      inspectContainer: async () => ({ imageDigest: DIGEST }),
    });
    const session = await new DockerExecutionEnvironment(api).start(REQUEST);
    expect(session.imageDigest).toBe(DIGEST);
  });

  it('inspects the container, not the image name — a retag must not make it lie', async () => {
    let asked = '';
    const api = fakeApi({
      networkExists: async () => true,
      inspectContainer: async (id) => {
        asked = id;
        return { imageDigest: DIGEST };
      },
    });
    await new DockerExecutionEnvironment(api).start(REQUEST);
    expect(asked).toBe('c1');
  });

  it('omits the digest rather than inventing one when the daemon cannot say', async () => {
    const api = fakeApi({
      networkExists: async () => true,
      inspectContainer: async () => ({}),
    });
    const session = await new DockerExecutionEnvironment(api).start(REQUEST);
    expect(session.imageDigest).toBeUndefined();
  });

  it('keeps the container when the inspect fails', async () => {
    // A missing digest degrades a transcript. Losing a live container over a
    // reporting detail would be the worse trade.
    const api = fakeApi({
      networkExists: async () => true,
      inspectContainer: async () => {
        throw new Error('daemon hiccup');
      },
    });
    const session = await new DockerExecutionEnvironment(api).start(REQUEST);
    expect(session).toBeTruthy();
    expect(session.imageDigest).toBeUndefined();
  });
});

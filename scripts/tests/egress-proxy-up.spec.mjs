/**
 * T705 · the proxy bring-up script's LOGIC, without a daemon (D-28).
 *
 * Same split as `T576a`/`T576`: the plan (what networks, containers, config
 * files, in what order) is pure and asserted here against a stubbed daemon;
 * only the execution against a real socket is manual. Conflating the two is
 * how an untested script becomes part of a security control.
 */
import { describe, expect, it } from 'vitest';
import { GENERATION_EGRESS_PROFILE } from '../../packages/execution-contract/src/index.ts';
import {
  proxyContainerNameFor,
  proxyConfigFor,
  proxyFilterFor,
} from '../../execution-providers/docker/src/proxy-config.ts';
import { PROXY_IMAGE, planProxyUp, executeProxyUp } from '../egress-proxy-up.mjs';

const CONF_DIR = '/tmp/pmi-egress-proxy-conf';

function plan() {
  return planProxyUp(GENERATION_EGRESS_PROFILE, { confDir: CONF_DIR });
}

/** A daemon that records every call, answering "nothing exists yet". */
function stubDaemon(over = {}) {
  const calls = [];
  return {
    calls,
    inspectNetwork: async (name) => {
      calls.push(['inspectNetwork', name]);
      return null;
    },
    createNetwork: async (payload) => {
      calls.push(['createNetwork', payload]);
    },
    removeContainerByName: async (name) => {
      calls.push(['removeContainerByName', name]);
    },
    createContainer: async (payload) => {
      calls.push(['createContainer', payload]);
      return { id: 'proxy-1' };
    },
    connectNetwork: async (network, containerId) => {
      calls.push(['connectNetwork', network, containerId]);
    },
    startContainer: async (id) => {
      calls.push(['startContainer', id]);
    },
    ...over,
  };
}

const stubIo = () => {
  const written = [];
  return { written, writeConfigDir: async (dir, files) => written.push([dir, files]) };
};

describe('T705 · the plan restates the profile, in order', () => {
  it('plans network → config → container → egress leg → start, in that order', () => {
    expect(plan().map((op) => op.op)).toEqual([
      'ensure_internal_network',
      'write_config',
      'replace_container',
      'connect_egress',
      'start_container',
    ]);
  });

  it('creates the SANDBOX network internal — the proxy is the only way out', () => {
    const ensure = plan().find((op) => op.op === 'ensure_internal_network');
    expect(ensure.name).toBe('pmi-egress-generation');
    expect(ensure.payload).toMatchObject({ Name: 'pmi-egress-generation', Internal: true });
  });

  it('writes the GENERATED config and filter, not hand-written ones', () => {
    const write = plan().find((op) => op.op === 'write_config');
    expect(write.files['tinyproxy.conf']).toBe(proxyConfigFor(GENERATION_EGRESS_PROFILE));
    expect(write.files['filter']).toBe(proxyFilterFor(GENERATION_EGRESS_PROFILE));
  });

  it('names the container the way the provider derives it, so the env var resolves', () => {
    const replace = plan().find((op) => op.op === 'replace_container');
    expect(replace.name).toBe(proxyContainerNameFor('generation'));
  });

  it('mounts the config read-only and attaches the sidecar to the internal network', () => {
    const replace = plan().find((op) => op.op === 'replace_container');
    expect(replace.payload).toMatchObject({
      Image: PROXY_IMAGE,
      HostConfig: {
        Binds: [`${CONF_DIR}:/etc/tinyproxy:ro`],
        NetworkMode: 'pmi-egress-generation',
      },
    });
  });

  it('adds the egress leg as a SECOND network, after creation', () => {
    const connect = plan().find((op) => op.op === 'connect_egress');
    expect(connect.network).toBe('bridge');
  });

  it('refuses a wildcard profile before planning anything', () => {
    expect(() =>
      planProxyUp(
        { name: 'wild', allowedDestinations: ['*'], enforcement: 'proxy' },
        { confDir: CONF_DIR },
      ),
    ).toThrow();
  });
});

describe('T705 · the executor performs the plan against the daemon it is given', () => {
  it('executes every op, in plan order, and starts the container it created', async () => {
    const daemon = stubDaemon();
    const io = stubIo();
    await executeProxyUp(plan(), daemon, io);
    expect(daemon.calls.map((c) => c[0])).toEqual([
      'inspectNetwork',
      'createNetwork',
      'removeContainerByName',
      'createContainer',
      'connectNetwork',
      'startContainer',
    ]);
    expect(daemon.calls.at(-1)).toEqual(['startContainer', 'proxy-1']);
    expect(io.written).toEqual([
      [CONF_DIR, { 'tinyproxy.conf': expect.any(String), filter: expect.any(String) }],
    ]);
  });

  it('keeps an existing INTERNAL network rather than recreating it', async () => {
    const daemon = stubDaemon({
      inspectNetwork: async (name) => {
        daemon.calls.push(['inspectNetwork', name]);
        return { internal: true };
      },
    });
    await executeProxyUp(plan(), daemon, stubIo());
    expect(daemon.calls.map((c) => c[0])).not.toContain('createNetwork');
  });

  it('REFUSES an existing non-internal network instead of silently using it', async () => {
    // The dangerous direction (DEF-028-015): a routable network under the
    // profile's name would let the run report "enforced" with the whole
    // internet reachable. Deleting it automatically would also be wrong —
    // the operator created it, the operator learns why it must go.
    const daemon = stubDaemon({
      inspectNetwork: async () => ({ internal: false }),
    });
    await expect(executeProxyUp(plan(), daemon, stubIo())).rejects.toThrow(/internal/i);
    expect(daemon.calls.map((c) => c[0])).not.toContain('createContainer');
  });

  it('replaces an existing sidecar, so re-running converges instead of erroring', async () => {
    const daemon = stubDaemon();
    await executeProxyUp(plan(), daemon, stubIo());
    const removeIdx = daemon.calls.findIndex((c) => c[0] === 'removeContainerByName');
    const createIdx = daemon.calls.findIndex((c) => c[0] === 'createContainer');
    expect(removeIdx).toBeGreaterThanOrEqual(0);
    expect(removeIdx).toBeLessThan(createIdx);
  });
});

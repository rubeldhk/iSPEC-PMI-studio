/**
 * T705 — bring up the egress proxy for a named profile (D-28, ADR-0013).
 *
 * `R-028-8`: a network permitting exactly one hostname cannot be expressed with
 * `docker network create` alone. This script delivers the shape that can:
 *
 *   sandbox ──(pmi-egress-<profile>, --internal: NO route out)──> proxy sidecar
 *   proxy sidecar ──(bridge)──> exactly the profile's destinations, via a
 *   Tinyproxy whitelist GENERATED from the profile (proxy-config.ts).
 *
 * Constitution V: the plan and the executor below are pure and unit-tested in
 * `scripts/tests/egress-proxy-up.spec.mjs` against a stubbed daemon; only
 * `main()` touches a real socket, exactly the `T576` split.
 *
 * Usage:
 *   node scripts/egress-proxy-up.mjs [profile]   # default: generation
 *   node scripts/egress-proxy-up.mjs --dry-run   # print the plan, touch nothing
 */
import {
  EGRESS_PROFILES,
  assertEgressProfile,
} from '../packages/execution-contract/src/index.ts';
import {
  PROXY_PORT,
  proxyConfigFor,
  proxyContainerNameFor,
  proxyFilterFor,
} from '../execution-providers/docker/src/proxy-config.ts';

/** Built from execution-providers/docker/proxy/Dockerfile (T703). */
export const PROXY_IMAGE = 'pmi-studio/egress-proxy';

/** Must match the provider's networkPrefix — one naming rule (T670). */
const NETWORK_PREFIX = 'pmi-egress-';

/**
 * The plan: every state change, as data. Asserted by the unit tests; performed
 * by `executeProxyUp`. Refuses a profile the contract would refuse, so an
 * invalid profile can never become a running proxy.
 */
export function planProxyUp(profile, { confDir }) {
  assertEgressProfile(profile);
  const networkName = `${NETWORK_PREFIX}${profile.name}`;
  const containerName = proxyContainerNameFor(profile.name);
  return [
    {
      op: 'ensure_internal_network',
      name: networkName,
      payload: {
        Name: networkName,
        Driver: 'bridge',
        // The load-bearing flag: without a route out, the ONLY path from the
        // sandbox to anywhere is a CONNECT tunnel through the sidecar.
        Internal: true,
        Labels: { 'pmi.egress-profile': profile.name },
      },
    },
    {
      op: 'write_config',
      dir: confDir,
      files: {
        'tinyproxy.conf': proxyConfigFor(profile),
        filter: proxyFilterFor(profile),
      },
    },
    {
      op: 'replace_container',
      name: containerName,
      payload: {
        Image: PROXY_IMAGE,
        HostConfig: {
          // Read-only: the sidecar can serve the allowlist, never rewrite it.
          Binds: [`${confDir}:/etc/tinyproxy:ro`],
          NetworkMode: networkName,
          RestartPolicy: { Name: 'unless-stopped' },
        },
      },
    },
    // The second leg. Attached AFTER creation because NetworkMode can carry
    // only one network; this is what makes the sidecar dual-homed.
    { op: 'connect_egress', network: 'bridge', container: containerName },
    { op: 'start_container', name: containerName },
  ];
}

/** Performs the plan against whatever daemon it is given (injected — PC-1). */
export async function executeProxyUp(plan, daemon, io) {
  let containerId = null;
  for (const step of plan) {
    switch (step.op) {
      case 'ensure_internal_network': {
        const existing = await daemon.inspectNetwork(step.name);
        if (existing === null) {
          await daemon.createNetwork(step.payload);
        } else if (existing.internal !== true) {
          // DEF-028-015 — the dangerous direction. A routable network under
          // the profile's name reports as enforced with the internet open.
          // Not deleted automatically: the operator created it, the operator
          // learns why it must go.
          throw new Error(
            `Network "${step.name}" exists but is not internal, so it routes past the proxy ` +
              `and the profile would report as enforced while the sandbox has the open ` +
              `internet (DEF-028-015). Remove it (docker network rm ${step.name}) and re-run.`,
          );
        }
        break;
      }
      case 'write_config':
        await io.writeConfigDir(step.dir, step.files);
        break;
      case 'replace_container': {
        // Converge, don't error: re-running after a config change must land
        // the new allowlist, and a stale sidecar is worse than a moment's gap.
        await daemon.removeContainerByName(step.name);
        ({ id: containerId } = await daemon.createContainer({ ...step.payload, name: step.name }));
        break;
      }
      case 'connect_egress':
        await daemon.connectNetwork(step.network, containerId);
        break;
      case 'start_container':
        await daemon.startContainer(containerId);
        break;
      default:
        throw new Error(`Unknown op: ${step.op}`);
    }
  }
  return containerId;
}

// ---------------------------------------------------------------- execution
// Below the test boundary, exactly like unixSocketDockerApi: everything above
// is asserted in CI; this half needs a real daemon and is exercised manually.

function socketPath() {
  const host = process.env.DOCKER_HOST ?? '';
  if (host.startsWith('unix://')) return host.slice('unix://'.length);
  if (host.startsWith('npipe://')) return host.slice('npipe://'.length).replace(/\//g, '\\');
  return process.platform === 'win32' ? '//./pipe/docker_engine' : '/var/run/docker.sock';
}

async function dockerRequest(method, path, body) {
  const { request: httpRequest } = await import('node:http');
  return new Promise((resolvePromise, reject) => {
    const payload = body === undefined ? undefined : JSON.stringify(body);
    const req = httpRequest(
      {
        socketPath: socketPath(),
        method,
        path,
        headers: payload
          ? { 'content-type': 'application/json', 'content-length': Buffer.byteLength(payload) }
          : {},
      },
      (res) => {
        const chunks = [];
        res.on('data', (c) => chunks.push(c));
        res.on('end', () =>
          resolvePromise({ status: res.statusCode ?? 0, text: Buffer.concat(chunks).toString('utf8') }),
        );
      },
    );
    req.on('error', reject);
    if (payload) req.write(payload);
    req.end();
  });
}

function expectOk(res, what) {
  if (res.status >= 400) throw new Error(`${what}: HTTP ${res.status} ${res.text}`);
}

function realDaemon() {
  return {
    async inspectNetwork(name) {
      const res = await dockerRequest('GET', `/v1.43/networks/${encodeURIComponent(name)}`);
      if (res.status === 404) return null;
      expectOk(res, 'inspect network');
      return { internal: JSON.parse(res.text).Internal === true };
    },
    async createNetwork(payload) {
      expectOk(await dockerRequest('POST', '/v1.43/networks/create', payload), 'create network');
    },
    async removeContainerByName(name) {
      const res = await dockerRequest(
        'DELETE',
        `/v1.43/containers/${encodeURIComponent(name)}?force=true`,
      );
      if (res.status !== 404) expectOk(res, 'remove container');
    },
    async createContainer(payload) {
      const { name, ...config } = payload;
      const res = await dockerRequest(
        'POST',
        `/v1.43/containers/create?name=${encodeURIComponent(name)}`,
        config,
      );
      expectOk(res, 'create container');
      return { id: JSON.parse(res.text).Id };
    },
    async connectNetwork(network, containerId) {
      expectOk(
        await dockerRequest('POST', `/v1.43/networks/${encodeURIComponent(network)}/connect`, {
          Container: containerId,
        }),
        'connect network',
      );
    },
    async startContainer(id) {
      const res = await dockerRequest('POST', `/v1.43/containers/${id}/start`);
      if (res.status !== 304) expectOk(res, 'start container');
    },
  };
}

async function main() {
  const args = process.argv.slice(2);
  const dryRun = args.includes('--dry-run');
  const profileName = args.find((a) => !a.startsWith('--')) ?? 'generation';
  const profile = EGRESS_PROFILES[profileName];
  if (!profile) {
    console.error(
      `Unknown egress profile "${profileName}". Known: ${Object.keys(EGRESS_PROFILES).join(', ')}.`,
    );
    process.exit(2);
  }

  const { mkdtemp, writeFile, mkdir } = await import('node:fs/promises');
  const { join } = await import('node:path');
  const { tmpdir } = await import('node:os');
  const confDir = join(tmpdir(), `pmi-egress-proxy-${profile.name}`);

  const plan = planProxyUp(profile, { confDir });
  if (dryRun) {
    console.log(JSON.stringify(plan, null, 2));
    return;
  }

  const io = {
    async writeConfigDir(dir, files) {
      await mkdir(dir, { recursive: true });
      for (const [file, content] of Object.entries(files)) {
        await writeFile(join(dir, file), content, 'utf8');
      }
    },
  };

  const id = await executeProxyUp(plan, realDaemon(), io);
  console.log(
    `Egress proxy for "${profile.name}" is up (container ${id.slice(0, 12)}).\n` +
      `Sandboxes on pmi-egress-${profile.name} reach ${profile.allowedDestinations.join(', ')} ` +
      `via http://${proxyContainerNameFor(profile.name)}:${PROXY_PORT} and nothing else.`,
  );
}

/** Runs only when invoked directly, never on import — the spec imports this file. */
const invokedDirectly =
  process.argv[1] && import.meta.url.endsWith(process.argv[1].replace(/\\/g, '/').split('/').pop());
if (invokedDirectly) {
  main().catch((error) => {
    console.error(String(error?.message ?? error));
    process.exit(1);
  });
}

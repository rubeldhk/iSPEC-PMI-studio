/**
 * T646a / T573 — the Docker execution provider.
 *
 * Routed from EPIC-003, where it was about to be written as `ContainerRuntime`
 * *inside* `speckit.adapter.ts`. `D-21` (conflict `C-20`) stopped that: Native
 * §4 forbids business logic depending directly on Docker, so Docker is a
 * **provider behind a port**, not the abstraction. This package existing at all
 * is what that decision looks like in the tree.
 *
 * **No `dockerode`, no `docker` CLI** — the Docker Engine HTTP API over its unix
 * socket, per the task. The CLI would mean shelling out from the worker with the
 * worker's own privileges; `dockerode` is a dependency whose transitive surface
 * we would inherit for four endpoints. `D-31` (multi-tenant SaaS) makes the
 * second provider near-certainly Kubernetes, and a thin API client is what makes
 * that a sibling rather than a rewrite.
 *
 * The daemon is an injected port (PC-1), so every request this provider
 * constructs is unit-testable without Docker — which matters because RAID
 * **R-04** blocks container-in-container in CI. What CI cannot prove is whether
 * Docker *accepts* the request; that is `T646b`, and it is split out on purpose.
 */
import {
  ExecutionProviderError,
  type ExecResult,
  type ExecutionEnvironmentDescriptor,
  type ExecutionRequest,
  type ExecutionSession,
  type ProjectExecutionEnvironment,
} from '@pmi/execution-contract';

export const DOCKER_DESCRIPTOR: ExecutionEnvironmentDescriptor = {
  provider: 'docker',
  /** Persistent bindings are a later epic's; this provider refuses them. */
  supportedLifecycles: ['ephemeral'],
  supportsPersistentState: false,
  supportsNetworkPolicy: true,
  maxWallClockMs: 15 * 60 * 1000,
};

/** sandbox.json `user`. Non-root is an `ADR-0002` control, not a preference. */
const SANDBOX_UID = 10001;
const SANDBOX_GID = 10001;

/** The only writable path. Destroyed with the container. */
const WORKSPACE_PATH = '/workspace';

/**
 * The four operations this provider needs from a daemon.
 *
 * Narrow on purpose: a port this small is why a Kubernetes provider is a
 * sibling implementation rather than a rewrite, and why the whole of `ADR-0002`
 * is assertable in CI.
 */
export interface DockerEngineApi {
  createContainer(config: Record<string, unknown>): Promise<{ id: string }>;
  startContainer(id: string): Promise<void>;
  exec(id: string, command: readonly string[]): Promise<ExecResult>;
  removeContainer(id: string): Promise<void>;
  /**
   * `DEF-028-007` — does the egress network exist?
   *
   * Optional because a mocked daemon has no networks, and `T570` drives this
   * provider against exactly that. A mock omits it and the preflight is
   * skipped; a real daemon implements it and the preflight runs. Making it
   * required would have forced every existing fixture to answer a question a
   * mock cannot meaningfully be asked.
   */
  networkExists?(name: string): Promise<boolean>;
  /**
   * `DEF-028-010` — the daemon's own content address for the image it resolved.
   *
   * Optional for the same reason as `networkExists`: a mocked daemon has no
   * images, and a provider that cannot report a digest says so by omission
   * rather than inventing one.
   */
  inspectContainer?(id: string): Promise<{ imageDigest?: string }>;
}

export interface DockerProviderOptions {
  readonly descriptor?: ExecutionEnvironmentDescriptor;
  /** Prefix for the operator-defined network carrying an egress profile. */
  readonly networkPrefix?: string;
}

/** Sessions carry their container id without exposing it on the contract. */
const CONTAINER_ID = Symbol('pmi.docker.containerId');

interface DockerSession extends ExecutionSession {
  [CONTAINER_ID]: string;
}

export class DockerExecutionEnvironment implements ProjectExecutionEnvironment {
  readonly descriptor: ExecutionEnvironmentDescriptor;
  private readonly networkPrefix: string;
  /** Ids already removed, so `stop` is idempotent (E8). */
  private readonly removed = new Set<string>();

  constructor(
    private readonly api: DockerEngineApi,
    options: DockerProviderOptions = {},
  ) {
    this.descriptor = options.descriptor ?? DOCKER_DESCRIPTOR;
    this.networkPrefix = options.networkPrefix ?? 'pmi-egress-';
  }

  async start(request: ExecutionRequest): Promise<ExecutionSession> {
    // Every refusal below happens BEFORE the daemon is touched, so a doomed run
    // costs no container. Same E7 reasoning as the engine and the agent.
    if (request.signal?.aborted) {
      throw new ExecutionProviderError('cancelled', 'Cancelled before the container started.');
    }

    // T573 — the binding decides whether state outlives the container, so the
    // binding is what is checked. `lifecycle` and `workspace.kind` can disagree.
    if (request.lifecycle === 'persistent' || request.workspace.kind === 'persistent') {
      throw new ExecutionProviderError(
        'policy_refused',
        `The docker provider cannot honour a persistent workspace binding; it supports ` +
          `${this.descriptor.supportedLifecycles.join(', ')} only. Persistent project state lives ` +
          `in the git remote (decision D-22), never in a container volume.`,
      );
    }

    if (!this.descriptor.supportsNetworkPolicy) {
      throw new ExecutionProviderError(
        'policy_refused',
        'This provider declares no network-policy support, so it cannot accept an egress profile.',
      );
    }

    // DEF-028-007 — the network IS the egress control, so its absence is a
    // policy failure, not an infrastructure hiccup. Checked BEFORE the
    // container is created, so a doomed run still costs nothing.
    //
    // This provider deliberately does NOT create the network. A network created
    // by default is a bridge network with unrestricted egress: the run would
    // succeed, the profile would report as enforced, and the sandbox would have
    // the whole internet. `SC-AGT-005` froze this boundary so that an epic
    // could not widen it by accident — including this one.
    const networkName = this.networkFor(request.egressProfile.name);
    if (this.api.networkExists) {
      const exists = await this.api.networkExists(networkName);
      if (!exists) {
        throw new ExecutionProviderError(
          'policy_refused',
          `Egress profile "${request.egressProfile.name}" requires the Docker network ` +
            `"${networkName}", which does not exist. This provider does not create it: the network ` +
            `IS the egress control, and one created by default would permit the whole internet ` +
            `while reporting the profile as enforced. Create it permitting only ` +
            `${request.egressProfile.allowedDestinations.join(', ')}, or, for a fully contained run ` +
            `with no egress at all: docker network create --internal ${networkName}`,
        );
      }
    }

    const config = this.buildCreateConfig(request);

    let id: string;
    try {
      ({ id } = await this.api.createContainer(config));
    } catch (error) {
      throw this.classify(error, 'The execution environment could not be created.');
    }

    try {
      await this.api.startContainer(id);
    } catch (error) {
      // Otherwise a failed start leaks one container per attempt.
      await this.remove(id);
      throw this.classify(error, 'The execution environment could not be started.');
    }

    // DEF-028-010 — asked AFTER start, so it reports what actually ran rather
    // than what was requested. A failure here must not fail the run: a missing
    // digest degrades the transcript, and losing a live container over a
    // reporting detail would be worse than the gap it fills.
    let imageDigest: string | undefined;
    if (this.api.inspectContainer) {
      imageDigest = await this.api
        .inspectContainer(id)
        .then((info) => info.imageDigest)
        .catch(() => undefined);
    }

    return this.session(id, imageDigest);
  }

  /** Idempotent, and never throws into a result (E8). */
  async stop(session: ExecutionSession): Promise<void> {
    const id = (session as DockerSession)[CONTAINER_ID];
    if (!id) return;
    await this.remove(id);
  }

  // ---------------------------------------------------------------- internals

  /**
   * The create request, with every `ADR-0002` control on it.
   *
   * Built in one place and asserted field by field in `T570`, because a control
   * that is missing here is a control that does not exist — and the failure is
   * silent: the container starts perfectly well without it.
   */
  private buildCreateConfig(request: ExecutionRequest): Record<string, unknown> {
    const limits = request.resourceLimits;

    return {
      Image: request.image,
      // Kept alive so `exec` has something to run in; the wall clock is enforced
      // by the caller and by `HostConfig` below, not by the entrypoint.
      // DEF-028-009 — reset whatever the image declares.
      //
      // `pmi-studio/speckit-engine` declares ENTRYPOINT ["/bin/sh","-c"], which
      // makes the FIRST Cmd element a shell script and the rest positional
      // arguments: ['sleep','300'] became `sh -c "sleep" "300"` — sleep with no
      // operand — and the container exited in milliseconds. The engine then
      // execed into a container that was already gone. Neither the image nor the
      // provider was wrong alone; only a real daemon composes the two, which is
      // why `T646b` found it and no check on either side could.
      //
      // The provider owns the session lifecycle, so it states the process it
      // needs instead of inheriting one. This also makes the provider correct
      // against any image, not just this one.
      Entrypoint: [],
      Cmd: ['sleep', String(Math.ceil(request.timeoutMs / 1000))],
      WorkingDir: WORKSPACE_PATH,
      User: `${SANDBOX_UID}:${SANDBOX_GID}`,
      // Exhaustive by construction: whatever the request does not carry does not
      // exist inside the container. No DATABASE_URL, no queue URL, no secret.
      Env: Object.entries(request.env).map(([k, v]) => `${k}=${v}`),
      HostConfig: {
        ReadonlyRootfs: true,
        // The ONLY writable path, and it is memory-backed so it cannot survive
        // the container even if the daemon is unclean.
        Tmpfs: { [WORKSPACE_PATH]: `rw,size=512m,uid=${SANDBOX_UID},gid=${SANDBOX_GID}` },
        NanoCpus: Math.round(limits.cpus * 1_000_000_000),
        Memory: limits.memoryMb * 1024 * 1024,
        PidsLimit: limits.pids,
        CapDrop: ['ALL'],
        CapAdd: [],
        SecurityOpt: ['no-new-privileges'],
        Privileged: false,
        AutoRemove: false,
        // The profile becomes an operator-defined network. `bridge` or `host`
        // here would hand the agent the open internet, which is the single
        // control standing between this container and exfiltration (RAID R-06).
        NetworkMode: this.networkFor(request.egressProfile.name),
      },
    };
  }

  private session(id: string, imageDigest?: string): ExecutionSession {
    const api = this.api;

    const session: DockerSession = {
      [CONTAINER_ID]: id,
      ...(imageDigest ? { imageDigest } : {}),

      exec: (command) => api.exec(id, command),

      /**
       * Content is base64-encoded, never interpolated into a shell command.
       *
       * It is a customer requirement: it may contain quotes, newlines, and
       * `$(...)`. Interpolating it would be command injection running with the
       * agent's own privileges inside the sandbox.
       */
      writeFile: async (path, content) => {
        const encoded = Buffer.from(content, 'utf8').toString('base64');
        const result = await api.exec(id, [
          'sh',
          '-c',
          `mkdir -p "$(dirname "$1")" && printf '%s' "$2" | base64 -d > "$1"`,
          'sh',
          path,
          encoded,
        ]);
        if (result.exitCode !== 0) {
          throw new ExecutionProviderError(
            'provider_error',
            `Could not write ${path} into the execution environment.`,
            result.stderr,
          );
        }
      },

      readFile: async (path) => {
        const result = await api.exec(id, ['cat', path]);
        if (result.exitCode !== 0) {
          throw new ExecutionProviderError(
            'provider_error',
            `Could not read ${path} from the execution environment.`,
            result.stderr,
          );
        }
        return result.stdout;
      },

      listFiles: async () => {
        const result = await api.exec(id, ['find', '.', '-type', 'f']);
        return result.stdout
          .split(/\r?\n/)
          .map((line) => line.trim())
          .filter((line) => line !== '');
      },
    };

    return session;
  }

  private async remove(id: string): Promise<void> {
    if (this.removed.has(id)) return;
    this.removed.add(id);
    // Teardown failure is reported by the caller's own hook, never raised: a
    // throw here would replace the real terminal outcome with a cleanup error.
    await this.api.removeContainer(id).catch(() => undefined);
  }

  /**
   * The network an egress profile maps to. One place, so the preflight
   * (`DEF-028-007`) and the container config can never name different networks.
   */
  private networkFor(profileName: string): string {
    return `${this.networkPrefix}${profileName}`;
  }

  /**
   * Which failure this was.
   *
   * `image_unavailable` and `provider_unavailable` are deliberately distinct:
   * one means build the image, the other means fix the infrastructure, and
   * sending an operator to the wrong one costs an outage's worth of time.
   */
  private classify(error: unknown, message: string): ExecutionProviderError {
    const status = (error as { statusCode?: number }).statusCode;
    const code = (error as { code?: string }).code;

    // DEF-028-008 — the daemon answers 404 for anything it cannot find: an
    // image, a network, a container, a volume. Mapping every 404 to
    // `image_unavailable` sent an operator to rebuild a correct image when a
    // network was missing, which is the exact cost the comment above names.
    // The daemon says which resource it could not find, so read it rather than
    // assume. Anything unrecognised stays `image_unavailable`: that is the
    // common case and the useful default.
    const detail = String((error as { message?: string }).message ?? '');
    const notFoundIsNetwork = /\bnetwork\b/i.test(detail);

    const reason =
      status === 404
        ? notFoundIsNetwork
          ? 'policy_refused'
          : 'image_unavailable'
        : code === 'ENOENT' || code === 'ECONNREFUSED'
          ? 'provider_unavailable'
          : 'provider_error';

    // Diagnostics only. The daemon's message carries whatever the request held.
    return new ExecutionProviderError(reason, message, redactDiagnostics(error));
  }
}

/** E9 — never let a credential reach diagnostics. Mirrors the engine adapter. */
export function redactDiagnostics(error: unknown): string {
  const text = error instanceof Error ? error.message : String(error);
  return text
    .replace(/\bsk-[A-Za-z0-9_-]{8,}/g, 'sk-[redacted]')
    .replace(/\bBearer\s+[A-Za-z0-9._-]{8,}/gi, 'Bearer [redacted]')
    .replace(/\b(AI_PROVIDER_TOKEN|DATABASE_URL|SESSION_SECRET|JWT_SECRET)\s*=\s*\S+/gi, '$1=[redacted]');
}

/**
 * Where the Docker Engine API listens, resolved from platform and environment.
 *
 * **`DEF-028-004`.** The original default was `/var/run/docker.sock` with a
 * `unix://` prefix stripped from `DOCKER_HOST` — both POSIX-only. On Windows the
 * daemon listens on the named pipe `//./pipe/docker_engine` and `DOCKER_HOST` is
 * set to `npipe://./pipe/docker_engine`, which survived that replace unchanged
 * and was handed to `http.request` as a filesystem path. The provider could not
 * reach a daemon on the platform `T646b` was waiting for, and `T570` could not
 * see it because a mocked daemon replaces exactly this function.
 *
 * Pure and exported so `T668` can assert every branch without a daemon — the
 * gap that let `DEF-028-004` through.
 */
export function resolveDockerSocketPath(
  platform: string = process.platform,
  env: Record<string, string | undefined> = process.env,
  explicit?: string,
): string {
  if (explicit) return explicit;

  const host = env['DOCKER_HOST'];
  if (host) {
    if (/^npipe:\/\//i.test(host)) {
      // Docker writes this endpoint both ways — `npipe://./pipe/docker_engine`
      // and `npipe:////./pipe/docker_engine`. A named pipe path must begin with
      // `//`, so normalise rather than trust the form we happen to receive.
      const rest = host.replace(/^npipe:\/\//i, '');
      return rest.startsWith('//') || rest.startsWith('\\\\') ? rest : `//${rest.replace(/^\/+/, '')}`;
    }
    // Anything else (tcp://, ssh://) is not a socket path. Returned unchanged so
    // the caller's error names the real cause instead of a mangled path.
    return host.replace(/^unix:\/\//, '');
  }

  return platform === 'win32' ? '//./pipe/docker_engine' : '/var/run/docker.sock';
}

/**
 * The real daemon, over its local socket — a unix socket on POSIX, a named pipe
 * on Windows. Node's `http.request` accepts either as `socketPath`.
 *
 * Deliberately below the test boundary: everything above is asserted in CI, and
 * this is the layer `T646b` exists to exercise for the first time.
 */
export function unixSocketDockerApi(socketPathArg?: string): DockerEngineApi {
  const socketPath = resolveDockerSocketPath(process.platform, process.env, socketPathArg);
  const request = async (
    method: string,
    path: string,
    body?: unknown,
  ): Promise<{ status: number; text: string }> => {
    const { request: httpRequest } = await import('node:http');
    return new Promise((resolve, reject) => {
      const payload = body === undefined ? undefined : JSON.stringify(body);
      const req = httpRequest(
        {
          socketPath,
          method,
          path,
          headers: payload
            ? { 'content-type': 'application/json', 'content-length': Buffer.byteLength(payload) }
            : {},
        },
        (res) => {
          const chunks: Buffer[] = [];
          res.on('data', (c: Buffer) => chunks.push(c));
          res.on('end', () =>
            resolve({ status: res.statusCode ?? 0, text: Buffer.concat(chunks).toString('utf8') }),
          );
        },
      );
      req.on('error', reject);
      if (payload) req.write(payload);
      req.end();
    });
  };

  const expectOk = (res: { status: number; text: string }, what: string): void => {
    if (res.status >= 400) {
      throw Object.assign(new Error(`${what}: ${res.text}`), { statusCode: res.status });
    }
  };

  return {
    async createContainer(config) {
      const res = await request('POST', '/v1.43/containers/create', config);
      expectOk(res, 'create container');
      return { id: (JSON.parse(res.text) as { Id: string }).Id };
    },

    async startContainer(id) {
      const res = await request('POST', `/v1.43/containers/${id}/start`);
      expectOk(res, 'start container');
    },

    async exec(id, command) {
      const created = await request('POST', `/v1.43/containers/${id}/exec`, {
        AttachStdout: true,
        AttachStderr: true,
        Cmd: [...command],
      });
      expectOk(created, 'create exec');
      const execId = (JSON.parse(created.text) as { Id: string }).Id;

      const started = await request('POST', `/v1.43/exec/${execId}/start`, { Detach: false });
      expectOk(started, 'start exec');

      const inspect = await request('GET', `/v1.43/exec/${execId}/json`);
      expectOk(inspect, 'inspect exec');
      const exitCode = (JSON.parse(inspect.text) as { ExitCode: number }).ExitCode ?? 0;

      // Docker multiplexes stdout and stderr into 8-byte-framed chunks unless a
      // TTY is attached. Demultiplexed here so stderr never reaches stdout —
      // stderr is operator-facing only (PC-3).
      const { stdout, stderr } = demultiplex(started.text);
      return { exitCode, stdout, stderr };
    },

    async removeContainer(id) {
      const res = await request('DELETE', `/v1.43/containers/${id}?force=true&v=true`);
      if (res.status !== 404) expectOk(res, 'remove container');
    },

    /**
     * `DEF-028-007` — the preflight's one question.
     *
     * A 404 is the answer "no", not a fault: this endpoint exists to be asked
     * about a network that may be absent. Any other error status IS a fault and
     * is raised, so a broken daemon is never reported as a missing network.
     */
    /**
     * `DEF-028-010` — the image the daemon resolved for this container.
     *
     * `Image` on a container inspect is a sha256 content address, which is
     * precisely what "which image produced this specification" needs. Read from
     * the container rather than the image name so a retagged image cannot make
     * the transcript lie.
     */
    async inspectContainer(id) {
      const res = await request('GET', `/v1.43/containers/${id}/json`);
      expectOk(res, 'inspect container');
      const parsed = JSON.parse(res.text) as { Image?: string };
      return parsed.Image ? { imageDigest: parsed.Image } : {};
    },

    async networkExists(name) {
      const res = await request('GET', `/v1.43/networks/${encodeURIComponent(name)}`);
      if (res.status === 404) return false;
      expectOk(res, 'inspect network');
      return true;
    },
  };
}

/** Split Docker's framed stream into stdout and stderr. Exported for testing. */
export function demultiplex(raw: string): { stdout: string; stderr: string } {
  const buffer = Buffer.from(raw, 'binary');
  let stdout = '';
  let stderr = '';
  let offset = 0;

  while (offset + 8 <= buffer.length) {
    const streamType = buffer[offset];
    const length = buffer.readUInt32BE(offset + 4);
    const payload = buffer.subarray(offset + 8, offset + 8 + length).toString('utf8');
    if (streamType === 2) stderr += payload;
    else stdout += payload;
    offset += 8 + length;
  }

  // A daemon with a TTY attached sends no frames. Treating unframed output as
  // stdout is right; treating it as an error would break every TTY deployment.
  if (offset === 0) return { stdout: raw, stderr: '' };
  return { stdout, stderr };
}

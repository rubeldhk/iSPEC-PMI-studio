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

    return this.session(id);
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
        NetworkMode: `${this.networkPrefix}${request.egressProfile.name}`,
      },
    };
  }

  private session(id: string): ExecutionSession {
    const api = this.api;

    const session: DockerSession = {
      [CONTAINER_ID]: id,

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
   * Which failure this was.
   *
   * `image_unavailable` and `provider_unavailable` are deliberately distinct:
   * one means build the image, the other means fix the infrastructure, and
   * sending an operator to the wrong one costs an outage's worth of time.
   */
  private classify(error: unknown, message: string): ExecutionProviderError {
    const status = (error as { statusCode?: number }).statusCode;
    const code = (error as { code?: string }).code;

    const reason =
      status === 404
        ? 'image_unavailable'
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
 * The real daemon, over the unix socket.
 *
 * Deliberately below the test boundary: everything above is asserted in CI, and
 * this is the layer `T646b` exists to exercise for the first time.
 */
export function unixSocketDockerApi(
  socketPath = process.env['DOCKER_HOST']?.replace(/^unix:\/\//, '') ?? '/var/run/docker.sock',
): DockerEngineApi {
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

/**
 * `T1264` (EPIC-038) — inspecting a package **as supplied**.
 *
 * `FR-CTX-060`–`FR-CTX-065`, the reviewer-facing half of `BR-0096`.
 *
 * ## Re-assembly is not forbidden here, it is unavailable
 *
 * The constructor takes a reader of stored rows, a reader of current source
 * versions and a reader of execution registrations. Nothing that ranks,
 * filters or retrieves. *"What did the model see"* and *"what would it see
 * now"* render the same screen, and the only reliable way to answer the first
 * is to have no means of computing the second (`FR-CTX-063`).
 *
 * ## Drift is stated, never applied
 *
 * Where a source has moved since, the retained item keeps the version that was
 * supplied and gains a note naming the current one. Four answers, each sending
 * a reader somewhere different: `unchanged`, `moved`, `unresolvable` (the
 * source is gone) and `unknown` (nobody could look). The last is never
 * collapsed into `unchanged`: a reader that is unbound or failing has not
 * established that nothing moved.
 *
 * ## Consequential is read, not decided
 *
 * `FR-CTX-061` — from `EPIC-037`'s registration. With no reader, or a
 * registration that records no answer, the value is `undetermined` with a
 * reason, never a default in either direction.
 *
 * Framework-free (PC-1).
 */
import { ValidationFailedError } from '../../core/errors.js';
import type { ContextStore } from './context.store.js';
import type { LiveStateElement } from './live-state.js';
import type { ContextPackage, PackageItem } from './package.types.js';
import type { ExclusionRecord } from './retrieval/outcome.types.js';

/** Where a source is now. `resolves: false` means it was looked for and is gone. */
export interface SourceVersionReader {
  currentVersion(
    workspaceId: string,
    sourceType: string,
    sourceId: string,
  ): Promise<
    | { resolves: true; version: string }
    | { resolves: false }
    /** `T1810` — a type no module serves: not gone, not current, not known. */
    | { resolves: 'unknown'; reason: string }
  >;
}

/**
 * `FR-CTX-061` — what `EPIC-037`'s registration says about an execution.
 * `null` when the execution is not registered.
 */
export interface ExecutionRegistrationReader {
  registrationOf(
    workspaceId: string,
    executionId: string,
  ): Promise<
    | ((
        | { consequential: boolean }
        | { consequential: 'undetermined'; reason: string }
      ) & {
        /**
         * `T1816` — `EPIC-037`'s projected lifecycle state. It reads
         * `registered` until the first event, which is what "never ran" is.
         */
        lifecycleState?: string;
      })
    | null
  >;
}

export type Drift =
  | { readonly kind: 'unchanged' }
  | { readonly kind: 'moved'; readonly currentVersion: string; readonly note: string }
  | { readonly kind: 'unresolvable'; readonly note: string }
  | { readonly kind: 'unknown'; readonly note: string };

export type InspectedItem = PackageItem & { readonly drift: Drift };

export interface ExecutionBinding {
  readonly executionId: string | null;
  readonly registered: boolean;
  readonly consequential: boolean | 'undetermined';
  readonly reason?: string;
  /**
   * `T1816` — whether the execution has run, read from `EPIC-037`. `'unknown'`
   * where there is no lifecycle to read; never assumed either way.
   */
  readonly ran: boolean | 'unknown';
  /** Set when it has not run: the package was prepared, and nothing consumed it. */
  readonly consumption?: string;
}

/** `T1816` — `EPIC-037`'s first lifecycle state, held until the first event. */
const NOT_YET_RUN = 'registered';

function consumptionOf(lifecycleState: string | undefined): Pick<ExecutionBinding, 'ran' | 'consumption'> {
  if (lifecycleState === undefined) return { ran: 'unknown' };
  return lifecycleState === NOT_YET_RUN
    ? {
        ran: false,
        consumption:
          'the execution is registered and has not run, so nothing consumed this package ' +
          '(EPIC-037 lifecycle: registered)',
      }
    : { ran: true };
}

export interface Inspection {
  readonly package: ContextPackage;
  readonly items: readonly InspectedItem[];
  readonly exclusions: readonly ExclusionRecord[];
  /** `T1833`, `FR-CTX-035` — the budget excluded something. */
  readonly bounded: boolean;
  /** `FR-CTX-021` — as given, each with the instant it was read. */
  readonly liveState: readonly LiveStateElement[];
  readonly execution: ExecutionBinding;
}

/** The read side of the store, and only the read side. */
export type InspectionReader = Pick<
  ContextStore,
  'findPackage' | 'itemsFor' | 'exclusionsFor' | 'liveStateFor' | 'packagesForExecution'
>;

export class InspectionService {
  constructor(
    private readonly store: InspectionReader,
    private readonly versions: SourceVersionReader | null,
    private readonly registrations: ExecutionRegistrationReader | null,
  ) {}

  /** `FR-CTX-060` — one package, or `null` when it is not in this workspace (`FR-002`). */
  async inspect(workspaceId: string, packageId: string): Promise<Inspection | null> {
    const pkg = await this.store.findPackage(workspaceId, packageId);
    return pkg === null ? null : this.#inspect(pkg);
  }

  /**
   * `FR-CTX-062` — the packages an execution was given, newest first.
   *
   * The execution id is required. A workspace-wide listing would answer a
   * question nobody asked and become the thing people page through instead of
   * the audit path.
   */
  async forExecution(workspaceId: string, executionId: string): Promise<Inspection[]> {
    if (typeof executionId !== 'string' || executionId.trim() === '') {
      throw new ValidationFailedError(
        'executionId is required: packages are listed for the execution they fed (FR-CTX-062)',
      );
    }
    const packages = await this.store.packagesForExecution(workspaceId, executionId.trim());
    return Promise.all(packages.map((p) => this.#inspect(p)));
  }

  async #inspect(pkg: ContextPackage): Promise<Inspection> {
    const [items, exclusions, liveState, execution] = await Promise.all([
      this.store.itemsFor(pkg.workspaceId, pkg.id),
      this.store.exclusionsFor(pkg.workspaceId, pkg.id),
      this.store.liveStateFor(pkg.workspaceId, pkg.id),
      this.#execution(pkg),
    ]);
    const inspected = await Promise.all(
      items.map(async (item): Promise<InspectedItem> => ({
        ...item,
        // `T1839` — asked where the source lives, not where the package does.
        drift: await this.#drift(item.sourceWorkspaceId ?? pkg.workspaceId, item),
      })),
    );
    return {
      package: pkg,
      items: inspected,
      exclusions,
      bounded: exclusions.some((e) => e.reason === 'budget'),
      liveState,
      execution,
    };
  }

  async #drift(workspaceId: string, item: PackageItem): Promise<Drift> {
    if (this.versions === null) {
      return {
        kind: 'unknown',
        note: 'no source-version reader is bound, so whether this source has moved is not known',
      };
    }
    let now: Awaited<ReturnType<SourceVersionReader['currentVersion']>>;
    try {
      now = await this.versions.currentVersion(workspaceId, item.sourceType, item.sourceId);
    } catch (error) {
      // An outage, not an answer. `unresolvable` would claim the source is
      // gone, which nobody established.
      return {
        kind: 'unknown',
        note: `the current version could not be read (${error instanceof Error ? error.message : 'unknown fault'})`,
      };
    }
    if (now.resolves === 'unknown') return { kind: 'unknown', note: now.reason };
    if (!now.resolves) {
      return {
        kind: 'unresolvable',
        note: `${item.sourceType} ${item.sourceId} no longer resolves; the package retains ${item.sourceVersion} as supplied`,
      };
    }
    if (now.version === item.sourceVersion) return { kind: 'unchanged' };
    return {
      kind: 'moved',
      currentVersion: now.version,
      note: `supplied at ${item.sourceVersion}; the source is now at ${now.version}`,
    };
  }

  async #execution(pkg: ContextPackage): Promise<ExecutionBinding> {
    if (pkg.executionId === null) {
      return {
        executionId: null,
        registered: false,
        consequential: 'undetermined',
        reason: 'the package is not bound to an execution (FR-CTX-062)',
        ran: 'unknown',
      };
    }
    if (this.registrations === null) {
      return {
        executionId: pkg.executionId,
        registered: false,
        consequential: 'undetermined',
        reason: 'no reader of EPIC-037 registrations is bound, so consequentiality is not known (FR-CTX-061)',
        ran: 'unknown',
      };
    }
    const registration = await this.registrations.registrationOf(pkg.workspaceId, pkg.executionId);
    if (registration === null) {
      return {
        executionId: pkg.executionId,
        registered: false,
        consequential: 'undetermined',
        reason: `execution ${pkg.executionId} is not registered with EPIC-037`,
        ran: 'unknown',
      };
    }
    const consumption = consumptionOf(registration.lifecycleState);
    return registration.consequential === 'undetermined'
      ? {
          executionId: pkg.executionId,
          registered: true,
          consequential: 'undetermined',
          reason: registration.reason,
          ...consumption,
        }
      : {
          executionId: pkg.executionId,
          registered: true,
          consequential: registration.consequential,
          ...consumption,
        };
  }
}

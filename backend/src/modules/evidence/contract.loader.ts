/**
 * `T858b` — the Contract catalog. Evidence Contracts are repository-resident
 * JSON under `packages/evidence-contract/contracts/`, one file per version
 * (`R-032-4`), validated by the same `validateContract` the conformance check
 * uses, and loaded once.
 *
 * Every version of every class is kept, never only the latest: `FR-EVS-023`
 * judges work against the version it began under, so a version still in use by
 * work in flight must stay readable after its successor ships.
 *
 * ## `FR-EVS-024` — no weakening while work is in flight (`T858b`)
 *
 * A version that removes an item, or lets an item accept a type it did not, is
 * **refused at load** while any work is in flight under its predecessor. Refused
 * means not loaded: `latest()` keeps answering with the predecessor, so new work
 * binds to the stronger Contract, and `refusals()` lists what was refused and
 * why. It does not throw — work being in flight is a fact about the data, not a
 * malformed configuration, and it must not take the application down.
 */
import { readFileSync, readdirSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, join, resolve } from 'node:path';
import { validateContract, type EvidenceContract } from '@pmi/evidence-contract';

/** Where the definitions live — beside the package's sources, resolved, not hardcoded. */
export function contractsDirectory(): string {
  const entry = createRequire(import.meta.url).resolve('@pmi/evidence-contract');
  return resolve(dirname(entry), '..', 'contracts');
}

/** `workClass@contractVersion` — the key in-flight work is reported under. */
export function versionKey(workClass: string, contractVersion: number): string {
  return `${workClass}@${contractVersion}`;
}

/** What `next` gives up relative to `prev`. Empty when `next` is as strong or stronger. */
export function weakenings(prev: EvidenceContract, next: EvidenceContract): string[] {
  const found: string[] = [];
  for (const item of prev.items) {
    const successor = next.items.find((candidate) => candidate.itemId === item.itemId);
    if (successor === undefined) {
      found.push(`item ${item.itemId} removed`);
      continue;
    }
    for (const type of successor.acceptingPredicateTypes) {
      if (!item.acceptingPredicateTypes.includes(type)) found.push(`item ${item.itemId} now also accepts ${type}`);
    }
  }
  return found;
}

export interface ContractRefusal {
  readonly workClass: string;
  readonly contractVersion: number;
  readonly weakens: number;
  readonly reasons: readonly string[];
}

export class ContractCatalog {
  private readonly byClass = new Map<string, Map<number, EvidenceContract>>();
  private readonly refused: ContractRefusal[] = [];

  private constructor(contracts: readonly EvidenceContract[], inFlight: ReadonlySet<string>) {
    const sorted = [...contracts].sort((a, b) => a.contractVersion - b.contractVersion);
    for (const contract of sorted) {
      const versions = this.byClass.get(contract.workClass) ?? new Map<number, EvidenceContract>();
      const loaded = [...versions.values()];
      // Compared against EVERY loaded predecessor with work in flight, not only
      // the newest: v3 must not quietly undo what v1 work still depends on.
      for (const prior of loaded) {
        if (!inFlight.has(versionKey(prior.workClass, prior.contractVersion))) continue;
        const reasons = weakenings(prior, contract);
        if (reasons.length > 0) {
          this.refused.push({
            workClass: contract.workClass,
            contractVersion: contract.contractVersion,
            weakens: prior.contractVersion,
            reasons,
          });
          break;
        }
      }
      if (this.refused.some((r) => r.workClass === contract.workClass && r.contractVersion === contract.contractVersion)) {
        continue;
      }
      versions.set(contract.contractVersion, contract);
      this.byClass.set(contract.workClass, versions);
    }
  }

  /** `FR-EVS-024` — the versions refused at load, and why. Visible, never silent. */
  refusals(): readonly ContractRefusal[] {
    return this.refused;
  }

  /**
   * From already-parsed definitions. A definition that fails validation throws
   * here, at load — a malformed Contract fails when configuration is read, not
   * at the moment someone needs it to pass.
   */
  static fromDefinitions(
    definitions: readonly unknown[],
    inFlight: ReadonlySet<string> = new Set(),
  ): ContractCatalog {
    const contracts = definitions.map((definition) => {
      const validation = validateContract(definition);
      if (!validation.ok) {
        throw new Error(`Evidence Contract refused at load — ${validation.reason}: ${validation.message}`);
      }
      return validation.value;
    });
    return new ContractCatalog(contracts, inFlight);
  }

  static fromDirectory(
    directory: string = contractsDirectory(),
    inFlight: ReadonlySet<string> = new Set(),
  ): ContractCatalog {
    const definitions = readdirSync(directory)
      .filter((name) => name.endsWith('.json') && name !== 'work-classes.json')
      .map((name) => JSON.parse(readFileSync(join(directory, name), 'utf8')) as unknown);
    return ContractCatalog.fromDefinitions(definitions, inFlight);
  }

  get(workClass: string, contractVersion: number): EvidenceContract | null {
    return this.byClass.get(workClass)?.get(contractVersion) ?? null;
  }

  latest(workClass: string): EvidenceContract | null {
    const versions = this.byClass.get(workClass);
    if (versions === undefined || versions.size === 0) return null;
    return versions.get(Math.max(...versions.keys())) ?? null;
  }

  workClasses(): string[] {
    return [...this.byClass.keys()].sort();
  }
}

/** The slice of the repository the catalog's load reads. */
export interface InFlightSource {
  inFlightContractVersions(): Promise<Set<string>>;
}

/**
 * `T1994` — the catalog as the application builds it (`FR-EVS-024`).
 *
 * The in-flight set is read first, so a version weakening one that work is in
 * flight under is refused rather than loaded. If the store cannot say, every
 * version is treated as in flight: the strict reading. Every refusal is
 * **reported** — a version its author saw ship, silently left unloaded while
 * new work keeps binding its predecessor, is a refusal nobody can see.
 */
export async function loadCatalog(
  repository: InFlightSource,
  options: { directory?: string; report: (message: string) => void },
): Promise<ContractCatalog> {
  const everything = ContractCatalog.fromDirectory(options.directory);
  const inFlight = await repository.inFlightContractVersions().catch(
    () =>
      new Set(
        everything.workClasses().flatMap((c) => {
          const latest = everything.latest(c)!.contractVersion;
          return Array.from({ length: latest }, (_, i) => versionKey(c, i + 1));
        }),
      ),
  );
  const catalog = ContractCatalog.fromDirectory(options.directory, inFlight);
  for (const refusal of catalog.refusals()) {
    options.report(
      `Evidence Contract ${refusal.workClass} v${refusal.contractVersion} refused at load: it weakens ` +
        `v${refusal.weakens}, which work is in flight under — ${refusal.reasons.join('; ')}. ` +
        `New work keeps binding v${refusal.weakens} (FR-EVS-024).`,
    );
  }
  return catalog;
}

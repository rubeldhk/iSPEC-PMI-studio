/**
 * T463 — persistence for the engine set a deployment accepted.
 *
 * Written against a NARROW client port rather than importing `@prisma/client`,
 * because Prisma is not a dependency of this repository yet: EPIC-004 `T013`
 * still owes the first migration. A store that imported Prisma today would not
 * compile, and a store that did not exist would leave `engine_registrations`
 * permanently unwritten — which is the gap convergence found.
 *
 * This shape drops onto `PrismaClient.engineRegistration` unchanged when T013
 * lands: the method names and argument shape are Prisma's own.
 *
 * The table is a RECORD, not the source of truth. Adapters are validated at the
 * composition root (FR-021); these rows exist so an operator can see which
 * engines a running deployment accepted, and at what version, without reading
 * the code.
 */
import type {
  EngineRegistrationRecord,
  EngineRegistrationStore,
} from './engine-registry.service.js';

/** The subset of a Prisma delegate this store uses. Nothing more is required. */
export interface EngineRegistrationDelegate {
  upsert(args: {
    where: { name: string };
    create: {
      name: string;
      version: string;
      capabilities: string[];
      isDefault: boolean;
    };
    update: {
      version: string;
      capabilities: string[];
      isDefault: boolean;
    };
  }): Promise<unknown>;
}

/**
 * Upsert by name.
 *
 * Registration runs on every startup, so `create` would fail the second time a
 * process booted. Upsert also means a version change is *recorded* rather than
 * duplicated — an engine that has been upgraded should show one row at its
 * current version, not a row per deployment.
 */
export class PrismaEngineRegistrationStore implements EngineRegistrationStore {
  constructor(private readonly engineRegistration: EngineRegistrationDelegate) {}

  async record(registration: EngineRegistrationRecord): Promise<void> {
    await this.engineRegistration.upsert({
      where: { name: registration.name },
      create: {
        name: registration.name,
        version: registration.version,
        capabilities: [...registration.capabilities],
        isDefault: registration.isDefault,
      },
      update: {
        version: registration.version,
        capabilities: [...registration.capabilities],
        isDefault: registration.isDefault,
      },
    });
  }
}

/**
 * A store that records nothing, for deployments without a database.
 *
 * Explicit rather than implicit: `EngineRegistryService` already tolerates a
 * missing store, but "no store was supplied" and "this deployment deliberately
 * does not persist registrations" are different states, and only one of them is
 * a configuration mistake.
 */
export class NullEngineRegistrationStore implements EngineRegistrationStore {
  readonly recorded: EngineRegistrationRecord[] = [];

  async record(registration: EngineRegistrationRecord): Promise<void> {
    this.recorded.push(registration);
  }
}

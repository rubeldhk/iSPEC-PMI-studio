/**
 * T674 — audit module wiring (convergence finding `F1`).
 *
 * This file used to be `@Module({})` with a comment saying providers would be
 * wired "once a Prisma client exists". The consequence was that `AuditService`,
 * `AuditInterceptor` and `AuditController` were **fully built, fully tested and
 * unreachable**: the running API had no audit layer, nothing served
 * `/v1/audit`, and `FR-033` — *"an audit entry for every state-changing action
 * and refused access"* — was satisfied by no running code at all.
 *
 * `EnginesModule` carries the same sentence in its own header, from `T462`.
 * Convergence found it there and fixed it; here the identical gap survived, in
 * the epic that owns the requirement.
 *
 * **The persistence adapter is still missing, and that is now the only thing
 * missing.** It is named as a token rather than hidden inside a `new`, so the
 * gap is one provider — swapped at the composition root when a Prisma client
 * lands — instead of an entire absent module. The default below refuses rather
 * than pretends.
 *
 * The services stay framework-free (PC-1): no `@Injectable()`, no decorators,
 * no Nest import in a `.service.ts`. They are plain classes wired here with
 * factory providers, which is why the architecture test can assert a service
 * never imports an HTTP type while this file legitimately does.
 */
import { Module } from '@nestjs/common';
import { AuditController, type AuditReader } from './audit.controller.js';
import { AuditService, type AuditWriter } from './audit.service.js';
import { AUDIT_READER, AUDIT_WRITER } from './audit.tokens.js';

export { AUDIT_READER, AUDIT_WRITER } from './audit.tokens.js';

/**
 * Raised when audit persistence has not been configured.
 *
 * Deliberately not a silent no-op. A writer that discarded entries would let an
 * action succeed with no audit record — exactly the outcome `FR-033` and the
 * database trigger exist to prevent — and it would do so invisibly. Failing
 * names the missing adapter instead.
 */
export class AuditPersistenceUnavailableError extends Error {
  constructor() {
    super(
      'Audit persistence is not configured. Provide AUDIT_WRITER at the composition root; ' +
        'refusing to run an action whose audit entry cannot be written (FR-033).',
    );
    this.name = 'AuditPersistenceUnavailableError';
  }
}

/** The default until a Prisma-backed adapter is supplied. Refuses; never drops. */
export class UnconfiguredAuditWriter implements AuditWriter {
  async create(): Promise<void> {
    throw new AuditPersistenceUnavailableError();
  }
}

/** The default read side. Same reasoning: an empty list would look like an empty trail. */
export class UnconfiguredAuditReader implements AuditReader {
  async list(): Promise<unknown[]> {
    throw new AuditPersistenceUnavailableError();
  }
}

@Module({
  controllers: [AuditController],
  providers: [
    {
      provide: AUDIT_WRITER,
      useFactory: (): AuditWriter => new UnconfiguredAuditWriter(),
    },
    {
      provide: AUDIT_READER,
      useFactory: (): AuditReader => new UnconfiguredAuditReader(),
    },
    {
      provide: AuditService,
      inject: [AUDIT_WRITER],
      useFactory: (writer: AuditWriter): AuditService => new AuditService(writer),
    },
  ],
  exports: [AuditService, AUDIT_WRITER, AUDIT_READER],
})
export class AuditModule {}

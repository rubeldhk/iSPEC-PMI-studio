/**
 * T674a — the audit layer is actually reachable.
 * Written to FAIL before T674 exists (Constitution V).
 *
 * **Convergence finding `F1`.** `AuditModule` was `@Module({})`. `AuditService`,
 * `AuditInterceptor` and `AuditController` were all built, all unit-tested, and
 * **never provided or registered** — so the running API had no audit layer and
 * nothing served `/v1/audit`, while `FR-033` reported as satisfied.
 *
 * This is the same gap `EnginesModule` names in its own header from `T462`:
 * *"fully built, fully tested, and unreachable."* It was found there by
 * convergence and fixed; here it survived, in the epic that owns `FR-033`.
 *
 * The tests assert **wiring**, not behaviour — behaviour is `T027`, `T028a` and
 * `T029a`'s job and they already pass. What none of them can see is whether
 * anything constructs the classes they test.
 */
import { describe, expect, it } from 'vitest';
import {
  AUDIT_WRITER,
  AuditModule,
  AuditPersistenceUnavailableError,
} from '../../../src/modules/audit/audit.module.js';
import { AuditController } from '../../../src/modules/audit/audit.controller.js';
import { AuditService } from '../../../src/modules/audit/audit.service.js';

/** Read Nest's metadata without standing up a whole application. */
function metadata(key: string): unknown[] {
  return (Reflect.getMetadata(key, AuditModule) as unknown[] | undefined) ?? [];
}

function providerTokens(): unknown[] {
  return metadata('providers').map((provider) =>
    typeof provider === 'object' && provider !== null && 'provide' in provider
      ? (provider as { provide: unknown }).provide
      : provider,
  );
}

describe('T674a · AuditModule wiring (convergence F1, FR-033)', () => {
  it('registers the controller, so /v1/audit is actually served', () => {
    // The whole finding in one assertion. Before T674 this array was empty and
    // the route did not exist, however well the controller was tested.
    expect(metadata('controllers')).toContain(AuditController);
  });

  it('provides AuditService', () => {
    expect(providerTokens()).toContain(AuditService);
  });

  it('supplies the writer by token rather than constructing one', () => {
    // The persistence adapter is the ONE thing still outstanding (no Prisma
    // client exists yet). Naming it as a token keeps that gap explicit and
    // swappable, instead of hiding it inside a `new` the module cannot defer.
    expect(providerTokens()).toContain(AUDIT_WRITER);
  });

  it('exports what other modules need, rather than keeping it private', () => {
    // An audit service nothing can inject is the unreachable state again, one
    // level in.
    const exported = metadata('exports');
    expect(exported).toContain(AuditService);
    expect(exported).toContain(AUDIT_WRITER);
  });

  it('keeps the service framework-free (PC-1)', () => {
    // The services carry no Nest decorators; the module wires them with factory
    // providers. That is what lets the architecture test assert a `.service.ts`
    // never imports an HTTP type while this file legitimately does.
    const providers = metadata('providers');
    const service = providers.find(
      (provider) =>
        typeof provider === 'object' &&
        provider !== null &&
        (provider as { provide?: unknown }).provide === AuditService,
    ) as { useFactory?: unknown; inject?: unknown[] } | undefined;

    expect(service?.useFactory, 'AuditService must be built by a factory, not decorated').toBeTypeOf(
      'function',
    );
    expect(service?.inject).toContain(AUDIT_WRITER);
  });

  it('builds a real AuditService from the factory', () => {
    // A factory that returns the wrong thing would satisfy every assertion
    // above and provide a broken object at runtime.
    const providers = metadata('providers');
    const service = providers.find(
      (provider) =>
        typeof provider === 'object' &&
        provider !== null &&
        (provider as { provide?: unknown }).provide === AuditService,
    ) as { useFactory: (writer: unknown) => unknown };

    const built = service.useFactory({ create: async () => undefined });
    expect(built).toBeInstanceOf(AuditService);
  });
});

describe('T674a · the container can actually build it, WITH its dependencies', () => {
  // Metadata assertions are necessary and not sufficient — but "it constructed
  // without throwing" is not sufficient either, and finding that out is the
  // point of this block.
  //
  // `AuditReader` is an interface and erases at compile time, so the controller
  // must name its token with `@Inject`. Dropping that `@Inject` was tried as a
  // mutation and **every metadata assertion above still passed, and so did a
  // test that merely constructed the controller** — because this suite is
  // transformed by esbuild, which does not emit `design:paramtypes`. Nest saw a
  // zero-argument constructor and happily built an instance whose reader was
  // `undefined`. Under `tsc` (how the API is actually built) metadata IS
  // emitted and the same code throws at bootstrap instead.
  //
  // So these assert what the container injected, not that it returned an
  // object. `@Inject` writes `self:paramtypes` directly and does not depend on
  // the transform, which is exactly why the distinction is observable here.

  it('instantiates the module, controller and service', async () => {
    const { NestFactory } = await import('@nestjs/core');
    const context = await NestFactory.createApplicationContext(AuditModule, { logger: false });
    try {
      expect(context.get(AuditService)).toBeInstanceOf(AuditService);
      expect(context.get(AuditController)).toBeInstanceOf(AuditController);
    } finally {
      await context.close();
    }
  });

  it('injects the reader into the controller — not undefined', async () => {
    // The assertion the mutation could not survive. A controller holding
    // `undefined` throws a TypeError on the first request; one wired correctly
    // reaches the unconfigured reader and refuses by name.
    const { NestFactory } = await import('@nestjs/core');
    const context = await NestFactory.createApplicationContext(AuditModule, { logger: false });
    try {
      const controller = context.get(AuditController);
      await expect(
        controller.list({ workspaceId: 'ws_a', userId: 'u1' }, {}),
      ).rejects.toThrow(AuditPersistenceUnavailableError);
    } finally {
      await context.close();
    }
  });

  it('refuses rather than silently discarding when persistence is unconfigured', async () => {
    // The default writer must fail loudly. One that dropped entries would let
    // an action succeed with no audit record — the exact outcome FR-033 and the
    // database trigger exist to prevent — and would do it invisibly.
    const { NestFactory } = await import('@nestjs/core');
    const context = await NestFactory.createApplicationContext(AuditModule, { logger: false });
    try {
      const service = context.get(AuditService);
      await expect(
        service.record({
          workspaceId: 'ws_a',
          actorId: 'u1',
          action: 'create',
          targetType: 'project',
          outcome: 'success',
        }),
      ).rejects.toThrow(AuditPersistenceUnavailableError);
    } finally {
      await context.close();
    }
  });
});

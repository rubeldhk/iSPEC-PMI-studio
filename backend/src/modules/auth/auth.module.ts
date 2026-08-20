/**
 * T025 — auth module wiring.
 *
 * The services stay framework-free (PC-1): no `@Injectable()`, no Nest import
 * outside this file, the controller, and the middleware. Plain classes wired
 * with factory providers — the same shape as `audit.module.ts` (T674) and
 * `jobs.module.ts` (T651).
 *
 * The user directory defaults to REFUSING, not to an empty answer
 * (`UnconfiguredUserDirectory`): a directory that said "no such user" to every
 * sign-in would present a missing adapter as a credentials problem. The
 * Prisma-backed adapter (`PrismaUserDirectory`) is supplied by overriding
 * `USER_DIRECTORY` at the composition root — the same seam as `AUDIT_WRITER`
 * and `JOB_STORE`.
 */
import { Inject, Module, type DynamicModule, type MiddlewareConsumer, type NestModule } from '@nestjs/common';
import { AuthController } from './auth.controller.js';
import {
  LocalIdentityProvider,
  UnconfiguredUserDirectory,
  type IdentityProvider,
  type UserDirectory,
} from './identity-provider.js';
import { Argon2PasswordService, type PasswordHasher } from './password.service.js';
import { SessionService } from './sessions.js';
import { SessionContextMiddleware } from './session-context.middleware.js';
import { IDENTITY_PROVIDER, PASSWORD_HASHER, USER_DIRECTORY } from './auth.tokens.js';

export { IDENTITY_PROVIDER, PASSWORD_HASHER, USER_DIRECTORY } from './auth.tokens.js';

/**
 * `T831` / `DEF-005-001` — the directory seam the module always promised.
 *
 * The comment above says the Prisma adapter "is supplied by overriding
 * `USER_DIRECTORY` at the composition root", and for the epic's whole life
 * nothing could actually do that: a static module's binding is not
 * overridable from outside, so the composed application resolved the refusing
 * default and every sign-in was a 500. `register()` makes the promise real —
 * the root passes a factory, and omitting it keeps the refusing default, so an
 * unconfigured environment still fails loudly rather than answering "no such
 * user" to everyone.
 */
@Module({})
export class AuthModule implements NestModule {
  // @Inject for the same reason as the controller: tsx/esbuild emits no
  // design:paramtypes, so without the token this is undefined and the session
  // middleware silently guards every route with a service that is not there.
  constructor(@Inject(SessionService) private readonly sessions: SessionService) {}

  static register(options: { directory?: () => UserDirectory } = {}): DynamicModule {
    return {
      module: AuthModule,
      controllers: [AuthController],
      providers: [
        { provide: PASSWORD_HASHER, useFactory: (): PasswordHasher => new Argon2PasswordService() },
        {
          provide: USER_DIRECTORY,
          useFactory: (): UserDirectory =>
            options.directory ? options.directory() : new UnconfiguredUserDirectory(),
        },
        {
          provide: IDENTITY_PROVIDER,
          inject: [USER_DIRECTORY, PASSWORD_HASHER],
          useFactory: (directory: UserDirectory, passwords: PasswordHasher): IdentityProvider =>
            new LocalIdentityProvider(directory, passwords),
        },
        { provide: SessionService, useFactory: (): SessionService => new SessionService() },
      ],
      exports: [SessionService, IDENTITY_PROVIDER, PASSWORD_HASHER, USER_DIRECTORY],
    };
  }

  configure(consumer: MiddlewareConsumer): void {
    const sessions = this.sessions;
    // Applied to every route: identity is established once, here, and each
    // endpoint decides what an absent context means (FR-002).
    consumer
      .apply((req: never, res: never, next: () => void) =>
        new SessionContextMiddleware(sessions).use(req, res, next),
      )
      .forRoutes('*');
  }
}

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
import { Module, type MiddlewareConsumer, type NestModule } from '@nestjs/common';
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

@Module({
  controllers: [AuthController],
  providers: [
    { provide: PASSWORD_HASHER, useFactory: (): PasswordHasher => new Argon2PasswordService() },
    { provide: USER_DIRECTORY, useFactory: (): UserDirectory => new UnconfiguredUserDirectory() },
    {
      provide: IDENTITY_PROVIDER,
      inject: [USER_DIRECTORY, PASSWORD_HASHER],
      useFactory: (directory: UserDirectory, passwords: PasswordHasher): IdentityProvider =>
        new LocalIdentityProvider(directory, passwords),
    },
    { provide: SessionService, useFactory: (): SessionService => new SessionService() },
  ],
  exports: [SessionService, IDENTITY_PROVIDER, PASSWORD_HASHER, USER_DIRECTORY],
})
export class AuthModule implements NestModule {
  constructor(private readonly sessions: SessionService) {}

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

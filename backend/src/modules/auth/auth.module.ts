/**
 * T025 — auth module wiring.
 *
 * The services stay framework-free (PC-1): no `@Injectable()`, no Nest import
 * outside this file, the controller, and the middleware. Plain classes wired
 * with factory providers — the same shape as `audit.module.ts` (T674) and
 * `jobs.module.ts` (T651).
 *
 * T831 (DEF-005-001): `USER_DIRECTORY` binds `PrismaUserDirectory` whenever
 * `DATABASE_URL` is configured — the adapter the epic built is the adapter
 * the application runs. Without a database the deliberately-refusing default
 * remains: a directory that said "no such user" to every sign-in would
 * present a missing adapter as a credentials problem, which is exactly how
 * this module reported the wiring gap UAT found. The env var IS this
 * process's composition input — the same signal `prisma migrate` deploys by —
 * so the binding lives here rather than waiting for a composition root that
 * did not exist when a 15/15-green epic shipped an unusable capability.
 */
import { Inject, Module, type MiddlewareConsumer, type NestModule } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';
import { AuthController } from './auth.controller.js';
import {
  LocalIdentityProvider,
  PrismaUserDirectory,
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
    {
      provide: USER_DIRECTORY,
      // T831: DATABASE_URL present → the real directory. Absent → refuse by
      // name, never pretend (DEF-005-001).
      useFactory: (): UserDirectory =>
        process.env['DATABASE_URL']
          ? new PrismaUserDirectory(new PrismaClient().user)
          : new UnconfiguredUserDirectory(),
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
})
export class AuthModule implements NestModule {
  // BY TOKEN — same reason as the controller (T674a/T830): esbuild-based
  // runners emit no design:paramtypes, and an implicit class injection
  // resolves to undefined that only throws on first use.
  constructor(@Inject(SessionService) private readonly sessions: SessionService) {}

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

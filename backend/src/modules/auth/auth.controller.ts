/**
 * T025 — session sign-in, sign-out, and `me` (contracts/platform-api.md · Authentication).
 *
 * PC-1: this is a transport. Credential checking lives behind the identity
 * provider, session state in the session service; this class translates and
 * manages the cookie, nothing more.
 *
 * Sessions are HTTP-only cookies. The cookie carries only the opaque token —
 * SameSite=Lax against CSRF, Path=/ so every route sees it. `Secure` arrives
 * with the first TLS environment (EPIC-014); local HTTP would silently drop a
 * Secure cookie and make sign-in look broken.
 */
import { Body, Controller, Get, HttpCode, Inject, Post, Req, Res } from '@nestjs/common';
import { UnauthenticatedError, ValidationFailedError } from '../../core/errors.js';
import type { Identity, IdentityProvider } from './identity-provider.js';
import { SessionService } from './sessions.js';
import { IDENTITY_PROVIDER } from './auth.tokens.js';

export const SESSION_COOKIE = 'pmi_session';

export interface SignInBody {
  email?: string;
  password?: string;
}

/** User and workspace identity — the sign-in and `me` response shape. */
export interface WhoAmI {
  user: { id: string; email: string; displayName: string };
  workspace: { id: string };
}

interface CookieCarrier {
  headers: { cookie?: string };
}

/** The one thing this controller needs from the response object. */
interface HeaderSetter {
  setHeader(name: string, value: string): void;
}

/** Parse one cookie out of the header. No dependency for one `split`. */
export function readCookie(req: CookieCarrier, name: string): string | null {
  const header = req.headers.cookie;
  if (!header) return null;
  for (const part of header.split(';')) {
    const [key, ...rest] = part.trim().split('=');
    if (key === name) return rest.join('=') || null;
  }
  return null;
}

function toWhoAmI(identity: Identity): WhoAmI {
  return {
    user: { id: identity.userId, email: identity.email, displayName: identity.displayName },
    workspace: { id: identity.workspaceId },
  };
}

@Controller('auth')
export class AuthController {
  constructor(
    // Injected BY TOKEN — the interface erases at compile time (T674 precedent).
    @Inject(IDENTITY_PROVIDER) private readonly identities: IdentityProvider,
    private readonly sessions: SessionService,
  ) {}

  @Post('sign-in')
  @HttpCode(200)
  async signIn(@Body() body: SignInBody, @Res({ passthrough: true }) res: HeaderSetter): Promise<WhoAmI> {
    const fields: { field: string; reason: string }[] = [];
    if (!body.email || body.email.trim() === '') fields.push({ field: 'email', reason: 'required' });
    if (!body.password || body.password === '') fields.push({ field: 'password', reason: 'required' });
    if (fields.length > 0) {
      throw new ValidationFailedError('Sign-in request is incomplete.', { fields });
    }

    const identity = await this.identities.authenticate(body.email as string, body.password as string);
    if (identity === null) {
      // One message for both unknown email and wrong password — naming which
      // half failed would confirm account existence.
      throw new UnauthenticatedError('Invalid email or password.');
    }

    const session = this.sessions.create(identity);
    res.setHeader(
      'Set-Cookie',
      `${SESSION_COOKIE}=${session.token}; HttpOnly; SameSite=Lax; Path=/`,
    );
    return toWhoAmI(identity);
  }

  @Post('sign-out')
  @HttpCode(200)
  async signOut(
    @Req() req: CookieCarrier,
    @Res({ passthrough: true }) res: HeaderSetter,
  ): Promise<{ signedOut: true }> {
    const token = readCookie(req, SESSION_COOKIE);
    if (token) this.sessions.destroy(token);
    // Expire the cookie regardless — sign-out with no live session is still a
    // success, not an error a user can do anything about.
    res.setHeader('Set-Cookie', `${SESSION_COOKIE}=; HttpOnly; SameSite=Lax; Path=/; Max-Age=0`);
    return { signedOut: true };
  }

  @Get('me')
  async me(@Req() req: CookieCarrier): Promise<WhoAmI> {
    const token = readCookie(req, SESSION_COOKIE);
    const session = token ? this.sessions.resolve(token) : null;
    if (!session) throw new UnauthenticatedError('No valid session.');
    return toWhoAmI(session);
  }
}

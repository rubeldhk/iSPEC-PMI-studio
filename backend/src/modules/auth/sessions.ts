/**
 * Server-side sessions (part of T025, R-008).
 *
 * Sessions are opaque random tokens mapped to identities in process memory —
 * the smallest thing that establishes user and workspace identity on every
 * request for a Phase 1 single-user surface. The token carries nothing; all
 * meaning lives server-side, which is why sign-out genuinely ends the session
 * rather than waiting for an expiry the client promised to honour.
 *
 * Framework-free (PC-1). Wired in `auth.module.ts`.
 */
import { randomBytes } from 'node:crypto';
import type { Identity } from './identity-provider.js';

export interface SessionRecord extends Identity {
  token: string;
  expiresAt: Date;
}

export interface SessionOptions {
  /** Defaults to 12 hours — a working day, not a persistent login. */
  ttlMs?: number;
  /** Injectable clock, so expiry is testable without waiting. */
  now?: () => Date;
}

const DEFAULT_TTL_MS = 12 * 60 * 60 * 1000;

export class SessionService {
  private readonly sessions = new Map<string, SessionRecord>();
  private readonly ttlMs: number;
  private readonly now: () => Date;

  constructor(options: SessionOptions = {}) {
    this.ttlMs = options.ttlMs ?? DEFAULT_TTL_MS;
    this.now = options.now ?? ((): Date => new Date());
  }

  create(identity: Identity): SessionRecord {
    const token = randomBytes(32).toString('hex');
    const record: SessionRecord = {
      ...identity,
      token,
      expiresAt: new Date(this.now().getTime() + this.ttlMs),
    };
    this.sessions.set(token, record);
    return record;
  }

  /** A live session, or null. An expired session is removed on sight. */
  resolve(token: string): SessionRecord | null {
    const record = this.sessions.get(token);
    if (!record) return null;
    if (record.expiresAt.getTime() <= this.now().getTime()) {
      this.sessions.delete(token);
      return null;
    }
    return record;
  }

  destroy(token: string): void {
    this.sessions.delete(token);
  }
}

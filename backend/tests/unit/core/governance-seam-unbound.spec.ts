/**
 * `T1195` (EPIC-001) — a documented code for an unbound governance seam.
 *
 * `DEF-033-002`'s third item. Two ports that `ROOM_PORTS` declares
 * `absent: 'refuse'` are unbound, and their refusals reach a user as
 * **"An unexpected error occurred."** — indistinguishable from a crash.
 *
 * The consuming Epics were right not to fix this locally. `PolicyUnavailableError`
 * says so in its own comment: *"no documented status code means 'a governance
 * seam is unbound', and `DEF-008-001` is what happens when an Epic that does not
 * own `platform-api.md` invents one."* `provider_unavailable` looks like a fit
 * and is not — it is documented in `platform-api-epic-002.md` for an unreachable
 * **storage provider**, and borrowing another Epic's documented meaning is the
 * same mistake pointing the other way.
 *
 * So the code is added **here**, by the Epic that owns the contract, and the
 * status table is amended in the same change.
 */
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  GovernanceSeamUnboundError,
  PlatformError,
  toErrorBody,
  toHttpStatus,
} from '../../../src/core/errors.js';

const here = dirname(fileURLToPath(import.meta.url));
const CONTRACT = resolve(here, '../../../../specs/_shared/contracts/platform-api.md');

describe('T1195 · the code exists and is a PlatformError', () => {
  it('carries `governance_seam_unbound`', () => {
    const error = new GovernanceSeamUnboundError('the PolicyProvider seam is unbound');
    expect(error.code).toBe('governance_seam_unbound');
    expect(error).toBeInstanceOf(PlatformError);
  });

  it('is 503 — the seam is absent, not the request malformed', () => {
    // Not 422: the request was well formed and the refusal is not about its
    // content. Not 502: that is an unreachable upstream provider, documented
    // for `EPIC-025`. 503 says the service cannot serve this until something is
    // configured, which is exactly the state.
    expect(toHttpStatus(new GovernanceSeamUnboundError('x'))).toBe(503);
  });

  it('keeps its own message, so the seam is named', () => {
    // The whole point. `internal_error` gave the caller nothing; this must say
    // WHICH seam, or it is the same defect with a nicer number.
    const body = toErrorBody(
      new GovernanceSeamUnboundError('the PolicyProvider seam is unbound — EPIC-031 supplies it'),
    );
    expect(body.error.code).toBe('governance_seam_unbound');
    expect(body.error.message).toMatch(/PolicyProvider/);
    expect(body.error.message).toMatch(/EPIC-031/);
  });

  it('an unrelated error is still internal_error', () => {
    // Anti-vacuity: the mapping must not have widened to catch everything.
    expect(toHttpStatus(new Error('something else'))).toBe(500);
    expect(toErrorBody(new Error('something else')).error.code).toBe('internal_error');
  });
});

describe('T1195 · the contract documents it', () => {
  it('`platform-api.md` lists the status', () => {
    // `DEF-008-001`'s rule, satisfied rather than worked around: the code exists
    // because the owning contract documents it, not because an epic needed one.
    const contract = readFileSync(CONTRACT, 'utf8');
    expect(contract).toMatch(/`503`/);
    expect(contract).toMatch(/governance seam/i);
  });

  it('and says a seam that is unbound REFUSES rather than defaults', () => {
    // `FR-GEL-062`'s reasoning, recorded where a reader of the contract meets
    // it: a default that permits is invisible at every call site.
    const contract = readFileSync(CONTRACT, 'utf8');
    expect(contract).toMatch(/refus/i);
  });
});

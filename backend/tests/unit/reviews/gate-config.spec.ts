/**
 * T277 — a gate binds only to a permitted M08 lifecycle transition
 * (FR-ENH-012, finding A1 resolved). Written to FAIL before T278/T280 exist.
 */
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import {
  GateConfigService,
  InMemoryGateStore,
  PERMITTED_GATE_TRANSITIONS,
} from '../../../src/modules/reviews/gate-config.service.js';
import { PERMITTED_TRANSITIONS } from '../../../src/modules/specifications/lifecycle.machine.js';

const here = dirname(fileURLToPath(import.meta.url));
const SCHEMA = readFileSync(resolve(here, '../../../prisma/schema.prisma'), 'utf8');

const WS = 'ws_a';

function build(): GateConfigService {
  return new GateConfigService(new InMemoryGateStore());
}

describe('T277 · the permitted transition set is EPIC-009s, not a copy', () => {
  it('derives the eight from the ONE lifecycle machine — the two can never drift', () => {
    expect(PERMITTED_GATE_TRANSITIONS).toEqual(
      PERMITTED_TRANSITIONS.map((t) => `${t.from}->${t.to}`),
    );
    expect(PERMITTED_GATE_TRANSITIONS.length).toBe(8);
  });

  it.each(PERMITTED_TRANSITIONS.map((t) => [`${t.from}->${t.to}`]))(
    'a gate binds to %s',
    async (transition) => {
      const gate = await build().createGate(WS, {
        transition,
        requiredRoles: ['security-reviewer'],
        blocking: true,
      });
      expect(gate.transition).toBe(transition);
    },
  );

  it('an unknown transition is refused BY NAME, listing the permitted set', async () => {
    const err = await build()
      .createGate(WS, { transition: 'approved->draft', requiredRoles: ['qa-agent'], blocking: true })
      .catch((e: unknown) => e as Error);
    expect(err).toBeInstanceOf(Error);
    expect((err as Error).message).toMatch(/approved->draft/);
    expect((err as Error).message).toMatch(/draft->review/);
  });

  it('an unknown role in the gate is refused by name', async () => {
    await expect(
      build().createGate(WS, {
        transition: 'draft->review',
        requiredRoles: ['vibes-reviewer'],
        blocking: true,
      }),
    ).rejects.toThrow(/vibes-reviewer/);
  });

  it('a gate with NO roles is refused — the gate fails closed, twelve is never a default (clarification 2026-08-19)', async () => {
    await expect(
      build().createGate(WS, { transition: 'draft->review', requiredRoles: [], blocking: true }),
    ).rejects.toThrow(/role/i);
  });
});

describe('T277 · the ReviewGate model (T278)', () => {
  it('exists with transition, required roles, and blocking', () => {
    const match = /model ReviewGate \{[\s\S]*?\n\}/.exec(SCHEMA);
    expect(match, 'model ReviewGate missing').toBeTruthy();
    const block = match![0];
    expect(block).toMatch(/transition\s+String/);
    expect(block).toMatch(/requiredRoles\s+String\[\]/);
    expect(block).toMatch(/blocking\s+Boolean/);
    expect(block).toMatch(/@@map\("review_gates"\)/);
  });
});

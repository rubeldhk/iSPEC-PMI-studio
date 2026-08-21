/**
 * T280 — gate configuration and capability checking (FR-ENH-012, E-R5).
 *
 * A gate binds only to a permitted M08 transition — the set is DERIVED from
 * EPIC-009's lifecycle machine, not copied, so the two can never drift. A
 * gate with no roles is refused: the gate fails closed, and twelve is never
 * a default (clarification 2026-08-19; this epic carries PP-017's whole cost
 * exposure). Framework-free (PC-1).
 */
import { REVIEW_CAPABILITY, type EngineDescriptor } from '@pmi/engine-contract';
import { ValidationFailedError } from '../../core/errors.js';
import { PERMITTED_TRANSITIONS } from '../specifications/lifecycle.machine.js';
import { roleByName } from './roles.js';

/** `from->to` for each of the eight permitted transitions — derived, not copied. */
export const PERMITTED_GATE_TRANSITIONS: readonly string[] = PERMITTED_TRANSITIONS.map(
  (t) => `${t.from}->${t.to}`,
);

export interface ReviewGateRecord {
  id: string;
  workspaceId: string;
  transition: string;
  requiredRoles: string[];
  blocking: boolean;
}

export interface GateStore {
  append(gate: ReviewGateRecord): Promise<ReviewGateRecord>;
  findForTransition(workspaceId: string, transition: string): Promise<ReviewGateRecord[]>;
}

export class ReviewCapabilityUnavailableError extends ValidationFailedError {}

let seq = 0;

export class GateConfigService {
  constructor(private readonly store: GateStore) {}

  async createGate(
    workspaceId: string,
    input: { transition: string; requiredRoles: string[]; blocking: boolean },
  ): Promise<ReviewGateRecord> {
    if (!PERMITTED_GATE_TRANSITIONS.includes(input.transition)) {
      throw new ValidationFailedError(
        `"${input.transition}" is not a permitted lifecycle transition. ` +
          `Gates bind to one of: ${PERMITTED_GATE_TRANSITIONS.join(', ')}.`,
      );
    }
    if (input.requiredRoles.length === 0) {
      throw new ValidationFailedError(
        'A gate must name the roles it runs — there is no implicit default, and an ' +
          'unconfigured gate fails closed.',
      );
    }
    for (const name of input.requiredRoles) roleByName(name); // refused by name

    return this.store.append({
      id: `rg_${++seq}_${Math.random().toString(36).slice(2, 8)}`,
      workspaceId,
      transition: input.transition,
      requiredRoles: [...input.requiredRoles],
      blocking: input.blocking,
    });
  }

  /**
   * E-R5 — the engine registered fine without review; the GATE is where the
   * absence is refused, with the engine and the missing capability named.
   */
  assertEngineCanReview(descriptor: EngineDescriptor): void {
    if (!descriptor.capabilities.includes(REVIEW_CAPABILITY)) {
      throw new ReviewCapabilityUnavailableError(
        `Engine "${descriptor.name}" declares no "${REVIEW_CAPABILITY}" capability, so this ` +
          'gate cannot run. The engine remains registered; configure the gate against a ' +
          'reviewing engine or remove it.',
      );
    }
  }
}

export class InMemoryGateStore implements GateStore {
  private readonly rows: ReviewGateRecord[] = [];

  async append(gate: ReviewGateRecord): Promise<ReviewGateRecord> {
    this.rows.push({ ...gate });
    return { ...gate };
  }

  async findForTransition(workspaceId: string, transition: string): Promise<ReviewGateRecord[]> {
    return this.rows
      .filter((r) => r.workspaceId === workspaceId && r.transition === transition)
      .map((r) => ({ ...r }));
  }
}

/**
 * T337y — the Requirement Room's service seam.
 *
 * PC-1: framework-free. The module wires it; it stays callable without HTTP so
 * an MCP surface can be added in Phase 3 without redesign.
 *
 * **What this is at T337y**: the module skeleton and its wiring, so T337x's
 * reachability test has a real graph to resolve and real routes to reach. The
 * operations land across Phases 3–8.
 *
 * A stub returning a plausible success would be the defect this Epic's own
 * reachability test exists to catch, one level down. So each unbuilt operation
 * throws, naming the task that will implement it — and validation that is real
 * lands now, so a route answers *"your request is wrong"* rather than
 * *"we broke"*.
 */
import { ValidationFailedError } from '../../core/errors.js';

export class NotYetImplementedError extends Error {
  constructor(operation: string, task: string) {
    super(`requirement-room.${operation} is declared and not yet implemented — ${task}`);
    this.name = 'NotYetImplementedError';
  }
}

export interface IntakeInput {
  readonly workspaceId: string;
  readonly projectId: string;
  readonly sourceRef: string;
  readonly text: string;
}

const INTAKE_REQUIRED = ['workspaceId', 'projectId', 'sourceRef', 'text'] as const;

export class RequirementRoomService {
  /** FR-RQR-010 — multi-source intake becomes labelled candidates. Lands at T338b. */
  intake(input: IntakeInput): Promise<unknown> {
    const missing = INTAKE_REQUIRED.filter((field) => {
      const value = (input as unknown as Record<string, unknown> | null | undefined)?.[field];
      return typeof value !== 'string' || value.length === 0;
    });
    if (missing.length > 0) {
      throw new ValidationFailedError(`intake requires: ${missing.join(', ')}`);
    }
    throw new NotYetImplementedError('intake', 'T338b');
  }

  /** FR-RQR-012 — clarifications as one set. Lands at T338j. */
  clarifications(_roomObjectId: string): Promise<unknown> {
    throw new NotYetImplementedError('clarifications', 'T338j');
  }

  /** FR-RQR-014 — labelled candidates, conflicts, gaps. Lands at T338n. */
  analysis(_roomObjectId: string): Promise<unknown> {
    throw new NotYetImplementedError('analysis', 'T338n');
  }

  /** FR-RQR-020 — two or more options, each a recommendation. Lands at T339c. */
  options(_roomObjectId: string): Promise<unknown> {
    throw new NotYetImplementedError('options', 'T339c');
  }

  /** FR-RQR-040 — an authorized human decision. Lands at T339p. */
  decide(_roomObjectId: string): Promise<unknown> {
    throw new NotYetImplementedError('decide', 'T339p');
  }

  /** FR-RQR-050 — freeze the set. Lands at T338f. */
  baseline(_roomObjectId: string): Promise<unknown> {
    throw new NotYetImplementedError('baseline', 'T338f');
  }

  /** FR-RQR-060 — select a baselined set as specification input. Lands at T403c. */
  handoff(_version: string): Promise<unknown> {
    throw new NotYetImplementedError('handoff', 'T403c');
  }

  /** FR-RQR-073 — what is blocking. Lands at T403q. */
  readiness(_roomObjectId: string): Promise<unknown> {
    throw new NotYetImplementedError('readiness', 'T403q');
  }
}

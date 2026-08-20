/**
 * T121 — validation orchestration through the engine contract (FR-023).
 *
 * The engine says what it found; this service holds the line on TWO rules:
 * a finding without a location is malformed output (FR-023 — the contract
 * marks `location` required, and an engine that ignores that produced output
 * we refuse), and a refused result stores NO partial artifact (FR-027) — the
 * well-formed siblings of a malformed finding are not stored either.
 *
 * Framework-free (PC-1). Wired in `specifications.module.ts`.
 */
import { randomUUID } from 'node:crypto';
import {
  engineFail,
  type EngineContext,
  type EngineResult,
  type SpecificationEngine,
  type ValidateSpecificationInput,
  type ValidationFinding,
} from '@pmi/engine-contract';

export interface StoredFinding extends ValidationFinding {
  id: string;
  workspaceId: string;
  specificationId: string;
  specificationVersionId: string;
}

/** Append-only: findings belong to the version validated, forever. */
export interface FindingSink {
  appendAll(findings: StoredFinding[]): Promise<void>;
}

export interface ValidationTarget {
  workspaceId: string;
  specificationId: string;
  specificationVersionId: string;
}

export class ValidateSpecificationService {
  constructor(private readonly sink: FindingSink) {}

  async validate(
    engine: SpecificationEngine,
    input: ValidateSpecificationInput,
    ctx: EngineContext,
    target: ValidationTarget,
  ): Promise<EngineResult<ValidationFinding[]>> {
    const result = await engine.validateSpecification(input, ctx);
    // An engine failure passes through untouched — re-labelling it would
    // erase the distinction FR-026 exists to preserve.
    if (!result.ok) return result;

    const malformed = result.value.filter((f) => !f.location || f.location.trim() === '');
    if (malformed.length > 0) {
      // FR-027: no partial artifact — nothing from this run is stored.
      return engineFail(
        'malformed_output',
        `${malformed.length} finding(s) carry no location; a finding must identify the part of the specification concerned (FR-023).`,
      );
    }

    await this.sink.appendAll(
      result.value.map((finding) => ({
        ...finding,
        id: randomUUID(),
        workspaceId: target.workspaceId,
        specificationId: target.specificationId,
        specificationVersionId: target.specificationVersionId,
      })),
    );
    return result;
  }
}

/** In-memory sink for tests and database-less runs. Append-only. */
export class InMemoryFindingSink implements FindingSink {
  readonly findings: StoredFinding[] = [];

  async appendAll(findings: StoredFinding[]): Promise<void> {
    this.findings.push(...findings.map((f) => Object.freeze({ ...f }) as StoredFinding));
  }
}

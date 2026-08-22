/**
 * T285 — gate execution (FR-ENH-013, FR-ENH-016).
 *
 * Every required role runs CONCURRENTLY through the engine contract — the
 * cost is per-invocation either way (one per role per gate, the PP-017
 * exposure T291 re-scores); sequential execution would only add latency.
 *
 * The platform stamps each finding with the role it ASKED (attribution is
 * never trusted from the adapter); a finding without a location — or any
 * malformed member — makes the WHOLE role result malformed_output, stored
 * as a failed role, never as a partial review (E-R2). An unavailable or
 * failed role fails the GATE, never passes it (E-R3). Empty findings is a
 * PASS (E-R4).
 */
import {
  isEngineFailure,
  type EngineResult,
  type ReviewOutput,
  type SpecificationEngine,
  type ValidationFinding,
} from '@pmi/engine-contract';
import type { ReviewRole } from './roles.js';
import type { ReviewGateRecord } from './gate-config.service.js';

export interface AttributedFinding {
  roleId: string;
  location: string;
  severity: ValidationFinding['severity'];
  message: string;
}

export type ValidatedOutput =
  | { ok: true; findings: AttributedFinding[] }
  | { ok: false; reason: 'malformed_output' };

/** E-R2 — validate and ATTRIBUTE in one act; partial reviews do not exist. */
export function validateReviewOutput(
  findings: ValidationFinding[],
  roleId: string,
): ValidatedOutput {
  const attributed: AttributedFinding[] = [];
  for (const finding of findings) {
    if (
      typeof finding.location !== 'string' ||
      finding.location.trim() === '' ||
      typeof finding.message !== 'string' ||
      finding.message.trim() === '' ||
      !['info', 'warning', 'error'].includes(finding.severity)
    ) {
      return { ok: false, reason: 'malformed_output' };
    }
    attributed.push({
      roleId,
      location: finding.location,
      severity: finding.severity,
      message: finding.message,
    });
  }
  return { ok: true, findings: attributed };
}

export interface RoleRun {
  roleId: string;
  status: 'completed' | 'failed';
  reason?: string;
}

export interface GateExecutionOutcome {
  gateId: string;
  rolesRun: RoleRun[];
  findings: AttributedFinding[];
  gateFailed: boolean;
  failedRoles: string[];
}

export interface GateExecutionInput {
  specification: string;
  roles: ReviewRole[];
  steering?: { subject: string; scopeType: string; content: string; version: number }[];
}

export class GateExecutionService {
  constructor(private readonly options: { timeoutMs?: number } = {}) {}

  async execute(
    gate: ReviewGateRecord,
    input: GateExecutionInput,
    engine: SpecificationEngine,
  ): Promise<GateExecutionOutcome> {
    const timeoutMs = this.options.timeoutMs ?? 600_000; // the platform's per-job cap posture

    const runs = await Promise.all(
      input.roles.map(async (role): Promise<{ run: RoleRun; findings: AttributedFinding[] }> => {
        if (typeof engine.reviewSpecification !== 'function') {
          // E-R5's gate-time half: the engine registered fine; THIS gate fails.
          return {
            run: { roleId: role.name, status: 'failed', reason: 'review_specification unavailable' },
            findings: [],
          };
        }
        let result: EngineResult<ReviewOutput>;
        try {
          result = await engine.reviewSpecification(
            {
              specification: input.specification,
              role: {
                name: role.name,
                responsibility: role.responsibility,
                permittedArtifactTypes: role.permittedArtifactTypes,
              },
              ...(input.steering ? { steering: input.steering as never } : {}),
            },
            {
              signal: new AbortController().signal,
              timeoutMs,
              correlationId: `gate_${gate.id}_${role.name}`,
            },
          );
        } catch {
          // E-R1 says adapters return failures; one that throws anyway is
          // still a FAILED role, never a silently skipped one.
          return {
            run: { roleId: role.name, status: 'failed', reason: 'engine_error' },
            findings: [],
          };
        }

        if (isEngineFailure(result)) {
          return {
            run: { roleId: role.name, status: 'failed', reason: result.failure.reason },
            findings: [],
          };
        }
        const validated = validateReviewOutput(result.value.findings, role.name);
        if (!validated.ok) {
          // Malformed output is treated as role unavailability (E-R2).
          return {
            run: { roleId: role.name, status: 'failed', reason: 'malformed_output' },
            findings: [],
          };
        }
        return { run: { roleId: role.name, status: 'completed' }, findings: validated.findings };
      }),
    );

    const rolesRun = runs.map((r) => r.run);
    const failedRoles = rolesRun.filter((r) => r.status === 'failed').map((r) => r.roleId);
    return {
      gateId: gate.id,
      rolesRun,
      findings: runs.flatMap((r) => r.findings),
      gateFailed: failedRoles.length > 0,
      failedRoles,
    };
  }
}

/**
 * Fixture adapter — a deliberately trivial engine.
 *
 * It exists so the contract, registry, and every downstream consumer are
 * provably correct BEFORE the container sandbox is built, and so the test
 * suite never invokes a live AI agent (research R-009, R-010).
 *
 * Deterministic by construction: same input, same output, always.
 */
import {
  assertPhase1Capabilities,
  engineFail,
  engineOk,
  PHASE_1_CAPABILITIES,
  type EngineContext,
  type EngineDescriptor,
  type EngineFailureReason,
  type EngineResult,
  type GeneratedSpecification,
  type GeneratedTask,
  type GenerateSpecificationInput,
  type GenerateTasksInput,
  type SpecificationEngine,
  type ValidateSpecificationInput,
  type ValidationFinding,
} from '@pmi/engine-contract';

/** Maximum requirements the fixture will accept — mirrors a real engine's input ceiling. */
export const FIXTURE_INPUT_CEILING = 500;

export interface FixtureOptions {
  /** Force every call to fail with this reason. Used to exercise the taxonomy. */
  failWith?: EngineFailureReason;
  /** Simulate work so cancellation and timeout can be tested. */
  delayMs?: number;
}

export class FixtureEngine implements SpecificationEngine {
  readonly descriptor: EngineDescriptor = {
    name: 'fixture',
    version: 'fixture-1.0.0+model=none',
    capabilities: [...PHASE_1_CAPABILITIES],
  };

  constructor(private readonly options: FixtureOptions = {}) {
    assertPhase1Capabilities(this.descriptor);
  }

  async generateSpecification(
    input: GenerateSpecificationInput,
    ctx: EngineContext,
  ): Promise<EngineResult<GeneratedSpecification>> {
    // E7: reject oversized input BEFORE starting work, not after failing.
    if (input.requirements.length === 0) {
      return engineFail('empty_selection', 'Select at least one requirement.');
    }
    if (input.requirements.length > FIXTURE_INPUT_CEILING) {
      return engineFail(
        'input_too_large',
        `Selection of ${input.requirements.length} exceeds the engine limit of ${FIXTURE_INPUT_CEILING}.`,
      );
    }

    const forced = await this.runOrFail(ctx);
    if (forced) return forced as EngineResult<GeneratedSpecification>;

    const contentRaw = [
      `# Specification: ${input.projectName}`,
      '',
      ...input.requirements.map((r) => `- ${r.reference} (${r.type}/${r.priority}) ${r.description}`),
    ].join('\n');

    return engineOk(
      {
        title: `Specification: ${input.projectName}`,
        contentRaw,
        contentParsed: {
          title: `Specification: ${input.projectName}`,
          requirementRefs: input.requirements.map((r) => r.reference),
        },
      },
      this.descriptor,
    );
  }

  async generateTasks(
    input: GenerateTasksInput,
    ctx: EngineContext,
  ): Promise<EngineResult<GeneratedTask[]>> {
    const forced = await this.runOrFail(ctx);
    if (forced) return forced as EngineResult<GeneratedTask[]>;
    return engineOk(
      [{ description: `Implement ${input.specificationTitle}` }],
      this.descriptor,
    );
  }

  async validateSpecification(
    input: ValidateSpecificationInput,
    ctx: EngineContext,
  ): Promise<EngineResult<ValidationFinding[]>> {
    const forced = await this.runOrFail(ctx);
    if (forced) return forced as EngineResult<ValidationFinding[]>;

    const findings: ValidationFinding[] = [];
    if (!input.specificationContent.trim()) {
      // FR-023: every finding carries a location.
      findings.push({ location: 'document', severity: 'error', message: 'Specification is empty.' });
    }
    return engineOk(findings, this.descriptor);
  }

  /**
   * Shared cancellation / timeout / injected-failure path.
   * Returns a failure result, or null to continue.
   */
  private async runOrFail(ctx: EngineContext): Promise<EngineResult<never> | null> {
    if (ctx.signal.aborted) {
      return engineFail('cancelled', 'Generation was cancelled.');
    }
    if (this.options.delayMs) {
      const outcome = await raceAgainst(this.options.delayMs, ctx);
      if (outcome) return outcome;
    }
    if (this.options.failWith) {
      return engineFail(this.options.failWith, `Injected failure: ${this.options.failWith}.`);
    }
    return null;
  }
}

/** E4 + E5: honour cancellation and self-terminate on timeout. */
function raceAgainst(delayMs: number, ctx: EngineContext): Promise<EngineResult<never> | null> {
  return new Promise((resolve) => {
    const done = (r: EngineResult<never> | null) => {
      clearTimeout(work);
      clearTimeout(limit);
      ctx.signal.removeEventListener('abort', onAbort);
      resolve(r);
    };
    const onAbort = () => done(engineFail('cancelled', 'Generation was cancelled.'));
    const work = setTimeout(() => done(null), delayMs);
    const limit = setTimeout(
      () => done(engineFail('timeout', `Exceeded the ${ctx.timeoutMs}ms limit.`)),
      ctx.timeoutMs,
    );
    ctx.signal.addEventListener('abort', onAbort, { once: true });
  });
}

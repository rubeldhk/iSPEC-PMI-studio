/**
 * Shared fixtures for the EPIC-008 specification tests.
 *
 * Mirrors `tests/unit/requirements/helpers.ts`: one place to build a stub
 * engine and a requirement selection, so a test file says what it asserts
 * rather than how it assembles a world.
 */
import type {
  EngineContext,
  EngineDescriptor,
  EngineResult,
  GeneratedSpecification,
  GeneratedTask,
  GenerateSpecificationInput,
  GenerateTasksInput,
  SpecificationEngine,
  ValidateSpecificationInput,
  ValidationFinding,
} from '@pmi/engine-contract';
import { engineFail, engineOk } from '@pmi/engine-contract';
import type { RequirementSelection } from '../../../src/modules/specifications/generate-specification.service.js';

export const DESCRIPTOR: EngineDescriptor = {
  name: 'stub',
  version: '1.4.0+model-x',
  capabilities: ['generate_specification', 'generate_tasks', 'validate_specification'],
};

export const OUTPUT: GeneratedSpecification = {
  title: 'Payments Specification',
  contentRaw: '# Payments\n\nThe system shall settle in one transaction.',
  contentParsed: { sections: [{ heading: 'Payments' }] },
};

/**
 * A `SpecificationEngine` whose generate step is scripted.
 *
 * `generateTasks` and `validateSpecification` are present because the contract
 * requires them; EPIC-008 never calls them, and they say so rather than
 * pretending to work.
 */
export class StubEngine implements SpecificationEngine {
  readonly calls: GenerateSpecificationInput[] = [];

  constructor(
    private readonly script: (
      input: GenerateSpecificationInput,
      ctx: EngineContext,
    ) => Promise<EngineResult<GeneratedSpecification>>,
    readonly descriptor: EngineDescriptor = DESCRIPTOR,
  ) {}

  static returning(value: GeneratedSpecification = OUTPUT, descriptor = DESCRIPTOR): StubEngine {
    return new StubEngine(async () => engineOk(value, descriptor), descriptor);
  }

  static failing(
    reason: Parameters<typeof engineFail>[0],
    message = 'scripted failure',
  ): StubEngine {
    return new StubEngine(async () => engineFail<GeneratedSpecification>(reason, message));
  }

  async generateSpecification(
    input: GenerateSpecificationInput,
    ctx: EngineContext,
  ): Promise<EngineResult<GeneratedSpecification>> {
    this.calls.push(input);
    return this.script(input, ctx);
  }

  async generateTasks(_i: GenerateTasksInput, _c: EngineContext): Promise<EngineResult<GeneratedTask[]>> {
    return engineFail<GeneratedTask[]>('engine_error', 'not used by EPIC-008');
  }

  async validateSpecification(
    _i: ValidateSpecificationInput,
    _c: EngineContext,
  ): Promise<EngineResult<ValidationFinding[]>> {
    return engineFail<ValidationFinding[]>('engine_error', 'not used by EPIC-008');
  }
}

/** Three requirements, distinct ids and references. */
export function selection(count = 3): RequirementSelection[] {
  return Array.from({ length: count }, (_unused, i) => ({
    id: `req_${i + 1}`,
    reference: `REQ-${String(i + 1).padStart(3, '0')}`,
    description: `The system shall do thing ${i + 1}.`,
    type: 'functional' as const,
    priority: 'p1' as const,
  }));
}

export const WS = 'ws_a';
export const OTHER_WS = 'ws_b';
export const PROJECT = 'proj_1';
export const CTX = { workspaceId: WS, userId: 'u1' };

/**
 * `T2593` (EPIC-047) — the seam through which a composition root hands the API
 * the agent runtime an Expert run executes in. `DEF-047-002`, option A.
 *
 * `backend/src` may name no agent adapter, execution provider or model
 * (`agent-independence.spec.ts`, `eslint.config.js`). The runtime is therefore
 * composed outside it — by `@pmi/api-launcher` — and enters here, through the
 * one exported door, `@pmi/backend/api`.
 *
 * Global, so `ExpertsModule` sees `EXPERT_AGENT_RUNTIME` without importing this
 * module: importing it there would make every composition of `AppModule` carry
 * a runtime slot it had to fill. Instead `ExpertsModule` injects the token
 * **optionally**, and a composition that supplies nothing — every test that
 * builds `AppModule`, and `main.ts` — keeps the refusal that names
 * `DEF-047-002`. Nothing becomes permissive by default.
 */
import { Module, type DynamicModule } from '@nestjs/common';
import { EXPERT_AGENT_RUNTIME, type AgentRuntime } from '../modules/experts/adapters/runners.adapter.js';

@Module({})
export class ExpertAgentRuntimeModule {
  static forRoot(runtime: AgentRuntime): DynamicModule {
    return {
      module: ExpertAgentRuntimeModule,
      global: true,
      providers: [{ provide: EXPERT_AGENT_RUNTIME, useValue: runtime }],
      exports: [EXPERT_AGENT_RUNTIME],
    };
  }
}

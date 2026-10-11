/**
 * `T2595` (EPIC-047) — start the API with the agent runtime composed.
 * `DEF-047-002`, option A.
 *
 * The container entrypoint runs this after migrating. `backend/src/main.ts`
 * still starts the API with nothing composed, for anyone who wants that.
 */
import { bootstrapApi } from '@pmi/backend/api';
import { composeExpertRuntime } from './compose.js';

void bootstrapApi({ expertAgentRuntime: composeExpertRuntime() });

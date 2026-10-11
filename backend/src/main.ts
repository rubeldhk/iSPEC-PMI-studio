/**
 * API entry point, with nothing composed.
 *
 * The bootstrap — observability, the error filter, body parsing, the version
 * prefix — lives in `api.ts` (`@pmi/backend/api`), so a composition root
 * outside `backend/src` can start the same API with an agent runtime
 * (`@pmi/api-launcher`, `DEF-047-002`). Started from here, Expert dispatch
 * refuses naming that defect, because `backend/src` may name no agent adapter.
 */
import { bootstrapApi } from './api.js';

void bootstrapApi();

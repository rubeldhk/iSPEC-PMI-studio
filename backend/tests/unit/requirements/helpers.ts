/**
 * Shared builder for the requirements test suite. In its own (non-spec) module
 * so importing it does not re-register another file's tests.
 */
import {
  InMemoryRequirementStore,
  RequirementsService,
} from '../../../src/modules/requirements/requirements.service.js';
import {
  InMemoryRequirementVersionStore,
  RequirementVersionService,
} from '../../../src/modules/requirements/requirement-version.service.js';

export function buildService(): {
  svc: RequirementsService;
  store: InMemoryRequirementStore;
  versions: RequirementVersionService;
} {
  const store = new InMemoryRequirementStore();
  const versions = new RequirementVersionService(new InMemoryRequirementVersionStore());
  return { svc: new RequirementsService(store, versions), store, versions };
}

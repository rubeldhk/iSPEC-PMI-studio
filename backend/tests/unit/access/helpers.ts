/**
 * EPIC-024 test harness — the access service graph over in-memory stores.
 */
import {
  AccessEnforcementService,
  InMemoryAttemptStore,
} from '../../../src/modules/access/access-enforcement.service.js';
import { AccessEvaluationService } from '../../../src/modules/access/access-evaluation.service.js';
import {
  AccessGrantService,
  InMemoryGrantStore,
  type ArtifactRef,
} from '../../../src/modules/access/access-grant.service.js';
import {
  AccessInheritanceService,
  InMemoryDerivationGraph,
} from '../../../src/modules/access/access-inheritance.service.js';
import { AccessSnapshotService } from '../../../src/modules/access/access-snapshot.service.js';

export const WS = 'ws_a';
export const OTHER_WS = 'ws_b';
export const ADMIN = 'u_admin';
export const ALICE = 'u_alice';
export const BOB = 'u_bob';

export const SPEC: ArtifactRef = { artifactType: 'specification', artifactId: 'spec_1' };
export const REQ_OPEN: ArtifactRef = { artifactType: 'requirement', artifactId: 'req_open' };
export const REQ_RESTRICTED: ArtifactRef = { artifactType: 'requirement', artifactId: 'req_secret' };

export interface AccessHarness {
  grants: InMemoryGrantStore;
  attempts: InMemoryAttemptStore;
  derivations: InMemoryDerivationGraph;
  grantService: AccessGrantService;
  inheritance: AccessInheritanceService;
  enforcement: AccessEnforcementService;
  snapshot: AccessSnapshotService;
  evaluation: AccessEvaluationService;
}

export function accessHarness(): AccessHarness {
  const grants = new InMemoryGrantStore();
  const attempts = new InMemoryAttemptStore();
  const derivations = new InMemoryDerivationGraph();
  const grantService = new AccessGrantService(grants);
  const inheritance = new AccessInheritanceService(grants, derivations);
  const enforcement = new AccessEnforcementService(inheritance, attempts);
  const snapshot = new AccessSnapshotService(grants);
  const evaluation = new AccessEvaluationService(enforcement);
  return { grants, attempts, derivations, grantService, inheritance, enforcement, snapshot, evaluation };
}

/** Restrict an artifact to `users`, granted by ADMIN (edit for the first). */
export async function restrict(
  h: AccessHarness,
  artifact: ArtifactRef,
  users: { userId: string; level: 'read' | 'edit' }[],
): Promise<void> {
  for (const u of users) {
    await h.grantService.grant(WS, artifact, { ...u, grantedById: ADMIN });
  }
}

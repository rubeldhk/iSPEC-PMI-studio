/**
 * `T2122` (EPIC-039, `R-039-13`) — what each port does when nothing fills it,
 * declared once (the `decision-contract` pattern). An absent port **refuses**;
 * none answers permissively.
 */
export interface PortDeclaration {
  readonly name: string;
  readonly direction: 'declared' | 'filled';
  readonly filledBy: string;
  readonly absent: string;
}

export const CAPABILITY_PORTS: readonly PortDeclaration[] = Object.freeze([
  {
    name: 'CapabilityPolicy',
    direction: 'declared',
    filledBy: 'EPIC-031 DecisionEngine adapter (T2212): one decision per configuration version, read back at every resolution',
    absent: 'refuse — configuration PUT and every project-scope resolution answer 503 naming CapabilityPolicy',
  },
  {
    name: 'EvidenceSink',
    direction: 'declared',
    filledBy: 'EPIC-032 EvidenceService adapter (T2215, blocked until EPIC-032 merges)',
    absent: 'refuse — the intake records refused / evidence-seam-unbound and the Evidence Contract item stays unmet (FR-HUB-055)',
  },
  {
    name: 'CredentialKeyring',
    direction: 'declared',
    filledBy: 'platform key material from PMI_INTEGRATION_KEYS / PMI_INTEGRATION_ACTIVE_KEY (R-039-10)',
    absent: 'refuse — credential writes answer 503 naming CredentialKeyring; adapters needing a credential are ineligible as credential-missing',
  },
  {
    name: 'ExecutionEvents',
    direction: 'declared',
    filledBy: 'EPIC-037 ExecutionEventService.append',
    absent: 'refuse — a request naming an execution cannot record capability-resolved on it (FR-HUB-038)',
  },
  {
    name: 'RegistryAccess',
    direction: 'declared',
    filledBy: 'EPIC-024 AccessEnforcementService on { artifactType: integration-registry, artifactId: workspaceId }',
    absent: 'refuse — deny by default; every registry route answers 404',
  },
  {
    name: 'ProjectOwnerGrant',
    direction: 'declared',
    filledBy: 'EPIC-042 OwnerGate.requireOwner (the EPIC-041 FR-LPW-027 rule)',
    absent: 'refuse — configuration and credential writes answer 403',
  },
  {
    name: 'EmbeddingPort',
    direction: 'filled',
    filledBy: 'EPIC-039 HubEmbeddingPort, for EPIC-038 (binding T2218, blocked until EPIC-038 retrieval merges)',
    absent: 'refuse — EPIC-038 answers 503 naming EmbeddingPort, now with the Hub explanation (FR-HUB-085)',
  },
  {
    name: 'AttestationSource',
    direction: 'filled',
    filledBy: 'EPIC-039 attestation-source adapter, for EPIC-032 (T2215, blocked until EPIC-032 merges)',
    absent: 'refuse — EPIC-032 refuses every external source (its current null binding)',
  },
]);

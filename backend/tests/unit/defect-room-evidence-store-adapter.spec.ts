/**
 * T1797 — the Defect Room's `EvidenceStore` port, filled by `EPIC-032`.
 * `FR-DFR-033`, `BR-0062`, `FR-EVS-042`.
 *
 * The port hands over a defect id and an attestation, and names no artifact
 * version. `FR-EVS-042` refuses a contribution that names none rather than
 * attaching it to whatever is current. The adapter therefore takes the version
 * the **defect names** — `contestedArtifactVersion`, *"the version REPORTED.
 * Nothing re-targets it later"* (`FR-DFR-024`) — which is named, not inferred.
 *
 * And where the defect cannot say, it refuses: an unknown defect, or a version
 * that is not a version number, is never guessed into one.
 */
import { describe, expect, it } from 'vitest';
import { predicateTypeFor } from '@pmi/evidence-contract';
import { ContractCatalog } from '../../src/modules/evidence/contract.loader.js';
import { CompletionGate } from '../../src/modules/evidence/completion.gate.js';
import { InMemoryEvidenceRepository } from '../../src/modules/evidence/evidence.repository.js';
import { EvidenceService } from '../../src/modules/evidence/evidence.service.js';
import { EvidenceServiceStore } from '../../src/modules/defect-room/evidence-store.adapter.js';

const WS = 'ws_dr';
const attestation = {
  _type: 'https://in-toto.io/Statement/v1' as const,
  subject: [{ name: 'session-window', digest: { sha256: 'ab'.repeat(32) } }],
  predicateType: predicateTypeFor('transcript'),
  predicate: { steps: ['open', 'submit', '500'] },
};

function setup(defect: { contestedArtifactRef: string; contestedArtifactVersion: string } | null) {
  const repository = new InMemoryEvidenceRepository();
  const catalog = ContractCatalog.fromDirectory();
  const evidence = new EvidenceService(repository, catalog, new CompletionGate(repository, catalog, null), { canRead: async () => true }, null);
  const defects = {
    findDefect: async (workspaceId: string, id: string) =>
      defect === null || workspaceId !== WS || id !== 'D-1'
        ? null
        : { id, workspaceId, projectId: 'p1', ...defect },
  };
  return { repository, adapter: new EvidenceServiceStore(defects, evidence) };
}

describe('T1797 · the Defect Room files reproduction evidence in the evidence store', () => {
  it('stores it, attesting the version the defect contests, and returns the evidence id', async () => {
    const { adapter, repository } = setup({ contestedArtifactRef: 'spec_1', contestedArtifactVersion: 'v3' });
    const { evidenceRef } = await adapter.contribute({ workspaceId: WS, workRef: 'D-1', attestation });
    const [stored] = await repository.attachedTo(WS, { type: 'outcome', id: 'D-1' });
    expect(stored).toMatchObject({
      id: evidenceRef,
      attestedArtifactId: 'spec_1',
      attestedVersion: 3,
      projectId: 'p1',
      sourceUri: 'pmi:defect-room',
      predicateType: predicateTypeFor('transcript'),
    });
  });

  it.each(['3', 'v3', 'V3'])('reads %s as version 3', async (version) => {
    const { adapter, repository } = setup({ contestedArtifactRef: 'spec_1', contestedArtifactVersion: version });
    await adapter.contribute({ workspaceId: WS, workRef: 'D-1', attestation });
    expect((await repository.attachedTo(WS, { type: 'outcome', id: 'D-1' }))[0]!.attestedVersion).toBe(3);
  });
});

describe('T1797 · FR-EVS-042 — where the defect cannot name a version, nothing is guessed', () => {
  it.each(['latest', 'v3-beta', '', 'v0'])('refuses a contested version of %j, storing nothing', async (version) => {
    const { adapter, repository } = setup({ contestedArtifactRef: 'spec_1', contestedArtifactVersion: version });
    await expect(adapter.contribute({ workspaceId: WS, workRef: 'D-1', attestation })).rejects.toThrow(/FR-EVS-042/);
    expect(await repository.attachedTo(WS, { type: 'outcome', id: 'D-1' })).toEqual([]);
  });

  it('refuses evidence for a defect it cannot find — in this workspace or at all', async () => {
    const { adapter } = setup({ contestedArtifactRef: 'spec_1', contestedArtifactVersion: 'v3' });
    await expect(adapter.contribute({ workspaceId: 'ws_other', workRef: 'D-1', attestation })).rejects.toMatchObject({
      code: 'not_found',
    });
  });
});

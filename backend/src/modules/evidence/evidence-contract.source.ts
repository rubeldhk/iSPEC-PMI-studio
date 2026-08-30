/**
 * `T1203` (EPIC-032, scoped) — the `EvidenceContractSource` the Room asks.
 *
 * `ROOM_PORTS` declares this seam `absent: 'refuse'`, and nothing had ever bound
 * it, so `BaselineService.approve` threw before reading anything
 * (`DEF-033-002`). This binds it against the tables `T1203`'s migration adds.
 *
 * ## It reads; `contract-evaluation.ts` decides
 *
 * The rules — accepted types, artifact version, integrity, the empty Contract —
 * live in a pure function with its own tests. This class fetches, scopes, and
 * hands over. A store that also decided would put the interesting rules where
 * they need a database to exercise.
 *
 * ## Two scoping rules that are not optional
 *
 * **`FR-EVS-016`** — evidence never crosses a workspace boundary. The workspace
 * is in the `where`, not applied afterwards.
 *
 * **`FR-EVS-035`** — where the Contract cannot be evaluated the gate refuses.
 * A Contract in another workspace is therefore *not found*, which resolves to
 * refuse rather than to an error a caller could mistake for a bug.
 */
import { evaluateContract, type EvidenceContract, type EvidenceItem } from './contract-evaluation.js';

/** The Prisma surface this source uses, named rather than imported (PC-1). */
interface Delegate {
  findFirst(args: unknown): Promise<unknown>;
  findMany(args: unknown): Promise<unknown[]>;
}

export interface EvidencePrismaClient {
  readonly evidenceContract: Delegate;
  readonly evidenceContractItem: Delegate;
  readonly evidenceItem: Delegate;
}

interface ContractRow {
  id: string;
  version: number;
  declaredEmptyByPolicy: boolean;
}

interface ItemRow {
  id: string;
  description: string;
  acceptedTypes: string[];
}

interface EvidenceRow {
  id: string;
  type: string;
  satisfiesItemId: string;
  attestsArtifactId: string;
  attestsArtifactVersion: number;
  integrityValid: boolean;
  resolvable: boolean;
}

export class PrismaEvidenceContractSource {
  constructor(private readonly prisma: EvidencePrismaClient) {}

  /**
   * The Room's question, answered.
   *
   * `evidenceContractRef` is the Contract's id. The target it is evaluated
   * against is the **project** — a requirement baseline attests the set being
   * frozen, and the Room names no finer artifact at approval time. Version `1`
   * until a Contract is attached to a versioned target, which is the rest of
   * `EPIC-032` (`FR-EVS-023`).
   */
  async isSatisfied(
    evidenceContractRef: string,
    ctx: { workspaceId: string; projectId: string },
  ): Promise<{ readonly satisfied: boolean; readonly unmet: readonly string[] }> {
    const row = (await this.prisma.evidenceContract.findFirst({
      // Both fields in the `where`. `FR-EVS-016` is not a filter applied later.
      where: { id: evidenceContractRef, workspaceId: ctx.workspaceId },
    })) as ContractRow | null;

    if (row === null) {
      // Not found, or in another workspace — deliberately the same answer, and
      // it refuses either way (`FR-EVS-035`).
      const evaluation = evaluateContract(null, [], {
        artifactId: ctx.projectId,
        artifactVersion: 1,
      });
      return { satisfied: evaluation.satisfied, unmet: evaluation.unmet };
    }

    const items = (await this.prisma.evidenceContractItem.findMany({
      where: { contractId: row.id },
    })) as ItemRow[];

    const evidence = (await this.prisma.evidenceItem.findMany({
      where: {
        workspaceId: ctx.workspaceId,
        satisfiesItemId: { in: items.map((item) => item.id) },
      },
    })) as EvidenceRow[];

    const contract: EvidenceContract = {
      ref: row.id,
      version: row.version,
      declaredEmptyByPolicy: row.declaredEmptyByPolicy,
      items: items.map((item) => ({
        id: item.id,
        description: item.description,
        acceptedTypes: item.acceptedTypes,
      })),
    };

    const evaluation = evaluateContract(contract, evidence as EvidenceItem[], {
      artifactId: ctx.projectId,
      artifactVersion: 1,
    });
    return { satisfied: evaluation.satisfied, unmet: evaluation.unmet };
  }
}

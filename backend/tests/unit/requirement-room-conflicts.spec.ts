/**
 * T338s — conflicts, duplicates and gaps across the candidate set.
 * `FR-RQR-014`, `FR-RQR-015`, `RULE-02`.
 *
 * *"Intent that contradicts an existing baseline MUST surface as a conflict for
 * decision, never resolve by recency."*
 *
 * **"Never by recency" is the assertion that matters**, and it is asserted as
 * an absence three ways: a `Finding` has no winner, reversing which intent
 * arrived first produces the same finding, and nothing is dropped from either
 * side. Recency-resolution is never a decision anybody writes down — it is what
 * a `Map` keyed by text does for free, and what "take the latest" does when
 * somebody needs the list to be shorter.
 *
 * **The detection here is deliberately narrow, and narrow is the point.** Two
 * sentences identical apart from a `not` are an *exact* contradiction: no
 * judgement, no threshold, no false positive a reviewer has to dismiss. Broader
 * contradiction is the AI half's job (`T338m`). A similarity score in this
 * function would make the deterministic half — the half that still runs when
 * the gateway is gone — the one nobody trusts.
 *
 * **Gaps and assumptions are not here.** `FR-RQR-014` names four things;
 * duplicates and baseline conflicts are the two a rule can find exactly, and
 * they are the two that keep working when the provider does not. Claiming the
 * other two deterministically would mean inventing a heuristic and calling its
 * output a gap.
 */
import { describe, expect, it } from 'vitest';
import { detectFindings } from '../../src/modules/requirement-room/analysis.service.js';
import { IntakeService } from '../../src/modules/requirement-room/intake.service.js';
import { InMemoryRequirementRoomStore } from '../../src/modules/requirement-room/requirement-room.store.js';

/** Real candidates, through the real intake — normalization included. */
async function candidates(...texts: string[]) {
  const store = new InMemoryRequirementRoomStore();
  const intake = new IntakeService(store);
  for (const text of texts) {
    await intake.intake({
      workspaceId: 'ws_1',
      projectId: 'pr_1',
      roomObjectId: 'ro_1',
      sourceRef: 'direct:2026-08-23',
      text,
    });
  }
  return store.listCandidates('ws_1', 'ro_1');
}

describe('T338s · duplicates within the candidate set', () => {
  it('finds two candidates stating the same requirement', async () => {
    const set = await candidates(
      'A baseline must be immutable.',
      'A baseline must be immutable.',
      'An approver must be named.',
    );

    const findings = detectFindings(set, []);

    expect(findings).toHaveLength(1);
    expect(findings[0]?.kind).toBe('duplicate');
    expect(findings[0]?.involves).toHaveLength(2);
  });

  it('ignores casing and incidental whitespace, which are not different intent', async () => {
    const set = await candidates('A baseline must be immutable.', 'a  baseline MUST be immutable.');

    expect(detectFindings(set, [])[0]?.kind).toBe('duplicate');
  });

  it('does not call two different requirements a duplicate', async () => {
    const set = await candidates('A baseline must be immutable.', 'An approver must be named.');

    expect(detectFindings(set, [])).toEqual([]);
  });

  it('names every member of the duplicate group, not just the pair', async () => {
    const set = await candidates(
      'A baseline must be immutable.',
      'A baseline must be immutable.',
      'A baseline must be immutable.',
    );

    const finding = detectFindings(set, [])[0];
    // Reporting the first pair and stopping leaves the third copy to be met
    // again in the next set, which is the same surprise one round later.
    expect(finding?.involves).toHaveLength(3);
  });
});

describe('T338s · intent that collides with a baseline', () => {
  const BASELINED = [
    { requirementVersionId: 'rv_1', text: 'A baseline must be immutable.' },
  ];

  it('surfaces a restatement of an approved requirement', async () => {
    const set = await candidates('a baseline MUST be immutable.');

    const findings = detectFindings(set, BASELINED);

    // Re-entering an approved requirement as new intent is somebody editing a
    // baseline through the front door. RULE-02 says that is a Change Request.
    expect(findings[0]?.kind).toBe('restates-baselined');
    expect(findings[0]?.detail).toMatch(/Change Request/);
  });

  it('surfaces a contradiction of an approved requirement', async () => {
    const set = await candidates('A baseline must not be immutable.');

    const findings = detectFindings(set, BASELINED);

    expect(findings[0]?.kind).toBe('contradicts-baselined');
    expect(findings[0]?.detail).toMatch(/FR-RQR-015/);
  });

  it('reads a double negative as agreement, not as a contradiction', async () => {
    const set = await candidates('A baseline must not never be immutable.');

    // Polarity is counted, not spotted. A rule that flipped on the presence of
    // any negation would report a conflict here and be wrong.
    expect(detectFindings(set, BASELINED)[0]?.kind).toBe('restates-baselined');
  });

  it('says nothing about intent that is simply unrelated', async () => {
    const set = await candidates('An approver must be named.');

    expect(detectFindings(set, BASELINED)).toEqual([]);
  });

  it('names both sides — the candidate and the frozen version', async () => {
    const set = await candidates('A baseline must not be immutable.');

    const finding = detectFindings(set, BASELINED)[0];

    expect(finding?.involves).toContain('rv_1');
    expect(finding?.involves).toContain(set[0]!.id);
  });
});

describe('T338s · never resolved by recency — FR-RQR-015', () => {
  const BASELINED = [{ requirementVersionId: 'rv_1', text: 'A baseline must be immutable.' }];

  it('carries no winner, and no field that could become one', async () => {
    const set = await candidates('A baseline must not be immutable.');

    const finding = detectFindings(set, BASELINED)[0];

    // A `winner`, a `resolution` or a `preferred` is how recency-resolution
    // arrives later without anybody deciding to add it.
    expect(Object.keys(finding ?? {}).sort()).toEqual(['detail', 'involves', 'kind']);
  });

  it('surfaces the conflict for decision rather than deciding it', async () => {
    const set = await candidates('A baseline must not be immutable.');

    const findings = detectFindings(set, BASELINED);

    // Both sides survive the analysis. Neither the candidate nor the baselined
    // requirement is removed, superseded or marked stale here.
    expect(findings).toHaveLength(1);
    expect(findings[0]?.involves).toHaveLength(2);
  });

  it('gives the same answer whichever intent arrived first', async () => {
    const older = await candidates('A baseline must not be immutable.');
    const fromBaseline = detectFindings(older, BASELINED);

    // The mirror: the frozen text is the negation, the candidate is the
    // positive. Recency has swapped; the finding must not.
    const newer = await candidates('A baseline must be immutable.');
    const mirrored = detectFindings(newer, [
      { requirementVersionId: 'rv_1', text: 'A baseline must not be immutable.' },
    ]);

    expect(mirrored[0]?.kind).toBe(fromBaseline[0]?.kind);
    expect(mirrored[0]?.kind).toBe('contradicts-baselined');
  });

  it('reports one finding per collision, in a stable order', async () => {
    const set = await candidates(
      'A baseline must not be immutable.',
      'An approver must not be named.',
    );

    const findings = detectFindings(set, [
      { requirementVersionId: 'rv_1', text: 'A baseline must be immutable.' },
      { requirementVersionId: 'rv_2', text: 'An approver must be named.' },
    ]);

    // Two collisions, two findings — neither collapsed into the other, and the
    // ids inside each are sorted so the output does not depend on read order.
    expect(findings).toHaveLength(2);
    for (const finding of findings) {
      expect(finding.involves).toEqual([...finding.involves].sort());
    }
  });
});

describe('T338s · findings need no model', () => {
  it('produces the same findings with no gateway anywhere in sight', async () => {
    const set = await candidates(
      'A baseline must be immutable.',
      'A baseline must be immutable.',
    );

    // `detectFindings` is a pure function of the candidates and the frozen set.
    // That is what makes `degrade` the right absent-behaviour for the gateway:
    // there is a real analysis left when the model is gone.
    expect(detectFindings(set, [])).toHaveLength(1);
  });
});

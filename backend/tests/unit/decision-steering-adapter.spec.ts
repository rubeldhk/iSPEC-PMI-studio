/**
 * T728a — binding `SteeringSource` to `EPIC-019`'s steering, written to fail
 * first. `R-031-1`, `FR-DPE-005`, `FR-DPE-042`.
 *
 * Classification rules are steering documents with `subject:
 * 'risk-classification'`. Storage, versioning, scope composition and
 * precedence are `EPIC-019`'s — this adapter reads them and **does not
 * re-decide precedence**: `resolveSteering()` chooses one document per subject,
 * the narrowest scope, and the adapter quotes its `SteeringOverride` rather than
 * restating it.
 *
 * A consequence worth stating because it is not obvious: one document wins
 * **whole**. A project-scope ruleset replaces the workspace one entirely, rather
 * than being merged rule by rule — merging would be a second precedence
 * implementation beside `BR-0071`'s, which `R-031-1` rejected.
 */
import { describe, expect, it } from 'vitest';
import { InMemorySteeringStore, SteeringService } from '../../src/modules/steering/steering.service.js';
import { SteeringRulesetSource } from '../../src/modules/decision/steering.adapter.js';

const WS = 'ws_steer';
const scope = { workspaceId: WS, projectId: 'p1' };

async function steering(
  docs: Array<{ scopeType: 'organization' | 'workspace' | 'project'; scopeRef: string; subject?: string; content: unknown }>,
) {
  const service = new SteeringService(new InMemorySteeringStore());
  const created = [];
  for (const d of docs) {
    created.push(
      await service.create(WS, {
        scope: { scopeType: d.scopeType, scopeRef: d.scopeRef },
        subject: d.subject ?? 'risk-classification',
        content: typeof d.content === 'string' ? d.content : JSON.stringify(d.content),
        createdById: 'u1',
      }),
    );
  }
  return { source: new SteeringRulesetSource(service), created };
}

describe('T728a · R-031-1 — rules are risk-classification steering documents', () => {
  it('returns the ruleset of the one applicable document, with its lineage and version', async () => {
    const { source, created } = await steering([
      { scopeType: 'workspace', scopeRef: WS, content: { rules: [{ actionPattern: 'deploy', band: 'medium' }] } },
    ]);
    const ruleset = await source.rulesetFor(scope);
    expect(ruleset.rules).toEqual([{ actionPattern: 'deploy', band: 'medium' }]);
    expect(ruleset.source).toEqual({ lineageId: created[0]!.lineageId, version: 1 });
    expect(ruleset.precedence).toBeUndefined();
  });

  it('ignores every other subject', async () => {
    const { source } = await steering([
      { scopeType: 'workspace', scopeRef: WS, subject: 'security', content: 'use TLS' },
    ]);
    expect(await source.rulesetFor(scope)).toEqual({ rules: [], source: null });
  });

  it('ignores a project document for another project', async () => {
    const { source } = await steering([
      { scopeType: 'project', scopeRef: 'p_other', content: { rules: [{ actionPattern: 'deploy', band: 'low' }] } },
    ]);
    expect((await source.rulesetFor(scope)).rules).toEqual([]);
  });
});

describe('T728a · FR-DPE-042 — precedence is EPIC-019’s, and quoted', () => {
  it('lets the narrower scope win whole, and quotes the SteeringOverride', async () => {
    const { source, created } = await steering([
      { scopeType: 'workspace', scopeRef: WS, content: { rules: [{ actionPattern: 'deploy', band: 'medium' }] } },
      { scopeType: 'project', scopeRef: 'p1', content: { rules: [{ actionPattern: 'deploy', band: 'low' }] } },
    ]);
    const ruleset = await source.rulesetFor(scope);
    expect(ruleset.rules).toEqual([{ actionPattern: 'deploy', band: 'low' }]);
    expect(ruleset.source).toEqual({ lineageId: created[1]!.lineageId, version: 1 });
    expect(ruleset.precedence).toMatch(/project v1 overrides workspace v1/);
    expect(ruleset.precedence).toMatch(/BR-0071/);
  });
});

describe('T728a · FR-DPE-050 — an unreadable ruleset is an error, never an empty one', () => {
  it.each([
    ['not JSON', 'deploy is low'],
    ['no rules list', { band: 'low' }],
    ['a band outside the three', { rules: [{ actionPattern: 'deploy', band: 'unknown' }] }],
    ['a rule with no action pattern', { rules: [{ band: 'low' }] }],
  ])('throws on %s, so the evaluator refuses', async (_label, content) => {
    const { source } = await steering([{ scopeType: 'workspace', scopeRef: WS, content }]);
    await expect(source.rulesetFor(scope)).rejects.toThrow(/risk-classification/);
  });
});

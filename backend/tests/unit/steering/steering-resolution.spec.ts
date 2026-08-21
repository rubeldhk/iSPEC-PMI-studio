/**
 * T239 — steering resolution is a PURE function (FR-ENH-005).
 * Written to FAIL before T240 exists (Constitution V).
 *
 * Narrower scope wins; the override is recorded naming both winner and loser;
 * the resolved set is ordered broadest to narrowest (contract rule S3).
 */
import { describe, expect, it } from 'vitest';
import {
  resolveSteering,
  type ResolvableSteeringDocument,
} from '../../../src/modules/steering/steering-resolver.js';

function doc(over: Partial<ResolvableSteeringDocument>): ResolvableSteeringDocument {
  return {
    id: 'sd_org_tech',
    subject: 'technology_stack',
    scopeType: 'organization',
    content: 'PostgreSQL only.',
    version: 1,
    status: 'active',
    ...over,
  };
}

describe('T239 · narrower scope wins, and the loser is recorded (FR-ENH-005)', () => {
  it('a project-scope document beats the organization-scope document on the same subject', () => {
    const broad = doc({ id: 'sd_broad' });
    const narrow = doc({ id: 'sd_narrow', scopeType: 'project', content: 'PostgreSQL and Valkey.', version: 3 });
    const { resolved, overrides } = resolveSteering([broad, narrow]);

    expect(resolved.map((r) => r.content)).toEqual(['PostgreSQL and Valkey.']);
    expect(overrides).toEqual([
      {
        winning: { id: 'sd_narrow', subject: 'technology_stack', scopeType: 'project', version: 3 },
        overridden: { id: 'sd_broad', subject: 'technology_stack', scopeType: 'organization', version: 1 },
      },
    ]);
  });

  it('different subjects never override each other', () => {
    const tech = doc({ id: 'sd_tech' });
    const security = doc({ id: 'sd_sec', subject: 'security', content: 'argon2id.' });
    const { resolved, overrides } = resolveSteering([tech, security]);
    expect(resolved.length).toBe(2);
    expect(overrides).toEqual([]);
  });

  it('a retired document neither wins nor overrides', () => {
    const active = doc({ id: 'sd_active' });
    const retired = doc({ id: 'sd_retired', scopeType: 'project', status: 'retired' });
    const { resolved, overrides } = resolveSteering([active, retired]);
    expect(resolved.map((r) => r.subject)).toEqual(['technology_stack']);
    expect(resolved[0]).toMatchObject({ scopeType: 'organization' });
    expect(overrides).toEqual([]);
  });

  it('the resolved set is ordered broadest to narrowest (S3)', () => {
    const project = doc({ id: 'sd_p', subject: 'security', scopeType: 'project', content: 'p' });
    const organization = doc({ id: 'sd_o', subject: 'coding_standards', scopeType: 'organization', content: 'o' });
    const workspace = doc({ id: 'sd_w', subject: 'architecture', scopeType: 'workspace', content: 'w' });
    const { resolved } = resolveSteering([project, organization, workspace]);
    expect(resolved.map((r) => r.scopeType)).toEqual(['organization', 'workspace', 'project']);
  });

  it('is pure — the same input yields the same output and mutates nothing', () => {
    const input = [doc({}), doc({ id: 'sd2', scopeType: 'workspace', version: 2 })];
    const snapshot = JSON.parse(JSON.stringify(input)) as unknown;
    const first = resolveSteering(input);
    const second = resolveSteering(input);
    expect(second).toEqual(first);
    expect(input).toEqual(snapshot);
  });

  it('the resolved entries carry exactly the contract shape — subject, scopeType, content, version', () => {
    const { resolved } = resolveSteering([doc({})]);
    expect(Object.keys(resolved[0] as object).sort()).toEqual(
      ['content', 'scopeType', 'subject', 'version'].sort(),
    );
  });
});

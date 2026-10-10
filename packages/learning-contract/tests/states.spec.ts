/**
 * `T2305` (EPIC-048) — the vocabularies that make an AI approver unnameable.
 *
 * `FR-LRN-004` (exactly six states, four terminal), `FR-LRN-027` (no `agent`
 * approver kind), `R-048-8` (`retired` reserved), `FR-LRN-028` (scope may be
 * narrowed, never widened). No `unknown` member anywhere: a state the code
 * cannot name is refused, not defaulted.
 */
import { describe, expect, it } from 'vitest';
import {
  APPROVER_KINDS,
  CANDIDATE_KINDS,
  CANDIDATE_STATES,
  CONFIDENCE_LEVELS,
  EVIDENCE_STATES,
  RISK_BANDS,
  TERMINAL_CANDIDATE_STATES,
  VERSION_STATUSES,
  isTerminalCandidateState,
} from '../src/states.js';
import { isNarrowerOrEqual, isStrictlyWider, scopeIncludesProject, type ClaimedScope } from '../src/scope.js';

const project = (id: string): ClaimedScope => ({ kind: 'project', projectIds: [id] });
const projects = (...ids: [string, string, ...string[]]): ClaimedScope => ({ kind: 'projects', projectIds: ids });
const workspace: ClaimedScope = { kind: 'workspace', projectIds: [] };

describe('T2305 · candidate states (FR-LRN-004)', () => {
  it('are exactly the six of FR-LRN-004', () => {
    expect([...CANDIDATE_STATES]).toEqual(['proposed', 'pending-review', 'approved', 'rejected', 'expired', 'withdrawn']);
  });

  it('four of them are terminal', () => {
    expect([...TERMINAL_CANDIDATE_STATES].sort()).toEqual(['approved', 'expired', 'rejected', 'withdrawn']);
    expect(isTerminalCandidateState('proposed')).toBe(false);
    expect(isTerminalCandidateState('pending-review')).toBe(false);
    for (const s of TERMINAL_CANDIDATE_STATES) expect(isTerminalCandidateState(s)).toBe(true);
  });
});

describe('T2305 · approver kinds (FR-LRN-027)', () => {
  it('are exactly human | policy — there is no agent to name', () => {
    expect([...APPROVER_KINDS]).toEqual(['human', 'policy']);
    expect(APPROVER_KINDS as readonly string[]).not.toContain('agent');
    expect(APPROVER_KINDS as readonly string[]).not.toContain('automation');
  });
});

describe('T2305 · evidence states (R-048-8)', () => {
  it('reserve retired beside the four that are produced', () => {
    expect([...EVIDENCE_STATES]).toEqual(['verified', 'integrity-failed', 'unresolvable', 'withheld', 'retired']);
  });
});

describe('T2305 · no unknown member anywhere', () => {
  it.each([
    ['CANDIDATE_STATES', CANDIDATE_STATES],
    ['CANDIDATE_KINDS', CANDIDATE_KINDS],
    ['CONFIDENCE_LEVELS', CONFIDENCE_LEVELS],
    ['VERSION_STATUSES', VERSION_STATUSES],
    ['EVIDENCE_STATES', EVIDENCE_STATES],
    ['APPROVER_KINDS', APPROVER_KINDS],
    ['RISK_BANDS', RISK_BANDS],
  ] as const)('%s', (_name, list) => {
    for (const forbidden of ['unknown', 'other', 'default', 'none']) {
      expect(list as readonly string[]).not.toContain(forbidden);
    }
  });

  it('kinds, confidence, statuses and bands are the contract vocabularies', () => {
    expect([...CANDIDATE_KINDS]).toEqual(['new', 'supersede', 'deprecate', 'widen-scope']);
    expect([...CONFIDENCE_LEVELS]).toEqual(['low', 'medium', 'high']);
    expect([...VERSION_STATUSES]).toEqual(['current', 'superseded', 'deprecated']);
    expect([...RISK_BANDS]).toEqual(['low', 'medium', 'high']);
  });
});

describe('T2305 · scope narrowing (FR-LRN-028)', () => {
  it('holds for project ⊆ projects ⊆ workspace', () => {
    expect(isNarrowerOrEqual(project('a'), projects('a', 'b'))).toBe(true);
    expect(isNarrowerOrEqual(projects('a', 'b'), workspace)).toBe(true);
    expect(isNarrowerOrEqual(project('a'), workspace)).toBe(true);
    expect(isNarrowerOrEqual(projects('a', 'b'), projects('a', 'b', 'c'))).toBe(true);
  });

  it('is reflexive', () => {
    expect(isNarrowerOrEqual(project('a'), project('a'))).toBe(true);
    expect(isNarrowerOrEqual(workspace, workspace)).toBe(true);
    expect(isNarrowerOrEqual(projects('b', 'a'), projects('a', 'b'))).toBe(true);
  });

  it('refuses widening', () => {
    expect(isNarrowerOrEqual(workspace, projects('a', 'b'))).toBe(false);
    expect(isNarrowerOrEqual(workspace, project('a'))).toBe(false);
    expect(isNarrowerOrEqual(projects('a', 'b'), project('a'))).toBe(false);
    expect(isNarrowerOrEqual(project('c'), projects('a', 'b'))).toBe(false);
    expect(isNarrowerOrEqual(project('a'), project('b'))).toBe(false);
    expect(isNarrowerOrEqual(projects('a', 'c'), projects('a', 'b'))).toBe(false);
  });

  it('isStrictlyWider is widening and never equality', () => {
    expect(isStrictlyWider(workspace, project('a'))).toBe(true);
    expect(isStrictlyWider(projects('a', 'b'), project('a'))).toBe(true);
    expect(isStrictlyWider(project('a'), project('a'))).toBe(false);
    expect(isStrictlyWider(project('b'), project('a'))).toBe(false);
  });

  it('scopeIncludesProject answers for each kind', () => {
    expect(scopeIncludesProject(project('a'), 'a')).toBe(true);
    expect(scopeIncludesProject(project('a'), 'b')).toBe(false);
    expect(scopeIncludesProject(projects('a', 'b'), 'b')).toBe(true);
    expect(scopeIncludesProject(projects('a', 'b'), 'c')).toBe(false);
    expect(scopeIncludesProject(workspace, 'anything')).toBe(true);
  });
});

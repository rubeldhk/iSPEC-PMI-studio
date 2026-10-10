/**
 * `T2380` (EPIC-048, US6, `FR-LRN-052`, `-073`, `-074`, `-075`) — the knowledge
 * browser, the view `/context/knowledge` hosts inside `EPIC-038`'s Context area.
 *
 * - filter by project, scope, category and status — each sent to the server;
 * - current, superseded, deprecated and not-yet-retrievable are distinct, by
 *   text as well as tone;
 * - an entry's history is readable in order;
 * - the page says what this is: approved knowledge, not authoritative;
 * - readable at 360px.
 */
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { KnowledgeBrowser, type KnowledgeBrowserApi } from '../../../src/pages/KnowledgeBrowser';
import type { KnowledgeHistory, KnowledgeItem, Project } from '../../../src/services/api';

afterEach(cleanup);

const here = dirname(fileURLToPath(import.meta.url));
const SRC = join(here, '..', '..', '..', 'src');

function item(over: Partial<KnowledgeItem>): KnowledgeItem {
  return {
    entryId: 'ke_1',
    category: 'test-setup',
    subjectKey: 'test-setup:db first',
    originProjectId: 'p1',
    versionId: 'kv_1',
    version: 1,
    statement: 'Start the database first.',
    scope: { kind: 'project', projectIds: ['p1'] },
    classification: 'internal',
    status: 'current',
    successorVersionId: null,
    approvedByKind: 'human',
    approvedBy: 'u_rev',
    approvedAt: '2026-10-09T12:00:00Z',
    retrievability: { outcome: 'retrievable', reason: null },
    openFlags: [],
    ...over,
  };
}

const ITEMS: KnowledgeItem[] = [
  item({ versionId: 'kv_2', version: 2, statement: 'Start the database, then migrate.' }),
  item({ versionId: 'kv_1', status: 'superseded', successorVersionId: 'kv_2' }),
  item({ entryId: 'ke_2', versionId: 'kv_9', statement: 'Old CI image.', status: 'deprecated', category: 'architecture' }),
  item({ entryId: 'ke_3', versionId: 'kv_7', statement: 'Waiting for an index.', retrievability: { outcome: 'not-yet-retrievable', reason: 'EmbeddingPort is not bound' } }),
];

const HISTORY: KnowledgeHistory = {
  entry: { id: 'ke_1', category: 'test-setup', subjectKey: 'test-setup:db first', originProjectId: 'p1' },
  versions: [
    { id: 'kv_1', version: 1, statement: 'Start the database first.', proposedStatement: 'DB first.', scope: { kind: 'project', projectIds: ['p1'] }, classification: 'internal', candidate: { id: 'lc_1', kind: 'new', sourceKind: 'execution', sourcePrincipalId: 'agent_1', executionId: 'exe_1' }, decision: { decisionId: 'dec_1', resolvingDecisionId: 'dec_1_r', approvedByKind: 'human', approvedBy: 'u_rev', approvedAt: '2026-10-08T12:00:00Z' }, statusEvents: [], flags: [] },
    { id: 'kv_2', version: 2, statement: 'Start the database, then migrate.', proposedStatement: 'Then migrate.', scope: { kind: 'project', projectIds: ['p1'] }, classification: 'internal', candidate: { id: 'lc_2', kind: 'supersede', sourceKind: 'person', sourcePrincipalId: 'u_sub', executionId: null }, decision: { decisionId: 'dec_2', resolvingDecisionId: 'dec_2_r', approvedByKind: 'human', approvedBy: 'u_rev2', approvedAt: '2026-10-09T12:00:00Z' }, statusEvents: [], flags: [] },
  ],
  events: [
    { at: '2026-10-08T12:00:00Z', type: 'approved', versionId: 'kv_1' },
    { at: '2026-10-08T12:00:00Z', type: 'current', versionId: 'kv_1' },
    { at: '2026-10-09T12:00:00Z', type: 'approved', versionId: 'kv_2' },
    { at: '2026-10-09T12:00:00Z', type: 'current', versionId: 'kv_2' },
    { at: '2026-10-09T12:00:00Z', type: 'superseded', versionId: 'kv_1' },
  ],
};

function api(): KnowledgeBrowserApi & { browseKnowledge: ReturnType<typeof vi.fn>; knowledgeHistory: ReturnType<typeof vi.fn> } {
  return {
    listProjects: vi.fn(async () => [{ id: 'p1', name: 'Alpha' }, { id: 'p2', name: 'Beta' }] as Project[]),
    browseKnowledge: vi.fn(async () => ({ items: ITEMS, nextCursor: null })),
    knowledgeHistory: vi.fn(async () => HISTORY),
  } as unknown as KnowledgeBrowserApi & { browseKnowledge: ReturnType<typeof vi.fn>; knowledgeHistory: ReturnType<typeof vi.fn> };
}

async function page(client: KnowledgeBrowserApi): Promise<void> {
  render(<KnowledgeBrowser api={client} />);
  await screen.findByRole('heading', { name: 'Knowledge' });
  await screen.findByText('Start the database, then migrate.');
}

describe('T2380 · what this is (FR-LRN-052)', () => {
  it('labels the view approved knowledge, not authoritative', async () => {
    await page(api());
    expect(screen.getByText(/Approved knowledge, not authoritative/)).toBeTruthy();
  });
});

describe('T2380 · filters (FR-LRN-073)', () => {
  it.each([
    ['Project', 'p2', { projectId: 'p2' }],
    ['Scope', 'workspace', { scope: 'workspace' }],
    ['Status', 'superseded', { status: 'superseded' }],
  ])('%s is sent to the server', async (label, value, expected) => {
    const client = api();
    await page(client);
    fireEvent.change(screen.getByLabelText(label), { target: { value } });
    await waitFor(() => expect(client.browseKnowledge).toHaveBeenLastCalledWith(expect.objectContaining(expected)));
  });

  it('category is sent to the server', async () => {
    const client = api();
    await page(client);
    fireEvent.change(screen.getByLabelText('Category'), { target: { value: 'architecture' } });
    fireEvent.submit(screen.getByRole('search'));
    await waitFor(() => expect(client.browseKnowledge).toHaveBeenLastCalledWith(expect.objectContaining({ category: 'architecture' })));
  });

  it('the table carries its own row filter too (PMI-DOC-005)', async () => {
    await page(api());
    expect(screen.getByRole('searchbox', { name: 'Filter knowledge' })).toBeTruthy();
  });
});

describe('T2380 · statuses are distinct (FR-LRN-074)', () => {
  it('current, superseded, deprecated and not-yet-retrievable each read differently', async () => {
    await page(api());
    const table = screen.getByRole('table');
    expect(within(table).getAllByText('current').length).toBeGreaterThan(0);
    expect(within(table).getByText('superseded by kv_2')).toBeTruthy();
    expect(within(table).getByText('deprecated')).toBeTruthy();
    expect(within(table).getByText('not yet retrievable')).toBeTruthy();
    const tones = new Set(['current', 'deprecated', 'not yet retrievable'].map((t) => within(table).getAllByText(t)[0]!.className));
    expect(tones.size).toBe(3);
  });
});

describe('T2380 · history, in order (FR-LRN-035)', () => {
  it('opens an entry’s history: every version, who proposed and approved it, every status change in order', async () => {
    const client = api();
    await page(client);
    fireEvent.click(screen.getAllByRole('button', { name: /History of ke_1/ })[0]!);
    const history = await screen.findByRole('region', { name: /History of entry ke_1/ });
    expect(client.knowledgeHistory).toHaveBeenCalledWith('ke_1');
    const events = within(history).getAllByRole('listitem').map((li) => li.textContent ?? '');
    expect(events).toHaveLength(5);
    expect(events[0]).toMatch(/v1 approved/);
    expect(events[4]).toMatch(/v1 superseded/);
    expect(within(history).getByText(/proposed by agent agent_1 .* approved by u_rev/)).toBeTruthy();
    expect(within(history).getByText(/proposed by person u_sub .* approved by u_rev2/)).toBeTruthy();
  });
});

describe('T2380 · readable at 360px (FR-LRN-075)', () => {
  it('uses the shared learning stylesheet and sets no width of its own', () => {
    const code = readFileSync(join(SRC, 'pages', 'KnowledgeBrowser.tsx'), 'utf8');
    expect(code).toMatch(/inbox-details\/learning\.css/);
    expect(code).not.toMatch(/minWidth|style=\{\{\s*width/);
  });
});

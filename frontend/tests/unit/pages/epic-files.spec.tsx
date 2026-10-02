/**
 * `T1650` / `T1654` / `T1684` (EPIC-045, `FR-ART-010`–`FR-ART-018`,
 * `FR-ART-035`, `FR-ART-009`) — the Epic's Files section: the tree, the header
 * of an open file, the version picker, the markers, the refusals and findings,
 * the four states.
 *
 * The assertion that matters most is the one about absent controls. The
 * platform is a **mirror**: a control that looked editable would invite an
 * edit that the project directory would silently overwrite on the next
 * governed command, and the reader would have no way to know. So the section
 * asserts what is NOT there, and says in words which side is authoritative.
 *
 * Written to FAIL before `T1651`.
 */
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { EpicFiles } from '../../../src/pages/EpicFiles';
import { ApiError, type ApiClient, type ArtifactTree, type ArtifactVersion } from '../../../src/services/api';

const SPEC = 'specs/003-reports/spec.md';
const PLAN = 'specs/003-reports/plan.md';
const CONTRACT = 'specs/003-reports/contracts/reports-api.md';

const SPECIFY = { executionId: 'exec_1', command: 'specify', outcome: 'completed', at: '2026-09-05T10:00:00.000Z', syncId: 'sync_1' };
const PLANNED = { executionId: 'exec_2', command: 'plan', outcome: 'completed', at: '2026-09-05T11:00:00.000Z', syncId: 'sync_2' };

function tree(over: Partial<ArtifactTree> = {}): ArtifactTree {
  return {
    epicId: 'e1',
    files: [
      {
        path: SPEC,
        kind: 'spec',
        current: { versionId: 'v2', digest: 'b'.repeat(64), sizeBytes: 120, sync: PLANNED },
        notInLatestSync: false,
        versions: [
          { versionId: 'v2', digest: 'b'.repeat(64), sizeBytes: 120, firstSyncedAt: '2026-09-05T11:00:00.000Z', deliveredBy: [PLANNED] },
          { versionId: 'v1', digest: 'a'.repeat(64), sizeBytes: 100, firstSyncedAt: '2026-09-05T10:00:00.000Z', deliveredBy: [SPECIFY] },
        ],
      },
      {
        path: PLAN,
        kind: 'plan',
        current: { versionId: 'v3', digest: 'c'.repeat(64), sizeBytes: 90, sync: SPECIFY },
        notInLatestSync: true,
        versions: [{ versionId: 'v3', digest: 'c'.repeat(64), sizeBytes: 90, firstSyncedAt: '2026-09-05T10:00:00.000Z', deliveredBy: [SPECIFY, PLANNED] }],
      },
      {
        path: CONTRACT,
        kind: 'contract',
        current: { versionId: 'v4', digest: 'd'.repeat(64), sizeBytes: 40, sync: PLANNED },
        notInLatestSync: false,
        versions: [{ versionId: 'v4', digest: 'd'.repeat(64), sizeBytes: 40, firstSyncedAt: '2026-09-05T11:00:00.000Z', deliveredBy: [PLANNED] }],
      },
    ],
    refusals: [{ path: 'specs/003-reports/notes.txt', code: 'path_not_in_artifact_set', detail: 'notes.txt is not one of the artifact set', executionId: 'exec_1', at: '2026-09-05T10:00:00.000Z' }],
    findings: { reportedNotSynced: [{ executionId: 'exec_1', digest: 'f'.repeat(64) }], syncedNotReported: [{ executionId: 'exec_2', digest: 'e'.repeat(64) }] },
    ...over,
  };
}

function version(over: Partial<ArtifactVersion> = {}): ArtifactVersion {
  return {
    versionId: 'v2',
    path: SPEC,
    kind: 'spec',
    digest: 'b'.repeat(64),
    sizeBytes: 120,
    content: '# Reports\n\nThe second version.\n',
    firstSyncedAt: '2026-09-05T11:00:00.000Z',
    deliveredBy: [PLANNED],
    ...over,
  };
}

function api(over: Partial<Record<string, unknown>> = {}): ApiClient {
  return {
    getEpicArtifacts: vi.fn(async () => tree()),
    // One document per version id. A stub answering the SAME document for every
    // id would let a page that fetched the wrong version pass this whole file.
    getArtifactVersion: vi.fn(async (id: string) => {
      if (id === 'v1') return version({ versionId: 'v1', digest: 'a'.repeat(64), sizeBytes: 100, content: '# Reports\n\nThe first version.\n', deliveredBy: [SPECIFY] });
      if (id === 'v3') return version({ versionId: 'v3', path: PLAN, kind: 'plan', digest: 'c'.repeat(64), sizeBytes: 90, content: '# Plan\n', deliveredBy: [SPECIFY, PLANNED] });
      if (id === 'v4') return version({ versionId: 'v4', path: CONTRACT, kind: 'contract', digest: 'd'.repeat(64), sizeBytes: 40, content: '# API\n', deliveredBy: [PLANNED] });
      return version();
    }),
    ...over,
  } as unknown as ApiClient;
}

afterEach(cleanup);

async function section(client: ApiClient = api(), props: Record<string, unknown> = {}) {
  const onSelect = vi.fn();
  render(<EpicFiles api={client} epicId="e1" epicSlug="reports" onSelect={onSelect} {...props} />);
  await waitFor(() => expect(screen.queryByText('Loading files')).toBeNull());
  return { onSelect };
}

describe('T1650 · the tree', () => {
  it('lists every synced file grouped by folder, with kind, size, short digest and the producing execution', async () => {
    await section();
    const files = screen.getByRole('region', { name: 'Files' });
    expect(files.textContent).toContain('spec.md');
    expect(files.textContent).toContain('plan.md');
    expect(files.textContent).toContain('reports-api.md');
    // The two folders of the artifact set are named, so `contracts/` is not a
    // sibling of `spec.md` in the reader's eye.
    expect(files.textContent).toContain('specs/003-reports');
    expect(files.textContent).toContain('contracts');
    // Kind, size and a SHORT digest — the full one on the title attribute.
    expect(files.textContent).toContain('spec');
    expect(files.textContent).toContain('120');
    expect(files.textContent).toContain('b'.repeat(12));
    expect(files.textContent).not.toContain('b'.repeat(64));
    expect(within(files).getByTitle('b'.repeat(64))).toBeDefined();
    // The producing execution of the current version: command · outcome · time.
    expect(files.textContent).toContain('plan');
    expect(files.textContent).toContain('completed');
  });

  it('marks a file the newest sync omitted, and still opens it (FR-ART-014)', async () => {
    await section();
    const row = screen.getByRole('button', { name: new RegExp(PLAN) });
    expect(row.textContent).toMatch(/not in the latest sync/i);
    fireEvent.click(row);
    await screen.findByRole('region', { name: 'Open file' });
  });

  it('offers NO control that creates, uploads, renames, edits or deletes (FR-ART-010)', async () => {
    await section();
    for (const label of [/edit/i, /save/i, /upload/i, /rename/i, /delete/i, /new file/i]) {
      expect(screen.queryByRole('button', { name: label }), String(label)).toBeNull();
    }
    expect(screen.queryByRole('textbox')).toBeNull();
  });

  it('says which side is authoritative, in words', async () => {
    await section();
    expect(screen.getByRole('region', { name: 'Files' }).textContent).toContain('the project directory is authoritative');
    expect(screen.getByRole('region', { name: 'Files' }).textContent?.toLowerCase()).toContain('mirror');
  });

  it('lists refusals and the reported-versus-synced findings under the tree, each naming the execution (FR-ART-009)', async () => {
    await section();
    const refusals = screen.getByRole('region', { name: 'Refused files' });
    expect(refusals.textContent).toContain('notes.txt');
    expect(refusals.textContent).toContain('path_not_in_artifact_set');
    expect(refusals.textContent).toContain('exec_1');

    const findings = screen.getByRole('region', { name: 'Findings' });
    expect(findings.textContent).toContain('exec_1');
    expect(findings.textContent).toContain('f'.repeat(12));
    expect(findings.textContent).toContain('exec_2');
    expect(findings.textContent).toMatch(/reported.*not synced/i);
    expect(findings.textContent).toMatch(/synced.*not reported/i);
  });

  it('shows neither section when there is nothing to show', async () => {
    await section(api({ getEpicArtifacts: vi.fn(async () => tree({ refusals: [], findings: { reportedNotSynced: [], syncedNotReported: [] } })) }));
    expect(screen.queryByRole('region', { name: 'Refused files' })).toBeNull();
    expect(screen.queryByRole('region', { name: 'Findings' })).toBeNull();
  });
});

describe('T1650 · the four states (FR-ART-015)', () => {
  it('loading', () => {
    render(<EpicFiles api={api({ getEpicArtifacts: vi.fn(() => new Promise(() => {})) })} epicId="e1" epicSlug="reports" onSelect={vi.fn()} />);
    expect(screen.getByText('Loading files')).toBeDefined();
  });

  it('empty — and names the command that would produce the first file', async () => {
    await section(api({ getEpicArtifacts: vi.fn(async () => tree({ files: [], refusals: [], findings: { reportedNotSynced: [], syncedNotReported: [] } })) }));
    const empty = screen.getByRole('region', { name: 'Files' });
    expect(empty.textContent).toContain('No governed command has synced files for this Epic yet');
    expect(empty.textContent).toContain('specify');
    expect(empty.textContent).toContain('spec.md');
  });

  it('error — in words, with what to do next', async () => {
    await section(api({ getEpicArtifacts: vi.fn(async () => { throw new ApiError('not_found', 'Not found.', 404); }) }));
    const alert = screen.getByRole('alert');
    expect(alert.textContent).toContain('Not found.');
  });

  it('partial — the tree loaded and the content failed, and the tree stays', async () => {
    await section(api({ getArtifactVersion: vi.fn(async () => { throw new ApiError('not_found', 'That version is gone.', 404); }) }));
    fireEvent.click(screen.getByRole('button', { name: new RegExp(SPEC) }));
    await screen.findByText(/That version is gone\./);
    expect(screen.getByRole('region', { name: 'Files' }).textContent).toContain('spec.md');
  });
});

describe('T1650 · opening a file (FR-ART-011, FR-ART-012)', () => {
  it('renders the content through MarkdownViewer with the header', async () => {
    await section();
    fireEvent.click(screen.getByRole('button', { name: new RegExp(SPEC) }));
    await screen.findByRole('region', { name: 'Open file' });
    // The content is RENDERED, not shown as source.
    expect(screen.getByRole('heading', { level: 1, name: 'Reports' })).toBeDefined();
    const header = screen.getByRole('region', { name: 'Open file' });
    expect(header.textContent).toContain(SPEC);
    expect(header.textContent).toContain('spec');
    expect(header.textContent).toContain('Version 1 of 2');
    expect(header.textContent).toContain('b'.repeat(12));
    expect(header.textContent).toContain('exec_2');
    expect(header.textContent).toContain('plan');
  });

  it('tells the host what is selected, so the URL can carry it (?file=&version=)', async () => {
    const { onSelect } = await section();
    fireEvent.click(screen.getByRole('button', { name: new RegExp(SPEC) }));
    await waitFor(() => expect(onSelect).toHaveBeenCalledWith({ file: SPEC, version: null }));
  });

  it('opens the file the host selected, without a click', async () => {
    await section(api(), { selectedFile: PLAN });
    await screen.findByRole('region', { name: 'Open file' });
    expect(screen.getByRole('region', { name: 'Open file' }).textContent).toContain(PLAN);
  });

  it('a relative sibling link opens that file (FR-ART-018)', async () => {
    const client = api({ getArtifactVersion: vi.fn(async () => version({ content: `See [the plan](plan.md).\n` })) });
    const { onSelect } = await section(client, { selectedFile: SPEC });
    await screen.findByRole('region', { name: 'Open file' });
    fireEvent.click(screen.getByRole('link', { name: 'the plan' }));
    await waitFor(() => expect(onSelect).toHaveBeenCalledWith({ file: PLAN, version: null }));
  });

  it('a relative link to a path with no version says *no synced version*', async () => {
    const client = api({ getArtifactVersion: vi.fn(async () => version({ content: `See [the tasks](tasks.md).\n` })) });
    await section(client, { selectedFile: SPEC });
    await screen.findByRole('region', { name: 'Open file' });
    expect(screen.queryByRole('link', { name: 'the tasks' })).toBeNull();
    expect(screen.getByText(/the tasks/).textContent).toContain('no synced version');
  });
});

describe('T1654 · the version picker (FR-ART-013, FR-ART-016)', () => {
  it('lists versions newest first with command, outcome, time and digest', async () => {
    await section(api(), { selectedFile: SPEC });
    await screen.findByRole('region', { name: 'Open file' });
    const picker = screen.getByRole('listbox', { name: 'Versions' });
    const options = within(picker).getAllByRole('option');
    expect(options).toHaveLength(2);
    expect(options[0]?.textContent).toContain('b'.repeat(12));
    expect(options[0]?.textContent).toContain('plan');
    expect(options[1]?.textContent).toContain('a'.repeat(12));
    expect(options[1]?.textContent).toContain('specify');
    expect(options[1]?.textContent).toContain('completed');
  });

  it('lists every execution that delivered one version against a single entry', async () => {
    await section(api(), { selectedFile: PLAN });
    await screen.findByRole('region', { name: 'Open file' });
    const options = within(screen.getByRole('listbox', { name: 'Versions' })).getAllByRole('option');
    expect(options).toHaveLength(1);
    expect(options[0]?.textContent).toContain('exec_1');
    expect(options[0]?.textContent).toContain('exec_2');
  });

  it('choosing an earlier version renders it and says it is NOT the current one', async () => {
    const { onSelect } = await section(api(), { selectedFile: SPEC });
    await screen.findByRole('region', { name: 'Open file' });
    fireEvent.click(within(screen.getByRole('listbox', { name: 'Versions' })).getAllByRole('option')[1] as HTMLElement);
    await screen.findByText(/The first version\./);
    const header = screen.getByRole('region', { name: 'Open file' });
    expect(header.textContent).toContain('Not the current version');
    expect(header.textContent).toContain('a'.repeat(12));
    expect(header.textContent).toContain('Version 2 of 2');
    expect(onSelect).toHaveBeenCalledWith({ file: SPEC, version: 'v1' });
  });

  it('the current version is not marked as not-current', async () => {
    await section(api(), { selectedFile: SPEC });
    await screen.findByRole('region', { name: 'Open file' });
    expect(screen.getByRole('region', { name: 'Open file' }).textContent).not.toContain('Not the current version');
  });

  it('a version named by the host loads directly, so ?version= reloads the same one', async () => {
    await section(api(), { selectedFile: SPEC, selectedVersion: 'v1' });
    await screen.findByText(/The first version\./);
    expect(screen.getByRole('region', { name: 'Open file' }).textContent).toContain('Not the current version');
  });
});

describe('T1684 · the Epic\'s slug and the synced directory (FR-ART-035)', () => {
  it('notes the difference when the directory does not match the Epic\'s slug', async () => {
    await section(api(), { epicSlug: 'reporting' });
    const files = screen.getByRole('region', { name: 'Files' });
    expect(files.textContent).toContain('003-reports');
    expect(files.textContent).toContain("the Epic's slug is now");
    expect(files.textContent).toContain('reporting');
  });

  it('says nothing when they agree — the note is a difference, not a label', async () => {
    await section(api(), { epicSlug: 'reports' });
    expect(screen.getByRole('region', { name: 'Files' }).textContent).not.toContain("the Epic's slug is now");
  });

  it('groups by the PATH, so files still appear under the directory they were synced from', async () => {
    await section(api(), { epicSlug: 'reporting' });
    expect(screen.getByRole('region', { name: 'Files' }).textContent).toContain('specs/003-reports');
  });
});

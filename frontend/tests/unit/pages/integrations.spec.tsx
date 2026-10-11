/**
 * `T2206` (EPIC-039, `US8`, `FR-HUB-071`–`FR-HUB-075`, `UX-0031`, `UX-0032`,
 * `UX-0040`) — the Integrations screen, view only.
 *
 * - the list shows name, direction, transport, capabilities, version, health
 *   and configuration status, with a filter (direction, health, capability, text);
 * - an opened entry shows health history and recent resolutions, with each
 *   refusal's per-candidate explanation inline (`UX-0032`);
 * - health states and *not applicable* fields have distinct styles and
 *   `aria-label`s, never colour alone (`UX-0031`);
 * - NO `button`, `input`, `select`, `textarea` or `form` other than the filter
 *   and the disclosure toggles, and the words "Configuration is through the
 *   API" are on the screen (`FR-HUB-074`);
 * - no cell renders a credential value; no wide table, so it reads at 360px (`UX-0040`).
 *
 * Written to FAIL before `T2207`.
 */
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { IntegrationsPage } from '../../../src/pages/Integrations';
import type { EntryDetail, EntryView, IntegrationsReadClient } from '../../../src/services/integrations.client';

afterEach(cleanup);

const CANARY = 'pmi-canary-12345678-1234-1234-1234-123456789abc';
const na = (reason: string) => ({ applicable: false as const, reason });
const v = <T,>(value: T) => ({ applicable: true as const, value });
const audit = { registeredBy: 'u_owner', registeredAt: '2026-10-10T09:00:00.000Z', lastChangeAt: '2026-10-10T09:00:00.000Z' };

const ENTRIES: EntryView[] = [
  {
    id: 'e_pmi', key: 'pmi-studio', name: 'pmi-studio (MCP server)', direction: 'inbound', status: 'active', listedOrder: 1, audit,
    provider: v('PMI Studio (this platform)'), transport: v('mcp'), version: v('1.4.0'),
    compatibility: v({ integrationContract: '1.0' }), permissionScope: v({ operations: ['pmi.project.context'] }), authorisation: v('project-connector-credential'),
    configuration: v({ state: 'configured' }), health: na('inbound; liveness is observed by the client, last connection: never'),
  },
  {
    id: 'e_gh', key: 'github-rest', name: 'GitHub (REST)', direction: 'outbound', status: 'active', listedOrder: 2, audit,
    provider: v('github'), transport: v('native-api'), version: v('0.1.0'),
    compatibility: v({ capabilities: [{ name: 'ReadRepository', majors: [1] }, { name: 'ReadBuildStatus', majors: [1] }] }),
    permissionScope: v({}), authorisation: v('github-app-installation'),
    configuration: v({ state: 'not-configured' }), health: v({ state: 'unhealthy', reason: 'credential-rejected', checkedAt: '2026-10-10T10:00:00.000Z' }),
  },
  {
    id: 'e_fx', key: 'fixture-ci', name: 'Fixture CI', direction: 'outbound', status: 'active', listedOrder: 3, audit,
    provider: v('fixture'), transport: v('native-api'), version: v('0.1.0'),
    compatibility: v({ capabilities: [{ name: 'ReadTestResults', majors: [1] }] }),
    permissionScope: v({}), authorisation: v('fixture-token'),
    configuration: v({ state: 'configured' }), health: v({ state: 'healthy', checkedAt: '2026-10-10T10:00:00.000Z' }),
  },
];

const DETAIL: EntryDetail = {
  entry: ENTRIES[1]!,
  healthHistory: [{ state: 'unhealthy', reason: 'credential-rejected', checkedAt: '2026-10-10T10:00:00.000Z', source: 'credential-set', retryAfterSeconds: null }],
  resolutions: [
    {
      id: 'res_1', capability: 'ReadBuildStatus', caller: 'room:change', outcome: 'refused', decidedAt: '2026-10-10T10:01:00.000Z', adapterKey: null, contractVersion: null,
      refusal: { code: 'no-eligible-adapter', message: 'No adapter can serve ReadBuildStatus 1.x.', candidates: [{ entryKey: 'github-rest', ineligibleBecause: 'health-unhealthy', detail: 'credential-rejected' }] },
    },
  ],
};

function client(over: Partial<IntegrationsReadClient> = {}): IntegrationsReadClient {
  return {
    listRegistry: vi.fn(async () => ({ entries: ENTRIES, omitted: [] })),
    entryDetail: vi.fn(async () => DETAIL),
    ...over,
  };
}

async function shown(c = client()): Promise<HTMLElement> {
  const { container } = render(<IntegrationsPage client={c} projectId="pr_1" />);
  await screen.findByText('GitHub (REST)');
  return container;
}

describe('T2206 · the Integrations screen (US8)', () => {
  it('lists every entry with name, direction, transport, capabilities, version, health and configuration; pmi-studio first', async () => {
    await shown();
    const items = screen.getAllByRole('listitem', { name: /integration/i });
    expect(items.map((i) => within(i).getByRole('heading').textContent)).toEqual(['pmi-studio (MCP server)', 'GitHub (REST)', 'Fixture CI']);
    const gh = items[1]!;
    for (const text of ['outbound', 'native-api', 'ReadRepository 1', 'ReadBuildStatus 1', '0.1.0', 'not-configured']) expect(within(gh).getByText(new RegExp(text))).toBeTruthy();
    expect(within(gh).getByLabelText(/Health: unhealthy — credential-rejected/)).toBeTruthy();
  });

  it('health states and not-applicable fields are distinct in style and in words, not colour alone (UX-0031)', async () => {
    await shown();
    const unhealthy = screen.getByLabelText(/Health: unhealthy/);
    const healthy = screen.getByLabelText(/Health: healthy/);
    expect(unhealthy.getAttribute('data-health')).toBe('unhealthy');
    expect(healthy.getAttribute('data-health')).toBe('healthy');
    expect(unhealthy.className).not.toBe(healthy.className);
    const notApplicable = screen.getByLabelText(/Health: not applicable — inbound; liveness is observed by the client/);
    expect(notApplicable.getAttribute('data-fact')).toBe('not-applicable');
    expect(notApplicable.className).toMatch(/not-applicable/);
    expect(notApplicable.textContent).toMatch(/Not applicable/);
  });

  it('filters by direction, health, capability and text', async () => {
    await shown();
    const names = (): string[] => screen.getAllByRole('listitem', { name: /integration/i }).map((i) => within(i).getByRole('heading').textContent ?? '');
    fireEvent.change(screen.getByLabelText('Direction'), { target: { value: 'inbound' } });
    expect(names()).toEqual(['pmi-studio (MCP server)']);
    fireEvent.change(screen.getByLabelText('Direction'), { target: { value: '' } });
    fireEvent.change(screen.getByLabelText('Health'), { target: { value: 'unhealthy' } });
    expect(names()).toEqual(['GitHub (REST)']);
    fireEvent.change(screen.getByLabelText('Health'), { target: { value: '' } });
    fireEvent.change(screen.getByLabelText('Capability'), { target: { value: 'ReadTestResults' } });
    expect(names()).toEqual(['Fixture CI']);
    fireEvent.change(screen.getByLabelText('Capability'), { target: { value: '' } });
    fireEvent.change(screen.getByLabelText('Search'), { target: { value: 'github' } });
    expect(names()).toEqual(['GitHub (REST)']);
  });

  it('an opened entry shows health history and recent resolutions, each refusal explained per candidate inline (UX-0032)', async () => {
    const c = client();
    await shown(c);
    const gh = screen.getAllByRole('listitem', { name: /integration/i })[1]!;
    const toggle = within(gh).getByRole('button', { name: /Details for GitHub \(REST\)/ });
    expect(toggle.getAttribute('aria-expanded')).toBe('false');
    fireEvent.click(toggle);
    await within(gh).findByText(/no-eligible-adapter/);
    expect(toggle.getAttribute('aria-expanded')).toBe('true');
    expect(c.entryDetail).toHaveBeenCalledWith('e_gh', 'pr_1');
    expect(within(gh).getByText(/credential-set/)).toBeTruthy();
    expect(within(gh).getByText(/No adapter can serve ReadBuildStatus 1\.x\./)).toBeTruthy();
    expect(within(gh).getByText(/github-rest — health-unhealthy: credential-rejected/)).toBeTruthy();
  });

  it('has no configuration control: only the filter and the disclosure toggles, and says configuration is through the API (FR-HUB-074)', async () => {
    const container = await shown();
    expect(screen.getByText(/Configuration is through the API/)).toBeTruthy();
    expect(container.querySelectorAll('form, textarea')).toHaveLength(0);
    expect(container.querySelectorAll('input')).toHaveLength(1); // the text filter
    expect(container.querySelectorAll('select')).toHaveLength(3); // direction, health, capability
    const buttons = [...container.querySelectorAll('button')];
    expect(buttons).toHaveLength(ENTRIES.length);
    for (const b of buttons) expect(b.hasAttribute('aria-expanded')).toBe(true);
  });

  it('renders no credential value, and no wide table (360 px, UX-0040)', async () => {
    const leaky = client({ listRegistry: vi.fn(async () => ({ entries: ENTRIES, omitted: [] })) });
    const container = await shown(leaky);
    expect(container.textContent).not.toContain(CANARY);
    expect(container.textContent).not.toMatch(/pmi_ct_/);
    expect(container.querySelectorAll('table')).toHaveLength(0);
  });

  it('a refused read is an error in words, not an empty list', async () => {
    render(<IntegrationsPage client={client({ listRegistry: vi.fn(async () => Promise.reject(new Error('Not found.'))) })} projectId="pr_1" />);
    expect(await screen.findByRole('alert')).toBeTruthy();
  });
});

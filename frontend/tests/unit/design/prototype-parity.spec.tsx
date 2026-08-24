/**
 * T924 (EPIC-029, Phase 9) — the prototype-parity check.
 *
 * `contracts/prototype-parity.md` splits the reference prototype into ten
 * patterns this Epic ADOPTS and eight it DECLINES, each decline carrying the
 * governance rule that forbids it. This file reads that table — the way
 * `T886` reads `components.md` — and asserts every adopted row's artifact is
 * really there.
 *
 * Why a check and not a review: the ten edits of Phase 9 are individually
 * small and collectively invisible. Nothing else in this Epic would notice a
 * `description` prop quietly dropped or `.ds-card` deleted in a merge, and
 * "we followed the prototype" is exactly the kind of claim Constitution V
 * says must be able to fail.
 *
 * The declined half is asserted too, in the only way it honestly can be: the
 * table must still name each decline with a reason, so adopting one later is
 * a visible edit to a governed document rather than a quiet commit.
 *
 * T924 MUTATION — three, at the bottom: a stylesheet row whose class is
 * stripped MUST fail naming its row; a PageHeader with no description and a
 * Modal with no footer MUST each be reported by the same predicate the live
 * probe uses.
 */
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router';

// EPIC-036 `T441q` — `App` now requires a Router in EVERY branch, not only the
// signed-in one. It reads the address to keep the shell's project selection
// honest against a deep link (convergence `F1`), so `useLocation` runs before
// the sign-in branch is chosen. Mounting it bare was always a half-truth: the
// signed-in branch has rendered `ShellRoutes` since `T437f`.
import { Button } from '../../../src/design/components/Button';
import { Modal } from '../../../src/design/components/Modal';
import { Navigation } from '../../../src/design/components/Navigation';
import { PageHeader } from '../../../src/design/components/PageHeader';
import { Table } from '../../../src/design/components/Table';
import { App } from '../../../src/main';
import type { ApiClient } from '../../../src/services/api';

const here = dirname(fileURLToPath(import.meta.url));
const SPEC = join(here, '../../../../specs/029-design-system');

const contract = readFileSync(join(SPEC, 'contracts/prototype-parity.md'), 'utf8');
const componentsCss = readFileSync(
  join(here, '../../../src/design/components/components.css'),
  'utf8',
);
const tokensCss = readFileSync(join(here, '../../../src/design/tokens.css'), 'utf8');

// ---------------------------------------------------------------------------
// Contract parsing — the table is the source of truth, never restated here.
// ---------------------------------------------------------------------------

interface AdoptedRow {
  number: number;
  pattern: string;
  task: string;
}

/** The numbered rows of the "Adopted" table. */
export function parseAdopted(text: string): AdoptedRow[] {
  const section = text.slice(text.indexOf('## Adopted'), text.indexOf('## Declined'));
  return section
    .split('\n')
    .filter((line) => /^\|\s*\d+\s*\|/.test(line))
    .map((line) => {
      const cells = line.split('|').map((c) => c.trim());
      return {
        number: Number.parseInt(cells[1] as string, 10),
        pattern: cells[2] as string,
        task: cells[5] as string,
      };
    });
}

/** The "Declined" table's rows: pattern and the reason it is declined. */
export function parseDeclined(text: string): Array<{ pattern: string; reason: string }> {
  const section = text.slice(text.indexOf('## Declined'), text.indexOf('## What a future Epic'));
  return section
    .split('\n')
    .filter((line) => line.startsWith('|') && !/^\|\s*-+/.test(line))
    .map((line) => line.split('|').map((c) => c.trim()))
    .filter((cells) => cells[1] !== 'Prototype pattern' && (cells[1] ?? '') !== '')
    .map((cells) => ({ pattern: cells[1] as string, reason: cells[2] as string }));
}

// ---------------------------------------------------------------------------
// DOM predicates — exported so the mutations below can drive the SAME logic
// with deliberately non-conforming input (the T886a pattern).
// ---------------------------------------------------------------------------

/** Row 4: a page header states what the page is for, not only its name. */
export function pageHeaderProblem(container: HTMLElement): string | null {
  const description = container.querySelector('.ds-page-header__description');
  if (!description) return 'renders no .ds-page-header__description';
  if ((description.textContent ?? '').trim() === '') return 'renders an empty description';
  return null;
}

/** Row 5: filtering sits in a tools bar above the grid, not loose above it. */
export function tableToolsProblem(container: HTMLElement): string | null {
  const tools = container.querySelector('.ds-table__tools');
  if (!tools) return 'renders no .ds-table__tools bar';
  if (!tools.querySelector('input')) return 'the tools bar holds no filter control (FR-DS-041)';
  return null;
}

/** Row 8: head / body / foot — the close affordance up top, actions collected below. */
export function modalRegionProblem(container: HTMLElement): string | null {
  const header = container.querySelector('.ds-modal__header');
  if (!header) return 'renders no .ds-modal__header';
  if (!header.querySelector('button')) return 'the header carries no close affordance';
  const footer = container.querySelector('.ds-modal__footer');
  if (!footer) return 'renders no .ds-modal__footer for its actions';
  return null;
}

/** Row 9: a vertical list whose items can carry a count. */
export function navigationProblem(container: HTMLElement): string | null {
  if (!container.querySelector('.ds-nav__list--vertical')) {
    return 'orientation="vertical" produces no .ds-nav__list--vertical';
  }
  const count = container.querySelector('.ds-nav__count');
  if (!count) return 'an item with a count renders no .ds-nav__count';
  if ((count.textContent ?? '').trim() === '') return 'the count renders empty';
  return null;
}

/** Row 10: a top bar carrying where you are and what is globally available. */
export function shellProblem(container: HTMLElement): string | null {
  const bar = container.querySelector('.ds-topbar');
  if (!bar) return 'the composed shell renders no .ds-topbar';
  if ((bar.textContent ?? '').trim() === '') return 'the top bar carries no location or actions';
  if (!container.querySelector('.ds-content')) return 'the shell bounds no .ds-content column';
  return null;
}

/** A declared CSS class — `.name` opening a block somewhere in the sheet. */
function declaresClass(css: string, name: string): boolean {
  return new RegExp(`\\.${name.replace(/[-]/g, '\\-')}[^\\w-][^{]*\\{`).test(css);
}

// ---------------------------------------------------------------------------
// One probe per adopted row.
// ---------------------------------------------------------------------------

interface Context {
  componentsCss: string;
  tokensCss: string;
}

const PROBES: Record<number, (ctx: Context) => string | null> = {
  1: (ctx) => {
    if (!ctx.tokensCss.includes('--color-canvas:')) return 'tokens.css declares no --color-canvas';
    return ctx.componentsCss.includes('var(--color-canvas)')
      ? null
      : 'nothing sits on the canvas — a ground no surface uses is not a ground';
  },

  2: (ctx) => {
    const missing = ['accent', 'success', 'warning', 'danger']
      .map((tone) => `--color-${tone}-subtle`)
      .filter((token) => !ctx.tokensCss.includes(`${token}:`));
    return missing.length === 0 ? null : `tokens.css declares no ${missing.join(', ')}`;
  },

  3: (ctx) =>
    declaresClass(ctx.componentsCss, 'ds-card')
      ? null
      : 'components.css declares no .ds-card surface',

  4: () => {
    const { container } = render(
      <PageHeader title="Projects" description="Everything you have access to in this workspace." />,
    );
    return pageHeaderProblem(container);
  },

  5: () => {
    const { container } = render(
      <Table caption="Requirements" columns={[{ key: 'a', header: 'A' }]} rows={[{ a: '1' }]} />,
    );
    return tableToolsProblem(container);
  },

  6: (ctx) => {
    const untinted = ['accent', 'success', 'warning', 'danger'].filter((tone) => {
      const block = new RegExp(`\\.ds-pill--${tone}\\s*\\{([^}]*)\\}`).exec(ctx.componentsCss);
      return !block || !block[1]?.includes(`var(--color-${tone}-subtle)`);
    });
    return untinted.length === 0
      ? null
      : `these tones are still outlines, not tinted grounds: ${untinted.join(', ')}`;
  },

  7: (ctx) => {
    const { container } = render(<Button variant="secondary">Export status</Button>);
    const button = container.querySelector('button');
    if (!button?.className.includes('ds-button--secondary')) {
      return 'variant="secondary" produces no ds-button--secondary class';
    }
    return declaresClass(ctx.componentsCss, 'ds-button--secondary')
      ? null
      : 'components.css declares no .ds-button--secondary';
  },

  8: () => {
    const { container } = render(
      <Modal open title="Create project" onClose={() => {}} actions={<Button>Create</Button>}>
        Body
      </Modal>,
    );
    return modalRegionProblem(container);
  },

  9: () => {
    const { container } = render(
      <Navigation
        label="Primary"
        orientation="vertical"
        items={[{ id: 'r', label: 'Requirements', count: 12 }]}
        onSelect={() => {}}
      />,
    );
    return navigationProblem(container);
  },

  10: () => null, // asserted in its own async test below — the shell must mount.
};

const adopted = parseAdopted(contract);
const declined = parseDeclined(contract);
const ctx: Context = { componentsCss, tokensCss };

afterEach(cleanup);

// ---------------------------------------------------------------------------
// Anti-vacuity — a table that stopped parsing would pass everything below.
// ---------------------------------------------------------------------------

describe('T924 · the parity contract still parses', () => {
  it('names ten adopted patterns, each with a task', () => {
    expect(adopted.length).toBe(10);
    for (const row of adopted) {
      expect(row.pattern, `row ${row.number} has no pattern`).not.toBe('');
      expect(row.task, `row ${row.number} names no task`).toMatch(/T9\d\d/);
    }
  });

  it('every adopted row has a probe here — a row nobody checks is a row nobody kept', () => {
    const unprobed = adopted.filter((r) => PROBES[r.number] === undefined).map((r) => r.number);
    expect(unprobed, 'adopted rows with no probe in this file').toEqual([]);
  });

  it('every declined pattern still carries its reason', () => {
    expect(declined.length).toBeGreaterThanOrEqual(8);
    const unreasoned = declined.filter((d) => d.reason.length < 20).map((d) => d.pattern);
    expect(unreasoned, 'declined without a stated reason — a decline is a decision').toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// T924 — the check itself
// ---------------------------------------------------------------------------

describe('T924 · every adopted prototype pattern is present', () => {
  it.each(adopted.filter((r) => r.number !== 10).map((r) => [r.number, r.pattern] as const))(
    'row %i — %s',
    (number) => {
      expect((PROBES[number] as (c: Context) => string | null)(ctx)).toBeNull();
    },
  );

  it('row 10 — the application shell carries the prototype frame', async () => {
    const api = {
      me: async (): Promise<never> => {
        throw new Error('no session');
      },
    } as unknown as ApiClient;
    const { container } = render(
      <MemoryRouter>
        <App api={api} />
      </MemoryRouter>,
    );
    await screen.findByRole('button', { name: /sign in/i });
    expect(shellProblem(container)).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// T924 MUTATION — each predicate observed failing
// ---------------------------------------------------------------------------

describe('T924 · MUTATION — the check can fail', () => {
  it('a stylesheet row whose class is stripped fails, naming what is missing', () => {
    const stripped = componentsCss.replace(/\.ds-card[^{]*\{[^}]*\}/g, '');
    const problem = (PROBES[3] as (c: Context) => string | null)({
      ...ctx,
      componentsCss: stripped,
    });
    expect(problem).not.toBeNull();
    expect(problem).toContain('.ds-card');
  });

  it('a PageHeader with no description is reported by the same predicate', () => {
    const { container } = render(<PageHeader title="Projects" />);
    expect(pageHeaderProblem(container)).toContain('description');
  });

  it('a Modal with no footer is reported by the same predicate', () => {
    const { container } = render(
      <div className="ds-modal">
        <div className="ds-modal__header">
          <button type="button">Close</button>
        </div>
      </div>,
    );
    expect(modalRegionProblem(container)).toContain('footer');
  });
});

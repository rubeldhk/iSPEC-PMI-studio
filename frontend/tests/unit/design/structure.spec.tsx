/**
 * T889 (EPIC-029) — the structure family: Table, Modal, Navigation,
 * PageHeader, StatusPill. The Table offers filtering (FR-DS-041); the Modal
 * traps and restores focus and closes on Escape; StatusPill carries status by
 * text as well as colour (FR-DS-012). State titles are read by
 * state-coverage.spec.tsx (T886).
 */
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { Table } from '../../../src/design/components/Table';
import { Modal } from '../../../src/design/components/Modal';
import { Navigation } from '../../../src/design/components/Navigation';
import { PageHeader } from '../../../src/design/components/PageHeader';
import { StatusPill } from '../../../src/design/components/StatusPill';

const here = dirname(fileURLToPath(import.meta.url));
const css = readFileSync(join(here, '../../../src/design/components/components.css'), 'utf8');

const COLUMNS = [
  { key: 'ref', header: 'Reference' },
  { key: 'desc', header: 'Description' },
];
const ROWS = [
  { ref: 'REQ-001', desc: 'Sign users in' },
  { ref: 'REQ-002', desc: 'List projects' },
];

afterEach(cleanup);

describe('Table (T889)', () => {
  it('Table · state: default — a real <table> with row/cell semantics', () => {
    render(<Table caption="Requirements" columns={COLUMNS} rows={ROWS} />);
    expect(screen.getByRole('table')).toBeDefined();
    expect(screen.getAllByRole('columnheader').length).toBe(2);
    expect(screen.getByText('REQ-001')).toBeDefined();
  });

  it('Table · state: hover — row hover is declared, distinct from focus', () => {
    expect(css.includes('.ds-table tbody tr:hover')).toBe(true);
  });

  it('Table · state: focus — row focus is declared, distinct from hover', () => {
    expect(css.includes('.ds-table tbody tr:focus-within') || css.includes('.ds-table tbody tr:focus')).toBe(
      true,
    );
  });

  it('Table · state: loading', () => {
    render(<Table caption="Requirements" columns={COLUMNS} rows={[]} loading />);
    expect(screen.getByRole('table').getAttribute('aria-busy')).toBe('true');
    expect(screen.getByRole('status')).toBeDefined();
  });

  it('Table · state: error — what went wrong and what to do', () => {
    render(
      <Table
        caption="Requirements"
        columns={COLUMNS}
        rows={[]}
        error="Requirements could not be loaded."
        errorAction="Check your connection and try again."
      />,
    );
    expect(screen.getByText('Requirements could not be loaded.')).toBeDefined();
    expect(screen.getByText('Check your connection and try again.')).toBeDefined();
  });

  it('Table · state: empty — explains why, not just a blank grid', () => {
    render(
      <Table
        caption="Requirements"
        columns={COLUMNS}
        rows={[]}
        emptyTitle="No requirements yet"
        emptyExplanation="None have been captured for this project."
      />,
    );
    expect(screen.getByText('No requirements yet')).toBeDefined();
    expect(screen.getByText('None have been captured for this project.')).toBeDefined();
  });

  it('MUST offer filtering (FR-DS-041) — a labelled filter narrows the rows', () => {
    render(<Table caption="Requirements" columns={COLUMNS} rows={ROWS} filterLabel="Filter requirements" />);
    const filter = screen.getByLabelText('Filter requirements');
    fireEvent.change(filter, { target: { value: 'REQ-002' } });
    expect(screen.queryByText('REQ-001')).toBeNull();
    expect(screen.getByText('REQ-002')).toBeDefined();
  });

  it('a filter that matches nothing says so instead of showing an empty grid', () => {
    render(<Table caption="Requirements" columns={COLUMNS} rows={ROWS} filterLabel="Filter requirements" />);
    fireEvent.change(screen.getByLabelText('Filter requirements'), { target: { value: 'zzz' } });
    expect(screen.getByText(/no rows match/i)).toBeDefined();
  });
});

describe('Modal (T889)', () => {
  it('Modal · state: default — a real <dialog>', () => {
    render(
      <Modal open title="Confirm archive" onClose={vi.fn()}>
        Body
      </Modal>,
    );
    const dialog = document.querySelector('dialog');
    expect(dialog).not.toBeNull();
    expect(dialog?.getAttribute('aria-label')).toBe('Confirm archive');
  });

  it('Modal · state: focus — focus moves in on open and is RESTORED on close', () => {
    // Mount an outside button, open the modal, close it, check focus restore.
    const outside = document.createElement('button');
    outside.textContent = 'outside';
    document.body.appendChild(outside);
    outside.focus();

    const { rerender } = render(
      <Modal open={false} title="Confirm" onClose={vi.fn()}>
        Body
      </Modal>,
    );
    expect(document.activeElement).toBe(outside);

    rerender(
      <Modal open title="Confirm" onClose={vi.fn()}>
        Body
      </Modal>,
    );
    const dialog = document.querySelector('dialog') as HTMLDialogElement;
    expect(dialog.contains(document.activeElement)).toBe(true);

    rerender(
      <Modal open={false} title="Confirm" onClose={vi.fn()}>
        Body
      </Modal>,
    );
    expect(document.activeElement).toBe(outside);
    outside.remove();
  });

  it('Modal · state: loading', () => {
    render(
      <Modal open title="Confirm" onClose={vi.fn()} loading>
        Body
      </Modal>,
    );
    expect(screen.getByRole('status')).toBeDefined();
  });

  it('Modal · state: error — what went wrong and what to do', () => {
    render(
      <Modal open title="Confirm" onClose={vi.fn()} error="The archive request failed.">
        Body
      </Modal>,
    );
    expect(screen.getByText('The archive request failed.')).toBeDefined();
  });

  it('closes on Escape', () => {
    const onClose = vi.fn();
    render(
      <Modal open title="Confirm" onClose={onClose}>
        Body
      </Modal>,
    );
    fireEvent.keyDown(document.querySelector('dialog') as HTMLDialogElement, { key: 'Escape' });
    expect(onClose).toHaveBeenCalled();
  });
});

describe('Navigation (T889)', () => {
  const ITEMS = [
    { id: 'projects', label: 'Projects', current: true },
    { id: 'requirements', label: 'Requirements' },
    { id: 'held', label: 'Held area', disabled: true },
  ];

  it('Navigation · state: default — a real <nav>, current location exposed to AT (FR-DS-012)', () => {
    render(<Navigation label="Primary" items={ITEMS} onSelect={vi.fn()} />);
    expect(screen.getByRole('navigation', { name: 'Primary' })).toBeDefined();
    const current = screen.getByRole('button', { name: 'Projects' });
    expect(current.getAttribute('aria-current')).toBe('page');
  });

  it('Navigation · state: hover — declared in the stylesheet', () => {
    expect(css.includes('.ds-nav') && css.includes('.ds-nav__item:hover')).toBe(true);
  });

  it('Navigation · state: focus — items are keyboard-reachable', () => {
    render(<Navigation label="Primary" items={ITEMS} onSelect={vi.fn()} />);
    const item = screen.getByRole('button', { name: 'Requirements' });
    item.focus();
    expect(document.activeElement).toBe(item);
  });

  it('Navigation · state: active — declared in the stylesheet', () => {
    expect(css.includes('.ds-nav__item:active')).toBe(true);
  });

  it('Navigation · state: disabled — a held destination is visibly unavailable, not hidden', () => {
    render(<Navigation label="Primary" items={ITEMS} onSelect={vi.fn()} />);
    expect((screen.getByRole('button', { name: 'Held area' }) as HTMLButtonElement).disabled).toBe(
      true,
    );
  });

  it('selecting an item calls back with its id', () => {
    const onSelect = vi.fn();
    render(<Navigation label="Primary" items={ITEMS} onSelect={onSelect} />);
    fireEvent.click(screen.getByRole('button', { name: 'Requirements' }));
    expect(onSelect).toHaveBeenCalledWith('requirements');
  });
});

describe('PageHeader (T889)', () => {
  it('PageHeader · state: default — a header landmark with the page title', () => {
    render(<PageHeader title="Projects" />);
    expect(screen.getByRole('banner')).toBeDefined();
    expect(screen.getByRole('heading', { name: 'Projects' })).toBeDefined();
  });

  it('PageHeader · state: loading — busy without hiding the title', () => {
    render(<PageHeader title="Projects" loading />);
    expect(screen.getByRole('heading', { name: 'Projects' })).toBeDefined();
    expect(screen.getByRole('status')).toBeDefined();
  });

  it('heading level follows the page, not the component', () => {
    render(<PageHeader title="Trace detail" level={2} />);
    expect(screen.getByRole('heading', { level: 2, name: 'Trace detail' })).toBeDefined();
  });
});

describe('StatusPill (T889)', () => {
  it('StatusPill · state: default — status carried by TEXT as well as colour (FR-DS-012)', () => {
    render(<StatusPill tone="success">active</StatusPill>);
    const pill = screen.getByText('active');
    expect(pill.textContent?.trim().length).toBeGreaterThan(0);
    expect(pill.className).toContain('ds-pill');
  });
});

// ---------------------------------------------------------------------------
// Phase 9 (T917/T918/T919/T921/T922) — prototype parity, the BEHAVIOUR half.
// prototype-parity.spec.tsx asserts each pattern is present; these assert it
// works. Presence without behaviour is the shape T886(b) was written against.
// ---------------------------------------------------------------------------

describe('PageHeader · description (T917, parity row 4)', () => {
  it('renders the sentence saying what the page is for, without displacing the title', () => {
    render(
      <PageHeader
        title="Requirements"
        description="Everything captured for this project, and what it traces to."
      />,
    );
    expect(screen.getByRole('heading', { name: 'Requirements' })).toBeDefined();
    expect(screen.getByText(/what it traces to/)).toBeDefined();
  });

  it('a header with no description renders no empty paragraph', () => {
    const { container } = render(<PageHeader title="Projects" />);
    expect(container.querySelector('.ds-page-header__description')).toBeNull();
  });
});

describe('Table · tools bar (T918, parity row 5)', () => {
  it('the filter still filters from inside the bar — FR-DS-041 is unchanged', () => {
    render(<Table caption="Requirements" columns={COLUMNS} rows={ROWS} />);
    const filter = screen.getByLabelText(/filter/i);
    expect(filter.closest('.ds-table__tools')).not.toBeNull();
    fireEvent.change(filter, { target: { value: 'REQ-002' } });
    expect(screen.queryByText('REQ-001')).toBeNull();
    expect(screen.getByText('REQ-002')).toBeDefined();
  });

  it('a screen may add its own control to the bar without owning the bar', () => {
    render(
      <Table
        caption="Requirements"
        columns={COLUMNS}
        rows={ROWS}
        tools={<button type="button">Export</button>}
      />,
    );
    const extra = screen.getByRole('button', { name: 'Export' });
    expect(extra.closest('.ds-table__tools')).not.toBeNull();
  });
});

describe('StatusPill · tinted ground (T919, parity row 6)', () => {
  it('the text still carries the status — the tint only makes it findable (FR-DS-012)', () => {
    render(<StatusPill tone="danger">blocked</StatusPill>);
    // The pill reads as "blocked" with colour removed entirely, which is the
    // whole of FR-DS-012; the ground is an affordance, not the meaning.
    expect(screen.getByText('blocked')).toBeDefined();
  });

  it('every tone declares a tinted ground, not an outline', () => {
    for (const tone of ['accent', 'success', 'warning', 'danger']) {
      const block = new RegExp(String.raw`\.ds-pill--${tone}\s*\{([^}]*)\}`).exec(css);
      expect(block?.[1], `.ds-pill--${tone} has no rule`).toBeDefined();
      expect(block?.[1], `.ds-pill--${tone} is not tinted`).toContain(
        `var(--color-${tone}-subtle)`,
      );
    }
  });
});

describe('Modal · head / body / foot (T921, parity row 8)', () => {
  it('actions collect in the footer and the close affordance sits in the header', () => {
    const onClose = vi.fn();
    const { container } = render(
      <Modal open title="Create project" onClose={onClose} actions={<button type="button">Create</button>}>
        Body
      </Modal>,
    );
    expect(container.querySelector('.ds-modal__footer')?.textContent).toContain('Create');
    const close = container.querySelector('.ds-modal__header button') as HTMLButtonElement;
    expect(close).not.toBeNull();
    fireEvent.click(close);
    expect(onClose).toHaveBeenCalled();
  });

  it('Escape still closes — the restructure did not cost the dialog its behaviour', () => {
    const onClose = vi.fn();
    const { container } = render(
      <Modal open title="Confirm" onClose={onClose}>
        Body
      </Modal>,
    );
    fireEvent.keyDown(container.querySelector('dialog') as HTMLDialogElement, { key: 'Escape' });
    expect(onClose).toHaveBeenCalled();
  });
});

describe('Navigation · orientation and count (T922, parity row 9)', () => {
  it('a count is part of the item\u2019s accessible name, never a disembodied number', () => {
    render(
      <Navigation
        label="Primary"
        orientation="vertical"
        items={[{ id: 'r', label: 'Requirements', count: 12 }]}
        onSelect={() => {}}
      />,
    );
    // "Requirements 12 waiting" — the number is attached to what it counts.
    expect(screen.getByRole('button', { name: /requirements\s*12\s*waiting/i })).toBeDefined();
  });

  it('orientation is presentation only — semantics are identical either way', () => {
    const { container: vertical } = render(
      <Navigation
        label="Primary"
        orientation="vertical"
        items={[{ id: 'p', label: 'Projects', current: true }]}
        onSelect={() => {}}
      />,
    );
    expect(
      vertical.querySelector('.ds-nav__item[aria-current="page"]'),
      'aria-current survives the vertical orientation',
    ).not.toBeNull();
    expect(vertical.querySelector('.ds-nav__list--vertical')).not.toBeNull();
  });

  it('an item with no count renders no badge', () => {
    const { container } = render(
      <Navigation label="Primary" items={[{ id: 'p', label: 'Projects' }]} onSelect={() => {}} />,
    );
    expect(container.querySelector('.ds-nav__count')).toBeNull();
  });
});

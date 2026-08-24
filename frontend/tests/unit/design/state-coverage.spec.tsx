/**
 * T886/T886a (EPIC-029) — the state-and-element coverage check.
 *
 * The states column of contracts/components.md IS the contract (FR-DS-020,
 * FR-DS-023, SC-DS-004): this file reads the table and asserts
 *  (a) every component has a test for every state its row declares — the
 *      check that makes a MISSING state a failure rather than an omission
 *      nobody notices. Convention: a state's test title contains
 *      `<Component> · state: <state>`, scanned across this directory;
 *  (b) every component renders the native element its `D-42` row names —
 *      the ONLY check that can see a div-based reimplementation, which every
 *      other check in this Epic passes happily.
 *
 * T886a mutation-verifies BOTH dimensions with fixtures below: a corpus
 * missing a declared state MUST fail (a); a `<div>` where the row names
 * `<button>` MUST fail (b). Per Constitution V a check that cannot fail is
 * decoration — and (b) is newly written, so it had never been seen failing.
 */
import { readFileSync, readdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, render } from '@testing-library/react';
import type { ReactElement } from 'react';
import { Button } from '../../../src/design/components/Button';
import { TextInput } from '../../../src/design/components/TextInput';
import { Select } from '../../../src/design/components/Select';
import { Checkbox } from '../../../src/design/components/Checkbox';
import { Radio } from '../../../src/design/components/Radio';
import { FormField } from '../../../src/design/components/FormField';
import { Table } from '../../../src/design/components/Table';
import { EmptyState } from '../../../src/design/components/EmptyState';
import { ErrorState } from '../../../src/design/components/ErrorState';
import { LoadingIndicator } from '../../../src/design/components/LoadingIndicator';
import { Modal } from '../../../src/design/components/Modal';
import { Toast } from '../../../src/design/components/Toast';
import { Navigation } from '../../../src/design/components/Navigation';
import { PageHeader } from '../../../src/design/components/PageHeader';
import { StatusPill } from '../../../src/design/components/StatusPill';

const here = dirname(fileURLToPath(import.meta.url));
const CONTRACT = readFileSync(
  join(here, '../../../../specs/029-design-system/contracts/components.md'),
  'utf8',
);

// ---------------------------------------------------------------------------
// Contract parsing — the tables are the source of truth, never restated here.
// ---------------------------------------------------------------------------

const STATE_NAMES = [
  'default',
  'hover',
  'focus',
  'active',
  'disabled',
  'loading',
  'error',
  'empty',
] as const;

interface Row {
  name: string;
  states: string[];
}

/** The fifteen numbered rows of the state matrix. */
export function parseStateRows(contract: string): Row[] {
  return contract
    .split('\n')
    .filter((line) => /^\|\s*\d+\s*\|/.test(line))
    .map((line) => {
      const cells = line.split('|').map((c) => c.trim());
      return {
        name: cells[2] as string,
        states: STATE_NAMES.filter((_, i) => cells[3 + i]?.includes('✓')),
      };
    });
}

/** The `D-42` table: component name → its "Built on" cell, names split on ·. */
export function parseBuiltOn(contract: string): Map<string, string> {
  const map = new Map<string, string>();
  const section = contract.slice(contract.indexOf('## `D-42`'));
  for (const line of section.split('\n')) {
    if (!/^\|\s*[A-Z]/.test(line)) continue;
    const cells = line.split('|').map((c) => c.trim());
    if (cells[1] === 'Component') continue;
    for (const name of (cells[1] as string).split('·').map((n) => n.trim())) {
      map.set(name, cells[2] as string);
    }
  }
  return map;
}

/** (a): declared states with no `<Component> · state: <state>` test in the corpus. */
export function missingStateTests(rows: Row[], corpus: string): string[] {
  const missing: string[] = [];
  for (const row of rows) {
    for (const state of row.states) {
      if (!corpus.includes(`${row.name} · state: ${state}`)) {
        missing.push(`${row.name} · state: ${state}`);
      }
    }
  }
  return missing;
}

/** (b): why a rendered container fails its row's "Built on" cell — null if it passes. */
export function nativeElementProblem(container: HTMLElement, builtOnCell: string): string | null {
  const tagMatch = /`<([a-z]+)(?:\s+type="([a-z]+)")?\s*>`/.exec(builtOnCell);
  if (tagMatch) {
    const [, tag, type] = tagMatch;
    const selector = type ? `${tag}[type="${type}"]` : (tag as string);
    return container.querySelector(selector)
      ? null
      : `renders no <${tag}${type ? ` type="${type}"` : ''}> — a reimplementation of a platform element is a defect against D-42`;
  }
  if (/semantic sectioning/.test(builtOnCell)) {
    return container.querySelector('section, header, article, aside')
      ? null
      : 'renders no semantic sectioning element';
  }
  if (/aria-busy|role="status"|aria-live/.test(builtOnCell)) {
    return container.querySelector('[role="status"], [aria-live], [aria-busy="true"]')
      ? null
      : 'renders no status/live-region semantics';
  }
  if (/text or icon/.test(builtOnCell)) {
    return (container.textContent ?? '').trim().length > 0
      ? null
      : 'carries no text — colour alone cannot carry status (FR-DS-012)';
  }
  return `unrecognised Built-on cell: ${builtOnCell}`;
}

// ---------------------------------------------------------------------------
// Minimal renders — one per inventory row, the smallest valid usage.
// ---------------------------------------------------------------------------

const RENDERS: Record<string, () => ReactElement> = {
  Button: () => <Button>Press</Button>,
  TextInput: () => <TextInput aria-label="Name" />,
  Select: () => (
    <Select aria-label="Choose">
      <option>One</option>
    </Select>
  ),
  Checkbox: () => <Checkbox aria-label="Agree" />,
  Radio: () => <Radio name="g" aria-label="Pick" />,
  FormField: () => (
    <FormField id="ff" label="Email">
      <TextInput />
    </FormField>
  ),
  Table: () => (
    <Table caption="Rows" columns={[{ key: 'a', header: 'A' }]} rows={[{ a: '1' }]} />
  ),
  EmptyState: () => (
    <EmptyState title="No projects yet" explanation="Nothing has been created in this workspace." />
  ),
  ErrorState: () => <ErrorState message="Could not load projects." action="Try again." />,
  LoadingIndicator: () => <LoadingIndicator label="Loading projects" />,
  Modal: () => (
    <Modal open title="Confirm" onClose={() => {}}>
      Body
    </Modal>
  ),
  Toast: () => <Toast message="Requirement saved" />,
  Navigation: () => (
    <Navigation
      label="Primary"
      items={[{ id: 'p', label: 'Projects', current: true }]}
      onSelect={() => {}}
    />
  ),
  PageHeader: () => <PageHeader title="Projects" />,
  StatusPill: () => <StatusPill tone="success">active</StatusPill>,
};

const rows = parseStateRows(CONTRACT);
const builtOn = parseBuiltOn(CONTRACT);

/**
 * Every state-test title in this directory, one string — EXCLUDING this file,
 * whose own fixtures mention state titles and would satisfy (a) vacuously.
 */
const corpus = readdirSync(here)
  .filter((f) => f.endsWith('.spec.tsx') && f !== 'state-coverage.spec.tsx')
  .map((f) => readFileSync(join(here, f), 'utf8'))
  .join('\n');

afterEach(cleanup);

// ---------------------------------------------------------------------------
// T886a — the mutations, observed failing by construction
// ---------------------------------------------------------------------------

describe('T886a · MUTATION — both dimensions can fail', () => {
  it('(a) a component missing a declared state fails, naming it', () => {
    const corpusWithoutLoading = corpus.replace('Button · state: loading', '');
    const missing = missingStateTests(rows, corpusWithoutLoading);
    expect(missing).toContain('Button · state: loading');
  });

  it('(b) a <div> where the row names <button> fails', () => {
    const { container } = render(<div>Press</div>);
    const problem = nativeElementProblem(container, builtOn.get('Button') as string);
    expect(problem).not.toBeNull();
    expect(problem).toContain('D-42');
  });
});

// ---------------------------------------------------------------------------
// T886 — the check itself
// ---------------------------------------------------------------------------

describe('T886 · the contract still parses (anti-vacuity)', () => {
  it('fifteen rows, each with at least the default state', () => {
    expect(rows.length).toBe(15);
    for (const row of rows) expect(row.states, `${row.name} declares no states`).toContain('default');
  });

  it('every row has a Built-on cell and a minimal render', () => {
    for (const row of rows) {
      expect(builtOn.has(row.name), `${row.name} has no D-42 row`).toBe(true);
      expect(RENDERS[row.name], `${row.name} has no minimal render here`).toBeDefined();
    }
  });
});

describe('T886 · (a) every declared state has a test (SC-DS-004)', () => {
  it('no declared state is untested', () => {
    expect(missingStateTests(rows, corpus)).toEqual([]);
  });
});

describe('T886 · (b) every component renders the native element its row names (D-42)', () => {
  it.each(rows.map((r) => [r.name] as [string]))('%s', (name) => {
    const { container } = render((RENDERS[name] as () => ReactElement)());
    expect(nativeElementProblem(container, builtOn.get(name) as string)).toBeNull();
  });
});

/**
 * T894 (EPIC-029) — the harness (T880) over every component of the Phase 1
 * inventory, in its minimal valid usage AND its noisiest state where the two
 * differ (FR-DS-030). Native elements carry most of this by construction
 * (D-42) — which is the starting point, not the evidence.
 */
import { afterEach, describe, it, vi } from 'vitest';
import { cleanup, render } from '@testing-library/react';
import type { ReactElement, ReactNode } from 'react';
import { expectNoViolations } from './axe';
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
import { ThemeControl } from '../../../src/design/ThemeControl';

function host(children: ReactNode): ReactElement {
  return (
    <main>
      <h1>Probe page</h1>
      {children}
    </main>
  );
}

afterEach(cleanup);

const CASES: Array<[string, () => ReactNode]> = [
  ['Button, loading', () => <Button loading>Save</Button>],
  ['TextInput, invalid', () => <TextInput aria-label="Name" invalid />],
  [
    'Select, with options',
    () => (
      <Select aria-label="Engine">
        <option value="a">A</option>
      </Select>
    ),
  ],
  ['Select, empty', () => <Select aria-label="Engine" emptyMessage="No engines are registered" />],
  ['Checkbox', () => <Checkbox aria-label="Agree" />],
  ['Radio', () => <Radio name="g" aria-label="Pick" />],
  [
    'FormField, with hint and error',
    () => (
      <FormField id="email" label="Email" hint="Work address preferred." error="Enter a valid email address.">
        <TextInput />
      </FormField>
    ),
  ],
  [
    'Table, populated with filter',
    () => (
      <Table
        caption="Requirements"
        columns={[{ key: 'ref', header: 'Reference' }]}
        rows={[{ ref: 'REQ-001' }]}
      />
    ),
  ],
  [
    'Table, empty',
    () => (
      <Table
        caption="Requirements"
        columns={[{ key: 'ref', header: 'Reference' }]}
        rows={[]}
        emptyTitle="No requirements yet"
        emptyExplanation="None have been captured."
      />
    ),
  ],
  [
    'EmptyState with action',
    () => (
      <EmptyState
        title="No projects yet"
        explanation="Nothing has been created."
        actionLabel="Create one"
        onAction={vi.fn()}
      />
    ),
  ],
  ['ErrorState', () => <ErrorState message="Could not load." action="Try again." />],
  ['LoadingIndicator', () => <LoadingIndicator label="Loading projects" />],
  ['Toast, dismissible', () => <Toast message="Requirement saved" onDismiss={vi.fn()} />],
  [
    'Navigation',
    () => (
      <Navigation
        label="Primary"
        items={[
          { id: 'p', label: 'Projects', current: true },
          { id: 'r', label: 'Requirements' },
        ]}
        onSelect={vi.fn()}
      />
    ),
  ],
  ['PageHeader, loading', () => <PageHeader title="Projects" level={2} loading />],
  ['StatusPill', () => <StatusPill tone="success">active</StatusPill>],

  // T931 (Phase 10) — the Phase 9 configurations. T894's cases above render
  // each component in its MINIMAL usage and were written before these regions
  // existed, so every one of them is markup the harness had never seen.
  [
    // The one with real assistive-technology substance: `count` puts
    // visually-hidden text inside the button, so the number is part of the
    // accessible name rather than a figure floating beside it.
    'Navigation, vertical with counts (T922)',
    () => (
      <Navigation
        label="Primary"
        orientation="vertical"
        items={[
          { id: 'r', label: 'Requirements', count: 12, current: true },
          { id: 'd', label: 'Decisions', count: 0 },
          { id: 's', label: 'Specifications' },
        ]}
        onSelect={vi.fn()}
      />
    ),
  ],
  [
    'PageHeader, with description (T917)',
    () => (
      <PageHeader
        title="Requirements"
        level={2}
        description="Everything captured for this project, and what it traces to."
      />
    ),
  ],
  // T913 — not an inventory row, but it renders on every page of the composed
  // application, so it belongs in the sweep every page is held to.
  ['ThemeControl', () => <ThemeControl />],
];

describe('T894 · every component passes the WCAG 2.2 AA harness', () => {
  it.each(CASES)('%s', async (_name, make) => {
    render(host(make()));
    await expectNoViolations();
  });

  it('Modal, open', async () => {
    render(
      <Modal open title="Confirm archive" onClose={vi.fn()}>
        <p>Archiving hides the project from lists.</p>
      </Modal>,
    );
    await expectNoViolations();
  });

  // T931 (Phase 10) — the head/body/foot Modal T921 produced. Both the header
  // (title beside its own close affordance) and the footer (the caller's
  // actions) are regions the case above never renders populated.
  it('Modal, open with actions in its footer (T921)', async () => {
    render(
      <Modal
        open
        title="Confirm archive"
        onClose={vi.fn()}
        actions={
          <>
            <Button variant="secondary" onClick={vi.fn()}>
              Keep project
            </Button>
            <Button variant="danger" onClick={vi.fn()}>
              Archive project
            </Button>
          </>
        }
      >
        <p>Archiving hides the project from lists.</p>
      </Modal>,
    );
    await expectNoViolations();
  });
});

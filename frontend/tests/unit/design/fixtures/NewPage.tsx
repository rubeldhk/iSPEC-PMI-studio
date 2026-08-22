/**
 * T900c (EPIC-029) — the NEW page: built from tokens and components only,
 * never shipped. It exists to prove SC-DS-006 — that a page nobody designed
 * for can be composed without inventing a single visual value — and it sits
 * DELIBERATELY outside frontend/src so the shipped lint scope stays honest;
 * token-sufficiency.spec.tsx drives the rule over it via the ESLint API.
 *
 * Where it needs raw layout values the components do not carry, it reaches
 * for tokens by var() reference — which is exactly the seam the check probes:
 * an unresolved reference here means the scale has a hole in it.
 */
import type { ReactElement } from 'react';
import { EmptyState } from '../../../../src/design/components/EmptyState';
import { FormField } from '../../../../src/design/components/FormField';
import { PageHeader } from '../../../../src/design/components/PageHeader';
import { StatusPill } from '../../../../src/design/components/StatusPill';
import { Table } from '../../../../src/design/components/Table';
import { TextInput } from '../../../../src/design/components/TextInput';

export function NewPage(): ReactElement {
  return (
    <main className="ds-page" style={{ maxWidth: 'var(--space-8)', gap: 'var(--space-6)' }}>
      <PageHeader title="Review queue" level={1} />
      <FormField id="new-page-filter" label="Reviewer" hint="Shown on the closure record.">
        <TextInput />
      </FormField>
      <Table
        caption="Open reviews"
        columns={[
          { key: 'id', header: 'Review' },
          { key: 'state', header: 'State' },
        ]}
        rows={[{ id: 'REV-001', state: <StatusPill tone="warning">waiting</StatusPill> }]}
      />
      <EmptyState
        title="No closed reviews yet"
        explanation="Closures appear here once the first review completes."
      />
    </main>
  );
}

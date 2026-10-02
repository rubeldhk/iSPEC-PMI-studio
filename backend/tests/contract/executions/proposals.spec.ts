/**
 * T1055, T1056 (EPIC-037 Band A) — the proposal is a REQUEST, not a decision.
 *
 * `R-037-5`. The rule is structural, so it is asserted against the two places
 * that could break it: the **schema**, which must carry no verdict column, and
 * the **contract**, which must give the connector no way to express one. Both
 * are read as text, because what matters is an absence.
 *
 * The corresponding behaviour — that a real proposal is adjudicated and the
 * verdict comes back as an event — is proven against PostgreSQL in
 * `tests/integration/executions/status-authority.spec.ts`.
 */
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const here = dirname(fileURLToPath(import.meta.url));
const MIGRATION = resolve(
  here,
  '../../../prisma/migrations/20260827160000_epic037_execution_registry/migration.sql',
);
const CONTRACT = resolve(
  here,
  '../../../../packages/execution-registry-contract/src/contract.ts',
);

const sql = readFileSync(MIGRATION, 'utf8');
/** Comments stripped: the rule is about the declared schema, not the prose. */
const ddl = sql.replace(/--.*$/gm, '');
const table = ddl.slice(
  ddl.indexOf('CREATE TABLE "status_transition_proposals"'),
  ddl.indexOf('CREATE TABLE "status_transition_state"'),
);

describe('T1055 · the proposal table carries no adjudication', () => {
  it('was actually found — the slice is not empty', () => {
    // Anti-vacuity: every absence below would pass against an empty string.
    expect(table.length).toBeGreaterThan(200);
    expect(table).toContain('"proposedState"');
    expect(table).toContain('"rationale"');
  });

  it.each(['verdict', 'adjudication', 'decision', 'approvedBy', 'appliedAt', 'outcome'])(
    'declares no "%s" column',
    (column) => {
      // A mutable verdict column would become the thing people read, and the
      // event stream would quietly stop being the authority.
      expect(table.includes(`"${column}"`), `the proposal carries ${column}`).toBe(false);
    },
  );

  it('is protected by an immutability trigger, not merely by convention', () => {
    // A reusable `reject_mutation()` function protects nothing until a trigger
    // attaches it to this table.
    expect(ddl).toContain('CREATE TRIGGER "status_transition_proposals_immutable"');
    expect(ddl).toMatch(
      /status_transition_proposals_immutable"\s*\n?\s*BEFORE UPDATE OR DELETE ON "status_transition_proposals"/,
    );
  });

  it('records who proposed it, and under which frozen identity', () => {
    // Identity is what makes the request adjudicable: EPIC-030 cannot apply
    // separation of duties to an anonymous proposal. The snapshot is the frozen
    // identity, so a later rename cannot rewrite who proposed this.
    for (const column of ['proposedBy', 'proposerSnapshotId']) {
      expect(table, `the proposal does not record ${column}`).toContain(`"${column}"`);
    }
  });

  it('leaves the authorisation basis to the event, not to a column', () => {
    // The delegation relied upon is recorded on `status-transition-proposed`,
    // where `registered` also records it -- in the immutable stream rather than
    // in a row that a later migration could widen or drop.
    expect(table.includes('"delegationId"')).toBe(false);
    const service = readFileSync(
      resolve(here, '../../../src/modules/executions/status-proposal.service.ts'),
      'utf8',
    );
    const proposed = service.slice(
      service.indexOf("type: 'status-transition-proposed'"),
      service.indexOf('this.adjudicator.adjudicate'),
    );
    expect(proposed).toContain('delegationId: delegation.id');
    expect(proposed).toContain('delegationIdentityVersion');
  });
});

describe('T1055 · the projection is separate, and says so', () => {
  it('keeps the verdict in its OWN table, which is rebuildable', () => {
    const projection = ddl.slice(ddl.indexOf('CREATE TABLE "status_transition_state"'));
    expect(projection).toContain('"state"');
    // And deliberately has no immutability trigger — a projection that could
    // not be rewritten could not be rebuilt.
    expect(ddl.includes('CREATE TRIGGER "status_transition_state_immutable"')).toBe(false);
  });

  it('constrains the projected state to a closed vocabulary', () => {
    expect(ddl).toContain('"status_transition_state_vocabulary"');
  });
});

describe('T1055 · the connector cannot express a verdict', () => {
  const contract = readFileSync(CONTRACT, 'utf8')
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/\/\/.*$/gm, '');
  const request = contract.slice(
    contract.indexOf('interface ProposeTransitionRequest'),
    contract.indexOf('interface ProposeTransitionRequest') + 900,
  );

  it('ProposeTransitionRequest states what is wanted and why', () => {
    expect(request).toContain('proposedState');
    expect(request).toContain('rationale');
    // `expectedCurrentStatus` is what makes the proposal falsifiable: without
    // it, an adjudicator cannot tell a stale proposal from a current one.
    expect(request).toContain('expectedCurrentStatus');
  });

  it.each(['verdict', 'approved', 'apply', 'force'])('declares no "%s" field', (field) => {
    expect(request.includes(field), `the request can express ${field}`).toBe(false);
  });
});

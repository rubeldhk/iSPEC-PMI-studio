/**
 * `T1306` (EPIC-038) — every included item records **why** it was included.
 *
 * `FR-CTX-064`, `PP-016` Explainable AI.
 *
 * Added 2026-08-31 to close analysis finding `E1`: the field existed in the
 * data model and no task wrote or tested it. That is the third instance in this
 * repository of a column nothing fills — after `EPIC-035`'s
 * `resolutionEvidenceRef` and `EPIC-034`'s four services registered in no
 * module — and the first caught before any code was written.
 *
 * ## Why it carries more weight than its size
 *
 * `plan.md` declares `PP-016` **Satisfied** on the strength of this field. An
 * unwritten column would not merely leave a null; it would make a principle row
 * false.
 *
 * ## And why the reason is recorded at selection
 *
 * A reason reconstructed afterwards is a guess about what the assembler was
 * thinking. The only moment the answer is known is the moment the item is
 * chosen, so that is where it is written — and a blank is refused rather than
 * defaulted, because a column that accepts `''` is a column that fills with it.
 */
import { describe, expect, it } from 'vitest';
import { AssemblyService } from '../../src/modules/context/assembly.service.js';
import { InMemoryContextStore } from '../../src/modules/context/context.store.js';
import {
  allow,
  candidates,
  classes,
  input,
  noAuthorisations,
  retrieval,
} from '../helpers/context-fixtures.js';

const service = (store: InMemoryContextStore): AssemblyService =>
  new AssemblyService(store, {
    retrieval: retrieval(candidates(['rq_1', 'rq_2'])),
    access: allow(),
    sourceClasses: classes(['requirement']),
    authorisations: noAuthorisations(),
  });

describe('T1306 · every item says why it is here', () => {
  it('no item carries a blank reason', async () => {
    const store = new InMemoryContextStore();
    const result = await service(store).assemble(input());
    const items = await store.itemsFor('ws_1', result.packageId);

    expect(items).toHaveLength(2);
    for (const item of items) {
      expect(item.inclusionReason.trim().length, `${item.sourceId} gives no reason`).toBeGreaterThan(
        0,
      );
    }
  });

  it('and the reason names what selected it, not merely that it was selected', async () => {
    // *"included"* is not a reason. `PP-016` asks what a reader can act on:
    // which part of the objective, or which rule, put this item here.
    const store = new InMemoryContextStore();
    const result = await service(store).assemble(input());
    const items = await store.itemsFor('ws_1', result.packageId);

    for (const item of items) {
      expect(item.inclusionReason).not.toMatch(/^included$/i);
      expect(item.inclusionReason.length).toBeGreaterThan(10);
    }
  });

  it('citing the objective it was assembled for', async () => {
    // The objective is the only thing that makes relevance meaningful, so the
    // reason refers to it rather than standing alone.
    const store = new InMemoryContextStore();
    const result = await service(store).assemble(
      input({ objective: 'why does the booking notify twice' }),
    );
    const items = await store.itemsFor('ws_1', result.packageId);
    expect(items[0]?.inclusionReason).toMatch(/objective|relevance|rank/i);
  });

  it('and an essential item says that is why it is here', async () => {
    // An item present because somebody marked it essential was not selected by
    // relevance, and recording it as though it were would misdescribe the
    // package to whoever reads it.
    const store = new InMemoryContextStore();
    const result = await service(store).assemble(
      input({ essentialSources: [{ sourceType: 'requirement', sourceId: 'rq_2' }] }),
    );
    const items = await store.itemsFor('ws_1', result.packageId);
    const marked = items.find((i) => i.sourceId === 'rq_2');
    expect(marked?.inclusionReason).toMatch(/essential/i);
  });

  it('and the two reasons are distinguishable, so the record is worth reading', async () => {
    // The control for the assertion above: if every item got the same sentence,
    // "essential" would appear on all of them and mean nothing.
    const store = new InMemoryContextStore();
    const result = await service(store).assemble(
      input({ essentialSources: [{ sourceType: 'requirement', sourceId: 'rq_2' }] }),
    );
    const items = await store.itemsFor('ws_1', result.packageId);
    const reasons = new Set(items.map((i) => i.inclusionReason));
    expect(reasons.size).toBe(2);
  });
});

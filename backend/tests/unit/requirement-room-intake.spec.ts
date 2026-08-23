/**
 * T338a — multi-source intake becomes candidates. `FR-RQR-010`, `R-033-1`,
 * `D-33`.
 *
 * *"Direct input and imported documents become candidates, normalized and
 * labelled, never decided requirements."*
 *
 * Three properties, and the third is the one this Epic exists to protect:
 *
 *   - **a document becomes candidates, plural.** One row per segment, so an
 *     imported document is not a single wall of text nobody can decide on
 *     individually. Direct input is one segment and therefore one candidate —
 *     the same code path, not a special case;
 *   - **normalized**, so an incidental re-wrap of a source document does not
 *     read as different intent (the same rule `requirement-hash.ts` applies for
 *     the same reason);
 *   - **never a decided requirement.** `promotedTo` is null on every candidate
 *     here, and `IntakeService` is constructed with **no register at all** —
 *     the strongest available form of `FR-RQR-002`. A service that cannot reach
 *     `EPIC-007` cannot write to it by mistake, so this is asserted by
 *     construction rather than by a spy a later refactor could satisfy.
 *
 * **The caller does not choose the label, and there is no field for one.**
 * `IntakeCommand` has no `epistemic` member, so labelling intake is not a
 * decision a call site makes. Intake *records* what a source said; it infers
 * nothing and recommends nothing, which is what `fact` means here. Letting a
 * caller pass a label would make intake a way to enter an inference already
 * wearing the label of a fact — `RULE-03` inverted through a parameter. The
 * stray-key case below proves the value is computed rather than read.
 */
import { describe, expect, it } from 'vitest';
import { EPISTEMIC_KINDS } from '@pmi/room-contract';
import { ValidationFailedError } from '../../src/core/errors.js';
import {
  IntakeService,
  type IntakeCommand,
} from '../../src/modules/requirement-room/intake.service.js';
import {
  InMemoryRequirementRoomStore,
  fromPersistedEpistemic,
  toPersistedEpistemic,
} from '../../src/modules/requirement-room/requirement-room.store.js';

function command(over: Partial<IntakeCommand> = {}): IntakeCommand {
  return {
    workspaceId: 'ws_1',
    projectId: 'pr_1',
    roomObjectId: 'ro_1',
    sourceRef: 'direct:2026-08-23',
    sourceKind: 'direct',
    text: 'The system must retain a superseded baseline.',
    ...over,
  };
}

function service(): { intake: IntakeService; store: InMemoryRequirementRoomStore } {
  const store = new InMemoryRequirementRoomStore();
  // One argument. There is no register to pass — see the note above.
  return { intake: new IntakeService(store), store };
}

describe('T338a · direct input and documents both become candidates', () => {
  it('turns direct input into exactly one candidate', async () => {
    const { intake } = service();
    const candidates = await intake.intake(command());

    expect(candidates).toHaveLength(1);
    expect(candidates[0]?.normalizedText).toBe('The system must retain a superseded baseline.');
    expect(candidates[0]?.sourceRef).toBe('direct:2026-08-23');
  });

  it('turns one imported document into several candidates', async () => {
    const { intake } = service();
    const candidates = await intake.intake(
      command({
        sourceKind: 'document',
        sourceRef: 'upload:stakeholder-brief.md',
        text: 'Baselines must be immutable.\n\nEvery decision needs a rationale.\n\nAn AI must not approve.',
      }),
    );

    expect(candidates.map((c) => c.normalizedText)).toEqual([
      'Baselines must be immutable.',
      'Every decision needs a rationale.',
      'An AI must not approve.',
    ]);
    // Every candidate names the document it came from — SC-RQR-006 needs the
    // trace to run backwards from a baseline to the intent it came from.
    expect(candidates.every((c) => c.sourceRef === 'upload:stakeholder-brief.md')).toBe(true);
  });

  it('splits a document only on blank lines, so a wrapped sentence stays one candidate', async () => {
    const { intake } = service();
    const candidates = await intake.intake(
      command({
        sourceKind: 'document',
        text: 'A superseded baseline\nremains readable and names\nwhat replaced it.',
      }),
    );

    expect(candidates).toHaveLength(1);
    expect(candidates[0]?.normalizedText).toBe(
      'A superseded baseline remains readable and names what replaced it.',
    );
  });
});

describe('T338a · candidates are normalized', () => {
  it('collapses incidental whitespace and trims', async () => {
    const { intake } = service();
    const [candidate] = await intake.intake(
      command({ text: '  The   system\tmust\n retain  a baseline.  ' }),
    );

    expect(candidate?.normalizedText).toBe('The system must retain a baseline.');
  });

  it('preserves casing — "SHALL" and "shall" are not the same requirement', async () => {
    const { intake } = service();
    const [candidate] = await intake.intake(command({ text: 'The system SHALL refuse.' }));

    expect(candidate?.normalizedText).toBe('The system SHALL refuse.');
  });
});

describe('T338a · candidates are labelled, and the caller does not choose the label', () => {
  it('labels every candidate with one of the four kinds', async () => {
    const { intake } = service();
    const candidates = await intake.intake(
      command({ sourceKind: 'document', text: 'One.\n\nTwo.\n\nThree.' }),
    );

    expect(candidates).toHaveLength(3);
    for (const candidate of candidates) {
      expect(EPISTEMIC_KINDS).toContain(candidate.epistemic);
    }
  });

  it('labels intake `fact` — it records what a source said and infers nothing', async () => {
    const { intake } = service();
    const [candidate] = await intake.intake(command());

    expect(candidate?.epistemic).toBe('fact');
  });

  it('ignores a label smuggled in past the type, rather than honouring it', async () => {
    const { intake } = service();
    // `IntakeCommand` has no `epistemic` member, so this is only reachable by
    // casting — which is exactly what an untyped HTTP body does. The value must
    // be computed, not read.
    const smuggled = { ...command(), epistemic: 'recommendation' } as unknown as IntakeCommand;
    const [candidate] = await intake.intake(smuggled);

    expect(candidate?.epistemic).toBe('fact');
  });
});

describe('T338a · a candidate is never a decided requirement', () => {
  it('leaves promotedTo null — the EPIC-007 reference is absent until something decides', async () => {
    const { intake } = service();
    const candidates = await intake.intake(
      command({ sourceKind: 'document', text: 'One.\n\nTwo.' }),
    );

    expect(candidates.every((c) => c.promotedTo === null)).toBe(true);
  });

  it('stores no requirement field beyond the normalized candidate itself', async () => {
    const { intake, store } = service();
    const [candidate] = await intake.intake(command());
    const stored = await store.findCandidateById(candidate!.id);

    // D-33 / FR-RQR-002 in the shape a reviewer can check at a glance: the row
    // holds normalized intent and a REFERENCE, and no second copy of a decided
    // requirement's description, type or priority.
    //
    // This is also the `requirement_candidates` column set exactly. The
    // in-memory store and the table must hold the same fields or the Prisma
    // implementation of this port cannot satisfy it — and a row shape that
    // drifts from the model is how a "temporary" extra field becomes a second
    // requirement store. `sourceKind` is deliberately NOT here: it says how to
    // segment the submitted text, and `sourceRef` is what identifies the source
    // afterwards (data-model §1).
    expect(Object.keys(stored ?? {}).sort()).toEqual([
      'acceptanceCriteria',
      'aiAnalysis',
      'createdAt',
      'epistemic',
      'id',
      'intendedForImplementation',
      'normalizedText',
      'projectId',
      'promotedTo',
      'roomObjectId',
      'sourceRef',
      'workspaceId',
    ]);
  });

  it('scopes every candidate to the acting workspace and project — BR-0001', async () => {
    const { intake } = service();
    const [candidate] = await intake.intake(command());

    expect(candidate?.workspaceId).toBe('ws_1');
    expect(candidate?.projectId).toBe('pr_1');
    expect(candidate?.roomObjectId).toBe('ro_1');
  });
});

describe('T338a · intake refuses rather than producing nothing', () => {
  it.each(['workspaceId', 'projectId', 'roomObjectId', 'sourceRef', 'text'] as const)(
    'names %s when it is missing, so a caller can act on the refusal',
    async (field) => {
      const { intake } = service();
      const broken = { ...command(), [field]: '' };

      await expect(intake.intake(broken)).rejects.toThrow(ValidationFailedError);
      await expect(intake.intake(broken)).rejects.toThrow(new RegExp(field));
    },
  );

  it('refuses a document that normalizes to nothing, rather than storing zero candidates', async () => {
    const { intake } = service();
    // The quiet failure this guards: a caller uploads a file that produced no
    // text, gets `200 []`, and believes the intent is in the Room.
    await expect(
      intake.intake(command({ sourceKind: 'document', text: '   \n\n  \t \n ' })),
    ).rejects.toThrow(ValidationFailedError);
  });
});

describe('T338a · the label survives persistence, in both directions', () => {
  // `Epistemic` is `open-question`; the `RoomEpistemic` enum is `open_question`,
  // because a Postgres enum member cannot carry a hyphen. That single character
  // is the whole reason this block exists: a mapping that exists but is only
  // applied in one direction reads a stored `open_question` back as a value the
  // contract's union does not contain, and every `switch` over the four kinds
  // then falls through to whatever the default branch happens to be — which is
  // exactly the unlabelled element `FR-RQR-011` forbids, arriving through the
  // storage layer rather than through a call site.
  it('round-trips all four kinds without loss', () => {
    for (const kind of EPISTEMIC_KINDS) {
      expect(fromPersistedEpistemic(toPersistedEpistemic(kind))).toBe(kind);
    }
  });

  it('maps the one member whose spelling has to change, and leaves the rest alone', () => {
    expect(toPersistedEpistemic('open-question')).toBe('open_question');
    expect(fromPersistedEpistemic('open_question')).toBe('open-question');
    expect(toPersistedEpistemic('fact')).toBe('fact');
  });

  it('refuses an unrecognised stored value rather than defaulting it to a kind', () => {
    // A default here would invent a label for a row nobody labelled.
    expect(() => fromPersistedEpistemic('unlabelled')).toThrow(/unlabelled/);
  });
});

/**
 * `T1190` (EPIC-033 Phase 11) — the decision surface.
 *
 * `US4`'s screen, and the one most easily built into a lie. A decision surface
 * offering one path is *"a conclusion wearing a decision's clothes"* — the
 * spec's own words — so the shape here is load-bearing rather than cosmetic.
 *
 * **Two option forms are rendered before anything is typed.** Not one with an
 * "add another" affordance: the easy path is the one that gets used, and a
 * single-option decision is what `BR-0023` exists to prevent.
 *
 * **Nothing is pre-selected.** `FR-RQR-022`. A checked default is a decision the
 * person did not take, and it would be recorded as though they had.
 *
 * **Every option is sent, not just the winner.** `FR-RQR-023` keeps the options
 * *not* chosen, and the service derives them from the difference — so a form
 * that submitted only the chosen option would silently lose the half that makes
 * a decision reviewable.
 *
 * `RULE-03` under all of it: this region collects what a person decided. It
 * never decides, and it holds no path that could.
 */
import { useState, type FormEvent, type ReactElement } from 'react';

/** What a recorded decision looks like coming back. */
export interface RecordedDecision {
  readonly id: string;
  readonly roomObjectId: string;
  readonly decidedBy: string;
  readonly chosenOption: string;
  readonly declinedOptions: readonly string[];
  readonly rationale: string;
}

/** `FR-RQR-021` — an option is not stated until all four are. */
export interface DraftOption {
  readonly id: string;
  readonly summary: string;
  readonly tradeOffs: readonly string[];
  readonly dependencies: readonly string[];
  readonly risks: readonly string[];
  readonly reasoning: string;
}

export interface DecisionProps {
  readonly decisions: readonly RecordedDecision[];
  onDecide(
    options: readonly DraftOption[],
    chosenOptionId: string,
    rationale: string,
  ): Promise<void>;
}

interface DraftFields {
  summary: string;
  tradeOffs: string;
  dependencies: string;
  risks: string;
  reasoning: string;
}

const EMPTY: DraftFields = {
  summary: '',
  tradeOffs: '',
  dependencies: '',
  risks: '',
  reasoning: '',
};

/** One per line, blanks dropped — the simplest input that yields a real list. */
const lines = (value: string): string[] =>
  value
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line !== '');

const stated = (draft: DraftFields): boolean =>
  draft.summary.trim() !== '' &&
  lines(draft.tradeOffs).length > 0 &&
  lines(draft.dependencies).length > 0 &&
  lines(draft.risks).length > 0 &&
  draft.reasoning.trim() !== '';

export function Decision({ decisions, onDecide }: DecisionProps): ReactElement {
  const [drafts, setDrafts] = useState<DraftFields[]>([{ ...EMPTY }, { ...EMPTY }]);
  const [chosen, setChosen] = useState<number | null>(null);
  const [rationale, setRationale] = useState('');
  const [problem, setProblem] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const update = (index: number, field: keyof DraftFields, value: string): void => {
    setDrafts((current) =>
      current.map((draft, i) => (i === index ? { ...draft, [field]: value } : draft)),
    );
  };

  const submit = async (event: FormEvent): Promise<void> => {
    event.preventDefault();
    if (busy) return;
    setProblem(null);

    const complete = drafts.filter(stated);
    if (complete.length < 2) {
      setProblem(
        'A decision presents two or more options, each with trade-offs, dependencies, risks and reasoning.',
      );
      return;
    }
    if (chosen === null || !stated(drafts[chosen] ?? EMPTY)) {
      setProblem('Choose an option before recording the decision.');
      return;
    }
    if (rationale.trim() === '') {
      setProblem('A rationale is required — a decision nobody explained cannot be reviewed.');
      return;
    }

    const options: DraftOption[] = complete.map((draft, i) => ({
      id: `opt-${i + 1}`,
      summary: draft.summary.trim(),
      tradeOffs: lines(draft.tradeOffs),
      dependencies: lines(draft.dependencies),
      risks: lines(draft.risks),
      reasoning: draft.reasoning.trim(),
    }));
    const chosenId = options[complete.indexOf(drafts[chosen]!)]?.id;
    if (chosenId === undefined) {
      setProblem('Choose an option before recording the decision.');
      return;
    }

    setBusy(true);
    try {
      await onDecide(options, chosenId, rationale.trim());
      setDrafts([{ ...EMPTY }, { ...EMPTY }]);
      setChosen(null);
      setRationale('');
    } catch (error) {
      // Surfaced, never swallowed. The refusal a person meets today is
      // `PolicyUnavailableError` — `EPIC-031` has not bound the `PolicyProvider`
      // seam, and `FR-GEL-062` will not treat an undecided decision as an
      // approval. It reaches the client as a `500` because the Room deliberately
      // refuses to invent a status code it does not own (`DEF-008-001`), so
      // without this the form would clear and look as though it had worked.
      setProblem(
        error instanceof Error && error.message !== ''
          ? `The decision was not recorded: ${error.message}`
          : 'The decision was not recorded.',
      );
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="ds-stack">
      <h3>Decision</h3>
      <p className="ds-text-muted">
        Options are <strong>recommendations</strong>. A requirement decision is taken by an
        authorized person, and records what was not chosen.
      </p>

      {decisions.length > 0 && (
        <ul className="ds-stack">
          {decisions.map((decision) => (
            <li key={decision.id}>
              <p>
                Chose <code>{decision.chosenOption}</code>, declining{' '}
                <code>{decision.declinedOptions.join(', ') || 'nothing'}</code>.
              </p>
              <p>{decision.rationale}</p>
            </li>
          ))}
        </ul>
      )}

      <form className="ds-stack" onSubmit={(event): void => void submit(event)}>
        {drafts.map((draft, index) => {
          const n = index + 1;
          return (
            <fieldset key={index}>
              <legend>Option {n} — a recommendation</legend>

              <label htmlFor={`option-${n}-summary`}>Option {n} summary</label>
              <input
                id={`option-${n}-summary`}
                type="text"
                value={draft.summary}
                onChange={(e): void => update(index, 'summary', e.target.value)}
              />

              <label htmlFor={`option-${n}-tradeoffs`}>Option {n} trade-offs</label>
              <textarea
                id={`option-${n}-tradeoffs`}
                value={draft.tradeOffs}
                onChange={(e): void => update(index, 'tradeOffs', e.target.value)}
                placeholder="One per line"
              />

              <label htmlFor={`option-${n}-dependencies`}>Option {n} dependencies</label>
              <textarea
                id={`option-${n}-dependencies`}
                value={draft.dependencies}
                onChange={(e): void => update(index, 'dependencies', e.target.value)}
                placeholder="One per line"
              />

              <label htmlFor={`option-${n}-risks`}>Option {n} risks</label>
              <textarea
                id={`option-${n}-risks`}
                value={draft.risks}
                onChange={(e): void => update(index, 'risks', e.target.value)}
                placeholder="One per line"
              />

              <label htmlFor={`option-${n}-reasoning`}>Option {n} reasoning</label>
              <textarea
                id={`option-${n}-reasoning`}
                value={draft.reasoning}
                onChange={(e): void => update(index, 'reasoning', e.target.value)}
              />

              <label htmlFor={`option-${n}-choose`}>Choose option {n}</label>
              <input
                id={`option-${n}-choose`}
                type="radio"
                name="chosen-option"
                checked={chosen === index}
                onChange={(): void => setChosen(index)}
              />
            </fieldset>
          );
        })}

        <button
          type="button"
          onClick={(): void => setDrafts((current) => [...current, { ...EMPTY }])}
        >
          Add another option
        </button>

        <label htmlFor="decision-rationale">Rationale</label>
        <textarea
          id="decision-rationale"
          value={rationale}
          onChange={(e): void => setRationale(e.target.value)}
        />

        {problem !== null && <p role="alert">{problem}</p>}

        <button type="submit" disabled={busy}>
          Record decision
        </button>
      </form>
    </section>
  );
}

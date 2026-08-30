/**
 * `T996w` (EPIC-034) — the Change Room's options region.
 *
 * `FR-CHR-040`–`FR-CHR-042`, `FR-CHR-082`, `UX-0031`.
 *
 * ## Why the marking is not optional and not local
 *
 * `UX-0031` calls an unlabelled recommendation *"a governance failure expressed
 * as a styling choice"*. Six trade-off dimensions laid out in a tidy table,
 * with nothing saying a model produced them, is that failure — and it is more
 * convincing for being tidy. So every option goes through `EpistemicMark`,
 * `EPIC-033`'s shared component, which derives the treatment from the label and
 * offers no override. There is no token map in this file: a per-Room mapping is
 * how two Rooms come to paint the same label differently (`UX-0035`).
 *
 * ## Nothing is pre-selected
 *
 * No highlight, no default, no badge on one of them, and no prop through which
 * a caller could ask for one. `RULE-03` inverted looks exactly like a helpful
 * default, and the options arrive in the order the service returned them —
 * which is the order the provider gave, because a "best first" sort is a
 * pre-selection nobody has to admit to.
 *
 * ## A degraded result is not an empty table
 *
 * When no options could be produced this renders the reason and no cards. An
 * empty table would read as *"no options exist"*, which is a different claim
 * from *"nobody could produce any"* — and the first one is a conclusion nobody
 * reached.
 *
 * ## Why this is a region and not `pages/ChangeRoom.tsx`
 *
 * `T996w` named the page file. It is the wrong home, and `T200a` said so: every
 * module under `src/pages/` must be reachable from the application root, and a
 * page that nothing renders is the defect that check exists to catch —
 * `DEF-010-001`, where five of nine pages were imported by nothing.
 *
 * What this is, is a **region**, like `Candidates`, `Decision` and `Baseline`
 * beside it. Phase 8's `T994s` owns `pages/ChangeRoom.tsx` and composes six
 * regions through `RoomShell`; it will import this one the way
 * `RequirementRoom.tsx` imports `Candidates`. Putting it in `pages/` now would
 * have meant either a routed screen showing a single fragment, or a guard
 * worked around.
 */
import type { ReactElement } from 'react';
import { EpistemicMark } from './Epistemic';

/** `FR-CHR-041`'s six, in the requirement's order — how a reader compares two options. */
const DIMENSIONS = [
  'schedule',
  'cost',
  'quality',
  'security',
  'compatibility',
  'delivery',
] as const;

type DimensionName = (typeof DIMENSIONS)[number];

export interface TradeOffView {
  /** `false` means *explicitly not applicable*, which still carries a detail. */
  readonly stated: boolean;
  readonly detail: string;
}

export interface ChangeOptionView {
  readonly optionId: string;
  readonly summary: string;
  readonly reasoning: string;
  readonly tradeOffs: Readonly<Record<DimensionName, TradeOffView>>;
  readonly epistemic: 'recommendation';
}

export interface RejectedOptionView {
  readonly index: number;
  readonly reason: string;
}

/** What `POST /rooms/change/requests/:id/options` returns, verbatim. */
export interface ChangeOptionsView {
  readonly available: boolean;
  /** Two or more, or `null`. Never one, and never a pair invented to fill it. */
  readonly options: readonly ChangeOptionView[] | null;
  readonly degradedReason: string | null;
  readonly degradedKind: string | null;
  readonly rejected: readonly RejectedOptionView[];
}

function TradeOffRow({
  dimension,
  tradeOff,
}: {
  dimension: DimensionName;
  tradeOff: TradeOffView;
}): ReactElement {
  return (
    <div className="tradeoff">
      <dt data-testid="tradeoff-dimension">{dimension}</dt>
      <dd>
        {/* A stated position, shown as one. Hiding it would turn somebody's
            answer into an absence. */}
        {tradeOff.stated ? null : <span className="tradeoff__na">Not applicable — </span>}
        {tradeOff.detail}
      </dd>
    </div>
  );
}

function OptionCard({ option }: { option: ChangeOptionView }): ReactElement {
  return (
    <article className="change-option" data-testid="change-option">
      <header>
        <EpistemicMark value={{ epistemic: option.epistemic, value: option.summary }} />
      </header>
      <p className="change-option__reasoning">{option.reasoning}</p>
      <dl className="change-option__tradeoffs">
        {DIMENSIONS.map((dimension) => (
          <TradeOffRow key={dimension} dimension={dimension} tradeOff={option.tradeOffs[dimension]} />
        ))}
      </dl>
    </article>
  );
}

export interface ChangeOptionsRegionProps {
  readonly view: ChangeOptionsView;
}

export function ChangeOptionsRegion({ view }: ChangeOptionsRegionProps): ReactElement {
  if (!view.available || view.options === null) {
    return (
      <section className="change-options" aria-label="Options">
        <p className="change-options__unmet">
          FR-CHR-040 asks for two or more options and none are being shown. This is not a
          statement that no options exist — it is that none could be produced.
        </p>
        {view.degradedReason === null ? null : (
          <p className="change-options__reason">{view.degradedReason}</p>
        )}
        {view.rejected.length === 0 ? null : (
          <ul className="change-options__rejected">
            {/* Never silently dropped: a discarded option is a fact about what
                the provider produced. */}
            {view.rejected.map((rejected) => (
              <li key={rejected.index}>
                Option {rejected.index + 1} was not shown: {rejected.reason}
              </li>
            ))}
          </ul>
        )}
      </section>
    );
  }

  return (
    <section className="change-options" aria-label="Options">
      {view.options.map((option) => (
        <OptionCard key={option.optionId} option={option} />
      ))}
    </section>
  );
}

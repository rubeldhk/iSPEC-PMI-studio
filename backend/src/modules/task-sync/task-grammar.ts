/**
 * `T1697` / `T1777` (EPIC-046, `R-046-1`) — the `tasks.md` grammar.
 *
 * Pure: no I/O, no clock, no store. Given the same markdown and the same
 * configuration it returns the same result (`FR-KAN-009`), which is what lets
 * the corpus at `tests/fixtures/task-grammar/corpus.md` be the specification
 * rather than a description of one.
 *
 * ## Why the grammar lives here and not in the harness
 *
 * `packages/workspace-bundle`'s `tickedTasks` says so itself: *"The identifier's
 * SHAPE is the platform's policy (its governance configuration), not the
 * harness's."* The hook was built to leave this decision to the platform, and
 * `FR-KAN-002` requires it be configuration rather than a code path — so a
 * policy change is a deployment, not a re-provisioning of every workstation.
 *
 * The consequence is deliberate: the hook's `tickedTasks` takes *the first token
 * after a ticked checkbox* and is more permissive than this pattern, so a hook
 * can report progress for a token this grammar rejects. That is not a defect,
 * it is `FR-KAN-042`'s **unmatched progress report** — the two rules meet
 * without either side needing to know the other's.
 *
 * ## Three verdicts, and where the line between them falls
 *
 * **ignored** — not a task-list item at the start of a line. Not counted, not
 * reported (`FR-KAN-001`): headings, prose, tables, nested items, a `*` bullet,
 * a double space, a checkbox character the grammar does not know.
 *
 * **refused** — it opened as one of this grammar's task-list items and then
 * failed. Counted and reported with a code, never dropped (`FR-KAN-003`).
 *
 * **parsed** — a task.
 *
 * The boundary is `CONSIDERED`, and it is drawn tightly on purpose: the nine
 * refusal codes of data-model.md §7 are all about the *content after the
 * checkbox*, so a line whose bullet or spacing is wrong has no code to be
 * refused under. Widening the checkbox forms is a configuration change; adding
 * a tenth code would be a contract change, and this Epic does not make one.
 *
 * ## Nothing is inferred
 *
 * `FR-KAN-004`. No identifier is generated, no description rewritten, and no
 * status read from position, section, ordering or prose — a `- [ ]` line under
 * a heading called *Done* stays `not_started`, which the corpus asserts.
 */
import { loadStageConfig } from '@pmi/epic-stage';
import { scrubCredentials } from '../../core/errors.js';
import type { LineOutcome, LineRefusalCode } from './task-sync.store.js';

export interface TaskGrammarConfig {
  /** Default `^T\d+$` — `DS-1`'s `T###`. Configuration, per `FR-KAN-002`. */
  readonly identifierPattern: RegExp;
  /** The optional marker after the identifier. `DS-1`'s `[P?]`. */
  readonly parallelMarker: string;
  readonly descriptionMaxLength: number;
}

/**
 * The identifier shape, **composed rather than written** (`FR-ESK-025`).
 *
 * `governance/epic-stage.config.json` holds it, because it was once hand-copied
 * into six sites across three files and widening it meant editing six correctly
 * with nothing to notice a miss. `tests/governance/epic-stage/task-id-format.spec.ts`
 * fails any source that writes the shape itself, and it is right to: this module
 * would have been the seventh site.
 *
 * A deployment may still override it with `PMI_TASK_ID_PATTERN` (`R-046-9`) —
 * the shape is configuration, and this is its default, not its definition.
 */
function defaultIdentifierPattern(): RegExp {
  const configured = process.env['PMI_TASK_ID_PATTERN'];
  return new RegExp(configured !== undefined && configured.length > 0 ? configured : loadStageConfig().taskIdentifierRecogniser);
}

/**
 * The longest description a task line may carry (`R-046-9`).
 *
 * A limit rather than none, because the description is stored and rendered, and
 * a line that runs to a paragraph is a heading someone ticked rather than a
 * task. Configurable for the same reason the identifier shape is: a project's
 * conventions are not this module's to fix.
 */
function defaultDescriptionMax(): number {
  const configured = Number(process.env['PMI_TASK_DESCRIPTION_MAX']);
  return Number.isInteger(configured) && configured > 0 ? configured : 500;
}

export const DEFAULT_TASK_GRAMMAR: TaskGrammarConfig = Object.freeze({
  identifierPattern: defaultIdentifierPattern(),
  parallelMarker: '[P]',
  descriptionMaxLength: defaultDescriptionMax(),
});

export interface ParsedTaskLine {
  readonly lineNumber: number;
  readonly rawText: string;
  readonly outcome: LineOutcome;
  readonly refusalCode: LineRefusalCode | null;
  /** Names the family of a problem, never quotes the offending text (`FR-KAN-073`). */
  readonly refusalDetail: string | null;
  readonly taskKey: string | null;
  readonly description: string;
  readonly checked: boolean;
  readonly parallel: boolean;
  /** Repository paths the description names (`FR-KAN-005`, `DS-1`). Empty is a fact. */
  readonly sourcePaths: readonly string[];
  /** On a duplicate: where the winning line was (`FR-KAN-007`). */
  readonly firstSeenOnLine: number | null;
}

export interface ParseCounts {
  readonly linesConsidered: number;
  readonly parsed: number;
  readonly refused: number;
  readonly duplicates: number;
}

export interface ParseResult {
  readonly lines: readonly ParsedTaskLine[];
  readonly counts: ParseCounts;
}

/**
 * The boundary. A `-` bullet at column 0, one space, a checkbox that is exactly
 * ` `, `x` or `X`, one space, and then something. Anything else in the file is
 * not this grammar's business — see the header for why this is drawn tightly.
 */
const CONSIDERED = /^- \[([ xX])\] (.*)$/;

/**
 * A backticked span is a repository path when it looks like one: it contains a
 * `/`, or it ends in a file extension. `presentInLatestParse` in backticks is an
 * identifier a description is discussing, not a file it changes.
 */
const PATH_LIKE = /^[\w.@~-]+(?:\/[\w.@~-]+)+$|^[\w.@~-]+\.[A-Za-z0-9]{1,8}$/;

function pathsIn(description: string): string[] {
  const spans = [...description.matchAll(/`([^`]+)`/g)].map((m) => m[1] ?? '');
  const found = spans.filter((s) => PATH_LIKE.test(s.trim())).map((s) => s.trim());
  return [...new Set(found)];
}

/**
 * The credential families, borrowed from `core/errors.ts` so a refusal here and
 * an audit row there cannot disagree about what a credential looks like. The
 * detail names the family and stops (`FR-KAN-073`).
 */
function credentialFamily(text: string): string | null {
  if (scrubCredentials(text) === text) return null;
  if (/pmi_ct_[A-Za-z0-9_-]{20,}/.test(text)) return 'a PMI Studio connector credential';
  // The family, never a vendor: the backend names no provider (EPIC-041's rule).
  if (/\bsk-[A-Za-z0-9-]{16,}\b/.test(text)) return 'an API key';
  return 'a bearer token';
}

interface Draft {
  readonly lineNumber: number;
  readonly rawText: string;
  readonly checked: boolean;
  readonly rest: string;
}

function refuse(d: Draft, code: LineRefusalCode, detail: string, taskKey: string | null = null): ParsedTaskLine {
  return {
    lineNumber: d.lineNumber,
    rawText: d.rawText,
    outcome: 'refused',
    refusalCode: code,
    refusalDetail: detail,
    taskKey,
    description: '',
    checked: d.checked,
    parallel: false,
    sourcePaths: [],
    firstSeenOnLine: null,
  };
}

export function parseTasks(markdown: string, config: TaskGrammarConfig): ParseResult {
  const lines: ParsedTaskLine[] = [];
  const firstSeen = new Map<string, number>();

  markdown.split(/\r?\n/).forEach((rawText, index) => {
    const opened = CONSIDERED.exec(rawText);
    if (!opened) return; // ignored, and deliberately not counted

    const d: Draft = { lineNumber: index + 1, rawText, checked: opened[1] !== ' ', rest: (opened[2] ?? '').trim() };

    const [token, ...remainder] = d.rest.split(/\s+/);
    if (token === undefined || token === '') {
      lines.push(refuse(d, 'malformed_identifier', 'the line carries no identifier'));
      return;
    }
    if (!config.identifierPattern.test(token)) {
      lines.push(refuse(d, 'identifier_not_matched', `the identifier does not match ${String(config.identifierPattern)}`, null));
      return;
    }

    const parallel = remainder[0] === config.parallelMarker;
    const description = (parallel ? remainder.slice(1) : remainder).join(' ').trim();
    if (description === '') {
      lines.push(refuse(d, 'missing_description', 'the identifier carries no description', token));
      return;
    }
    if (description.length > config.descriptionMaxLength) {
      lines.push(refuse(d, 'description_too_long', `the description is ${description.length} characters; the limit is ${config.descriptionMaxLength}`, token));
      return;
    }
    const family = credentialFamily(description);
    if (family !== null) {
      // FR-KAN-073. Never store the description, never quote the match.
      lines.push(refuse(d, 'credential_in_description', `the description contains what looks like ${family}`, token));
      return;
    }

    const seen = firstSeen.get(token);
    if (seen !== undefined) {
      // FR-KAN-007: first wins, second reported with BOTH line numbers, sync succeeds.
      lines.push({
        lineNumber: d.lineNumber,
        rawText,
        outcome: 'duplicate',
        refusalCode: 'duplicate_identifier',
        refusalDetail: `the identifier ${token} was already used on line ${seen}`,
        taskKey: token,
        description,
        checked: d.checked,
        parallel,
        sourcePaths: pathsIn(description),
        firstSeenOnLine: seen,
      });
      return;
    }

    firstSeen.set(token, d.lineNumber);
    lines.push({
      lineNumber: d.lineNumber,
      rawText,
      outcome: 'parsed',
      refusalCode: null,
      refusalDetail: null,
      taskKey: token,
      description,
      checked: d.checked,
      parallel,
      sourcePaths: pathsIn(description),
      firstSeenOnLine: null,
    });
  });

  const count = (outcome: LineOutcome): number => lines.filter((l) => l.outcome === outcome).length;
  return {
    lines,
    counts: {
      linesConsidered: lines.length,
      parsed: count('parsed'),
      refused: count('refused'),
      duplicates: count('duplicate'),
    },
  };
}

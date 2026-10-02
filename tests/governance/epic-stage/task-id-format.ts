/**
 * T864e / T864i (EPIC-026 F-26.9) — the one definition of a task identifier.
 *
 * `FR-ESK-025`. **The pattern is configuration** (`FR-ESK-015`), held once in
 * `governance/epic-stage.config.json` beside `epicDirectoryPattern`, and read
 * from here by every check that needs it.
 *
 * Before this module, `T\d{3}[a-z]?` was written out by hand in **six places
 * across three files** — four of them in `dor.ts`. Widening it meant editing
 * six sites correctly, and **a missed site would not fail**: it would quietly
 * stop recognising identifiers, which is the failure mode this whole
 * requirement exists to end.
 *
 * ## Two patterns, because a checker asks two questions
 *
 * | Question | Pattern | On failure |
 * |---|---|---|
 * | Is this token meant to be a task identifier? | recogniser, `^T\d+[a-z]*$` | not one; ignore |
 * | Is it a **valid** one? | pattern, `^T\d{3,}[a-z]?$` | **unrecognised — fail** |
 *
 * A single narrow pattern **cannot report what it does not match**, because not
 * matching is how it says *"this is not a task id"*. `EPIC-036` `T441n` named
 * the consequence exactly: a four-digit id was *"invisible to all three
 * [checks] … silently unchecked, **which is worse than a collision**"*.
 */
import { readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..', '..');

interface StageConfig {
  readonly taskIdentifierPattern: string;
  readonly taskIdentifierRecogniser: string;
}

function config(): StageConfig {
  return JSON.parse(
    readFileSync(join(ROOT, 'governance', 'epic-stage.config.json'), 'utf8'),
  ) as StageConfig;
}

/**
 * A fresh anchored regex each call.
 *
 * Deliberately **not** a module-level constant: a shared `RegExp` carries
 * `lastIndex` state when a caller adds `g`, and a check that silently skips
 * every other match is precisely the class of fault this file exists to remove.
 */
export function taskIdentifierPattern(): RegExp {
  return new RegExp(config().taskIdentifierPattern);
}

/** The broader shape — what *looks* like a task identifier, valid or not. */
export function taskIdentifierRecogniser(): RegExp {
  return new RegExp(config().taskIdentifierRecogniser);
}

/** Strip the anchors so a pattern can be composed into a larger one. */
function unanchored(pattern: string): string {
  return pattern.replace(/^\^/, '').replace(/\$$/, '');
}

/**
 * The identifier shape **without anchors**, for composing into a larger regex.
 *
 * The six replaced sites each matched an identifier *in a context* — after
 * `covers`, after `unit test:`, at the start of a completed task line — so a
 * single anchored pattern could not serve them. **The fragment is what makes
 * one definition serve six uses**: each site keeps its own context and none
 * keeps its own idea of what an identifier looks like.
 */
export function taskIdentifierFragment(): string {
  return unanchored(config().taskIdentifierPattern);
}

/**
 * The **recogniser** shape without anchors — what the line parsers below use.
 *
 * `T1000`. Distinct from {@link taskIdentifierFragment}, and the distinction is
 * the whole point: a parser built from the *valid* pattern could never extract
 * `T99`, so {@link unrecognisedIdentifiers} could never report it. **Reporting
 * a malformed identifier requires first matching it** — the narrow pattern
 * classifies, the broad one parses, and swapping them silently restores the
 * skip this module exists to end.
 */
export function taskIdentifierRecogniserFragment(): string {
  return unanchored(config().taskIdentifierRecogniser);
}

/**
 * A task-line parser for one checkbox shape, composed from the recogniser.
 *
 * `T1000`. The checkbox class is the only thing that legitimately differs
 * between the two exported parsers; the identifier shape is the thing that
 * must not differ from anything. Before this, both wrote `T\d+[a-z]*` out by
 * hand — a third and fourth copy of the very shape this module exists to hold
 * once, inside the module holding it.
 */
function taskLineParser(checkbox: string): RegExp {
  return new RegExp(`^\\s*-\\s*\\[${checkbox}\\]\\s*(${taskIdentifierRecogniserFragment()})\\b`);
}

/**
 * The identifier a **completed** task line declares (`- [x]`), or `null`.
 *
 * Distinct from {@link taskIdentifierOf}, which accepts `- [ ]` too. The
 * distinction is load-bearing in `task-paths.spec.ts`: `G-26-14` asserts that a
 * task claiming to be **done** names paths that exist, and an incomplete task
 * naming a file it has not written yet is correct rather than a violation.
 */
export function completedTaskIdentifierOf(line: string): string | null {
  const match = taskLineParser('[xX]').exec(line);
  if (match === null) return null;
  return match[1]!;
}

/**
 * The identifier a task line declares, or `null` when the line declares none.
 *
 * Replaces the hand-written line parser that each consumer carried its own
 * copy of, and — since `T1000` — composes its identifier shape from
 * configuration rather than restating it.
 */
export function taskIdentifierOf(line: string): string | null {
  const match = taskLineParser('[xX ]').exec(line);
  if (match === null) return null;
  return match[1]!;
}

/** A task identifier that looks like one but is not valid. */
export interface UnrecognisedIdentifier {
  readonly id: string;
  readonly line: string;
}

/**
 * Every identifier-shaped token in a task list that the pattern does **not**
 * admit.
 *
 * This is the function `T441n` asked for. It is the difference between
 * *"nothing failed"* and *"nothing was examined"* — two states that look
 * identical from outside a checker, and only one of which is good news.
 */
export function unrecognisedIdentifiers(tasks: string): UnrecognisedIdentifier[] {
  const valid = taskIdentifierPattern();
  const recognises = taskIdentifierRecogniser();
  const found: UnrecognisedIdentifier[] = [];
  for (const line of tasks.split(/\r?\n/)) {
    const id = taskIdentifierOf(line);
    if (id === null) continue;
    if (!recognises.test(id)) continue; // not a task identifier at all
    if (valid.test(id)) continue; // a valid one
    found.push({ id, line: line.trim() });
  }
  return found;
}

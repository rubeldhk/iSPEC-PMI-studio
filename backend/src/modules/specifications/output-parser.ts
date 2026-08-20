/**
 * T079 — the engine output parser (F-04.2, FR-026).
 *
 * An adapter is third-party code. `ok: true` from the engine contract says the
 * run FINISHED; it does not say that what came back is a specification. This is
 * the boundary where that second question is answered, and answering it "no"
 * produces a named failure — never a stored specification with a hole in it.
 *
 * Two reasons, deliberately distinct (FR-026 / SC-005):
 *
 *   `empty_output`     — the engine produced nothing to store.
 *   `malformed_output` — it produced something that is not a specification.
 *
 * Collapsing them would lose the only signal that separates "the model returned
 * an empty completion" from "the adapter has a bug", which are diagnosed in
 * completely different places.
 *
 * Note the deliberate inversion recorded in plan.md: EPIC-021's review
 * capability treats "found nothing" as a PASS. Same contract, opposite meaning
 * — which is why emptiness is decided here, per capability, rather than in the
 * contract package.
 *
 * Framework-free (PC-1).
 */
import type { EngineFailureReason } from '@pmi/engine-contract';
import { FAILURE_MESSAGES } from '../../core/failure-taxonomy.js';

export type ParseFailureReason = Extract<EngineFailureReason, 'malformed_output' | 'empty_output'>;

export interface ParsedSpecification {
  title: string;
  /** Verbatim (R-007) — a future parser fix must be able to re-derive from it. */
  contentRaw: string;
  contentParsed: Record<string, unknown>;
}

export type ParseOutcome =
  | { ok: true; value: ParsedSpecification }
  | {
      ok: false;
      reason: ParseFailureReason;
      message: string;
      /** Operator-facing: WHICH field was wrong. Never the value itself (R-011, E9). */
      field: string;
    };

function fail(reason: ParseFailureReason, field: string): ParseOutcome {
  // The message is the taxonomy's, unmodified. Engine output is never folded
  // into it: it may carry a credential or a prompt (research R-011, rule E9).
  return { ok: false, reason, message: FAILURE_MESSAGES[reason], field };
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isBlank(value: string): boolean {
  return value.trim() === '';
}

/**
 * Validate one engine result into something storable.
 *
 * Order matters: emptiness is checked on `contentRaw` BEFORE structure, so an
 * engine that returned nothing is reported as having returned nothing rather
 * than as having returned nonsense.
 */
export function parseEngineOutput(output: unknown): ParseOutcome {
  if (!isPlainObject(output)) return fail('malformed_output', 'output');

  const { title, contentRaw, contentParsed } = output;

  if (typeof contentRaw !== 'string') return fail('malformed_output', 'contentRaw');
  if (isBlank(contentRaw)) return fail('empty_output', 'contentRaw');

  if (typeof title !== 'string' || isBlank(title)) return fail('malformed_output', 'title');

  if (!isPlainObject(contentParsed)) return fail('malformed_output', 'contentParsed');
  // Structure that extracted nothing is not structure. Storing `{}` would make
  // every later reader — diff, validation, task generation — fail further from
  // the cause.
  if (Object.keys(contentParsed).length === 0) return fail('malformed_output', 'contentParsed');

  return {
    ok: true,
    value: {
      // A name has no leading whitespace; content does, and keeps it.
      title: title.trim(),
      contentRaw,
      contentParsed,
    },
  };
}

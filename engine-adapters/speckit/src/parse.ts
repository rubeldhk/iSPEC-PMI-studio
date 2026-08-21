/**
 * Spec Kit output parsing (T091, tested by T087).
 *
 * Two rules carry the weight:
 *
 *   R-007  The raw output is ALWAYS retained, verbatim, even when parsing
 *          fails. RAID R-01 is that Spec Kit or model output drifts and breaks
 *          the parser; keeping the raw text means a parser fix can re-derive
 *          structure without re-running — and re-running is a billed AI call.
 *
 *   E6     Empty output is `empty_output`, never a valid empty specification.
 *          Returning `ok` with empty content would let a silently empty
 *          artifact enter the lifecycle and be approved.
 */
import type { GeneratedSpecification, ValidationFinding } from '@pmi/engine-contract';

export type ParseOutcome =
  | { ok: true; value: GeneratedSpecification }
  | { ok: false; reason: 'empty_output' | 'malformed_output'; detail: string };

/** A section keyed by its heading, in document order. */
export interface ParsedSections {
  title: string;
  sections: Record<string, string>;
  headingOrder: string[];
}

/**
 * Parse a generated `spec.md`.
 *
 * Deliberately permissive about *structure* and strict about *emptiness*. The
 * agent's headings vary between models and Spec Kit releases; what must never
 * vary is that a specification has a title and some content.
 */
export function parseSpecification(raw: string): ParseOutcome {
  if (raw.trim() === '') {
    return { ok: false, reason: 'empty_output', detail: 'The engine produced no output.' };
  }

  const lines = raw.split(/\r?\n/);
  const titleLine = lines.find((line) => /^#\s+\S/.test(line.trim()));

  if (!titleLine) {
    // No top-level heading: the output is *something*, but not a specification.
    return {
      ok: false,
      reason: 'malformed_output',
      detail: 'No top-level heading found; the output is not a specification document.',
    };
  }

  const title = titleLine.trim().replace(/^#\s+/, '').trim();
  const parsed = collectSections(lines, title);

  const hasBody = Object.values(parsed.sections).some((body) => body.trim() !== '');
  if (!hasBody) {
    // A title and nothing else is not a specification — and would otherwise
    // pass as a valid artifact with a plausible name.
    return {
      ok: false,
      reason: 'malformed_output',
      detail: 'The output has a title but no content under any heading.',
    };
  }

  const findings = extractSteeringFindings(raw);
  return {
    ok: true,
    value: {
      title,
      contentRaw: raw,
      contentParsed: { title: parsed.title, sections: parsed.sections, headingOrder: parsed.headingOrder },
      ...(findings.length > 0 ? { findings } : {}),
    },
  };
}

/**
 * EPIC-019 (steering-contract rule S6) — a steering violation the agent
 * recorded is surfaced as a FINDING on the successful result, never as a
 * failure. The agent is instructed (in the input document the adapter
 * renders) to record violations as
 * `<!-- steering-violation: <location> | <severity> | <message> -->`.
 */
export function extractSteeringFindings(raw: string): ValidationFinding[] {
  const findings: ValidationFinding[] = [];
  for (const match of raw.matchAll(/<!--\s*steering-violation:\s*([^|]+)\|([^|]+)\|([\s\S]*?)-->/g)) {
    const location = (match[1] ?? '').trim();
    const severity = (match[2] ?? '').trim();
    const message = (match[3] ?? '').trim();
    if (location === '' || message === '') continue;
    if (!['info', 'warning', 'error'].includes(severity)) continue;
    findings.push({ location, severity: severity as ValidationFinding['severity'], message });
  }
  return findings;
}

function collectSections(lines: string[], title: string): ParsedSections {
  const sections: Record<string, string> = {};
  const headingOrder: string[] = [];
  let current: string | null = null;
  const buffer: string[] = [];

  const flush = (): void => {
    if (current !== null) sections[current] = buffer.join('\n').trim();
    buffer.length = 0;
  };

  for (const line of lines) {
    const heading = /^(#{2,6})\s+(.+)$/.exec(line.trim());
    if (heading?.[2]) {
      flush();
      current = heading[2].trim();
      if (!headingOrder.includes(current)) headingOrder.push(current);
      continue;
    }
    if (current !== null) buffer.push(line);
  }
  flush();

  // A document with a title and prose but no sub-headings still has content.
  if (headingOrder.length === 0) {
    const body = lines.filter((line) => !/^#\s+/.test(line.trim())).join('\n').trim();
    if (body !== '') {
      sections['body'] = body;
      headingOrder.push('body');
    }
  }

  return { title, sections, headingOrder };
}

/**
 * Locate the generated spec file inside the workspace.
 *
 * Spec Kit writes to `specs/<feature>/spec.md` and chooses `<feature>` itself,
 * so the path is discovered rather than assumed.
 */
export function findSpecificationPath(paths: readonly string[]): string | null {
  const candidates = paths
    .filter((path) => /(^|\/)specs\/[^/]+\/spec\.md$/.test(path.replace(/\\/g, '/')))
    .sort();
  return candidates[0] ?? null;
}

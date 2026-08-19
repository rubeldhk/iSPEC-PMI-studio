/**
 * T601 / T604 — the reconciliation register's markdown → JSON projection.
 *
 * `R-027-1`: humans read markdown, checks read JSON. One source, two renderings,
 * and a digest so the two provably agree.
 *
 * **Why a projection at all.** Constitution V requires a check that can fail,
 * and a twenty-five-section report with ~470 register rows is exactly the
 * artifact that rots. Checking it by regex over prose produces a check that
 * passes on malformed input — worse than no check, because it manufactures
 * confidence.
 *
 * **The one design rule here: malformed input is REJECTED, never skipped.**
 * A parser that silently drops a bad row produces a smaller register, and every
 * completeness check downstream stays green because it iterates what it was
 * given. That is the failure shape this repository hit four times in one week
 * (DEF-001-001, DEF-018-001, DEF-028-001, DEF-028-003) — a check that names the
 * right condition and cannot observe it.
 *
 * Usage: `pnpm register:build`
 */
import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
export const REPO_ROOT = resolve(HERE, '..');
export const REGISTER_DIR = join(REPO_ROOT, 'specs/027-ai-native-amendment/register');
export const IMPACT_REPORT = join(REPO_ROOT, 'specs/027-ai-native-amendment/impact-report.md');
export const PROJECTION = join(REGISTER_DIR, 'register.json');

export class MalformedRowError extends Error {
  constructor(message) {
    super(message);
    this.name = 'MalformedRowError';
  }
}

/** The pipe table under `## Register`. Mirrors `register-structure.spec.ts`. */
export function parseTable(markdown) {
  const parts = markdown.split(/^## Register\s*$/m);
  if (parts.length < 2) return [];
  const rows = [];
  for (const line of parts[1].split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed.startsWith('|')) {
      if (rows.length > 0) break;
      continue;
    }
    if (/^\|[\s:|-]+\|$/.test(trimmed)) continue;
    rows.push(
      trimmed
        .slice(1, -1)
        .split('|')
        .map((cell) => cell.trim()),
    );
  }
  return rows;
}

/**
 * A single cell.
 *
 * `—` and `` and `null` all mean **absent**, and absent must be `null` rather
 * than the string `"—"`. A check asking `row.necessity === null` would pass on
 * the string; a check asking for truthiness would find `"—"` truthy and pass on
 * a row that records nothing.
 *
 * Booleans and integers are converted for the same reason: the string `"false"`
 * is truthy, and `removed_because_external` is the one field §2 forbids being
 * true.
 */
export function parseScalar(cell) {
  const value = String(cell ?? '').trim();
  if (value === '' || value === '—' || value === '-' || value.toLowerCase() === 'null') return null;
  if (value === 'true') return true;
  if (value === 'false') return false;
  if (/^-?\d+$/.test(value)) return Number.parseInt(value, 10);
  return value;
}

/** `a ; b ; c` → `['a','b','c']`; an em-dash → `[]`. */
export function parseList(cell) {
  const value = String(cell ?? '').trim();
  if (value === '' || value === '—' || value === '-') return [];
  return value
    .split(';')
    .map((part) => part.trim())
    .filter(Boolean);
}

/** `label :: consequence ;; label :: consequence` → option objects. */
export function parseOptions(cell) {
  const value = String(cell ?? '').trim();
  if (value === '' || value === '—' || value === '-') return [];
  return value.split(';;').map((pair) => {
    const [label, ...rest] = pair.split('::');
    const consequence = rest.join('::').trim();
    if (!consequence) {
      // A decision whose options carry no consequences is a decision presented
      // without its trade-offs — the thing FR-AMD-008 exists to forbid.
      throw new MalformedRowError(
        `option "${pair.trim()}" has no consequence; use "label :: consequence"`,
      );
    }
    return { label: label.trim(), consequence };
  });
}

/** Columns parsed as lists rather than scalars. */
const LIST_FIELDS = new Set(['duplicates', 'locations', 'blocking_research', 'blocks']);

/**
 * Header row + data rows → objects.
 *
 * Throws on any row whose cell count differs from the header. **This is the
 * most important line in the file**: dropping the row instead would shrink the
 * register silently.
 */
export function rowsToObjects(rows) {
  if (rows.length === 0) return [];
  const [header, ...data] = rows;
  return data.map((cells, index) => {
    if (cells.length !== header.length) {
      const hint = cells[0] ? `"${cells[0]}"` : `row ${index + 1}`;
      throw new MalformedRowError(
        `${hint} has ${cells.length} cells; the header declares ${header.length}. ` +
          `A row that does not match its header is rejected, never skipped — skipping it would ` +
          `shrink the register while every completeness check stayed green.`,
      );
    }
    const object = {};
    header.forEach((column, i) => {
      if (column === 'options') object[column] = parseOptions(cells[i]);
      else if (LIST_FIELDS.has(column)) object[column] = parseList(cells[i]);
      else object[column] = parseScalar(cells[i]);
    });
    return object;
  });
}

/** register file → projection key. */
const SOURCES = {
  'clauses.md': 'clauses',
  'verdicts.md': 'verdicts',
  'capabilities.md': 'capabilities',
  'capability-areas.md': 'capability_areas',
  'premises.md': 'premises',
  'decisions.md': 'decisions',
  'research.md': 'research',
  'adrs.md': 'adrs',
  'preserved-elements.md': 'preserved_element_changes',
};

/**
 * DEF-027-004 — line endings are normalised before hashing.
 *
 * This repository has no `.gitattributes` and `core.autocrlf=true` on Windows,
 * so the working copy holds CRLF while a Linux CI checkout holds LF. Hashing raw
 * bytes made every digest platform-dependent: all nine matched locally and none
 * matched in CI, which `G-27-11` correctly reported as nine files "changed since
 * the last build" that nobody had touched.
 *
 * Line endings are decided by git and the checkout platform, not by anything a
 * person wrote — the same reasoning EPIC-026's `RF-7` records. Nothing else is
 * normalised: a digest that ignored whitespace could not detect a whitespace
 * edit, which is a real edit.
 */
const sha256 = (text) =>
  createHash('sha256')
    .update(String(text).replace(/\r\n/g, '\n'))
    .digest('hex');

/**
 * The §18 report's own shape.
 *
 * Counted here rather than in the check so `G-27-06` reads one number from the
 * projection instead of re-implementing a markdown parser — two parsers for one
 * format is how a projection comes to disagree with its source.
 */
function summariseImpactReport() {
  if (!existsSync(IMPACT_REPORT)) return { sections: 0, empty_with_reason: [], placeholders: 0 };
  const text = readFileSync(IMPACT_REPORT, 'utf8');
  const sections = [...text.matchAll(/^## \d+\.\s/gm)].length;
  const placeholders = [...text.matchAll(/\bTBD\b|\bTODO\b|\bplaceholder\b|\[NEEDS/gi)].length;
  const empty = [...text.matchAll(/^## \d+\.\s+(.+?)\s*$\n+\s*_?Explicitly empty[:—-]/gim)].map(
    (m) => m[1],
  );
  return { sections, empty_with_reason: empty, placeholders };
}

export function buildRegister() {
  const projection = {
    version: '1.0',
    generated_from: {},
    clauses: [],
    verdicts: [],
    capabilities: [],
    capability_areas: [],
    premises: [],
    decisions: [],
    research: [],
    adrs: [],
    preserved_element_changes: [],
    epic_status_changes: [],
    impact_report: summariseImpactReport(),
  };

  for (const [file, key] of Object.entries(SOURCES)) {
    const path = join(REGISTER_DIR, file);
    if (!existsSync(path)) {
      throw new MalformedRowError(`register/${file} is missing; T598 creates the scaffold`);
    }
    const raw = readFileSync(path, 'utf8');
    // T604 — the digest is of the SOURCE file. `G-27-11` compares it back, so a
    // stale or hand-edited projection fails rather than passing quietly.
    projection.generated_from[file] = sha256(raw);
    try {
      projection[key] = rowsToObjects(parseTable(raw));
    } catch (error) {
      throw new MalformedRowError(`register/${file}: ${error.message}`);
    }
  }

  // `epic_status_changes` lives in decisions.md under its own heading, because
  // it is normally EMPTY and a whole file asserting emptiness reads as an
  // oversight rather than as a finding (FR-AMD-017).
  const decisionsRaw = readFileSync(join(REGISTER_DIR, 'decisions.md'), 'utf8');
  const statusSection = decisionsRaw.split(/^## Epic status changes\s*$/m)[1];
  if (statusSection) {
    const rows = [];
    for (const line of statusSection.split(/\r?\n/)) {
      const trimmed = line.trim();
      if (!trimmed.startsWith('|')) {
        if (rows.length > 0) break;
        continue;
      }
      if (/^\|[\s:|-]+\|$/.test(trimmed)) continue;
      rows.push(
        trimmed
          .slice(1, -1)
          .split('|')
          .map((c) => c.trim()),
      );
    }
    projection.epic_status_changes = rowsToObjects(rows);
  }

  return projection;
}

/** Written only when invoked directly, so importing this module is side-effect free. */
if (process.argv[1] && resolve(process.argv[1]) === resolve(fileURLToPath(import.meta.url))) {
  const projection = buildRegister();
  writeFileSync(PROJECTION, `${JSON.stringify(projection, null, 2)}\n`, 'utf8');
  const counts = Object.entries(projection)
    .filter(([, v]) => Array.isArray(v))
    .map(([k, v]) => `${k}=${v.length}`)
    .join(' · ');
  console.log(`register.json written — ${counts}`);
}

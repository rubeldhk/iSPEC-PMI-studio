/**
 * T482 / T484 — rendering the register (`RF-1` … `RF-6`).
 *
 * The register is generated **and committed**, so it is read as a **diff** far
 * more often than as a document. Every rule below serves that, and two of them
 * are counter-intuitive until you have seen the diff:
 *
 * - **No timestamps** (`RF-2`). A generation date makes every rebuild a change,
 *   and a reviewer stops reading by the third one.
 * - **No totals or percentages** (`RF-2`). A roll-up means one Epic advancing
 *   rewrites a line about a different Epic — the register would report movement
 *   that did not happen.
 *
 * Not a `.spec.ts`, so vitest never collects it.
 */

/** The em dash is the SOLE empty marker. Never blank, never `N/A`, never `null`. */
const EMPTY = '—';

export interface StageRow {
  readonly epic: string;
  readonly directory: string;
  readonly title: string;
  readonly kind: 'delivery' | 'parent-design';
  readonly stage: string;
  /** `Kind — object`, `stalled`, or null for none. */
  readonly posture: string | null;
  readonly readiness: 'Ready' | 'Ready (waived)' | 'Not ready' | 'n/a';
  /** The next command, or null at a terminal stage. */
  readonly next: string | null;
}

export interface Finding {
  readonly epic: string;
  readonly finding: string;
  /** Matches the severity split in `FR-ESK-016`. */
  readonly severity: 'report' | 'fail';
}

export interface Waiver {
  readonly epic: string;
  readonly condition: string;
  readonly owner: string;
  readonly expires: string;
  readonly reason: string;
}

/**
 * T518 — `RF-6`. The register stops where the journey does.
 *
 * Convergence, defects, closure and promotion are already governed, by
 * Constitution IV, VI and VII, with their own artifacts: `closure.md`,
 * `defects/`, EPIC-014's promotion gate. Restating any of it here would recreate
 * the problem this epic exists to remove, one layer along — a register showing
 * "closed" is a second answer to a question `closure.md` already answers, and
 * the two disagree the first time one is updated without the other.
 *
 * Enforced **at render time**, not only asserted about the output. A check on
 * the output alone passes until somebody tries, then fails after the fact; a
 * guard here refuses the content and names the rule to whoever is adding it.
 *
 * Note what is NOT forbidden: `DOR-11` reads `defects/` to decide readiness.
 * The register may **consume** governed state to compute a verdict; it may not
 * **restate** it as content.
 */
const GOVERNED_STATE = [
  { pattern: /\bconverge/i, owner: 'Constitution IV — closure.md records convergence' },
  { pattern: /\bDEF-\d{3}-\d{3}\b/, owner: 'Constitution VI — defects/ is the record' },
  { pattern: /\bCLOSED\b/, owner: 'Constitution IX — closure.md records closure' },
  { pattern: /release-eligible/i, owner: 'Constitution IX — closure.md records release eligibility' },
  { pattern: /\bpromot(?:ed|ion)\b/i, owner: 'Constitution VII — EPIC-014 F-11.2 gates promotion' },
];

function assertNotGovernedState(value: string | null | undefined, where: string): void {
  if (!value) return;
  for (const { pattern, owner } of GOVERNED_STATE) {
    if (pattern.test(value)) {
      throw new Error(
        `RF-6: the register may not carry governed state — ${where} contains "${value}". ` +
          `That belongs to ${owner}. The register covers the journey up to Ready to Implement ` +
          `and references the governing artifact rather than restating it (FR-ESK-009).`,
      );
    }
  }
}

/** `RF-1` — the file states that it is generated and names its rebuild command. */
const HEADER = [
  '# Epic Stage Register',
  '',
  '**Generated — do not edit.** Rebuild with `pnpm register:update`.',
  '',
  '**Epic**: [`EPIC-026`](../specs/026-epic-stage-kanban/) · **Requirements**: `FR-ESK-007`,',
  '`FR-ESK-021` · **Checks**: `G-26-01` to `G-26-10`',
  '',
  'Stage and readiness are **derived** from each Epic directory. Kind, posture and waivers are',
  '**declared** in [`epic-declarations.json`](./epic-declarations.json). Nothing crosses that line:',
  'a person never writes a stage, and a machine never infers intent.',
  '',
];

function cell(value: string | null | undefined): string {
  const text = (value ?? '').trim();
  return text === '' ? EMPTY : text;
}

/** `RF-3` — one row per Epic, one line per row. A wrapped row is a multi-line diff. */
function renderRow(row: StageRow): string {
  return [
    '',
    `[${row.epic}](../specs/${row.directory}/)`,
    cell(row.title),
    cell(row.kind),
    cell(row.stage),
    cell(row.posture),
    cell(row.readiness),
    row.next ? `\`${row.next}\`` : EMPTY,
    '',
  ].join(' | ').trim();
}

/**
 * `RF-4` — findings are reported, never folded into a stage.
 *
 * Omitted entirely when empty: an empty table is noise in every diff until
 * something breaks, and a reader who has scrolled past `## Findings` fifty times
 * will scroll past the fifty-first.
 */
function renderFindings(findings: Finding[]): string[] {
  if (findings.length === 0) return [];
  return [
    '## Findings',
    '',
    'Reported, never folded into a stage — reaching a stage and passing a gate are different claims.',
    '',
    '| Epic | Finding | Severity |',
    '|---|---|---|',
    ...findings.map((finding) => `| ${finding.epic} | ${finding.finding} | ${finding.severity} |`),
    '',
  ];
}

/**
 * `RF-5` — a waiver is visible here or it does not exist.
 *
 * Burying an exception in a config file nobody reads is exactly how a gate gets
 * quietly skipped, which is the failure the waiver mechanism exists to prevent
 * rather than cause.
 *
 * The `expires` date does not breach `RF-2`: that rule forbids values derived
 * from the **clock**, because they change on every run. An expiry is input, and
 * changes only when a person changes it.
 */
function renderWaivers(waivers: Waiver[]): string[] {
  if (waivers.length === 0) return [];
  return [
    '## Active waivers',
    '',
    '| Epic | Condition | Owner | Expires | Reason |',
    '|---|---|---|---|---|',
    ...waivers.map(
      (waiver) =>
        `| ${waiver.epic} | ${waiver.condition} | ${waiver.owner} | ${waiver.expires} | ${waiver.reason} |`,
    ),
    '',
  ];
}

/** The whole register. Deterministic: identical input yields an identical file. */
export function renderRegister(
  rows: StageRow[],
  findings: Finding[] = [],
  waivers: Waiver[] = [],
): string {
  for (const row of rows) {
    assertNotGovernedState(row.stage, `${row.epic} Stage`);
    assertNotGovernedState(row.posture, `${row.epic} Posture`);
    assertNotGovernedState(row.readiness, `${row.epic} Readiness`);
  }
  for (const finding of findings) {
    assertNotGovernedState(finding.finding, `${finding.epic} finding`);
  }

  // Sorted HERE rather than trusted from the caller. Filesystem order differs
  // between machines, and a register that inherited it would fail the exact-text
  // drift check on somebody else's checkout for a reason nobody could see.
  const ordered = [...rows].sort((a, b) => a.epic.localeCompare(b.epic));

  const lines = [
    ...HEADER,
    '| Epic | Title | Kind | Stage | Posture | Readiness | Next |',
    '|---|---|---|---|---|---|---|',
    ...ordered.map(renderRow),
    '',
    ...renderFindings([...findings].sort((a, b) => a.epic.localeCompare(b.epic))),
    ...renderWaivers([...waivers].sort((a, b) => a.epic.localeCompare(b.epic))),
  ];

  // Exactly one trailing newline. Varying trailing whitespace fails an
  // exact-text comparison (RF-7) for a reason no reader would ever guess.
  return `${lines.join('\n').replace(/\n+$/, '')}\n`;
}

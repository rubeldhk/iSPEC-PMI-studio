/**
 * The known-red gate (2026-10-01).
 *
 * Runs every check `governance/known-red.json` lists and **asserts it is still
 * red**. Exits 0 while the obligations stand, non-zero the moment one is met —
 * or the moment a listed check stops being a check.
 *
 * ## Why this exists
 *
 * `T884` and `T999u` are red because work is genuinely outstanding: a human
 * screen-reader pass and a keyboard-only Tier 2 journey. They lived inside the
 * Architecture and Governance steps, so CI stopped at the first of them and the
 * Contract, Integration and Governance steps never ran. Three suites went
 * unexecuted on every push in order to keep two obligations visible — a trade
 * that costs more than it buys, since a regression in tenancy isolation or
 * audit immutability would have reached the default branch unexamined.
 *
 * The gate separates the two concerns. The gating steps exclude those files, so
 * everything downstream runs. This step runs them on their own and fails if
 * they are not red, so the obligation is still asserted on every push rather
 * than merely documented.
 *
 * ## It is built to retire itself
 *
 * The inverted exit code is the whole design. When the evidence lands, the
 * check passes, and a gate that shrugged would leave it permanently exempt from
 * the suite that gates merges — so a later malformed record would never fail CI
 * again, which is precisely what `T884` exists to catch. Instead this fails and
 * says to delete the entry.
 *
 * `--exclude` is not used here: this step runs the files POSITIVELY, by path,
 * so a renamed or deleted spec collects nothing and is reported rather than
 * passing silently (`T632`'s anti-vacuity argument).
 */
import { existsSync, mkdtempSync, readFileSync, rmSync, appendFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const MANIFEST = join(ROOT, 'governance', 'known-red.json');

/** The fields every entry must carry for the gate to mean anything. */
const REQUIRED = ['id', 'file', 'project', 'gatedScript', 'evidence', 'owes'];

/**
 * Everything wrong with a manifest; empty means usable.
 *
 * Malformed input is rejected loudly rather than skipped — `T600`'s lesson,
 * where a parser that quietly yielded fewer rows left every completeness check
 * green while examining a smaller set.
 */
export function manifestProblems(manifest) {
  if (manifest === null || typeof manifest !== 'object') {
    return ['the manifest is not an object'];
  }
  const checks = manifest.checks;
  if (!Array.isArray(checks)) return ['the manifest declares no `checks` array'];
  if (checks.length === 0) {
    return ['the manifest lists no checks — an empty gate should be deleted, not run'];
  }

  const problems = [];
  const seen = new Set();
  for (const [index, check] of checks.entries()) {
    const label = typeof check?.id === 'string' ? check.id : `entry ${index}`;
    if (check === null || typeof check !== 'object') {
      problems.push(`${label}: not an object`);
      continue;
    }
    for (const field of REQUIRED) {
      const value = check[field];
      if (typeof value !== 'string' || value.trim() === '') {
        problems.push(`${label}: missing or empty \`${field}\``);
      }
    }
    if (typeof check.id === 'string') {
      if (seen.has(check.id)) problems.push(`${check.id}: duplicate id`);
      seen.add(check.id);
    }
  }
  return problems;
}

/**
 * Whether the gate still holds for one check, given what running it produced.
 *
 * Three ways a run can look like "still red" while proving nothing, each of
 * which breaks the gate instead: the file is gone, it collected no tests, or it
 * passed.
 */
export function gateVerdict(check, result) {
  if (result.fileMissing) {
    return {
      ok: false,
      reason:
        `${check.id}: ${check.file} does not exist. The entry gates nothing — ` +
        'delete it from governance/known-red.json, or restore the spec.',
    };
  }
  if (result.numTotalTests === 0) {
    return {
      ok: false,
      reason:
        `${check.id}: ${check.file} collected no tests. A check that cannot run is not a check ` +
        'that is red — fix the path or the suite before trusting this gate.',
    };
  }
  if (result.numFailedTests === 0) {
    return {
      ok: false,
      reason:
        `${check.id}: now passes. The evidence has landed (${check.evidence}), so retire the ` +
        'entry: remove it from governance/known-red.json, drop it from the gated script in ' +
        'package.json, and remove its row from the README known-red table. Leaving it listed ' +
        'would exempt the check from every future run.',
    };
  }
  return {
    ok: true,
    reason: `${check.id}: still red, as expected (${result.numFailedTests} failing). Owes ${check.owes}.`,
  };
}

/** Run one check by path and read its counts out of vitest's JSON report. */
function runCheck(check, outDir) {
  if (!existsSync(join(ROOT, check.file))) {
    return { fileMissing: true, numTotalTests: 0, numFailedTests: 0 };
  }
  const report = join(outDir, `${check.id}.json`);
  const command = [
    'pnpm exec vitest run',
    `--project ${check.project}`,
    JSON.stringify(check.file),
    '--reporter=json',
    `--outputFile=${JSON.stringify(report)}`,
  ].join(' ');

  // The non-zero exit is the EXPECTED outcome here, so it is not consulted —
  // the counts in the report are what the verdict reads.
  spawnSync(command, { cwd: ROOT, shell: true, stdio: 'ignore' });

  if (!existsSync(report)) {
    return { fileMissing: false, numTotalTests: 0, numFailedTests: 0 };
  }
  const parsed = JSON.parse(readFileSync(report, 'utf8'));
  return {
    fileMissing: false,
    numTotalTests: Number(parsed.numTotalTests ?? 0),
    numFailedTests: Number(parsed.numFailedTests ?? 0),
  };
}

function report(lines) {
  for (const line of lines) console.log(line);
  const summary = process.env['GITHUB_STEP_SUMMARY'];
  if (summary) {
    try {
      appendFileSync(summary, `${lines.join('\n')}\n`);
    } catch {
      // A summary that cannot be written must not fail the gate.
    }
  }
}

function main() {
  const manifest = JSON.parse(readFileSync(MANIFEST, 'utf8'));
  const problems = manifestProblems(manifest);
  if (problems.length > 0) {
    report(['## Known-red gate: the manifest is unusable', '', ...problems.map((p) => `- ${p}`)]);
    process.exitCode = 1;
    return;
  }

  const outDir = mkdtempSync(join(tmpdir(), 'known-red-'));
  const lines = [
    '## Known-red checks',
    '',
    'These fail on purpose. The gate asserts they are STILL red, so the obligation is checked',
    'on every push rather than merely written down. It fails the build the day one passes.',
    '',
  ];
  let held = true;
  try {
    for (const check of manifest.checks) {
      const verdict = gateVerdict(check, runCheck(check, outDir));
      lines.push(`- ${verdict.ok ? 'red, as expected' : 'GATE BROKEN'} — ${verdict.reason}`);
      if (!verdict.ok) held = false;
    }
  } finally {
    rmSync(outDir, { recursive: true, force: true });
  }

  if (!held) {
    lines.push('', 'The gate is broken: read the lines above and act on them. See README §Known-red checks.');
  }
  report(lines);
  process.exitCode = held ? 0 : 1;
}

// Importable for its own tests without running the gate — `T600`'s split.
if (process.argv[1] && resolve(process.argv[1]) === resolve(fileURLToPath(import.meta.url))) {
  main();
}

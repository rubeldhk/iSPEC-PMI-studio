/**
 * T313 · Check G-04 — no steering file restates the constitution or a template.
 * T320 · Check G-04b — the constitution wins; no steering file claims precedence over it.
 *
 * Satisfies SC-RGP-003, the highest-value check in this epic, because the failure it
 * prevents is silent: a duplicated paragraph reads correctly today and forks at the next
 * amendment, leaving two sources of truth and no signal that they disagree.
 *
 * This is the one governance check that FAILS CI (2026-08-05 severity split). The rest
 * report.
 *
 * Method (R-018-2): compare 12-word shingles of prose. Blockquotes and fenced code are
 * excluded, so an attributed quotation is permitted and an unattributed restatement is not.
 */
import { describe, it, expect } from 'vitest';
import { readConfig, steeringFiles, read, proseOf, shingles } from './helpers';

const config = readConfig();
const files = steeringFiles();
const size = config.overlapShingleWords;

const corpus = new Map<string, Set<string>>();
for (const source of config.overlapCorpus) {
  corpus.set(source, shingles(proseOf(read(source)), size));
}

describe('G-04 · no verbatim duplication of governed text (FR-RGP-004, SF-6)', () => {
  it.each(files.map((file) => [file.subject, file] as const))(
    '%s restates no constitution or template text',
    (_subject, file) => {
      const own = shingles(proseOf(file.raw), size);
      const offences: string[] = [];
      for (const [source, sourceShingles] of corpus) {
        for (const shingle of own) {
          if (sourceShingles.has(shingle)) {
            offences.push(`duplicates ${source}: "${shingle}"`);
          }
        }
      }
      expect(
        offences.slice(0, 5),
        `${file.relativePath} restates governed text instead of linking to it (FR-RGP-004). ` +
          `Replace the passage with a link, or quote it in a blockquote so the source stays visible.`,
      ).toEqual([]);
    },
  );

  it('links to the constitution wherever a steering file names a principle', () => {
    const offences: string[] = [];
    for (const file of files) {
      const namesPrinciple = /\bConstitution (I|II|III|IV|V|VI|VII|VIII|IX)\b/.test(file.body);
      const links = file.body.includes('.specify/memory/constitution.md');
      if (namesPrinciple && !links) offences.push(file.relativePath);
    }
    expect(offences, 'a steering file naming a constitution principle must link to it').toEqual([]);
  });
});

describe('G-04b · constitution precedence (FR-RGP-005, SF-7)', () => {
  const overrideClaims = [
    /overrides? the constitution/i,
    /notwithstanding the constitution/i,
    /takes precedence over the constitution/i,
    /supersedes? the constitution/i,
    /except where the constitution/i,
    /in place of the constitution/i,
  ];

  it.each(files.map((file) => [file.subject, file] as const))(
    '%s claims no precedence over the constitution',
    (_subject, file) => {
      const claims = overrideClaims.filter((pattern) => pattern.test(file.body)).map(String);
      expect(claims, `${file.relativePath} claims authority over the constitution; there is no override direction`).toEqual(
        [],
      );
    },
  );

  it('states the precedence rule in the steering index', () => {
    const readme = read('governance/steering/README.md');
    expect(readme, 'the steering index must state that the constitution wins').toMatch(
      /constitution wins|constitution prevails/i,
    );
    expect(readme).toMatch(/\.specify\/memory\/constitution\.md/);
  });
});

/**
 * `T2114` (EPIC-039, `R-039-3`) — the five v1 contract documents, read from the
 * reviewed JSON files in `capabilities/`.
 *
 * The files are the source; the migration seeds them into
 * `capability_contract_versions` and the conformance check asserts the rows
 * equal the files. Everything that needs a contract at runtime — the Hub's
 * input and output validation, the adapter conformance suite — reads it here,
 * so there is one copy.
 */
import { readFileSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import type { CapabilityContractDocument } from './contract.js';
import type { CapabilityName } from './vocabulary.js';

const DIR = fileURLToPath(new URL('../capabilities/', import.meta.url));

/** `<Name>.v<major>.<minor>.json` */
export const CONTRACT_FILE_PATTERN = /^([A-Za-z]+)\.v(\d+)\.(\d+)\.json$/;

export function contractFileName(doc: { name: string; major: number; minor: number }): string {
  return `${doc.name}.v${doc.major}.${doc.minor}.json`;
}

export function contractFilesDirectory(): string {
  return DIR;
}

function load(): readonly CapabilityContractDocument[] {
  return Object.freeze(
    readdirSync(DIR)
      .filter((f) => CONTRACT_FILE_PATTERN.test(f))
      .sort()
      .map((f) => Object.freeze(JSON.parse(readFileSync(`${DIR}${f}`, 'utf8')) as CapabilityContractDocument)),
  );
}

/** Every contract version the package ships. */
export const CAPABILITY_CONTRACTS: readonly CapabilityContractDocument[] = load();

/** The latest minor of a major, or `null` when the package ships none. */
export function contractFor(name: CapabilityName, major: number): CapabilityContractDocument | null {
  const matching = CAPABILITY_CONTRACTS.filter((c) => c.name === name && c.major === major).sort((a, b) => b.minor - a.minor);
  return matching[0] ?? null;
}

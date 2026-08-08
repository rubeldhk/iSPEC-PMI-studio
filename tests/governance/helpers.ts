/**
 * Shared helpers for the EPIC-018 governance conformance checks.
 *
 * Not a `.spec.ts` file by design — the governance Vitest project matches
 * `tests/governance/**\/*.spec.ts`, so this module is imported, never collected.
 */
import { readFileSync, existsSync, readdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

export const REPO_ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
export const GOVERNANCE_DIR = join(REPO_ROOT, 'governance');
export const STEERING_DIR = join(GOVERNANCE_DIR, 'steering');

export interface GovernanceConfig {
  steeringReviewIntervalDays: number;
  steeringSubjects: string[];
  owners: string[];
  statuses: string[];
  pmiDoc000Sections: string[];
  templates: string[];
  overlapCorpus: string[];
  overlapShingleWords: number;
  vagueTerms: string[];
}

export function readConfig(): GovernanceConfig {
  return JSON.parse(readFileSync(join(GOVERNANCE_DIR, 'governance.config.json'), 'utf8'));
}

/** Read a repo-relative path. Throws with the path in the message when absent. */
export function read(relativePath: string): string {
  const absolute = join(REPO_ROOT, relativePath);
  if (!existsSync(absolute)) {
    throw new Error(`expected file to exist: ${relativePath}`);
  }
  return readFileSync(absolute, 'utf8');
}

export function repoExists(relativePath: string): boolean {
  return existsSync(join(REPO_ROOT, relativePath));
}

export interface SteeringFile {
  subject: string;
  relativePath: string;
  raw: string;
  front: Record<string, string>;
  body: string;
}

export function parseFrontMatter(raw: string): { front: Record<string, string>; body: string } {
  const match = /^---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/.exec(raw);
  if (!match) return { front: {}, body: raw };
  const [, frontMatter = '', body = ''] = match;
  const front: Record<string, string> = {};
  for (const line of frontMatter.split(/\r?\n/)) {
    const kv = /^([A-Za-z_][A-Za-z0-9_]*):\s*(.*)$/.exec(line);
    const key = kv?.[1];
    const value = kv?.[2];
    if (key && value !== undefined) front[key] = value.replace(/\s+#.*$/, '').trim();
  }
  return { front, body };
}

export function steeringFiles(): SteeringFile[] {
  if (!existsSync(STEERING_DIR)) return [];
  return readdirSync(STEERING_DIR)
    .filter((name) => name.endsWith('.md') && name !== 'README.md')
    .sort()
    .map((name) => {
      const raw = readFileSync(join(STEERING_DIR, name), 'utf8');
      const { front, body } = parseFrontMatter(raw);
      return { subject: name.replace(/\.md$/, ''), relativePath: `governance/steering/${name}`, raw, front, body };
    });
}

export interface Standard {
  id: string;
  title: string;
  text: string;
}

/** Standards are `### <ID> · <Title>` headings, per contracts/steering-file-format.md SF-2. */
export function standardsOf(body: string): Standard[] {
  const lines = body.split(/\r?\n/);
  const standards: Standard[] = [];
  let current: Standard | null = null;
  for (const line of lines) {
    const heading = /^### ([A-Z]{2,4}-\d{3}) · (.+)$/.exec(line.trim());
    const id = heading?.[1];
    const title = heading?.[2];
    if (id && title) {
      const standard: Standard = { id, title: title.trim(), text: '' };
      standards.push(standard);
      current = standard;
      continue;
    }
    if (/^#{1,3} /.test(line.trim())) current = null;
    else if (current) current.text += `${line}\n`;
  }
  return standards;
}

/**
 * Prose only: front matter, fenced code, blockquotes and inline code removed.
 *
 * Blockquotes are excluded deliberately — SF-6 permits a *quoted* reference to the
 * constitution or a template, and forbids only unattributed restatement.
 */
export function proseOf(markdown: string): string {
  const { body } = parseFrontMatter(markdown);
  return body
    .replace(/```[\s\S]*?```/g, ' ')
    .replace(/^\s*>.*$/gm, ' ')
    .replace(/`[^`]*`/g, ' ')
    .replace(/\[([^\]]*)\]\([^)]*\)/g, '$1');
}

export function words(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter(Boolean);
}

export function shingles(text: string, size: number): Set<string> {
  const tokens = words(text);
  const set = new Set<string>();
  for (let i = 0; i + size <= tokens.length; i++) {
    set.add(tokens.slice(i, i + size).join(' '));
  }
  return set;
}

/** Every `specs/<nnn>-<slug>/` epic directory currently on disk. */
export function epicDirectories(): string[] {
  return readdirSync(join(REPO_ROOT, 'specs'), { withFileTypes: true })
    .filter((entry) => entry.isDirectory() && /^\d{3}-/.test(entry.name))
    .map((entry) => entry.name)
    .sort();
}

/**
 * `T1494` (EPIC-042, `FR-EXT-003`, `FR-EXT-005`, `FR-EXT-011`, `FR-EXT-017`,
 * `contracts/extension-and-hooks.md` §1–§3) — the extension's content is
 * checked, not trusted: the manifest validates; every hook names a command the
 * extension provides and is mandatory; every tool and argument the command
 * files name exists in the `pmi-studio` surface (read from the server's own
 * tool definitions, text-level, no import); no command names an agent
 * product or provider, asks for a credential value, or prints a line outside
 * the §3 vocabulary; the registry fragment is well-formed.
 *
 * The extension necessarily names the toolkit it extends; what it may never
 * name is an agent product or a provider (`PP-006`).
 * Written to FAIL before `T1495`.
 */
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parse } from 'yaml';
import { describe, expect, it } from 'vitest';
import { BUNDLE_VERSION, extensionDir } from '../src/index.js';

const here = dirname(fileURLToPath(import.meta.url));
const REPO = resolve(here, '../../..');
const MANIFEST = join(extensionDir(), 'extension.yml');
const FRAGMENT = join(extensionDir(), 'extensions-fragment.yml');
const COMMANDS = ['begin', 'finish', 'progress'] as const;
const GOVERNED = ['specify', 'clarify', 'checklist', 'plan', 'tasks', 'analyze', 'implement', 'converge', 'constitution'] as const;
const PROVIDERS = /\b(claude|cursor|codex|copilot|gemini|anthropic|openai)\b/i;

interface Manifest {
  schema_version: string;
  extension: { id: string; version: string; description: string };
  requires: { speckit_version: string };
  provides: { commands: { name: string; file: string; description: string }[] };
  hooks: Record<string, { command: string; optional: boolean; description?: string; condition?: unknown }>;
}

function manifest(): Manifest {
  return parse(readFileSync(MANIFEST, 'utf8')) as Manifest;
}

/** The surface, from the server's own tool definitions: tool → argument names. */
function surface(): Map<string, Set<string>> {
  const dir = join(REPO, 'packages', 'mcp-server', 'src', 'tools');
  const out = new Map<string, Set<string>>();
  for (const file of readdirSync(dir).filter((f) => f.endsWith('.ts'))) {
    const text = readFileSync(join(dir, file), 'utf8');
    const blocks = text.split(/(?=\n\s+name: 'pmi\.)/);
    for (const block of blocks) {
      const name = /name: '(pmi\.[A-Za-z.]+)'/.exec(block)?.[1];
      if (!name) continue;
      const args = new Set<string>(['contractVersion']);
      // Keys of the input shape, inline or one per line: `name: z.…`.
      for (const m of block.matchAll(/(\w+): z\./g)) args.add(m[1] as string);
      if (/\.\.\.correlated/.test(block)) args.add('correlationId');
      out.set(name, args);
    }
  }
  return out;
}

const LINE_FORMS = [
  /^PMI · registered <executionId> \(<command>, <epic\|no epic>\)$/,
  /^PMI · completed <executionId> \(<outcome>\)$/,
  /^PMI · refused <code>: <message>$/,
  /^PMI · queued <executionId> \(not governed\)$/,
  /^PMI · constitution <current\|stale→refreshed\|restored\|drift — waiting for confirmation>$/,
  /^PMI · left open <executionId> from <time> — complete as failed\? \(yes\/no\)$/,
  /^PMI · sync not available until <epic>$/,
  /^PMI · nothing to decompose — add requirements in PMI Studio → Requirement Room$/,
];
const CONCRETE_FORMS = [
  /^PMI · registered /,
  /^PMI · completed /,
  /^PMI · refused /,
  /^PMI · queued /,
  /^PMI · constitution /,
  /^PMI · left open /,
  /^PMI · sync /,
  /^PMI · nothing to decompose/,
  /^PMI · first run: /,
  /^PMI · plan: /,
  /^PMI · split proposed: /,
];

describe('T1494 · the manifest (contracts/extension-and-hooks.md §1)', () => {
  it('is the pmi extension at the bundle version, requiring the toolkit range, providing three commands', () => {
    const m = manifest();
    expect(m.schema_version).toBe('1.0');
    expect(m.extension.id).toBe('pmi');
    expect(m.extension.version).toBe(BUNDLE_VERSION);
    expect(m.requires.speckit_version).toMatch(/^>=\d+\.\d+\.\d+$/);
    expect(m.provides.commands.map((c) => c.name).sort()).toEqual(['speckit.pmi.begin', 'speckit.pmi.finish', 'speckit.pmi.progress']);
    for (const c of m.provides.commands) {
      expect(c.name).toMatch(/^speckit\.pmi\.[a-z]+$/);
      expect(existsSync(join(extensionDir(), c.file)), `${c.file} missing`).toBe(true);
      expect(c.description.length).toBeGreaterThan(0);
    }
  });

  it('registers before and after hooks for exactly the nine governed commands, each mandatory, each naming a provided command, none conditioned', () => {
    const m = manifest();
    const provided = new Set(m.provides.commands.map((c) => c.name));
    const events = Object.keys(m.hooks).sort();
    expect(events).toEqual(GOVERNED.flatMap((c) => [`after_${c}`, `before_${c}`]).sort());
    for (const [event, hook] of Object.entries(m.hooks)) {
      expect(hook.optional, `${event} must be mandatory`).toBe(false);
      expect(provided.has(hook.command), `${event} names ${hook.command}, which is not provided`).toBe(true);
      expect(hook.condition).toBeUndefined();
      expect(hook.command).toBe(event.startsWith('before_') ? 'speckit.pmi.begin' : 'speckit.pmi.finish');
    }
  });
});

describe('T1494 · the registry fragment (§2)', () => {
  it('lists pmi as installed and one mandatory entry per event with extension pmi and no condition', () => {
    const f = parse(readFileSync(FRAGMENT, 'utf8')) as { installed: string[]; hooks: Record<string, { extension: string; command: string; enabled: boolean; optional: boolean; condition?: unknown }[]> };
    expect(f.installed).toEqual(['pmi']);
    expect(Object.keys(f.hooks).sort()).toEqual(Object.keys(manifest().hooks).sort());
    for (const [event, entries] of Object.entries(f.hooks)) {
      expect(entries).toHaveLength(1);
      const e = entries[0] as (typeof entries)[number];
      expect(e).toMatchObject({ extension: 'pmi', enabled: true, optional: false, command: manifest().hooks[event]?.command });
      expect(e.condition).toBeUndefined();
    }
  });
});

describe('T1494 · the command files (§3)', () => {
  const tools = surface();

  it.each(COMMANDS)('%s.md names only tools and arguments the surface has, in "Call `pmi.x` with `a`, `b`" lines', (command) => {
    const text = readFileSync(join(extensionDir(), 'commands', `${command}.md`), 'utf8');
    const calls = [...text.matchAll(/[Cc]all `(pmi\.[A-Za-z.]+)`(?: with ([^\n]*?))?(?:[.,;]|$|\s+where|\s+—)/gm)];
    expect(calls.length, `${command}.md names no tool call`).toBeGreaterThan(0);
    for (const [, tool, rest] of calls) {
      expect(tools.has(tool as string), `${command}.md calls ${tool}, which the surface does not have`).toBe(true);
      const args = [...(rest ?? '').matchAll(/`([a-zA-Z]+)`/g)].map((m) => m[1] as string);
      for (const arg of args) {
        expect(tools.get(tool as string)?.has(arg), `${command}.md passes ${arg} to ${tool}, which its schema does not accept`).toBe(true);
      }
    }
    // Every pmi.* mention anywhere is a real tool.
    for (const m of text.matchAll(/`(pmi\.[a-zA-Z.]+)`/g)) {
      expect(tools.has(m[1] as string), `${command}.md mentions ${m[1]}`).toBe(true);
    }
  });

  it.each(COMMANDS)('%s.md names no agent product or provider and never asks for a credential value', (command) => {
    const text = readFileSync(join(extensionDir(), 'commands', `${command}.md`), 'utf8');
    for (const line of text.split('\n')) {
      expect(line, `provider named: ${line}`).not.toMatch(PROVIDERS);
    }
    expect(text).not.toMatch(/paste (the|your) (token|credential)|enter (the|your) (token|credential)|PMI_STUDIO_TOKEN=/i);
    expect(text).not.toMatch(/pmi_ct_[A-Za-z0-9]{8,}|sk-[A-Za-z0-9]{8,}/);
    expect(text.replace(/\s+/g, ' ')).toMatch(/never (read, ask for, print or pass|handle|handles|reads) a credential/i);
  });

  it('ships no script: every command file is markdown; no shell block, no script file', () => {
    const dir = join(extensionDir(), 'commands');
    expect(readdirSync(dir).every((f) => f.endsWith('.md'))).toBe(true);
    for (const command of COMMANDS) {
      const text = readFileSync(join(dir, `${command}.md`), 'utf8');
      expect(text).not.toMatch(/```(sh|bash|powershell|ps1|python)/);
    }
    expect(existsSync(join(extensionDir(), 'scripts'))).toBe(false);
  });

  it('begin.md prints only lines in the §3 vocabulary, and lists the vocabulary itself', () => {
    const text = readFileSync(join(extensionDir(), 'commands', 'begin.md'), 'utf8');
    const listed = [...text.matchAll(/^- `(PMI · [^`]+)`$/gm)].map((m) => m[1] as string);
    expect(listed).toHaveLength(LINE_FORMS.length);
    listed.forEach((form, i) => expect(form).toMatch(LINE_FORMS[i] as RegExp));
    const printed = [...text.matchAll(/`(PMI · [^`]+)`/g)].map((m) => m[1] as string);
    for (const line of printed) {
      expect(CONCRETE_FORMS.some((re) => re.test(line)), `line outside the vocabulary: ${line}`).toBe(true);
    }
  });

  it('finish.md and progress.md print only lines in the vocabulary', () => {
    for (const command of ['finish', 'progress'] as const) {
      const text = readFileSync(join(extensionDir(), 'commands', `${command}.md`), 'utf8');
      for (const m of text.matchAll(/`(PMI · [^`]+)`/g)) {
        expect(CONCRETE_FORMS.some((re) => re.test(m[1] as string)), `${command}.md: ${m[1]}`).toBe(true);
      }
    }
  });
});

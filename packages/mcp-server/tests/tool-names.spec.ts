/**
 * EPIC-039 `T2166` (`R-039-5`) — the `pmi-studio` server exports its tool-name
 * table and version as plain data, so the Integration Hub's registry can READ
 * the connector's facts rather than copy them, without loading the MCP SDK.
 *
 * The table must equal what the server actually registers: a list that drifted
 * from the server would make the registry describe a connector that does not
 * exist.
 */
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { MCP_SERVER_VERSION, TOOL_NAMES } from '../src/tool-names.js';
import { ARTIFACT_TOOLS } from '../src/tools/artifacts.js';
import { EXECUTION_TOOLS } from '../src/tools/execution.js';
import { GOVERNANCE_READ_TOOLS, READ_TOOLS } from '../src/tools/reads.js';
import { RESERVED_TOOLS } from '../src/tools/reserved.js';
import { TASK_TOOLS } from '../src/tools/tasks.js';

describe('T2166 · the tool-name table is the server\'s own', () => {
  it('equals every tool the server registers, live and reserved', () => {
    const registered = [...EXECUTION_TOOLS, ...READ_TOOLS, ...GOVERNANCE_READ_TOOLS, ...ARTIFACT_TOOLS, ...TASK_TOOLS, ...RESERVED_TOOLS].map((t) => t.name).sort();
    expect([...TOOL_NAMES].sort()).toEqual(registered);
  });

  it('the version is the manifest\'s', () => {
    const manifest = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8')) as { version: string };
    expect(MCP_SERVER_VERSION).toBe(manifest.version);
  });

  it('carries no pmi.capability or pmi.integrations tool (FR-HUB-004)', () => {
    expect(TOOL_NAMES.filter((n) => /^pmi\.(capability|integrations)/.test(n))).toEqual([]);
  });
});

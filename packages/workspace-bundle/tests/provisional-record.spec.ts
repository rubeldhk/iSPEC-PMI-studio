/**
 * `T1529` (EPIC-042, US5, `FR-EXT-050`–`FR-EXT-054`, `R-042-6`,
 * `contracts/extension-and-hooks.md` §8) — a provisional record written the way
 * `speckit.pmi.begin` writes it validates; `readOfflineMode` answers
 * `provisional` only on the exact line and `strict` otherwise (`BR-0202`).
 * Written to FAIL before `T1530`.
 */
import { describe, expect, it } from 'vitest';
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { governedExecutionSection, readLastExecution, readOfflineMode, runBegin, validateProvisionalRecord, type ToolClient, type ToolResult } from '../src/index.js';

const record = (over: Record<string, unknown> = {}) => ({
  registration: { executionId: 'prov_1234', command: 'plan', argsSanitized: { command: 'plan' }, correlationId: 'c1', idempotencyKey: 'prov_1234', input: { targetType: 'epic', targetId: '7' }, surface: 'mcp-client' },
  events: [{ type: 'execution-sync-queued', occurredAt: '2026-09-04T12:00:00Z', payload: { reason: 'platform_unreachable' } }],
  governed: false,
  ...over,
});

describe('T1529 · validateProvisionalRecord', () => {
  it('accepts a record with a client-generated id, the queued event first, and governed false', () => {
    expect(validateProvisionalRecord(record())).toEqual({ ok: true });
    const completed = record({ events: [...record().events, { type: 'lifecycle.completed', occurredAt: '2026-09-04T12:05:00Z', payload: { outcome: 'completed' } }] });
    expect(validateProvisionalRecord(completed)).toEqual({ ok: true });
  });

  it.each([
    ['an id that is not prov_', { registration: { ...record().registration, executionId: 'exec_1', idempotencyKey: 'exec_1' } }, 'prov_'],
    ['an idempotency key that is not the id', { registration: { ...record().registration, idempotencyKey: 'other' } }, 'equals the execution id'],
    ['a surface other than mcp-client', { registration: { ...record().registration, surface: 'local-cli' } }, 'mcp-client'],
    ['a first event that is not the queued event', { events: [{ type: 'started', occurredAt: '2026-09-04T12:00:00Z' }] }, 'execution-sync-queued'],
    ['governed true', { governed: true }, 'governed: false'],
    ['no events', { events: [] }, 'non-empty'],
  ])('refuses %s', (_label, over, message) => {
    const result = validateProvisionalRecord(record(over));
    expect(result.ok).toBe(false);
    expect((result as { ok: false; errors: readonly string[] }).errors.join('\n')).toContain(message);
  });
});

describe('T1529 · readOfflineMode', () => {
  it('reads provisional only from the exact line the render carries', () => {
    expect(readOfflineMode(`# X\n\n## Governed Execution\n\n${governedExecutionSection('provisional')}`)).toBe('provisional');
    expect(readOfflineMode(`## Governed Execution\n\n${governedExecutionSection('strict')}`)).toBe('strict');
  });

  it('is strict when the line is absent, malformed, or the file is missing (BR-0202)', () => {
    expect(readOfflineMode(null)).toBe('strict');
    expect(readOfflineMode('')).toBe('strict');
    expect(readOfflineMode('# Constitution\n')).toBe('strict');
    expect(readOfflineMode('Offline mode: sometimes\n')).toBe('strict');
    expect(readOfflineMode('offline mode: provisional\n')).toBe('strict');
    expect(readOfflineMode('Offline mode: provisional is what I want\n')).toBe('strict');
  });
});

describe('T1543 · a provisional record that cannot be made durable is not a record (Phase 9, FR-EXT-050)', () => {
  it('runBegin refuses as strict mode does, naming the path, and writes nothing', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'pmi-prov-durable-'));
    try {
      mkdirSync(join(dir, '.pmi'), { recursive: true });
      mkdirSync(join(dir, '.specify', 'memory'), { recursive: true });
      writeFileSync(join(dir, '.pmi', 'project.json'), JSON.stringify({ projectId: 'p_a', platformUrl: 'http://localhost:3000', bundleVersion: '0.2.0' }));
      writeFileSync(join(dir, '.specify', 'memory', 'constitution.md'), `# X\n\n## Governed Execution\n\n${governedExecutionSection('provisional')}`, 'utf8');
      // A FILE where the provisional directory must be: the record cannot be written.
      writeFileSync(join(dir, '.pmi', 'provisional'), 'not a directory\n', 'utf8');
      const client: ToolClient = {
        async callTool(): Promise<ToolResult> {
          return { isError: true, structuredContent: { code: 'platform_unreachable', message: 'unreachable' } };
        },
      };
      const begun = await runBegin(client, dir, { command: 'clarify' });
      expect(begun.refused?.code).toBe('platform_unreachable');
      expect(begun.provisional).toBe(false);
      expect(begun.executionId).toBeNull();
      expect(begun.lines).toHaveLength(1);
      expect(begun.lines[0]).toMatch(/^PMI · refused platform_unreachable: PMI Studio at http:\/\/localhost:3000 is unreachable and the provisional record could not be written at .*provisional/);
      expect(readLastExecution(dir)).toBeNull();
      expect(readFileSync(join(dir, '.pmi', 'provisional'), 'utf8')).toBe('not a directory\n');
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});

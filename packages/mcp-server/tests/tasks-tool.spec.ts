/**
 * `T1708` (EPIC-046, `R-046-8`, `contracts/tasks-api.md` §1) —
 * `pmi.tasks.sync`, live.
 *
 * `EPIC-043` reserved this name and refused it by Epic; `EPIC-042`'s finish
 * hook has been calling it after every `tasks` and `implement` ever since. What
 * changed on the client side is one `ToolSpec`, and this file asserts the three
 * things that spec has to get right:
 *
 *  - it accepts **exactly what the shipped hook sends** and adds no argument of
 *    its own, because `FR-KAN-061` forbids editing the hook;
 *  - it addresses the project as `me`, so a client cannot name another one;
 *  - `epicNumber` is accepted and **dropped**, because the Epic comes from the
 *    execution's binding and forwarding it would create a second, contradictable
 *    source for the same fact.
 *
 * Written to FAIL before `T1709`.
 */
import { afterEach, describe, expect, it } from 'vitest';
import { TASK_TOOLS } from '../src/tools/tasks.js';
import { RESERVED_TOOLS as RESERVED_SPECS } from '../src/tools/reserved.js';
import { connect, stubPlatform } from './server.spec.js';

const open: { client: { close(): Promise<void> }; server: { close(): Promise<void> } }[] = [];

afterEach(async () => {
  for (const o of open.splice(0)) {
    await o.client.close();
    await o.server.close();
  }
});

const MARKDOWN = '- [ ] T1701 Do the thing in `a/b.ts`\n';

describe('T1708 · the tool spec', () => {
  it('is the only tool this Epic adds', () => {
    expect(TASK_TOOLS.map((t) => t.name)).toEqual(['pmi.tasks.sync']);
  });

  it('is mutating, and routes to the project the credential opens', () => {
    const [spec] = TASK_TOOLS;
    expect(spec?.mutating).toBe(true);
    expect(spec?.route({} as never)).toEqual({ method: 'POST', path: '/v1/projects/me/tasks/sync' });
  });

  it('drops `epicNumber` rather than forwarding it (FR-KAN-030)', () => {
    expect(TASK_TOOLS[0]?.strip).toEqual(['epicNumber']);
  });

  it('accepts no idempotency key — the hook sends none and the platform derives it (R-046-8)', () => {
    expect(Object.keys(TASK_TOOLS[0]?.input ?? {}).sort()).toEqual(['contractVersion', 'epicNumber', 'executionId', 'tasksMarkdown']);
  });
});

describe('T1708 · the call reaches the platform unchanged', () => {
  it('forwards the execution and the markdown, and nothing else', async () => {
    const { port, calls } = stubPlatform(() => ({
      ok: true,
      status: 201,
      body: {
        syncId: 's1', epicId: 'e1', tasksDigest: 'a'.repeat(64),
        counts: { linesConsidered: 1, parsed: 1, refused: 0, duplicates: 0 },
        diff: { added: [{ taskKey: 'T1701' }], descriptionChanged: [], checkboxChanged: [], unchanged: 0, noLongerPresent: [] },
        refusedLines: [], markers: { aheadOfFile: [], supersededByFile: [] }, outOfBandEdit: false,
      },
    }));
    const o = await connect(port);
    open.push(o);

    const result = await o.client.callTool({
      name: 'pmi.tasks.sync',
      arguments: { executionId: 'x_1', tasksMarkdown: MARKDOWN, epicNumber: 3 },
    });

    expect(result.isError).toBeFalsy();
    expect(calls).toHaveLength(1);
    expect(calls[0]?.path).toBe('/v1/projects/me/tasks/sync');
    // `epicNumber` was accepted by the schema and never sent on.
    expect(calls[0]?.body).toEqual({ executionId: 'x_1', tasksMarkdown: MARKDOWN });
    expect(result.structuredContent).toMatchObject({ syncId: 's1', epicId: 'e1' });
  });

  it('refuses a call with no markdown before the platform is touched', async () => {
    const { port, calls } = stubPlatform();
    const o = await connect(port);
    open.push(o);
    const result = await o.client.callTool({ name: 'pmi.tasks.sync', arguments: { executionId: 'x_1' } });
    expect(result.isError).toBe(true);
    expect(calls, 'a schema failure must not reach the platform').toEqual([]);
  });

  it('accepts an EMPTY tasks.md — a placeholder file is legitimate content', async () => {
    // US1 scenario 5's second empty state. Refusing it here would make the
    // board unable to tell "nothing synced" from "a file with no task lines".
    const { port, calls } = stubPlatform(() => ({
      ok: true,
      status: 201,
      body: {
        syncId: 's2', epicId: 'e1', tasksDigest: 'b'.repeat(64),
        counts: { linesConsidered: 0, parsed: 0, refused: 0, duplicates: 0 },
        diff: { added: [], descriptionChanged: [], checkboxChanged: [], unchanged: 0, noLongerPresent: [] },
        refusedLines: [], markers: { aheadOfFile: [], supersededByFile: [] }, outOfBandEdit: false,
      },
    }));
    const o = await connect(port);
    open.push(o);
    const result = await o.client.callTool({ name: 'pmi.tasks.sync', arguments: { executionId: 'x_1', tasksMarkdown: '' } });
    expect(result.isError).toBeFalsy();
    expect(calls[0]?.body).toEqual({ executionId: 'x_1', tasksMarkdown: '' });
  });
});

describe('T1708 · it has left the reserved list', () => {
  it('leaves exactly ONE reserved tool — EPIC-037 provisional intake', () => {
    expect(RESERVED_SPECS.map((t) => t.name)).toEqual(['pmi.execution.sync']);
  });

  it('so no reserved tool rides an unregistered connector scope any more', () => {
    // Recorded because it removes a habit: `connector-auth.guard.spec.ts` had
    // borrowed each Epic's not-yet-registered scope in turn as its example of
    // an unregistered one. There is nothing left to borrow (`T1693`).
    expect(RESERVED_SPECS.every((t) => t.epic === 'EPIC-037')).toBe(true);
  });
});

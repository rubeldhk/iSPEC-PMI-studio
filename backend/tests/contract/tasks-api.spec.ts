/**
 * `T1705` (EPIC-046, `contracts/tasks-api.md`) — the contract document and the
 * code agree.
 *
 * This is deliberately *not* a second copy of `task-sync.spec.ts`. That suite
 * drives the real route against a real stack and proves the behaviour; this one
 * reads the **contract document** and the source and fails when they drift —
 * which is the failure nobody notices, because both halves keep working while
 * the document quietly stops describing them.
 *
 * Written to FAIL before `T1706`.
 */
import { readFileSync, readdirSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '../../..');
const contract = readFileSync(join(root, 'specs/046-task-kanban-governed-status/contracts/tasks-api.md'), 'utf8');
const controller = readFileSync(join(root, 'backend/src/modules/task-sync/tasks-sync.controller.ts'), 'utf8');
const tool = readFileSync(join(root, 'packages/mcp-server/src/tools/tasks.ts'), 'utf8');
const scopes = readFileSync(join(root, 'backend/src/modules/connector/connector-scope.ts'), 'utf8');
const service = readFileSync(join(root, 'backend/src/modules/task-sync/task-sync.service.ts'), 'utf8');

describe('T1705 · the connector operation (contracts/tasks-api.md §1)', () => {
  it('is mounted at the path the contract names, behind the guard, with the scope tasks.sync', () => {
    expect(contract).toContain('POST /v1/projects/{projectId}/tasks/sync');
    expect(controller).toContain("@Controller('projects')");
    expect(controller).toContain("@Post(':projectId/tasks/sync')");
    expect(controller).toContain('@UseGuards(ConnectorAuthGuard)');
    expect(controller).toContain("@ConnectorScope('tasks.sync')");
    expect(scopes).toContain("registerConnectorScope('tasks.sync')");
  });

  it('accepts exactly what the shipped hook sends, and no idempotency key (FR-KAN-061, R-046-8)', () => {
    // The hook's call is `{ executionId, tasksMarkdown }`. A key would be a
    // second way to key a sync that no client uses.
    expect(tool).toContain('executionId: z.string()');
    expect(tool).toContain('tasksMarkdown: z.string()');
    expect(tool).not.toContain('idempotencyKey');
    expect(controller).not.toContain('idempotencyKey');
    expect(service).toContain('deriveSyncKey(input.executionId, input.tasksMarkdown)');
  });

  it('addresses the project as `me`, so a client cannot name another one', () => {
    expect(tool).toContain("path: '/v1/projects/me/tasks/sync'");
  });

  it('drops `epicNumber` rather than forwarding it — the Epic comes from the execution (FR-KAN-030)', () => {
    expect(tool).toContain("strip: ['epicNumber']");
    expect(service).toContain('resolveEpic');
    expect(service).not.toMatch(/input\.epicNumber|body\.epicNumber/);
  });
});

describe('T1705 · the answer is a diff a client can print without prose (FR-KAN-037)', () => {
  const keys = ['added', 'descriptionChanged', 'checkboxChanged', 'unchanged', 'noLongerPresent'];

  it.each(keys)('the contract and the tool both carry `%s`', (key) => {
    expect(contract, `contract is missing ${key}`).toContain(key);
    expect(tool, `tool output is missing ${key}`).toContain(key);
  });

  it.each(['counts', 'refusedLines', 'markers', 'outOfBandEdit', 'tasksDigest'])('the answer carries `%s`', (key) => {
    expect(tool).toContain(key);
    expect(contract).toContain(key);
  });

  it('every diff entry is a key and a value, never a sentence', () => {
    // The shape is `{ taskKey, line? , from?, to? }` — a client prints it
    // without parsing English, which is what FR-KAN-037 is for.
    expect(service).toMatch(/export interface DiffEntry \{[\s\S]*?taskKey: string;/);
    expect(service).not.toMatch(/diff\.[a-zA-Z]+\.push\(\{[^}]*message:/);
  });
});

describe('T1705 · refusals reuse the existing vocabulary (FR-KAN-066)', () => {
  it('adds no new top-level refusal code — the specific code rides in `details`', () => {
    // The nine codes of data-model §7 are file- and line-level and travel
    // inside the answer; the transport keeps `validation_failed`.
    expect(service).toContain("code: 'command_not_task_bearing'");
    expect(service).toContain('new ValidationFailedError(');
    const errors = readFileSync(join(root, 'backend/src/core/errors.ts'), 'utf8');
    for (const code of ['command_not_task_bearing', 'too_many_task_lines', 'file_too_large', 'not_utf8_text']) {
      expect(errors, `${code} must NOT become a top-level ErrorCode`).not.toContain(`'${code}'`);
    }
  });

  it('the contract lists the codes a client must handle', () => {
    for (const code of ['invalid_connector_credential', 'scope_required', 'credential_in_argument']) {
      expect(contract).toContain(code);
    }
  });
});

const boardController = readFileSync(join(root, 'backend/src/modules/task-sync/task-board.controller.ts'), 'utf8');

/**
 * The file's CODE, without its prose. This controller's header explains at
 * length why it is not behind `ConnectorAuthGuard`, so a bare `toContain` would
 * read the explanation as the thing it forbids — `durable-stores.spec.ts` strips
 * comments for the same reason.
 */
const boardCode = boardController.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');

describe('T1714 · the board read is a SESSION route (FR-KAN-063, FR-KAN-071)', () => {
  it('is mounted at the path the contract names', () => {
    expect(contract).toContain('GET  /v1/epics/{epicId}/tasks');
    expect(boardController).toContain("@Get('epics/:eid/tasks')");
  });

  it('is NOT behind the connector guard, and declares no connector scope', () => {
    // Not an oversight: `tasks.sync` is a write with no read beside it, so a
    // bearer token carries no session and the workspace guard refuses it.
    expect(boardCode).not.toContain('ConnectorAuthGuard');
    expect(boardCode).not.toContain('@ConnectorScope');
  });

  it('requires a session and project membership before it reads anything', () => {
    expect(boardController).toContain('requireAuth(raw)');
    expect(boardController).toContain('requireMember');
    // The Epic's own workspace scope first — an Epic of another workspace is
    // absent here exactly as it is on the Epic detail (DEF-044-003).
    expect(boardController).toContain('epics.locate(auth.workspaceId, eid)');
  });

  it('exposes no write that could edit a file (FR-KAN-010)', () => {
    // TWO `@Post`s, and both are about the RECORD rather than the file: a person
    // proposing a move, and a second person answering one (`T1792`). Neither
    // touches `tasks.md`. `FR-KAN-010` is about FILES, so the assertion is about
    // files: no update, no delete, and no filesystem call.
    //
    // Enumerated rather than counted, so a third `@Post` has to be named here
    // before it can exist — a write that slipped in unnamed is the thing this
    // catches.
    const posts = [...boardCode.matchAll(/@Post\('([^']+)'\)/g)].map((m) => m[1]);
    expect(posts.sort()).toEqual(['status-proposals/:proposalId/adjudication', 'tasks/:taskId/status-proposals']);
    for (const verb of ['@Patch(', '@Put(', '@Delete(']) {
      expect(boardCode, `${verb} must not appear on this controller`).not.toContain(verb);
    }
    for (const fs of ['node:fs', 'writeFile', 'mkdir']) {
      expect(boardCode, `the board controller must not reach for ${fs}`).not.toContain(fs);
    }
  });

  /**
   * `T1768` found this scan reading three hand-picked files. A mutation that
   * put a write in `task-proposal.service.ts` — the one file where such a
   * mistake would most naturally be made, because it is the path a person's
   * move takes — passed it untouched.
   *
   * So the scan reads the DIRECTORY. A file added to this module tomorrow is
   * covered by a check nobody has to remember to extend, which is the only
   * kind of coverage a boundary rule can rely on.
   */
  it('NO file in the module reaches for the filesystem (FR-KAN-010, SC-KAN-004)', () => {
    const moduleDir = join(root, 'backend/src/modules/task-sync');
    const files = readdirSync(moduleDir).filter((f) => f.endsWith('.ts'));
    // Anti-vacuity: an empty directory would pass this silently.
    expect(files.length).toBeGreaterThanOrEqual(10);
    for (const file of files) {
      const code = readFileSync(join(moduleDir, file), 'utf8');
      for (const fs of ['node:fs', "from 'fs'", 'writeFile', 'appendFile', 'mkdir', 'rmSync', 'unlink']) {
        expect(code, `${file} must not reach for ${fs} — the project directory is authoritative`).not.toContain(fs);
      }
    }
  });
});

describe('T1705 · the session routes are not connector-reachable (FR-KAN-063, FR-KAN-071)', () => {
  it('the contract says so, and the sync controller declares the only connector scope in the module', () => {
    expect(contract).toContain('**No connector read exists**');
    // One `@ConnectorScope` in the whole module: the write. A read appearing
    // later without a contract change is what this catches.
    const occurrences = [...controller.matchAll(/@ConnectorScope\(/g)];
    expect(occurrences).toHaveLength(1);
  });
});

describe('T1732 · the progress routes (FR-KAN-055 to FR-KAN-057)', () => {
  it('are mounted at the paths the contract names', () => {
    expect(contract).toContain('GET  /v1/epics/{epicId}/tasks/progress');
    expect(contract).toContain('GET  /v1/projects/{projectId}/tasks/progress');
    expect(boardController).toContain("@Get('epics/:eid/tasks/progress')");
    expect(boardController).toContain("@Get('projects/:projectId/tasks/progress')");
  });

  it('are session routes, behind membership like the board', () => {
    expect(boardCode).not.toContain('ConnectorAuthGuard');
    // Five Epic- or project-scoped reads, five membership checks — none of them
    // optional. `T1793` added the fifth (the project's unbound task syncs). The
    // number moves only when a read is added, which is the point: a read that
    // slipped in without a check would drop it back.
    expect([...boardCode.matchAll(/requireMember/g)]).toHaveLength(5);
  });

  it('both call the SAME derivation — FR-KAN-056 is structural, not a convention', () => {
    const progress = readFileSync(join(root, 'backend/src/modules/task-sync/task-progress.service.ts'), 'utf8');
    expect(boardController).toContain('this.progress.forEpic(');
    expect(boardController).toContain('this.progress.forProject(');
    // One counting function, called by both.
    expect([...progress.matchAll(/export function computeProgress/g)]).toHaveLength(1);
    expect(progress).toMatch(/forEpic[\s\S]*?computeProgress\(/);
    expect(progress).toMatch(/forProject[\s\S]*?computeProgress\(/);
  });
});

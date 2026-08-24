/**
 * T442w (EPIC-036) — every shell-owned surface, every state, driven.
 *
 * **Why this exists.** `SC-SHL-005` sets the target at **100% of shell-owned
 * surfaces**, and `FR-SHL-060` says *every* surface must distinguish loading,
 * empty, error and partial from one another. What verified that until now was
 * `T441h` — a completed task that **names three surfaces in its own
 * description**: `Home.spec.tsx`, `shell-context.spec.tsx`, `addresses.spec.tsx`.
 *
 * That list was already incomplete when it was ticked. The `ContextBar` project
 * selector is not in it, and one convergence pass later `T441v`/`T442b` found
 * that exact surface **rendering a failed fetch as an empty one** — which
 * `FR-SHL-062` calls a defect and not a fallback. A hand-written list cannot
 * fail when a surface is added without its states; it can only be re-read by
 * somebody who already knows what to look for.
 *
 * `SC-SHL-005` also says how it must be verified: **"by driving each state, not
 * by inspection."** So this file does not grep other spec files for evidence
 * that a state is covered — that would be inspection wearing a test's clothes.
 * It renders the real `App` at a real address for every state it claims, and
 * reads back what a person would see.
 *
 * ## The two assertions that matter
 *
 * 1. **Within a surface, no two states may render the same thing.** That is
 *    `FR-SHL-060` stated as an executable property rather than a promise, and
 *    it is precisely what `T442b` fixed by hand: *failed* and *empty* had the
 *    same signature.
 * 2. **The enumeration must cover the directory.** Every `.tsx` in
 *    `frontend/src/shell/` is either the home of a surface below or listed in
 *    `NO_STATES` with a reason. Adding `NewPanel.tsx` fails this file until
 *    somebody says which it is — so the omission that `T441h` made silently
 *    becomes a red test.
 *
 * Unit test for: `SC-SHL-005`, `FR-SHL-060`, `FR-SHL-061`, `FR-SHL-062`.
 */
import { readdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { cleanup, fireEvent, screen, waitFor, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { PROJECT, renderAt, stubApi } from './harness';
import type { ApiClient, Project } from '../../../src/services/api';

afterEach(cleanup);

const SHELL_SRC = join(dirname(fileURLToPath(import.meta.url)), '..', '..', '..', 'src', 'shell');

/** A promise that never settles — the only honest way to hold a loading state. */
function pending<T>(): Promise<T> {
  return new Promise<T>(() => {});
}

/** Read back what a person would see in one region of the shell. */
function signature(selector: string): string {
  const node = document.querySelector(selector);
  return (node?.textContent ?? '').replace(/\s+/g, ' ').trim();
}

/**
 * Wait for text to appear **inside one region**, not anywhere on the page.
 *
 * A page-wide `findByText` is ambiguous here by construction: the breadcrumb
 * and the project selector are on screen at every address, and the selector's
 * placeholder reads *"No project selected"* — the same words the empty Home
 * and the project gate use, because they are describing the same fact. The
 * first run of this file failed on exactly that. Scoping the wait to the region
 * under test is what makes each assertion about the surface it names.
 */
async function waitForIn(selector: string, pattern: RegExp): Promise<void> {
  await waitFor(() => expect(signature(selector)).toMatch(pattern));
}

/**
 * Drive every state and return the first pair that rendered identically.
 *
 * Extracted so the mutation test below exercises **this function** rather than
 * a re-implementation of it. A mutation check that asserts against its own copy
 * of the logic proves the copy works.
 */
async function firstCollision(
  states: readonly SurfaceState[],
): Promise<{ a: string; b: string } | undefined> {
  const seen = new Map<string, string>();
  for (const state of states) {
    const shown = await state.drive();
    const clash = [...seen.entries()].find(([, text]) => text === shown);
    if (clash !== undefined) return { a: clash[0], b: state.name };
    seen.set(state.name, shown);
    cleanup();
    vi.restoreAllMocks();
  }
  return undefined;
}

/** Select the seeded project, waiting for the option to exist first. */
async function selectProject(): Promise<void> {
  const select = await screen.findByLabelText('Project');
  await waitFor(() =>
    expect(within(select as HTMLElement).getByRole('option', { name: PROJECT.name })).toBeTruthy(),
  );
  fireEvent.change(select, { target: { value: PROJECT.id } });
}

interface SurfaceState {
  /** What state this is, in the vocabulary `FR-SHL-060` uses. */
  readonly name: string;
  /** Render it for real and return what showed. */
  readonly drive: () => Promise<string>;
}

interface Surface {
  readonly id: string;
  /** The module in `frontend/src/shell/` this surface lives in. */
  readonly module: string;
  readonly states: readonly SurfaceState[];
}

const MAIN = 'main';
const CONTEXT = '.shell-context';

/**
 * The shell-owned surfaces.
 *
 * A surface is shell-owned when **the shell decides what it renders**. Pages
 * hosted inside an area are not here and must not be: `FR-SHL-003` says the
 * shell hosts screens and implements none, so another Epic's empty state is
 * that Epic's to get right.
 */
const SHELL_SURFACES: readonly Surface[] = [
  {
    id: 'home',
    module: 'Home.tsx',
    states: [
      {
        name: 'loading',
        drive: async () => {
          const api = stubApi();
          vi.spyOn(api, 'listRuns').mockImplementation(pending);
          renderAt('/', api);
          await selectProject();
          await waitForIn(MAIN, /Loading what is waiting/i);
          return signature(MAIN);
        },
      },
      {
        name: 'empty — no project selected',
        drive: async () => {
          renderAt('/');
          await waitForIn(MAIN, /No project selected/i);
          return signature(MAIN);
        },
      },
      {
        name: 'empty — a working source with nothing in it',
        drive: async () => {
          const api = stubApi({ runs: [] });
          renderAt('/', api);
          await selectProject();
          // "Nothing waiting for your approval" — a source that answered and
          // had nothing, which must not read like a source that never answered.
          await waitForIn(MAIN, /Nothing waiting for your approval/i);
          return signature(MAIN);
        },
      },
      {
        name: 'error — the source was asked and did not answer',
        drive: async () => {
          const api = stubApi();
          vi.spyOn(api, 'listRuns').mockRejectedValue(new Error('the runs service is down'));
          renderAt('/', api);
          await selectProject();
          await waitForIn(MAIN, /the runs service is down/i);
          return signature(MAIN);
        },
      },
      {
        name: 'partial — some sources exist and some do not',
        drive: async () => {
          renderAt('/', stubApi());
          await selectProject();
          await screen.findByRole('status');
          return signature(MAIN);
        },
      },
    ],
  },
  {
    id: 'project-selector',
    module: 'ContextBar.tsx',
    states: [
      {
        name: 'loading',
        drive: async () => {
          const api = stubApi();
          vi.spyOn(api, 'listProjects').mockImplementation(pending);
          renderAt('/', api);
          await screen.findByLabelText('Project');
          return signature(CONTEXT);
        },
      },
      {
        name: 'failed',
        drive: async () => {
          const api = stubApi();
          vi.spyOn(api, 'listProjects').mockRejectedValue(new Error('the projects service is down'));
          renderAt('/', api);
          await screen.findByRole('alert');
          return signature(CONTEXT);
        },
      },
      {
        name: 'empty — this workspace has none',
        drive: async () => {
          const api = stubApi({ projects: [] as Project[] });
          renderAt('/', api);
          await screen.findByLabelText('Project');
          await waitFor(() => expect(signature(CONTEXT)).not.toMatch(/Loading/i));
          return signature(CONTEXT);
        },
      },
      {
        name: 'ready',
        drive: async () => {
          renderAt('/', stubApi());
          await selectProject();
          return signature(CONTEXT);
        },
      },
    ],
  },
  {
    id: 'not-found',
    module: 'NotFound.tsx',
    states: [
      {
        name: 'specified but not delivered — names the Epic that owes it',
        drive: async () => {
          renderAt('/governance');
          await waitForIn(MAIN, /not available yet/i);
          return signature(MAIN);
        },
      },
      {
        name: 'no such address',
        drive: async () => {
          renderAt('/no-such-place');
          await waitForIn(MAIN, /Nothing at/i);
          return signature(MAIN);
        },
      },
    ],
  },
  {
    id: 'project-gate',
    module: 'area-views.tsx',
    states: [
      {
        name: 'empty — an area needs a project and none is selected',
        drive: async () => {
          renderAt('/specifications');
          await waitForIn(MAIN, /No project selected/i);
          return signature(MAIN);
        },
      },
    ],
  },
];

/**
 * Modules with no state of their own, and why.
 *
 * Each line is a claim that can be wrong. A module that grows an async read
 * belongs above, and moving it is the point: the check exists so that decision
 * is made deliberately rather than by nobody.
 */
const NO_STATES: Readonly<Record<string, string>> = Object.freeze({
  'AppShell.tsx': 'the frame — it lays out regions and reads no data',
  'Navigation.tsx':
    'derived from the committed registry, which is present at module load; there is nothing to wait for',
  'NavigationDrawer.tsx': 'viewport width only — no data source, so no loading or error',
  'routes.tsx': 'a route tree, derived from the registry; it renders no surface of its own',
  'shell-context.tsx':
    'defines ProjectSetState and derives the current area from the address — it renders no surface. ' +
    'The surfaces that render its union are the project selector and the breadcrumb, both enumerated above.',
});

describe('T442w · every shell-owned surface drives every state it can be in', () => {
  it('enumerates surfaces at all, or this file proves nothing', () => {
    // Anti-vacuity, the same guard `T442t` carries. An empty enumeration would
    // make every assertion below pass over nothing — which is how `T441h`
    // reported 100% coverage of a set it never counted.
    expect(SHELL_SURFACES.length).toBeGreaterThanOrEqual(4);
    const totalStates = SHELL_SURFACES.reduce((n, s) => n + s.states.length, 0);
    expect(totalStates).toBeGreaterThanOrEqual(10);
  });

  it('covers every module in frontend/src/shell — a new surface fails until it is declared', () => {
    const modules = readdirSync(SHELL_SRC).filter((f) => f.endsWith('.tsx'));
    const enumerated = new Set(SHELL_SURFACES.map((s) => s.module));
    const undeclared = modules.filter((m) => !enumerated.has(m) && NO_STATES[m] === undefined);
    expect(
      undeclared,
      `${undeclared.join(', ')} is in frontend/src/shell and appears in neither SHELL_SURFACES nor NO_STATES. ` +
        'Declare its states, or say here why it has none — do not leave it to the next reader to notice.',
    ).toEqual([]);

    // And the reverse: an exemption for a file that no longer exists is a
    // stale claim, and stale claims are what this Epic keeps finding.
    const orphaned = Object.keys(NO_STATES).filter((m) => !modules.includes(m));
    expect(orphaned, `NO_STATES names ${orphaned.join(', ')}, which no longer exists`).toEqual([]);
  });

  describe.each(SHELL_SURFACES.map((s) => [s.id, s] as const))('%s', (id, surface) => {
    it('renders something in every state it declares', async () => {
      for (const state of surface.states) {
        const shown = await state.drive();
        expect(shown, `${id} rendered nothing in its "${state.name}" state`).not.toBe('');
        cleanup();
        vi.restoreAllMocks();
      }
    });

    it('renders each state differently from every other one (FR-SHL-060)', async () => {
      const clash = await firstCollision(surface.states);
      expect(
        clash,
        clash === undefined
          ? ''
          : `${id} renders "${clash.a}" and "${clash.b}" identically. FR-SHL-060 requires them ` +
            `to be distinguishable, and FR-SHL-062 calls the failed/empty case a defect rather ` +
            `than a fallback — which is the exact pair T442b had to fix by hand.`,
      ).toBeUndefined();
    });
  });
});

describe('T442w · MUTATION — the distinguishability check must be able to fail', () => {
  it('reports the collision when a failed state is rendered as an empty one', async () => {
    // `T200c`'s standard: a check nobody has seen fail is a check nobody knows
    // works. This is the *actual* fault `T442b` fixed — the project selector
    // reporting a rejected request the way it reports an empty workspace —
    // reconstructed here so `firstCollision` has to notice it.
    const collapsed: readonly SurfaceState[] = [
      { name: 'empty', drive: async () => Promise.resolve('Project No project selected') },
      { name: 'failed', drive: async () => Promise.resolve('Project No project selected') },
    ];
    await expect(firstCollision(collapsed)).resolves.toEqual({ a: 'empty', b: 'failed' });
  });

  it('and passes two states that genuinely differ', async () => {
    const distinct: readonly SurfaceState[] = [
      { name: 'empty', drive: async () => Promise.resolve('This workspace has no projects') },
      { name: 'failed', drive: async () => Promise.resolve('Projects could not be loaded') },
    ];
    await expect(firstCollision(distinct)).resolves.toBeUndefined();
  });
});

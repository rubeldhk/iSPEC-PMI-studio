/**
 * T438a / T438c (EPIC-036) — workspace and project, visible without asking.
 *
 * `BR-0001` is tenant isolation and its failure mode is **silent**: a user
 * acting on the wrong project sees a perfectly plausible screen and finds out
 * later. `UX-0010`/`UX-0011` answer that by making the scope visible rather
 * than implied, and `SC-SHL-009` puts a number on it — answerable from the
 * screen in under five seconds, without opening a menu.
 *
 * "Without opening a menu" is the testable half: the scope is **rendered**,
 * not behind a control.
 */
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, screen, waitFor, within } from '@testing-library/react';
import { NO_IDENTITY_PROJECT_SET, projectsOf } from '../../../src/shell/shell-context';
import { PROJECT, WORKSPACE_ID, renderAt, stubApi } from './harness';

afterEach(cleanup);

/**
 * The project `<select>`, re-queried every time.
 *
 * **Never hold the node across a state change.** React can replace the element
 * when the shell swaps frames, and a captured reference then sits detached
 * while the live one updates — so the assertion waits forever on a node nothing
 * is rendering into. It passes alone and fails under the full suite, which is
 * the only reason it was ever found.
 */
function projectSelect(): HTMLElement {
  return screen.getByLabelText('Project');
}

function breadcrumb(): HTMLElement {
  return screen.getByRole('navigation', { name: 'Breadcrumb' });
}

describe('T438a · the scope is on screen, not behind a control', () => {
  it('names the workspace and the project without any interaction', async () => {
    renderAt('/projects');
    await waitFor(() => expect(breadcrumb().textContent).toContain(WORKSPACE_ID));
  });

  it('says so plainly when no project is selected, rather than showing nothing', async () => {
    // An empty segment reads as "some project"; `DEF-007-001` is this class of
    // ambiguity one layer down.
    renderAt('/');
    await waitFor(() => expect(breadcrumb().textContent).toContain('No project selected'));
  });

  it('offers the project selector as a rendered control on every screen', async () => {
    renderAt('/runs');
    await screen.findByLabelText('Project');
    // The set arrives from `EPIC-004` asynchronously; the control is rendered
    // before it does, which is correct — an absent selector would be worse
    // than an empty one.
    await waitFor(() =>
      expect(within(projectSelect()).getAllByRole('option').length).toBeGreaterThan(1),
    );
  });
});

describe('T441v · FR-SHL-060 — the selector tells loading from empty', () => {
  // The convergence finding (`F3`). While `listProjects()` was in flight the
  // control read "No project selected" and nothing else — the same thing it
  // reads for a workspace that genuinely has no projects. Two different facts,
  // one appearance, on a surface the user sees on every screen.
  //
  // `DEF-007-001` is this class one layer down: a project-scoped list that
  // could not tell "no such project" from "this project is empty". The
  // difference matters because only one of them is worth waiting for.
  it('marks the control busy while the set is in flight', async () => {
    const api = stubApi();
    let release: ((projects: never[]) => void) | undefined;
    (api.listProjects as unknown as ReturnType<typeof vi.fn>).mockImplementation(
      async () => new Promise((resolve) => { release = resolve as never; }),
    );
    renderAt('/', api);
    await screen.findByLabelText('Project');
    expect(projectSelect().getAttribute('aria-busy'), 'the control is not marked busy').toBe('true');
    release?.([]);
  });

  it('stops being busy once the set has arrived', async () => {
    renderAt('/');
    await screen.findByLabelText('Project');
    await waitFor(() => expect(projectSelect().getAttribute('aria-busy')).toBeNull());
  });

  it('says the workspace has no projects only once it knows that', async () => {
    // The other half: an empty answer is a real answer, and it reads
    // differently from a question that has not come back yet.
    renderAt('/', stubApi({ projects: [] }));
    await screen.findByLabelText('Project');
    await waitFor(() =>
      expect(within(projectSelect()).getByText(/no projects in this workspace/i)).toBeTruthy(),
    );
    expect(projectSelect().getAttribute('aria-busy')).toBeNull();
  });

  it('does not claim the workspace is empty while it is still asking', async () => {
    const api = stubApi();
    let release: ((projects: never[]) => void) | undefined;
    (api.listProjects as unknown as ReturnType<typeof vi.fn>).mockImplementation(
      async () => new Promise((resolve) => { release = resolve as never; }),
    );
    renderAt('/', api);
    await screen.findByLabelText('Project');
    expect(within(projectSelect()).queryByText(/no projects in this workspace/i)).toBeNull();
    release?.([]);
  });
});

describe('T442a · FR-SHL-062 — a failed project set reports as failed, not as empty', () => {
  // The second convergence pass (`F1`), and a fault the first pass created.
  // `T441v` separated *loading* from *empty* and left the third state
  // undriven — so a request that **rejected** landed in `.catch` (list
  // emptied) and then read as a workspace with no projects.
  //
  // `FR-SHL-062` does not leave room for interpretation: *"A failed section
  // MUST report as failed. Rendering a failure as an empty state is a defect,
  // not a fallback."* An untested state is how that sentence stayed true of
  // the document and false of the code.
  function failing(): ReturnType<typeof stubApi> {
    const api = stubApi();
    (api.listProjects as unknown as ReturnType<typeof vi.fn>).mockRejectedValue(
      new Error('the projects service did not answer'),
    );
    return api;
  }

  it('does not claim the workspace is empty when the request failed', async () => {
    renderAt('/', failing());
    await screen.findByLabelText('Project');
    await waitFor(() => expect(projectSelect().getAttribute('aria-busy')).toBeNull());
    expect(
      within(projectSelect()).queryByText(/no projects in this workspace/i),
      'a failed request rendered as an empty workspace',
    ).toBeNull();
  });

  it('says the set could not be loaded, and marks the control invalid', async () => {
    renderAt('/', failing());
    await screen.findByLabelText('Project');
    await waitFor(() =>
      expect(within(projectSelect()).getByText(/could not be loaded/i)).toBeTruthy(),
    );
    expect(projectSelect().getAttribute('aria-invalid')).toBe('true');
  });

  it('offers what to do next, and says why (FR-SHL-061)', async () => {
    renderAt('/', failing());
    const alert = await screen.findByRole('alert');
    expect(alert.textContent).toContain('did not answer');
    expect(alert.textContent).toMatch(/reload/i);
  });

  it('shows no failure notice when the set loads', async () => {
    // The other half — an alert that is always present is not an alert.
    renderAt('/');
    await screen.findByLabelText('Project');
    await waitFor(() => expect(screen.queryByRole('alert')).toBeNull());
  });
});

describe('T442h · FR-SHL-062 — no identity is not an empty workspace', () => {
  // The third convergence pass (`F2`). The signed-out branch set
  // `{ kind: 'ready', projects: [] }` — *"we asked, and this workspace has
  // none"* — about a workspace that does not exist and a request never made.
  //
  // The converge note called it latent because `App` renders `SignIn` in the
  // same pass. **This test is written to find out whether that is true**, by
  // signing in for real: the identity arrives, `App` re-renders with the
  // stale set, and `ContextBar` mounts before the fetch effect runs. If the
  // window exists, the selector says the workspace is empty for one frame,
  // on a claim nothing supports.
  it('never claims the workspace is empty on the way in from sign-in', async () => {
    const api = stubApi({ signedIn: false });
    (api.signIn as unknown as ReturnType<typeof vi.fn>) = vi.fn(async () => ({
      user: { id: 'u1', email: 'uat@pmi.test', displayName: 'UAT' },
      workspace: { id: WORKSPACE_ID },
    }));
    // The set never answers, so anything the control says is what it says
    // BEFORE an answer exists.
    (api.listProjects as unknown as ReturnType<typeof vi.fn>).mockImplementation(
      async () => new Promise(() => undefined),
    );

    renderAt('/', api);
    fireEvent.change(await screen.findByLabelText(/email/i), {
      target: { value: 'uat@pmi.test' },
    });
    fireEvent.change(screen.getByLabelText(/password/i), { target: { value: 'x' } });
    fireEvent.click(screen.getByRole('button', { name: /sign in/i }));

    await screen.findByLabelText('Project');
    expect(
      within(projectSelect()).queryByText(/no projects in this workspace/i),
      'the shell claimed an empty workspace before it had asked',
    ).toBeNull();
    expect(within(projectSelect()).getByText(/loading projects/i)).toBeTruthy();
  });

  it('holds a value that is true rather than merely unrendered', () => {
    // **This assertion, not the one above, is why `T442i` changed anything.**
    //
    // The sign-in test passes with the old value too: React commits the
    // identity and the fetch together, so nothing ever renders the stale set.
    // Unreachable is not the same as correct, and `loading` and `failed` were
    // each unreachable-but-wrong for exactly one round before becoming
    // reachable-and-wrong. This checks the value itself.
    expect(NO_IDENTITY_PROJECT_SET.kind, 'no identity is not an answered, empty workspace').not.toBe(
      'ready',
    );
    expect(NO_IDENTITY_PROJECT_SET.kind).toBe('loading');
    expect(projectsOf(NO_IDENTITY_PROJECT_SET)).toEqual([]);
  });
});

describe('T438c · the breadcrumb reads workspace / project / area (UX-0012)', () => {
  it('has exactly three segments, in that order', async () => {
    renderAt('/runs');
    await waitFor(() => expect(breadcrumb().textContent).toContain('Runs'));
    const segments = within(breadcrumb())
      .getAllByRole('listitem')
      .map((item) => item.textContent?.trim() ?? '');
    expect(segments).toHaveLength(3);
    expect(segments[0]).toContain(WORKSPACE_ID);
    expect(segments[2]).toBe('Runs');
  });

  it('marks the area segment as the current page', async () => {
    renderAt('/runs');
    await waitFor(() => expect(breadcrumb().textContent).toContain('Runs'));
    const current = within(breadcrumb())
      .getAllByRole('listitem')
      .filter((item) => item.getAttribute('aria-current') === 'page');
    expect(current).toHaveLength(1);
    expect(current[0]!.textContent).toBe('Runs');
  });

  it('derives the area from the address, so it cannot disagree with it', async () => {
    // The reason `areaId` is not held in state (`data-model.md` §3): two
    // answers to "where am I" disagree the first time somebody uses back.
    renderAt('/storage');
    await waitFor(() =>
      expect(breadcrumb().textContent).toContain('Workspace & Administration'),
    );
  });

  it('names the project once one is selected', async () => {
    renderAt('/');
    await screen.findByLabelText('Project');
    // The option has to exist before it can be chosen: a `change` naming a
    // value the select does not have is silently ignored.
    await waitFor(() =>
      expect(within(projectSelect()).getByRole('option', { name: PROJECT.name })).toBeTruthy(),
    );
    fireEvent.change(projectSelect(), { target: { value: PROJECT.id } });
    await waitFor(() => expect(breadcrumb().textContent).toContain(PROJECT.name));
  });

  it('says "Not found" for an address that names no area', async () => {
    renderAt('/no-such-place', stubApi());
    await waitFor(() => expect(breadcrumb().textContent).toContain('Not found'));
  });
});

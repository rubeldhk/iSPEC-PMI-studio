/**
 * `T1168` (EPIC-033 Phase 9) — the screen that starts a Room.
 * Written to FAIL before `T1169` exists (Constitution V).
 *
 * `T405j` recorded quickstart Scenario 13 as *not run*. The investigation found
 * the harder truth: nothing in the frontend has ever called the intake route, so
 * a person cannot submit intent at all. This is the missing first step.
 *
 * ## What the keyboard block here does and does not prove
 *
 * `SC-RQR-008` requires the journey to be completable by keyboard alone. This
 * file asserts the **structural** properties that make that possible — native
 * controls, real label associations, a real `<form>` so Enter submits, and no
 * positive `tabindex` reordering the page. Those are the things that regress
 * silently under refactoring.
 *
 * It does **not** prove tab order or focus visibility. Those need a running
 * browser, which is `T1174`'s transcript, and whether that discharges the
 * accessibility half is the open question `T1175` asks rather than assumes.
 */
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { RequirementIntake } from '../../../src/pages/RequirementIntake';
import { ApiError, type ApiClient } from '../../../src/services/api';

afterEach(cleanup);

const PROJECT = 'pr_1';
const INTENT = 'The system shall notify approvers.';

type OpenInput = { projectId: string; text: string; sourceRef?: string };
type OpenFn = (input: OpenInput) => Promise<{ roomObjectId: string }>;

function apiWith(open: OpenFn): ApiClient {
  return { openRequirementRoom: open } as unknown as ApiClient;
}

const ok = (): ApiClient => apiWith(() => Promise.resolve({ roomObjectId: 'ro_new' }));

const intentField = (): HTMLElement => screen.getByLabelText(/intent/i);
const submitButton = (): HTMLElement => screen.getByRole('button', { name: /open(ing)? room/i });

describe('T1168 · submitting unstructured intent', () => {
  it('renders a labelled field for intent and for its source', () => {
    render(<RequirementIntake api={ok()} projectId={PROJECT} onOpened={vi.fn()} />);
    expect(intentField()).toBeDefined();
    expect(screen.getByLabelText(/source/i)).toBeDefined();
  });

  it('refuses to submit while the intent is empty', () => {
    const open = vi.fn(() => Promise.resolve({ roomObjectId: 'ro_new' }));
    render(<RequirementIntake api={apiWith(open)} projectId={PROJECT} onOpened={vi.fn()} />);

    expect((submitButton() as HTMLButtonElement).disabled).toBe(true);
    fireEvent.click(submitButton());
    // A submit that silently does nothing is worse than a disabled control: the
    // user cannot tell whether it worked.
    expect(open).not.toHaveBeenCalled();
  });

  it('treats whitespace as empty', () => {
    render(<RequirementIntake api={ok()} projectId={PROJECT} onOpened={vi.fn()} />);
    fireEvent.change(intentField(), { target: { value: '   \n  ' } });
    expect((submitButton() as HTMLButtonElement).disabled).toBe(true);
  });

  it('submits the intent and hands back the new Room', async () => {
    const open = vi.fn(() => Promise.resolve({ roomObjectId: 'ro_new' }));
    const onOpened = vi.fn();
    render(<RequirementIntake api={apiWith(open)} projectId={PROJECT} onOpened={onOpened} />);

    fireEvent.change(intentField(), { target: { value: INTENT } });
    fireEvent.click(submitButton());

    await waitFor(() => expect(onOpened).toHaveBeenCalledWith('ro_new'));
    expect(open).toHaveBeenCalledWith(
      expect.objectContaining({ projectId: PROJECT, text: INTENT }),
    );
  });

  it('never sends a workspace — the server takes it from the session', async () => {
    // `T1148`. A body naming its own tenant is the defect `DEF-033-001` closed,
    // and a form is exactly where one gets reintroduced.
    const open = vi.fn<OpenFn>(() => Promise.resolve({ roomObjectId: 'ro_new' }));
    render(<RequirementIntake api={apiWith(open)} projectId={PROJECT} onOpened={vi.fn()} />);

    fireEvent.change(intentField(), { target: { value: INTENT } });
    fireEvent.click(submitButton());

    await waitFor(() => expect(open).toHaveBeenCalled());
    expect(JSON.stringify(open.mock.calls[0]?.[0])).not.toMatch(/workspace/i);
  });

  it('does not submit twice while the first is in flight', async () => {
    // Two Rooms from one intent is a mess a user cannot tidy up: neither is
    // obviously the real one.
    let resolve: (v: { roomObjectId: string }) => void = () => {};
    const open = vi.fn(() => new Promise<{ roomObjectId: string }>((r) => (resolve = r)));
    render(<RequirementIntake api={apiWith(open)} projectId={PROJECT} onOpened={vi.fn()} />);

    fireEvent.change(intentField(), { target: { value: INTENT } });
    fireEvent.click(submitButton());
    fireEvent.click(submitButton());
    expect(open).toHaveBeenCalledTimes(1);

    resolve({ roomObjectId: 'ro_new' });
  });
});

describe('T1168 · a refusal is readable, and stays on screen', () => {
  it('renders the server’s refusal in place, as a live region', async () => {
    const api = apiWith(() =>
      Promise.reject(new ApiError('validation_failed', 'Intent must not be empty.', 422)),
    );
    render(<RequirementIntake api={api} projectId={PROJECT} onOpened={vi.fn()} />);

    fireEvent.change(intentField(), { target: { value: 'x' } });
    fireEvent.click(submitButton());

    // `role="alert"` is assertive: it is announced without the user having to go
    // looking for it, which a toast that vanishes is not.
    const alert = await screen.findByRole('alert');
    expect(alert.textContent).toMatch(/Intent must not be empty/i);
  });

  it('keeps what the user typed after a refusal', async () => {
    // Losing the text is how a user learns not to write anything long.
    const api = apiWith(() => Promise.reject(new ApiError('internal_error', 'Nope.', 500)));
    render(<RequirementIntake api={api} projectId={PROJECT} onOpened={vi.fn()} />);

    fireEvent.change(intentField(), { target: { value: INTENT } });
    fireEvent.click(submitButton());

    await screen.findByRole('alert');
    expect((intentField() as HTMLTextAreaElement).value).toBe(INTENT);
  });

  it('allows a retry after a refusal', async () => {
    let attempt = 0;
    const open = vi.fn(() => {
      attempt += 1;
      return attempt === 1
        ? Promise.reject(new ApiError('internal_error', 'Nope.', 500))
        : Promise.resolve({ roomObjectId: 'ro_second' });
    });
    const onOpened = vi.fn();
    render(<RequirementIntake api={apiWith(open)} projectId={PROJECT} onOpened={onOpened} />);

    fireEvent.change(intentField(), { target: { value: INTENT } });
    fireEvent.click(submitButton());
    await screen.findByRole('alert');

    // The control this file needs: a form left permanently disabled after one
    // failure would satisfy every assertion above.
    expect((submitButton() as HTMLButtonElement).disabled).toBe(false);
    fireEvent.click(submitButton());
    await waitFor(() => expect(onOpened).toHaveBeenCalledWith('ro_second'));
  });
});

describe('T1168 · SC-RQR-008 — the structure keyboard operation depends on', () => {
  it('uses a real form, so Enter submits without a mouse', async () => {
    const open = vi.fn(() => Promise.resolve({ roomObjectId: 'ro_new' }));
    const onOpened = vi.fn();
    const { container } = render(
      <RequirementIntake api={apiWith(open)} projectId={PROJECT} onOpened={onOpened} />,
    );

    const form = container.querySelector('form');
    expect(form, 'the controls are not inside a form').not.toBeNull();

    fireEvent.change(intentField(), { target: { value: INTENT } });
    fireEvent.submit(form!);
    await waitFor(() => expect(onOpened).toHaveBeenCalledWith('ro_new'));
  });

  it('every control is a native, focusable element', () => {
    // Not a div with a click handler. The whole of keyboard reachability for a
    // form of this shape follows from using the real elements.
    render(<RequirementIntake api={ok()} projectId={PROJECT} onOpened={vi.fn()} />);
    expect(intentField().tagName).toBe('TEXTAREA');
    expect(screen.getByLabelText(/source/i).tagName).toBe('INPUT');
    expect(submitButton().tagName).toBe('BUTTON');
  });

  it('no positive tabindex reorders the page', () => {
    // A positive `tabindex` moves an element ahead of everything with 0, which
    // is how a tab order stops matching the reading order.
    const { container } = render(
      <RequirementIntake api={ok()} projectId={PROJECT} onOpened={vi.fn()} />,
    );
    const positive = [...container.querySelectorAll('[tabindex]')].filter(
      (el) => Number(el.getAttribute('tabindex')) > 0,
    );
    expect(positive).toHaveLength(0);
  });

  it('the submit button is reachable — it is not disabled by anything but empty intent', () => {
    render(<RequirementIntake api={ok()} projectId={PROJECT} onOpened={vi.fn()} />);
    expect((submitButton() as HTMLButtonElement).disabled).toBe(true);
    fireEvent.change(intentField(), { target: { value: INTENT } });
    expect((submitButton() as HTMLButtonElement).disabled).toBe(false);
  });
});

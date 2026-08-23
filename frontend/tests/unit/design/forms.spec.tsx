/**
 * T887 (EPIC-029) — the form family: Button, TextInput, Select, Checkbox,
 * Radio, FormField — one test per state its contract row declares
 * (FR-DS-020, SC-DS-004; the row is read by state-coverage.spec.tsx, which
 * fails if any title below goes missing).
 *
 * Pointer states (hover/active) are stylesheet behaviour jsdom cannot
 * synthesise, so their tests assert the declared rule EXISTS in
 * components.css; interactive states assert real DOM behaviour.
 */
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { Button } from '../../../src/design/components/Button';
import { TextInput } from '../../../src/design/components/TextInput';
import { Select } from '../../../src/design/components/Select';
import { Checkbox } from '../../../src/design/components/Checkbox';
import { Radio } from '../../../src/design/components/Radio';
import { FormField } from '../../../src/design/components/FormField';

const here = dirname(fileURLToPath(import.meta.url));
const css = readFileSync(join(here, '../../../src/design/components/components.css'), 'utf8');

/** The declared pointer-state rule must exist — jsdom cannot hover for us. */
function expectStateRule(selector: string): void {
  expect(css.includes(selector), `components.css declares no '${selector}' rule`).toBe(true);
}

afterEach(cleanup);

describe('Button (T887)', () => {
  it('Button · state: default — a real <button> carrying its label', () => {
    render(<Button>Save</Button>);
    expect(screen.getByRole('button', { name: 'Save' })).toBeDefined();
  });

  it('Button · state: hover — the stylesheet declares the hover treatment', () => {
    expectStateRule('.ds-button:hover');
  });

  it('Button · state: focus — keyboard-focusable', () => {
    render(<Button>Save</Button>);
    const button = screen.getByRole('button');
    button.focus();
    expect(document.activeElement).toBe(button);
  });

  it('Button · state: active — the stylesheet declares the active treatment', () => {
    expectStateRule('.ds-button:active');
  });

  it('Button · state: disabled', () => {
    render(<Button disabled>Save</Button>);
    expect((screen.getByRole('button') as HTMLButtonElement).disabled).toBe(true);
  });

  it('Button · state: loading — KEEPS its label; a spinner replacing text loses the announcement', () => {
    render(<Button loading>Save</Button>);
    const button = screen.getByRole('button', { name: /save/i });
    expect(button.textContent).toContain('Save');
    expect(button.getAttribute('aria-busy')).toBe('true');
    expect((button as HTMLButtonElement).disabled).toBe(true);
  });
});

describe('TextInput (T887)', () => {
  it('TextInput · state: default — a real <input>', () => {
    render(<TextInput aria-label="Name" />);
    expect(screen.getByRole('textbox', { name: 'Name' }).tagName).toBe('INPUT');
  });

  it('TextInput · state: hover — the stylesheet declares the hover treatment', () => {
    expectStateRule('.ds-input:hover');
  });

  it('TextInput · state: focus — keyboard-focusable', () => {
    render(<TextInput aria-label="Name" />);
    const input = screen.getByRole('textbox');
    input.focus();
    expect(document.activeElement).toBe(input);
  });

  it('TextInput · state: disabled', () => {
    render(<TextInput aria-label="Name" disabled />);
    expect((screen.getByRole('textbox') as HTMLInputElement).disabled).toBe(true);
  });

  it('TextInput · state: error — aria-invalid, paired with FormField’s message', () => {
    render(<TextInput aria-label="Name" invalid />);
    expect(screen.getByRole('textbox').getAttribute('aria-invalid')).toBe('true');
  });
});

describe('Select (T887)', () => {
  it('Select · state: default — a real <select>, native listbox behaviour', () => {
    render(
      <Select aria-label="Engine">
        <option value="a">A</option>
      </Select>,
    );
    expect(screen.getByRole('combobox', { name: 'Engine' }).tagName).toBe('SELECT');
  });

  it('Select · state: hover — the stylesheet declares the hover treatment', () => {
    expectStateRule('.ds-select:hover');
  });

  it('Select · state: focus — keyboard-focusable', () => {
    render(
      <Select aria-label="Engine">
        <option value="a">A</option>
      </Select>,
    );
    const select = screen.getByRole('combobox');
    select.focus();
    expect(document.activeElement).toBe(select);
  });

  it('Select · state: disabled', () => {
    render(
      <Select aria-label="Engine" disabled>
        <option value="a">A</option>
      </Select>,
    );
    expect((screen.getByRole('combobox') as HTMLSelectElement).disabled).toBe(true);
  });

  it('Select · state: loading — busy and not operable mid-load', () => {
    render(
      <Select aria-label="Engine" loading>
        <option value="a">A</option>
      </Select>,
    );
    const select = screen.getByRole('combobox');
    expect(select.getAttribute('aria-busy')).toBe('true');
    expect((select as HTMLSelectElement).disabled).toBe(true);
  });

  it('Select · state: error — aria-invalid', () => {
    render(
      <Select aria-label="Engine" invalid>
        <option value="a">A</option>
      </Select>,
    );
    expect(screen.getByRole('combobox').getAttribute('aria-invalid')).toBe('true');
  });

  it('Select · state: empty — no options to choose, and it says so', () => {
    render(<Select aria-label="Engine" emptyMessage="No engines are registered" />);
    const select = screen.getByRole('combobox') as HTMLSelectElement;
    expect(select.disabled).toBe(true);
    expect(screen.getByText('No engines are registered')).toBeDefined();
  });
});

describe('Checkbox (T887)', () => {
  it('Checkbox · state: default — a real <input type="checkbox">', () => {
    render(<Checkbox aria-label="Agree" />);
    expect((screen.getByRole('checkbox') as HTMLInputElement).type).toBe('checkbox');
  });

  it('Checkbox · state: hover — the stylesheet declares the hover treatment', () => {
    expectStateRule('.ds-checkbox:hover');
  });

  it('Checkbox · state: focus — keyboard-focusable', () => {
    render(<Checkbox aria-label="Agree" />);
    const box = screen.getByRole('checkbox');
    box.focus();
    expect(document.activeElement).toBe(box);
  });

  it('Checkbox · state: disabled', () => {
    render(<Checkbox aria-label="Agree" disabled />);
    expect((screen.getByRole('checkbox') as HTMLInputElement).disabled).toBe(true);
  });

  it('Checkbox · state: error — aria-invalid', () => {
    render(<Checkbox aria-label="Agree" invalid />);
    expect(screen.getByRole('checkbox').getAttribute('aria-invalid')).toBe('true');
  });

  it('indeterminate is a value, not a state — settable as a property', () => {
    render(<Checkbox aria-label="Agree" />);
    const box = screen.getByRole('checkbox') as HTMLInputElement;
    box.indeterminate = true;
    expect(box.indeterminate).toBe(true);
  });
});

describe('Radio (T887)', () => {
  it('Radio · state: default — a real <input type="radio">, grouped by name', () => {
    render(
      <>
        <Radio name="g" aria-label="One" />
        <Radio name="g" aria-label="Two" />
      </>,
    );
    const radios = screen.getAllByRole('radio') as HTMLInputElement[];
    expect(radios.every((r) => r.type === 'radio' && r.name === 'g')).toBe(true);
  });

  it('Radio · state: hover — the stylesheet declares the hover treatment', () => {
    expectStateRule('.ds-radio:hover');
  });

  it('Radio · state: focus — keyboard-focusable', () => {
    render(<Radio name="g" aria-label="One" />);
    const radio = screen.getByRole('radio');
    radio.focus();
    expect(document.activeElement).toBe(radio);
  });

  it('Radio · state: disabled', () => {
    render(<Radio name="g" aria-label="One" disabled />);
    expect((screen.getByRole('radio') as HTMLInputElement).disabled).toBe(true);
  });

  it('Radio · state: error — aria-invalid', () => {
    render(<Radio name="g" aria-label="One" invalid />);
    expect(screen.getByRole('radio').getAttribute('aria-invalid')).toBe('true');
  });
});

describe('FormField (T887)', () => {
  it('FormField · state: default — a real <label> wired to its control', () => {
    render(
      <FormField id="email" label="Email">
        <TextInput />
      </FormField>,
    );
    const input = screen.getByLabelText('Email');
    expect(input.id).toBe('email');
  });

  it('FormField · state: disabled — the control inherits it', () => {
    render(
      <FormField id="email" label="Email" disabled>
        <TextInput />
      </FormField>,
    );
    expect((screen.getByLabelText('Email') as HTMLInputElement).disabled).toBe(true);
  });

  it('FormField · state: error — the message is ANNOUNCED and tied to the control (FR-DS-021)', () => {
    render(
      <FormField id="email" label="Email" error="Enter a valid email address.">
        <TextInput />
      </FormField>,
    );
    const input = screen.getByLabelText('Email');
    const message = screen.getByText('Enter a valid email address.');
    expect(message.getAttribute('role')).toBe('alert');
    expect(input.getAttribute('aria-invalid')).toBe('true');
    expect(input.getAttribute('aria-describedby')).toContain(message.id);
  });

  it('a hint is tied to the control without being an error', () => {
    render(
      <FormField id="email" label="Email" hint="Work address preferred.">
        <TextInput />
      </FormField>,
    );
    const input = screen.getByLabelText('Email');
    const hint = screen.getByText('Work address preferred.');
    expect(input.getAttribute('aria-describedby')).toContain(hint.id);
  });
});

describe('keyboard operability sweep (FR-DS-033)', () => {
  it('every interactive form component is reachable and operable by keyboard', () => {
    const onClick = vi.fn();
    render(
      <>
        <Button onClick={onClick}>Go</Button>
        <TextInput aria-label="T" />
        <Select aria-label="S">
          <option>x</option>
        </Select>
        <Checkbox aria-label="C" />
        <Radio name="r" aria-label="R" />
      </>,
    );
    for (const role of ['button', 'textbox', 'combobox', 'checkbox', 'radio']) {
      const el = screen.getByRole(role);
      el.focus();
      expect(document.activeElement, `${role} is not focusable`).toBe(el);
    }
    fireEvent.click(screen.getByRole('button'));
    expect(onClick).toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// Phase 9 (T920) — the prototype's four button weights, parity row 7.
// ---------------------------------------------------------------------------

describe('Button · secondary variant (T920, parity row 7)', () => {
  it('is the prototype\u2019s bare .btn — a bordered surface control, still a <button>', () => {
    render(<Button variant="secondary">Export status</Button>);
    const button = screen.getByRole('button', { name: 'Export status' });
    expect(button.tagName).toBe('BUTTON');
    expect(button.className).toContain('ds-button--secondary');
  });

  it('carries the same states the variant-neutral rules give every button', () => {
    render(
      <Button variant="secondary" loading>
        Saving
      </Button>,
    );
    const button = screen.getByRole('button', { name: /saving/i });
    // Loading keeps the label and disables the control, exactly as primary
    // does — a variant is a weight, never a different component.
    expect(button.getAttribute('aria-busy')).toBe('true');
    expect((button as HTMLButtonElement).disabled).toBe(true);
  });

  it('primary remains the default, so no existing caller changed meaning', () => {
    render(<Button>Sign in</Button>);
    expect(screen.getByRole('button', { name: 'Sign in' }).className).toContain(
      'ds-button--primary',
    );
  });
});

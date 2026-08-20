/**
 * T123a — the validation findings panel (FR-017/FR-018, US7).
 * Written to FAIL before T124 exists (Constitution V).
 */
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import { ValidationFindings } from '../../../src/components/ValidationFindings';
import type { ApiClient, Finding } from '../../../src/services/api';

const FINDINGS: Finding[] = [
  { id: 'f1', location: 'section:requirements/FR-003', severity: 'error', message: 'Requirement has no acceptance criterion.' },
  { id: 'f2', location: 'section:overview', severity: 'warning', message: 'Overview references a retired requirement.' },
  { id: 'f3', location: 'section:scope', severity: 'info', message: 'Scope statement is unusually short.' },
];

function api(findings: Finding[] = FINDINGS): ApiClient {
  return { getFindings: vi.fn(async () => findings) } as unknown as ApiClient;
}

afterEach(cleanup);

describe('ValidationFindings (FR-017/FR-018)', () => {
  it('every finding shows its location AND severity — a finding you cannot locate is noise', async () => {
    render(<ValidationFindings api={api()} specificationId="s1" />);
    expect(await screen.findByText('Requirement has no acceptance criterion.')).toBeDefined();
    expect(screen.getByText('section:requirements/FR-003')).toBeDefined();
    expect(screen.getByText('error')).toBeDefined();
    expect(screen.getByText('section:overview')).toBeDefined();
    expect(screen.getByText('warning')).toBeDefined();
    expect(screen.getByText('info')).toBeDefined();
  });

  it('severity is machine-readable on each row, not only a word in prose', async () => {
    render(<ValidationFindings api={api()} specificationId="s1" />);
    await screen.findByText('Requirement has no acceptance criterion.');
    expect(document.querySelectorAll('[data-severity="error"]').length).toBe(1);
    expect(document.querySelectorAll('[data-severity="warning"]').length).toBe(1);
    expect(document.querySelectorAll('[data-severity="info"]').length).toBe(1);
  });

  it('a clean specification says there are no findings', async () => {
    render(<ValidationFindings api={api([])} specificationId="s1" />);
    expect(await screen.findByText(/no findings/i)).toBeDefined();
  });
});

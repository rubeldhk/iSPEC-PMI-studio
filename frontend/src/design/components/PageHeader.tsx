/**
 * T893 (EPIC-029) — PageHeader: a `<header>` landmark whose heading level
 * follows the page (semantic sectioning per D-42). Loading is busy WITHOUT
 * hiding the title — the page's name is not a spinner's hostage.
 * Unit tests: tests/unit/design/structure.spec.tsx (T889).
 */
import { createElement, type ReactElement, type ReactNode } from 'react';
import { LoadingIndicator } from './LoadingIndicator';

export interface PageHeaderProps {
  title: string;
  /** Heading level in the page's outline; the page decides, not the component. */
  level?: 1 | 2 | 3;
  loading?: boolean;
  actions?: ReactNode;
}

export function PageHeader({ title, level = 1, loading = false, actions }: PageHeaderProps): ReactElement {
  return (
    <header className="ds-page-header">
      {createElement(`h${level}`, { className: 'ds-page-header__title' }, title)}
      {loading && <LoadingIndicator label="Loading" />}
      {actions && <div className="ds-page-header__actions">{actions}</div>}
    </header>
  );
}

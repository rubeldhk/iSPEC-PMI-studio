/**
 * T893 (EPIC-029) — Table, built on `<table>` (D-42): real row/cell
 * semantics; the filtering is ours (FR-DS-041, MUST). Loading, error and
 * empty each explain themselves inside the grid rather than blanking it
 * (FR-DS-021, FR-DS-022).
 * Unit tests: tests/unit/design/structure.spec.tsx (T889).
 */
import { useId, useState, type ReactElement, type ReactNode } from 'react';
import { EmptyState } from './EmptyState';
import { ErrorState } from './ErrorState';
import { LoadingIndicator } from './LoadingIndicator';

export interface TableColumn {
  key: string;
  header: string;
}

export interface TableProps {
  caption: string;
  columns: TableColumn[];
  rows: Array<Record<string, ReactNode>>;
  /** Label for the built-in filter (FR-DS-041). */
  filterLabel?: string;
  rowKey?: (row: Record<string, ReactNode>, index: number) => string;
  loading?: boolean;
  error?: string;
  errorAction?: string;
  emptyTitle?: string;
  emptyExplanation?: string;
}

export function Table({
  caption,
  columns,
  rows,
  filterLabel = 'Filter rows',
  rowKey = (_row, index) => String(index),
  loading = false,
  error,
  errorAction = 'Try again.',
  emptyTitle = 'Nothing here yet',
  emptyExplanation = 'No rows have been added.',
}: TableProps): ReactElement {
  const filterId = useId();
  const [filter, setFilter] = useState('');

  const needle = filter.trim().toLowerCase();
  const visible = needle
    ? rows.filter((row) =>
        columns.some((c) => String(row[c.key] ?? '').toLowerCase().includes(needle)),
      )
    : rows;

  const showFilter = !loading && !error && rows.length > 0;

  return (
    <div className="ds-table-wrap">
      {showFilter && (
        <p className="ds-table__filter">
          <label className="ds-field__label" htmlFor={filterId}>
            {filterLabel}
          </label>
          <input
            id={filterId}
            type="search"
            className="ds-input"
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
          />
        </p>
      )}
      <table className="ds-table" aria-busy={loading || undefined}>
        <caption className="ds-table__caption">{caption}</caption>
        <thead>
          <tr>
            {columns.map((c) => (
              <th key={c.key} scope="col">
                {c.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {loading ? (
            <tr>
              <td colSpan={columns.length}>
                <LoadingIndicator label="Loading rows" />
              </td>
            </tr>
          ) : error ? (
            <tr>
              <td colSpan={columns.length}>
                <ErrorState message={error} action={errorAction} />
              </td>
            </tr>
          ) : rows.length === 0 ? (
            <tr>
              <td colSpan={columns.length}>
                <EmptyState title={emptyTitle} explanation={emptyExplanation} />
              </td>
            </tr>
          ) : visible.length === 0 ? (
            <tr>
              <td colSpan={columns.length} className="ds-table__no-match">
                No rows match “{filter}”.
              </td>
            </tr>
          ) : (
            visible.map((row, i) => (
              <tr key={rowKey(row, i)} tabIndex={-1}>
                {columns.map((c) => (
                  <td key={c.key}>{row[c.key]}</td>
                ))}
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
}

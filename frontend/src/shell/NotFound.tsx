/**
 * T436l (EPIC-036) — a real not-found.
 *
 * `FR-SHL-017`: an address naming an area the shell does not host answers as
 * **not found**, never as an empty area inside working chrome. The two look
 * almost identical and mean completely different things — one says *"you have
 * arrived and there is nothing here"*, the other says *"there is no here"*.
 *
 * `DEF-001-006` is `EPIC-001`'s open defect: every unmatched path in the **API**
 * answers `500` rather than `404`, because `ErrorFilter` is a bare `@Catch()`.
 * That is not this Epic's to fix, and this page must not add to it.
 *
 * **Two different not-founds, told apart.** An address naming an area that is
 * specified but not delivered gets the area's own note and the Epic that owes
 * it — because *"that screen is not built yet"* is a more useful answer than
 * *"no such page"*, and it is true. Everything else gets the plain answer.
 *
 * Unit tests: `frontend/tests/unit/shell/routes.spec.tsx` (T436j),
 * `frontend/tests/unit/shell/addresses.spec.tsx` (T437n).
 */
import type { ReactElement } from 'react';
import { Link, useLocation } from 'react-router';
import { EmptyState } from '../design/components/EmptyState';
import { PageHeader } from '../design/components/PageHeader';
import { areaForPathname } from './shell-context';

export function NotFound(): ReactElement {
  const { pathname } = useLocation();
  const area = areaForPathname(pathname);
  const specified = area !== undefined && area.status !== 'delivered';

  return (
    <main>
      <PageHeader
        title="Not found"
        description={
          specified
            ? `${area.label} is part of the product and is not built yet.`
            : 'There is no page at this address.'
        }
      />
      <EmptyState
        title={specified ? `${area.label} is not available yet` : `Nothing at ${pathname}`}
        explanation={
          specified
            ? `${area.note ?? 'This area is specified but not built.'}${
                area.epic === null ? '' : ` Owner: ${area.epic}.`
              }`
            : 'Check the address, or start from Home.'
        }
      />
      <p>
        <Link to="/">Go to Home</Link>
      </p>
    </main>
  );
}

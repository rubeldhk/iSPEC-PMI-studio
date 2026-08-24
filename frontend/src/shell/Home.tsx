/**
 * T439h / T439k (EPIC-036) — Home: what is waiting for you.
 *
 * `BR-0192` requires decision visibility and has had no surface. This is it,
 * and it delivers **attention items only** — `BR-0013`'s derived project health
 * left this Epic at clarification, owner `U-03`.
 *
 * **Four states, distinguishable** (`FR-SHL-060`): loading, empty, error and
 * partial. The fourth is the one that matters here, because Home is partial by
 * construction: one of its three sources exists. `FR-SHL-062` forbids rendering
 * a failure — or an absence — as an empty state, so each section says which of
 * the three it is.
 *
 * Unit tests: `frontend/tests/unit/shell/Home.spec.tsx` (T439g, T439i, T439j).
 */
import { useEffect, useState, type ReactElement } from 'react';
import { Link, useNavigate } from 'react-router';
import { EmptyState } from '../design/components/EmptyState';
import { ErrorState } from '../design/components/ErrorState';
import { LoadingIndicator } from '../design/components/LoadingIndicator';
import { PageHeader } from '../design/components/PageHeader';
import { StatusPill } from '../design/components/StatusPill';
import {
  ATTENTION_KINDS,
  KIND_LABELS,
  homeModel,
  type AttentionKind,
  type HomeModel,
} from './home-model';
import { missingEvidence, pendingApprovals, policyBlocks } from './home-sources';
import { useShell } from './shell-context';
import type { ApiClient } from '../services/api';

async function load(api: ApiClient, projectId: string): Promise<HomeModel> {
  return homeModel([await pendingApprovals(api, projectId), policyBlocks(), missingEvidence()]);
}

/**
 * Where a user goes when a section has nothing in it — `T441w`, `FR-SHL-061`.
 *
 * *"Say what is absent"* was done; *"and what to do next"* was not. An empty
 * state with no way forward is a dead end wearing a friendly face, and the
 * `EmptyState` component has taken an action since `EPIC-029` built it.
 *
 * Only `pending-approval` has one, because only that source exists. Offering a
 * next step for a section whose Epic is unbuilt would send the user somewhere
 * that cannot help them, which is worse than offering none.
 */
const NEXT_STEP: Partial<Record<AttentionKind, { label: string; href: string }>> = {
  'pending-approval': { label: 'See all runs', href: '/runs' },
};

function Section({ kind, model }: { kind: AttentionKind; model: HomeModel }): ReactElement {
  const source = model.sources.find((candidate) => candidate.kind === kind)!;
  const items = model.items.filter((item) => item.kind === kind);
  const next = NEXT_STEP[kind];
  const navigate = useNavigate();

  return (
    <section aria-label={KIND_LABELS[kind]}>
      <h2>{KIND_LABELS[kind]}</h2>

      {/* Three different reasons a section can show no items, told apart.
          `FR-SHL-062`: a failure is not an empty state, and neither is a
          source that does not exist. */}
      {source.state === 'failed' && (
        <ErrorState
          message={`This section could not be loaded. ${source.reason ?? ''}`.trim()}
          action="Reload the page. If it keeps failing, the runs service is the place to look."
        />
      )}

      {source.state === 'unavailable' && (
        <div role="note">
          <StatusPill tone="warning">Not available</StatusPill>
          <p>{source.reason}</p>
        </div>
      )}

      {source.state === 'available' && items.length === 0 && (
        <EmptyState
          title={`Nothing ${KIND_LABELS[kind].toLowerCase()}`}
          explanation="This section is working and has nothing to show for the current project."
          {...(next
            ? {
                actionLabel: next.label,
                onAction: (): void => {
                  void navigate(next.href);
                },
              }
            : {})}
        />
      )}

      {items.length > 0 && (
        <ul>
          {items.map((item) => (
            <li key={`${item.kind}:${item.href}:${item.subject}`}>
              <Link to={item.href}>{item.subject}</Link>
              <span> · project {item.projectId}</span>
              {/* `FR-SHL-033`, `BR-0174` — a policy block carries the policy
                  that produced it, not merely that something is blocked. */}
              {item.detail !== undefined && <p>{item.detail}</p>}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

export function Home(): ReactElement {
  const { api, projectId } = useShell();
  const navigate = useNavigate();
  const [model, setModel] = useState<HomeModel | null>(null);

  useEffect(() => {
    let live = true;
    if (projectId === null) {
      setModel(null);
      return (): void => {
        live = false;
      };
    }
    setModel(null);
    void load(api, projectId).then((next) => {
      if (live) setModel(next);
    });
    return (): void => {
      live = false;
    };
  }, [api, projectId]);

  if (projectId === null) {
    return (
      <main>
        <PageHeader title="Home" description="What is waiting for you." />
        <EmptyState
          title="No project selected"
          explanation="Home shows what is waiting in one project at a time."
          actionLabel="Choose a project"
          onAction={(): void => {
            void navigate('/projects');
          }}
        />
      </main>
    );
  }

  if (model === null) {
    return (
      <main>
        <PageHeader title="Home" description="What is waiting for you." />
        <LoadingIndicator label="Loading what is waiting for you…" />
      </main>
    );
  }

  const workingSources = model.sources.filter((source) => source.state === 'available').length;

  return (
    <main>
      <PageHeader title="Home" description="What is waiting for you." />
      {workingSources < model.sources.length && (
        // The partial state, stated once at the top rather than left for the
        // reader to infer from three sections that look different.
        <p role="status">
          Showing {workingSources} of {model.sources.length} sources. The rest say why below.
        </p>
      )}
      {ATTENTION_KINDS.map((kind) => (
        <Section key={kind} kind={kind} model={model} />
      ))}
    </main>
  );
}

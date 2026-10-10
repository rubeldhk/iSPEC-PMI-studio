/**
 * `T1974` (EPIC-047) — the Engineering Experts screen. Unit test: `T1973`.
 *
 * `FR-EXP-070`…`FR-EXP-076`. A **view-only** registry in the Delivery group:
 * the roster, one Expert's contract and versions, a comparison of any two, its
 * recent runs, and a run's delegation tree inline. Contracts are authored
 * through the API and approved in the Decision Inbox, so this page offers no
 * authoring controls at all (`FR-EXP-076`) — a button that could not work
 * without an administrator role would be worse than no button.
 *
 * Limits that were enforced and limits the provider could not enforce are
 * labelled differently in words, not only in colour (`UX-0031`): "not
 * enforced" is a fact a reviewer must not be able to miss. No tables, so the
 * page reflows at 360px (`UX-0040`).
 */
import { useEffect, useState, type ReactElement } from 'react';
import {
  ApiError,
  type ApiClient,
  type ExpertContractView,
  type ExpertDetail,
  type ExpertElementDifference,
  type ExpertSessionLimit,
  type ExpertSessionSummary,
  type ExpertSessionView,
  type ExpertSummary,
  type ExpertTreeNode,
} from '../services/api';

export interface ExpertsPageProps {
  api: ApiClient;
}

const failure = (err: unknown): string =>
  err instanceof ApiError ? err.message : 'Something went wrong. Please try again.';

export function ExpertsPage({ api }: ExpertsPageProps): ReactElement {
  const [experts, setExperts] = useState<ExpertSummary[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [openId, setOpenId] = useState<string | null>(null);

  useEffect(() => {
    void (async (): Promise<void> => {
      try {
        setExperts(await api.listExperts());
      } catch (err) {
        setError(failure(err));
      }
    })();
  }, [api]);

  if (error !== null) {
    return (
      <section>
        <p role="alert">{error}</p>
      </section>
    );
  }
  if (experts === null) {
    return (
      <section>
        <p>Loading…</p>
      </section>
    );
  }

  return (
    <section aria-label="Engineering Experts">
      <h2>Engineering Experts</h2>
      {experts.length === 0 ? (
        <p>No Engineering Experts are registered in this workspace yet.</p>
      ) : (
        <ul>
          {experts.map((e) => (
            <li key={e.id} aria-label={e.key}>
              <strong>{e.name}</strong> <code>{e.key}</code>
              <p>{e.rolePurpose}</p>
              <p>
                <span>Risk: {e.riskClass}</span>
                {' · '}
                <span>{e.effectiveVersion === null ? 'no approved version' : `approved v${e.effectiveVersion}`}</span>
                {' · '}
                <span>{e.status}</span>
              </p>
              <button type="button" aria-label={`Open ${e.key}`} onClick={(): void => setOpenId(e.id)}>
                Open
              </button>
            </li>
          ))}
        </ul>
      )}
      {openId !== null ? <ExpertDetailView api={api} id={openId} /> : null}
    </section>
  );
}

function ExpertDetailView({ api, id }: { api: ApiClient; id: string }): ReactElement {
  const [detail, setDetail] = useState<ExpertDetail | null>(null);
  const [runs, setRuns] = useState<ExpertSessionSummary[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [diff, setDiff] = useState<{ from: number; to: number; rows: ExpertElementDifference[] } | null>(null);
  const [runId, setRunId] = useState<string | null>(null);
  // `T2011`, `FR-EXP-072` — any two versions; defaults to the oldest and the newest.
  const [from, setFrom] = useState<number | null>(null);
  const [to, setTo] = useState<number | null>(null);
  // `T2011`, `FR-EXP-071` — any version's contract, approved or not.
  const [viewed, setViewed] = useState<number | null>(null);

  useEffect(() => {
    void (async (): Promise<void> => {
      try {
        const loaded = await api.getExpert(id);
        setDetail(loaded);
        setFrom(loaded.versions[0]?.version ?? null);
        setTo(loaded.versions[loaded.versions.length - 1]?.version ?? null);
        setRuns(await api.expertSessions(id));
      } catch (err) {
        setError(failure(err));
      }
    })();
  }, [api, id]);

  if (error !== null) return <p role="alert">{error}</p>;
  if (detail === null) return <p>Loading…</p>;

  const versions = detail.versions;
  const shown = viewed === null ? undefined : versions.find((v) => v.version === viewed);
  const compare = (a: number, b: number): void => {
    void (async (): Promise<void> => {
      try {
        setDiff({ from: a, to: b, rows: await api.compareExpertVersions(id, a, b) });
      } catch (err) {
        setError(failure(err));
      }
    })();
  };

  return (
    <article aria-label={`Expert ${detail.expert.key}`}>
      <h3>
        {detail.expert.name} <code>{detail.expert.key}</code> — {detail.expert.status}
      </h3>

      <section aria-label="Effective contract">
        <h4>Effective contract</h4>
        {detail.effectiveVersion === null ? (
          <p>No version is approved, so nothing may run under this Expert.</p>
        ) : (
          <ContractView version={detail.effectiveVersion.version} contract={detail.effectiveVersion.contract} />
        )}
      </section>

      <section aria-label="Versions">
        <h4>Versions</h4>
        <ul>
          {versions.map((v) => (
            <li key={v.id}>
              v{v.version} — {v.status} — by {v.createdBy}{' '}
              <button type="button" aria-label={`View v${v.version} contract`} onClick={(): void => setViewed(v.version)}>
                View contract
              </button>
            </li>
          ))}
        </ul>
        {versions.length > 1 && from !== null && to !== null ? (
          <p>
            <label>
              Compare from{' '}
              <select aria-label="Compare from" value={from} onChange={(e): void => setFrom(Number(e.target.value))}>
                {versions.map((v) => (
                  <option key={v.id} value={v.version}>
                    v{v.version}
                  </option>
                ))}
              </select>
            </label>{' '}
            <label>
              to{' '}
              <select aria-label="Compare to" value={to} onChange={(e): void => setTo(Number(e.target.value))}>
                {versions.map((v) => (
                  <option key={v.id} value={v.version}>
                    v{v.version}
                  </option>
                ))}
              </select>
            </label>{' '}
            <button
              type="button"
              aria-label={`Compare v${from} and v${to}`}
              disabled={from === to}
              onClick={(): void => compare(from, to)}
            >
              Compare v{from} and v{to}
            </button>
          </p>
        ) : null}
      </section>

      {shown !== undefined ? (
        <section aria-label={`Contract v${shown.version}`}>
          <h4>Contract v{shown.version}</h4>
          <p>
            {shown.status} — by {shown.createdBy}
          </p>
          <ContractView version={shown.version} contract={shown.contract} />
        </section>
      ) : null}

      {diff !== null ? (
        <section aria-label={`Comparison of v${diff.from} and v${diff.to}`}>
          <h4>
            Comparison of v{diff.from} and v{diff.to}
          </h4>
          <ul>
            {diff.rows.map((d) => (
              <li key={d.element}>
                {d.element}: {d.changed ? 'changed' : 'unchanged'}
                {d.changed ? (
                  <span>
                    {' '}
                    ({JSON.stringify(d.from)} → {JSON.stringify(d.to)})
                  </span>
                ) : null}
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <section aria-label="Recent runs">
        <h4>Recent runs</h4>
        {runs.length === 0 ? (
          <p>No runs yet.</p>
        ) : (
          <ul>
            {runs.map((r) => (
              <li key={r.executionId}>
                <code>{r.executionId}</code> — {r.outcome ?? 'running'} on {r.model}
                {r.usedFallback ? ' (fallback)' : ''}{' '}
                <button type="button" aria-label={`Open run ${r.executionId}`} onClick={(): void => setRunId(r.executionId)}>
                  Open run
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>

      {runId !== null ? <RunView api={api} executionId={runId} /> : null}
    </article>
  );
}

function ContractView({ version, contract }: { version: number; contract: ExpertContractView }): ReactElement {
  const limits = Object.entries(contract.budget);
  return (
    <dl>
      <dt>Version</dt>
      <dd>v{version}</dd>
      <dt>Role and purpose</dt>
      <dd>{contract.rolePurpose}</dd>
      <dt>Models</dt>
      <dd>
        {contract.models.preferred}
        {contract.models.fallbacks.length > 0 ? `, then ${contract.models.fallbacks.join(', ')}` : ''}
      </dd>
      <dt>Capabilities and tools</dt>
      <dd>
        {contract.capabilities.join(', ')} · tools: {contract.allowedTools.join(', ') || 'none'}
      </dd>
      <dt>Context policy</dt>
      <dd>{describeContextPolicy(contract.contextPolicy)}</dd>
      <dt>Workspace requirements</dt>
      <dd>{describeWorkspace(contract.workspaceRequirements)}</dd>
      <dt>Prohibited actions</dt>
      <dd>{contract.prohibitedActions.join(', ') || 'none'}</dd>
      <dt>Permissions</dt>
      <dd>{contract.permissions.map((p) => `${p.action} ${p.artifactType}`).join(', ') || 'none'}</dd>
      <dt>Risk class</dt>
      <dd>{contract.riskClass}</dd>
      <dt>Budget</dt>
      <dd>
        {limits.map(([kind, s]) => `${kind} ${s?.value ?? ''}${s?.onUnenforceable ? ` (if unenforceable: ${s.onUnenforceable})` : ''}`).join('; ')}
      </dd>
      <dt>Memory policy</dt>
      <dd>{contract.memoryPolicy}</dd>
      <dt>Expected outputs</dt>
      <dd>{contract.expectedOutputs.map((o) => `${o.kind}${o.required ? '' : ' (optional)'}`).join(', ')}</dd>
      <dt>Evidence Contract</dt>
      <dd>
        {contract.evidenceContract.workClass}@{contract.evidenceContract.contractVersion}
      </dd>
      <dt>May delegate to</dt>
      <dd>{contract.delegatesTo.join(', ') || 'no one'}</dd>
    </dl>
  );
}

const describeContextPolicy = (p: ExpertContractView['contextPolicy']): string =>
  [
    `${p.budgetTokens} tokens, cost ${p.budgetCost}`,
    p.includeLiveState ? 'live state included' : 'live state not included',
    ...(p.essentialSources && p.essentialSources.length > 0
      ? [`essential: ${p.essentialSources.map((s) => `${s.sourceType} ${s.sourceId}`).join(', ')}`]
      : []),
  ].join('; ');

const describeWorkspace = (w: ExpertContractView['workspaceRequirements']): string => {
  const parts = [
    ...(w.executionType ? [`execution: ${w.executionType}`] : []),
    ...(w.repositoryAccess && w.repositoryAccess.length > 0 ? [`repository: ${w.repositoryAccess.join(', ')}`] : []),
    ...(w.supportsUnattended ? ['must support unattended runs'] : []),
  ];
  return parts.length > 0 ? parts.join('; ') : 'none stated';
};

function RunView({ api, executionId }: { api: ApiClient; executionId: string }): ReactElement {
  const [view, setView] = useState<ExpertSessionView | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void (async (): Promise<void> => {
      try {
        setView(await api.expertSession(executionId));
      } catch (err) {
        setError(failure(err));
      }
    })();
  }, [api, executionId]);

  if (error !== null) return <p role="alert">{error}</p>;
  if (view === null) return <p>Loading…</p>;
  const s = view.session;

  return (
    <section aria-label={`Run ${executionId}`}>
      <h4>Run {executionId}</h4>
      <p>
        {s.outcome ?? 'running'} on {s.model}
        {s.usedFallback ? ` — fallback: ${s.fallbackReason ?? 'reason not recorded'}` : ''}
      </p>
      <p>{s.toolObservation === 'unobserved' ? 'Tool use unobserved — the provider does not report its tool calls' : 'Tool use observed'}</p>
      {s.reviewRequired ? <p>Unattended work — requires review before it counts.</p> : null}

      <h5>Limits</h5>
      <ul>
        {view.limits.map((l) => (
          <li key={l.limit}>
            <LimitLine limit={l} />
          </li>
        ))}
      </ul>

      <h5>Delegation</h5>
      <ul role="tree" aria-label="Delegation tree">
        {view.tree.ancestors.map((a) => (
          <li role="treeitem" key={a.executionId} aria-selected={false}>
            {describeNode(a)} (delegated this run)
          </li>
        ))}
        <TreeItem node={view.tree.node} current={executionId} />
      </ul>
    </section>
  );
}

function LimitLine({ limit }: { limit: ExpertSessionLimit }): ReactElement {
  const consumed =
    limit.consumed === null ? `consumption not reported${limit.consumedReason ? ` (${limit.consumedReason})` : ''}` : `consumed ${limit.consumed}`;
  const reached =
    limit.reached === 'stopped' ? ' — stopped the run' : limit.reached === 'detected-late' ? ' — exceeded, detected late' : '';
  return (
    <span data-enforcement={limit.enforcement}>
      {limit.limit} {limit.value} — {limit.enforcement === 'enforced' ? 'enforced' : 'not enforced: the provider has no control for it'};{' '}
      {consumed}
      {reached}
    </span>
  );
}

const describeNode = (n: ExpertTreeNode): string =>
  `${n.expertKey} v${n.contractVersion ?? '?'} — ${n.outcome ?? 'running'} (${n.executionId})`;

function TreeItem({ node, current }: { node: ExpertTreeNode; current: string }): ReactElement {
  const children = node.children ?? [];
  return (
    <li role="treeitem" aria-selected={node.executionId === current} aria-expanded={children.length > 0 ? true : undefined}>
      {describeNode(node)}
      {children.length > 0 ? (
        <ul role="group">
          {children.map((c) => (
            <TreeItem key={c.executionId} node={c} current={current} />
          ))}
        </ul>
      ) : null}
    </li>
  );
}

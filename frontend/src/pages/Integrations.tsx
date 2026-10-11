/**
 * `T2207` (EPIC-039, `US8`, `FR-HUB-071`–`FR-HUB-075`) — the Integrations
 * screen. Unit test: `T2206`.
 *
 * A **view-only** registry in the Platform group: what the platform is
 * connected to, in which direction, by which transport, serving which
 * capabilities, at which version, and whether it is healthy and configured for
 * the selected project. Opening an entry shows its health history and its
 * recent resolutions, each refusal explained candidate by candidate in place
 * (`UX-0032`).
 *
 * - **No configuration control** (`FR-HUB-074`): the only controls are the
 *   filter and the disclosure toggles. Configuration and credentials go through
 *   the API, and the screen says so.
 * - **A value or a reason** (`FR-HUB-023`, `FR-HUB-073`): a *not applicable*
 *   field is drawn differently from a value and says why, in words.
 * - **Health in words** (`UX-0031`): each state has its own style, a
 *   `data-health` attribute and an `aria-label` — never colour alone.
 * - **Lists, not tables**, so a row wraps instead of scrolling at 360px (`UX-0040`).
 * - It reads through `integrations.client.ts`, which has no write function.
 */
import { useEffect, useMemo, useState, type ReactElement } from 'react';
import type { EntryDetail, EntryView, Fact, IntegrationsReadClient } from '../services/integrations.client';

export interface IntegrationsPageProps {
  client: IntegrationsReadClient;
  /** Configuration and health are per project; without one they read *not applicable*. */
  projectId?: string | null;
}

const message = (err: unknown): string => (err instanceof Error && err.message ? err.message : 'The registry could not be read.');

function capabilitiesOf(e: EntryView): string[] {
  if (!e.compatibility.applicable) return [];
  const caps = (e.compatibility.value as { capabilities?: { name: string; majors: number[] }[] }).capabilities;
  return Array.isArray(caps) ? caps.map((c) => `${c.name} ${c.majors.join(', ')}`) : [];
}

function healthState(e: EntryView): string {
  return e.health.applicable ? e.health.value.state : 'not-applicable';
}

function NotApplicable({ label, reason }: { label: string; reason: string }): ReactElement {
  return (
    <span className="integrations__fact integrations__fact--not-applicable" data-fact="not-applicable" aria-label={`${label}: not applicable — ${reason}`}>
      <em>Not applicable</em> — {reason}
    </span>
  );
}

function FactText<T>({ label, fact, render }: { label: string; fact: Fact<T>; render: (v: T) => string }): ReactElement {
  if (!fact.applicable) return <NotApplicable label={label} reason={fact.reason} />;
  return (
    <span className="integrations__fact" data-fact="value">
      {render(fact.value)}
    </span>
  );
}

function Health({ entry }: { entry: EntryView }): ReactElement {
  if (!entry.health.applicable) return <NotApplicable label="Health" reason={entry.health.reason} />;
  const { state, reason, checkedAt } = entry.health.value;
  const words = `${state}${reason ? ` — ${reason}` : ''}`;
  return (
    <span className={`integrations__health integrations__health--${state}`} data-health={state} aria-label={`Health: ${words}`}>
      {words}
      {checkedAt ? <small> (checked {checkedAt})</small> : null}
    </span>
  );
}

function Detail({ detail }: { detail: EntryDetail }): ReactElement {
  return (
    <div className="integrations__detail">
      <h4>Health history</h4>
      {detail.healthHistory.length === 0 ? (
        <p>No health check recorded.</p>
      ) : (
        <ul>
          {detail.healthHistory.map((h, i) => (
            <li key={`${h.checkedAt}-${i}`} data-health={h.state}>
              {h.checkedAt}: {h.state}
              {h.reason ? ` — ${h.reason}` : ''} ({h.source}){h.retryAfterSeconds !== null ? `, retry after ${h.retryAfterSeconds} s` : ''}
            </li>
          ))}
        </ul>
      )}
      <h4>Recent resolutions</h4>
      {detail.resolutions.length === 0 ? (
        <p>No resolution recorded.</p>
      ) : (
        <ul>
          {detail.resolutions.map((r) => (
            <li key={r.id} data-outcome={r.outcome}>
              <p>
                {r.decidedAt} · {r.capability} for {r.caller}: <strong>{r.outcome}</strong>
                {r.outcome === 'resolved' && r.adapterKey ? ` to ${r.adapterKey}${r.contractVersion ? ` (contract ${r.contractVersion})` : ''}` : ''}
                {r.refusal ? ` — ${r.refusal.code}` : ''}
              </p>
              {r.refusal ? (
                <>
                  <p>{r.refusal.message}</p>
                  <ul aria-label="Why each candidate was not chosen">
                    {r.refusal.candidates.map((c) => (
                      <li key={c.entryKey}>
                        {c.entryKey} — {c.ineligibleBecause ?? 'eligible'}
                        {c.detail ? `: ${c.detail}` : ''}
                      </li>
                    ))}
                  </ul>
                </>
              ) : null}
              {r.eligibleBecause && r.eligibleBecause.length > 0 ? <p>Eligible because: {r.eligibleBecause.join(', ')}</p> : null}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function Entry({ entry, client, projectId }: { entry: EntryView; client: IntegrationsReadClient; projectId?: string }): ReactElement {
  const [open, setOpen] = useState(false);
  const [detail, setDetail] = useState<EntryDetail | null>(null);
  const [error, setError] = useState<string | null>(null);
  const headingId = `integration-${entry.id}`;
  const toggle = (): void => {
    const next = !open;
    setOpen(next);
    if (next && detail === null) {
      client.entryDetail(entry.id, projectId).then(setDetail, (err: unknown) => setError(message(err)));
    }
  };
  return (
    <li className="integrations__entry" aria-label={`${entry.name} integration`}>
      <h3 id={headingId}>{entry.name}</h3>
      <dl className="integrations__facts">
        <dt>Direction</dt>
        <dd>{entry.direction}</dd>
        <dt>Provider</dt>
        <dd>
          <FactText label="Provider" fact={entry.provider} render={(v) => v} />
        </dd>
        <dt>Transport</dt>
        <dd>
          <FactText label="Transport" fact={entry.transport} render={(v) => v} />
        </dd>
        <dt>Capabilities</dt>
        <dd>{entry.direction === 'inbound' ? 'none — an inbound connector is never resolved for a capability' : capabilitiesOf(entry).join('; ') || 'none'}</dd>
        <dt>Version</dt>
        <dd>
          <FactText label="Version" fact={entry.version} render={(v) => v} />
        </dd>
        <dt>Health</dt>
        <dd>
          <Health entry={entry} />
        </dd>
        <dt>Configuration</dt>
        <dd>
          <FactText label="Configuration" fact={entry.configuration} render={(v) => `${v.state}${v.setBy ? ` by ${v.setBy}` : ''}${v.setAt ? ` at ${v.setAt}` : ''}`} />
        </dd>
        <dt>Status</dt>
        <dd>{entry.status}</dd>
      </dl>
      <button type="button" aria-expanded={open} aria-controls={`${headingId}-detail`} onClick={toggle}>
        Details for {entry.name}
      </button>
      {open ? (
        <div id={`${headingId}-detail`}>
          {error !== null ? <p role="alert">{error}</p> : detail === null ? <p>Loading…</p> : <Detail detail={detail} />}
        </div>
      ) : null}
    </li>
  );
}

export function IntegrationsPage({ client, projectId }: IntegrationsPageProps): ReactElement {
  const [entries, setEntries] = useState<readonly EntryView[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [direction, setDirection] = useState('');
  const [health, setHealth] = useState('');
  const [capability, setCapability] = useState('');
  const [text, setText] = useState('');
  const project = projectId ?? undefined;

  useEffect(() => {
    let live = true;
    client.listRegistry(project).then(
      (r) => {
        if (live) setEntries([...r.entries].sort((a, b) => a.listedOrder - b.listedOrder));
      },
      (err: unknown) => {
        if (live) setError(message(err));
      },
    );
    return () => {
      live = false;
    };
  }, [client, project]);

  const capabilityNames = useMemo(() => [...new Set((entries ?? []).flatMap((e) => capabilitiesOf(e).map((c) => c.split(' ')[0]!)))].sort(), [entries]);
  const shown = (entries ?? []).filter(
    (e) =>
      (direction === '' || e.direction === direction) &&
      (health === '' || healthState(e) === health) &&
      (capability === '' || capabilitiesOf(e).some((c) => c.startsWith(`${capability} `))) &&
      (text === '' || `${e.name} ${e.key}`.toLowerCase().includes(text.toLowerCase())),
  );

  return (
    <section className="integrations" aria-labelledby="integrations-heading">
      <h1 id="integrations-heading">Integrations</h1>
      <p>What the platform is connected to, and whether each connection is healthy. Configuration is through the API: the project owner sets adapters and credentials there, and nothing on this screen changes them.</p>
      {projectId ? null : <p>No project selected — configuration and health read “not applicable” until one is.</p>}
      <div className="integrations__filter" role="search" aria-label="Filter integrations">
        <label>
          Direction
          <select value={direction} onChange={(e) => setDirection(e.target.value)}>
            <option value="">Any</option>
            <option value="outbound">outbound</option>
            <option value="inbound">inbound</option>
          </select>
        </label>
        <label>
          Health
          <select value={health} onChange={(e) => setHealth(e.target.value)}>
            <option value="">Any</option>
            <option value="healthy">healthy</option>
            <option value="degraded">degraded</option>
            <option value="unhealthy">unhealthy</option>
            <option value="unknown">unknown</option>
            <option value="not-applicable">not applicable</option>
          </select>
        </label>
        <label>
          Capability
          <select value={capability} onChange={(e) => setCapability(e.target.value)}>
            <option value="">Any</option>
            {capabilityNames.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        </label>
        <label>
          Search
          <input type="search" value={text} onChange={(e) => setText(e.target.value)} />
        </label>
      </div>
      {error !== null ? (
        <p role="alert">{error}</p>
      ) : entries === null ? (
        <p>Loading the registry…</p>
      ) : shown.length === 0 ? (
        <p>No integration matches the filter.</p>
      ) : (
        <ul className="integrations__list">
          {shown.map((e) => (
            <Entry key={e.id} entry={e} client={client} {...(project ? { projectId: project } : {})} />
          ))}
        </ul>
      )}
    </section>
  );
}

/**
 * `T2514` — the Decision Inbox detail-renderer registry. `FR-DPE-027`
 * (amendment `A-031-2`, for `EPIC-048`).
 *
 * An Epic that owns an object type registers how an Inbox entry for it is
 * shown — `EPIC-048` registers its learning-candidate view for
 * `learning-candidate`. **Additive**: an entry whose type has no renderer
 * renders exactly as before.
 *
 * A renderer only adds detail inside the entry. It receives the entry and
 * nothing else — no API client, no callbacks — so it cannot change which
 * entries appear, their order, what blocks them, or the actions offered: the
 * Inbox renders all of those itself, around it.
 */
import type { ComponentType } from 'react';
import type { InboxEntry } from '../services/api';

export type InboxDetailRenderer = ComponentType<{ entry: InboxEntry }>;

export interface InboxRendererRegistry {
  /** One renderer per object type; a second registration for a type throws. */
  register(objectType: string, renderer: InboxDetailRenderer): void;
  rendererFor(objectType: string): InboxDetailRenderer | undefined;
}

export function createInboxRendererRegistry(): InboxRendererRegistry {
  const renderers = new Map<string, InboxDetailRenderer>();
  return {
    register(objectType, renderer) {
      if (renderers.has(objectType)) {
        throw new Error(`An Inbox detail renderer for "${objectType}" is already registered; one owner per type.`);
      }
      renderers.set(objectType, renderer);
    },
    rendererFor: (objectType) => renderers.get(objectType),
  };
}

/** The application's registry — what `DecisionInboxPage` reads unless given another. */
export const inboxRenderers: InboxRendererRegistry = createInboxRendererRegistry();

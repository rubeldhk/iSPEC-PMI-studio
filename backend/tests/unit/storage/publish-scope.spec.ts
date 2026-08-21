/**
 * T818 — a publish covers the WHOLE project and no artifact-subset selection
 * is offered, so FR-PUB-036's preview always compares against a
 * whole-project baseline: a deselected file must not be EXPRESSIBLE,
 * because it cannot be told apart from a deleted one (FR-PUB-032).
 */
import { describe, expect, it } from 'vitest';
import { PublishService } from '../../../src/modules/storage/publish.service.js';
import { WS, USER, PROJECT, storageHarness, connected } from './helpers.js';

describe('T818 · whole-project publish scope', () => {
  it('a publish covers every artifact of the project', async () => {
    const h = storageHarness();
    const { artifacts } = await connected(h, 5);
    const record = await h.publish.publish(WS, PROJECT, USER);
    expect(record.artifactsIncluded.map((a) => a.artifactId).sort()).toEqual(
      artifacts.map((a) => a.artifactId).sort(),
    );
    expect(record.artifactsIncluded.every((a) => a.landed)).toBe(true);
  });

  it('no artifact-subset selection is expressible — the signature has no parameter for one', () => {
    // Structural: publish(workspaceId, projectId, initiatedById, at?). A
    // subset cannot be passed because nothing accepts it — Function.length
    // counts the declared parameters.
    expect(PublishService.prototype.publish.length).toBeLessThanOrEqual(4);
    const source = PublishService.prototype.publish.toString();
    expect(source).not.toMatch(/artifactIds|subset|selection|include\b/);
  });

  it('the only omissions are access exclusions, and those are reported (FR-PUB-033)', async () => {
    const h = storageHarness();
    const { artifacts } = await connected(h, 3);
    h.access.deny(artifacts[2]!.artifactId);
    const record = await h.publish.publish(WS, PROJECT, USER);
    const publishedOrExcluded =
      record.artifactsIncluded.length + record.artifactsExcluded.length;
    // Nothing silently vanishes: included + excluded = the whole project.
    expect(publishedOrExcluded).toBe(artifacts.length);
    expect(record.artifactsExcluded[0]!.reason).not.toBe('');
  });
});

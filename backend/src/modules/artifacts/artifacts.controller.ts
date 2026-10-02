/**
 * `T1644` (EPIC-045, `contracts/artifacts-api.md` §2) — the three session
 * reads: an Epic's tree, one version's content, and the project's unbound
 * syncs.
 *
 * Session cookie, project membership, and the opaque `404` for anything else —
 * the same shape every product read in this platform has. **A connector
 * credential receives `404` on every one of them** (`FR-ART-043`): these
 * routes are not behind `ConnectorAuthGuard`, so a bearer token carries no
 * session and the workspace guard refuses it. The sync is a write with no read
 * beside it, deliberately.
 *
 * There is **no session write** here, and no route that edits, uploads,
 * renames or deletes anything (`FR-ART-010`). The project directory is
 * authoritative; PMI Studio is its mirror.
 */
import { Controller, Get, Inject, Param, Req } from '@nestjs/common';
import { NotFoundError, UnauthenticatedError } from '../../core/errors.js';
import type { WorkspaceContext } from '../../core/workspace.guard.js';
import { EpicService } from '../epics/epic.service.js';
import { ArtifactReadService, type ArtifactContent, type ArtifactTree, type UnboundArtifacts } from './artifact-read.service.js';

function requireAuth(ctx: WorkspaceContext | undefined | null): WorkspaceContext {
  if (!ctx?.workspaceId || !ctx.userId) throw new UnauthenticatedError('No valid session.');
  return ctx;
}

@Controller()
export class ArtifactsController {
  constructor(
    @Inject(ArtifactReadService) private readonly reads: ArtifactReadService,
    @Inject(EpicService) private readonly epics: EpicService,
  ) {}

  @Get('epics/:eid/artifacts')
  async tree(@Req() raw: WorkspaceContext | undefined, @Param('eid') eid: string): Promise<ArtifactTree> {
    const auth = requireAuth(raw);
    // `locate` is the Epic's own workspace scope — an Epic of another workspace
    // is absent here exactly as it is on the Epic detail (DEF-044-003).
    const epic = await this.epics.locate(auth.workspaceId, eid);
    await this.epics.deps.gate.requireMember(auth.workspaceId, epic.projectId);
    return this.reads.tree(auth.workspaceId, epic.projectId, eid);
  }

  @Get('artifacts/:vid')
  async content(@Req() raw: WorkspaceContext | undefined, @Param('vid') vid: string): Promise<ArtifactContent> {
    const auth = requireAuth(raw);
    const found = await this.reads.locate(auth.workspaceId, vid);
    if (found === null) throw new NotFoundError('Not found.');
    await this.epics.deps.gate.requireMember(auth.workspaceId, found.projectId);
    const content = await this.reads.content(auth.workspaceId, found.projectId, vid);
    if (content === null) throw new NotFoundError('Not found.');
    return content;
  }

  @Get('projects/:id/artifacts/unbound')
  async unbound(@Req() raw: WorkspaceContext | undefined, @Param('id') id: string): Promise<UnboundArtifacts> {
    const auth = requireAuth(raw);
    await this.epics.deps.gate.requireMember(auth.workspaceId, id);
    return this.reads.unbound(auth.workspaceId, id);
  }
}

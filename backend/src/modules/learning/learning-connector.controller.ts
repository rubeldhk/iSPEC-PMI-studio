/**
 * `T2335` (EPIC-048, `FR-LRN-061`) — agents and connectors submit through the
 * authenticated, versioned integration contract.
 *
 * `POST /projects/:projectId/learning/candidates` behind `EPIC-041`'s
 * `ConnectorAuthGuard`, scope `learning.submit` — the house pattern of
 * `connector-reads.controller.ts`. The credential decides the workspace, the
 * project and the submitting principal; the body decides none of them. The
 * body is `@pmi/learning-contract`'s `LearningSubmissionV1`, parsed by the same
 * function a connector can run before it sends.
 *
 * **Only submission is here.** Review is never reachable through the connector
 * guard (`FR-LRN-027`, `R-048-6` layer 1); `T2362` asserts the absence.
 */
import { Body, Controller, Inject, Post, Req, Res, UseGuards } from '@nestjs/common';
import { InvalidConnectorCredentialError } from '../../core/errors.js';
import { ConnectorAuthGuard, type ConnectorRequestContext } from '../connector/connector-auth.guard.js';
import { ConnectorScope } from '../connector/connector-scope.js';
import { strip } from './learning.controller.js';
import { SubmissionService, type SubmissionBody } from './submission.service.js';

interface StatusResponse {
  status(code: number): unknown;
}

@Controller('projects')
@UseGuards(ConnectorAuthGuard)
export class LearningConnectorController {
  constructor(@Inject(SubmissionService) private readonly submissions: SubmissionService) {}

  @Post(':projectId/learning/candidates')
  @ConnectorScope('learning.submit')
  async submit(
    @Req() req: { connector?: ConnectorRequestContext },
    @Body() body: unknown,
    @Res({ passthrough: true }) res: StatusResponse,
  ): Promise<SubmissionBody> {
    if (!req.connector) throw new InvalidConnectorCredentialError();
    const safe = strip(body);
    delete safe['projectId'];
    const outcome = await this.submissions.submit({
      actor: {
        kind: 'agent',
        workspaceId: req.connector.workspaceId,
        principalId: req.connector.principal.principalId,
        projectId: req.connector.projectId,
      },
      projectId: req.connector.projectId,
      body: safe,
    });
    res.status(outcome.status);
    return outcome.body;
  }
}

import { Catch, HttpException, type ArgumentsHost, type ExceptionFilter } from '@nestjs/common';
import { toErrorBody, toHttpStatus, type ErrorBody, type ErrorCode } from './errors.js';

/**
 * T018 — the transport half of the error model.
 *
 * PC-1: this is the ONLY place in the error path that touches HTTP. `errors.ts`
 * is framework-free so services can throw without knowing a transport exists —
 * which is what lets an MCP surface reuse them in Phase 3.
 *
 * ## T1010 — `DEF-001-006`: a framework exception keeps its own status
 *
 * Nest raises its **own** `NotFoundException` when no route matches, and
 * `HttpException` subclasses for framework-level 400, 405 and 415. None is a
 * `PlatformError`, so `toHttpStatus` answered 500 for all of them and
 * `GET /v1/no-such-route` returned **500 `internal_error`**. Every mistyped
 * URL raised a server error, and a real 404 became indistinguishable from a
 * crash.
 *
 * **The fix lives here and not in `toHttpStatus`.** The defect record proposed
 * changing that function, but it sits in `errors.ts`, whose header states
 * *"Nothing here imports an HTTP type"* and which
 * `tests/architecture/transport-independence.spec.ts` enforces. Teaching it
 * about `HttpException` would trade a status bug for a PC-1 violation. The
 * transport layer is the half that is allowed to know what HTTP is.
 *
 * **Trust the status, never the text.** `toErrorBody` refuses to echo an
 * unrecognised error's message *"because it may carry a connection string, a
 * token, or engine output"* — correct, and it survives unchanged. An
 * `HttpException` carries author-supplied text and the platform did not raise
 * it, so it is given a message of ours chosen by status.
 */
@Catch()
export class ErrorFilter implements ExceptionFilter {
  catch(exception: unknown, host: ArgumentsHost): void {
    const res = host.switchToHttp().getResponse<{
      status: (code: number) => { json: (body: unknown) => void };
    }>();

    if (exception instanceof HttpException) {
      const status = exception.getStatus();
      res.status(status).json(frameworkErrorBody(status));
      return;
    }

    res.status(toHttpStatus(exception)).json(toErrorBody(exception));
  }
}

/**
 * The platform code that matches a framework status, where one exists.
 *
 * Deliberately partial. `STATUS` in `errors.ts` maps code → status and is not
 * injective — three codes share 422 — so it cannot simply be inverted. These
 * are the statuses a framework error actually produces, each paired with the
 * code whose meaning matches.
 */
const CODE_FOR_STATUS: Readonly<Record<number, ErrorCode>> = {
  400: 'validation_failed',
  401: 'unauthenticated',
  403: 'forbidden',
  404: 'not_found',
  409: 'conflict',
};

/** Messages we author, per status. Never the exception's own. */
const MESSAGE_FOR_STATUS: Readonly<Record<number, string>> = {
  400: 'The request was not valid.',
  401: 'Authentication is required.',
  403: 'This action is not permitted.',
  404: 'The requested resource does not exist.',
  405: 'That method is not allowed for this resource.',
  409: 'The request conflicts with the current state.',
  415: 'That media type is not supported.',
};

/**
 * A body for a framework exception: its status, our words.
 *
 * A status with no matching platform code still keeps its status — 405 and 415
 * are true statements about the request and reporting them as 500 is the bug
 * being fixed. They take `validation_failed`, the generic client-error code,
 * because the alternative is inventing an `ErrorCode` in the epic that does
 * not own `platform-api.md` — the mistake `DEF-008-001` records.
 */
function frameworkErrorBody(status: number): ErrorBody {
  if (status >= 500) {
    return { error: { code: 'internal_error', message: 'An unexpected error occurred.' } };
  }
  return {
    error: {
      code: CODE_FOR_STATUS[status] ?? 'validation_failed',
      message: MESSAGE_FOR_STATUS[status] ?? 'The request could not be handled.',
    },
  };
}

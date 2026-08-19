import { Catch, type ArgumentsHost, type ExceptionFilter } from '@nestjs/common';
import { toErrorBody, toHttpStatus } from './errors.js';

/**
 * T018 — the transport half of the error model.
 *
 * PC-1: this is the ONLY place in the error path that touches HTTP. `errors.ts`
 * is framework-free so services can throw without knowing a transport exists —
 * which is what lets an MCP surface reuse them in Phase 3.
 */
@Catch()
export class ErrorFilter implements ExceptionFilter {
  catch(exception: unknown, host: ArgumentsHost): void {
    const res = host.switchToHttp().getResponse<{
      status: (code: number) => { json: (body: unknown) => void };
    }>();
    res.status(toHttpStatus(exception)).json(toErrorBody(exception));
  }
}

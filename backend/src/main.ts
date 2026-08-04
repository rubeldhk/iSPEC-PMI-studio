import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module.js';
import { ErrorFilter } from './core/error.filter.js';

/**
 * API entry point.
 *
 * PC-1: this is a transport. All capability lives in services that are callable
 * without HTTP, so an MCP surface can be added in Phase 3 without redesign.
 */
async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(AppModule);
  app.useGlobalFilters(new ErrorFilter());
  // D-8 / PP-012: every path is versioned.
  app.setGlobalPrefix('v1');
  const port = Number(process.env['PORT'] ?? 3000);
  await app.listen(port);
}

void bootstrap();

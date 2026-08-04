/**
 * Worker entry point (T004).
 *
 * The only process permitted to hold a concrete engine and to spawn sandboxes
 * (ADR-0001, ADR-0002).
 */
import { composeEngineRegistry } from './engine-composition.js';

async function main(): Promise<void> {
  const registry = composeEngineRegistry();
  console.log(JSON.stringify({ msg: 'worker.started', engines: registry.list() }));
}

void main();

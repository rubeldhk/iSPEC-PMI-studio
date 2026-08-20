/**
 * T462 — the engine layer is actually reachable from the application.
 *
 * Convergence found the registry and resolver fully tested and unreachable:
 * `AppModule` never imported them, so 34 passing tests described code the
 * running API could not call. These assertions are about WIRING, which is the
 * thing those tests could not see.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { PHASE_1_CAPABILITIES, engineOk, type SpecificationEngine } from '@pmi/engine-contract';
import { EngineRegistryService, NoDefaultEngineError } from '../../../src/modules/engines/engine-registry.service.js';
import { EngineResolverService } from '../../../src/modules/engines/engine-resolver.service.js';
import {
  EnginesModule,
  InheritDefaultEngineSelection,
  PROJECT_ENGINE_SELECTION,
} from '../../../src/modules/engines/engines.module.js';

const here = dirname(fileURLToPath(import.meta.url));
const appModuleSource = readFileSync(resolve(here, '../../../src/app.module.ts'), 'utf8');

/**
 * Comments stripped before asserting.
 *
 * `app.module.ts` *explains* that it imports no engine adapter, so a naive
 * search for "engine-adapter" matches the very comment describing the rule and
 * reports a violation that does not exist.
 */
const appModule = appModuleSource
  .replace(/\/\*[\s\S]*?\*\//g, ' ')
  .replace(/\/\/.*$/gm, ' ');

describe('the module is composed into the application', () => {
  it('AppModule imports EnginesModule', () => {
    // The whole finding: without this line the engine layer is dead code.
    expect(appModule).toMatch(/import\s*\{\s*EnginesModule\s*\}/);
    // [\s\S]*? rather than [^\]]*: T831 put process.env['DATABASE_URL'] inside
    // the imports array, and a bracket there must not make this check stop
    // seeing the module it asserts.
    expect(appModule).toMatch(/imports:\s*\[[\s\S]*?EnginesModule/);
  });

  it('AppModule still imports no engine adapter (FR-017)', () => {
    expect(appModule).not.toMatch(/engine-adapter/);
  });

  it('EnginesModule is a class the Nest container can consume', () => {
    expect(typeof EnginesModule).toBe('function');
  });
});

describe('the default selection port (FR-019)', () => {
  it('returns null so a project inherits the default engine', async () => {
    // Not a stub faking a feature: "no selection means inherit" IS the
    // requirement. Storing a selection is EPIC-006's.
    const selection = new InheritDefaultEngineSelection();
    await expect(selection.findEngineNameForProject()).resolves.toBeNull();
  });

  it('is exported under a stable token so EPIC-006 can replace it', () => {
    expect(typeof PROJECT_ENGINE_SELECTION).toBe('symbol');
  });
});

describe('the wiring the module performs', () => {
  /** Rebuild what the module's factories build, and prove the graph works. */
  function compose(): { registry: EngineRegistryService; resolver: EngineResolverService } {
    const registry = new EngineRegistryService();
    const resolver = new EngineResolverService(registry, new InheritDefaultEngineSelection());
    return { registry, resolver };
  }

  function stubEngine(name: string): SpecificationEngine {
    const descriptor = {
      name,
      version: `${name}-1.0.0+model=stub`,
      capabilities: [...PHASE_1_CAPABILITIES],
    };
    return {
      descriptor,
      generateSpecification: async () =>
        engineOk({ title: 't', contentRaw: 'raw', contentParsed: {} }, descriptor),
      generateTasks: async () => engineOk([{ description: 'd' }], descriptor),
      validateSpecification: async () => engineOk([], descriptor),
    };
  }

  it('resolves a project to the registered default', async () => {
    const { registry, resolver } = compose();
    registry.register(stubEngine('speckit'), { isDefault: true });
    const engine = await resolver.resolveForProject('any-project');
    expect(engine.descriptor.name).toBe('speckit');
  });

  it('starts EMPTY on the API side, which is correct', async () => {
    // The API resolves and records engines; it never runs them. An empty
    // registry here is the architecture working, not a missing provider.
    const { resolver } = compose();
    await expect(resolver.resolveForProject('any-project')).rejects.toBeInstanceOf(
      NoDefaultEngineError,
    );
  });
});

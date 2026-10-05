import { spawnSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';

const ROOT = path.resolve(import.meta.dirname, '..', '..', '..');
const CONFIG = path.join(ROOT, '.dependency-cruiser.json');
const TESTS_CONFIG = path.join(ROOT, '.dependency-cruiser.tests.json');
const CRUISE_BIN = path.join(
  ROOT,
  'node_modules',
  'dependency-cruiser',
  'bin',
  'dependency-cruiser.mjs',
);

interface CruiseReport {
  summary: { violations: { rule: { name: string } }[] };
}

const workDirs: string[] = [];

const STUB_PACKAGES = ['patchright', 'playwright', 'playwright-core'] as const;

function stubPackageFiles(hasPlaywright: boolean): Record<string, string> {
  const names = STUB_PACKAGES.filter(
    (name) => hasPlaywright || name === 'patchright',
  );
  return Object.fromEntries(
    names.flatMap((name) => [
      [
        `node_modules/${name}/package.json`,
        `{"name":"${name}","version":"1.0.0","main":"index.js"}`,
      ],
      [`node_modules/${name}/index.js`, 'module.exports = {};'],
    ]),
  );
}

/** Write a throwaway source tree (plus stub browser libraries) and cruise it. */
function cruise(
  files: Record<string, string>,
  { root = 'src', config = CONFIG, hasPlaywright = true } = {},
): string[] {
  const dir = mkdtempSync(path.join(tmpdir(), 'br-depcruise-'));
  workDirs.push(dir);
  const all: Record<string, string> = {
    'package.json': '{"name":"fixture","dependencies":{"patchright":"1.0.0"}}',
    ...stubPackageFiles(hasPlaywright),
    ...files,
  };
  for (const [relative, content] of Object.entries(all)) {
    const target = path.join(dir, relative);
    mkdirSync(path.dirname(target), { recursive: true });
    writeFileSync(target, content);
  }
  const result = spawnSync(
    process.execPath,
    [CRUISE_BIN, root, '--config', config, '--output-type', 'json'],
    { cwd: dir, encoding: 'utf8' },
  );
  const report = JSON.parse(result.stdout) as CruiseReport;
  return report.summary.violations.map((violation) => violation.rule.name);
}

const MAIN_IMPORTING = (targets: string[]): Record<string, string> => ({
  'src/main.ts': targets.map((t) => `import '${t}';`).join('\n'),
});

describe('dependency-cruiser layering rules', () => {
  afterEach(() => {
    for (const dir of workDirs.splice(0)) {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it('accepts a tree that respects every layer', () => {
    const violations = cruise({
      ...MAIN_IMPORTING([
        './replay/application/runner.ts',
        './replay/adapters/spawner.ts',
        './tui/render/screen.ts',
      ]),
      'src/shared/domain/kernel.ts': 'export const kernel = 1;\n',
      'src/replay/domain/parse.ts':
        "import { kernel } from '../../shared/domain/kernel.ts';\nexport const parse = kernel;\n",
      'src/replay/application/runner.ts':
        "import { parse } from '../domain/parse.ts';\nexport const run = parse;\n",
      'src/replay/adapters/spawner.ts':
        "import 'patchright';\nimport { run } from '../application/runner.ts';\nexport const spawn = run;\n",
      'src/recording-capture/domain/pure.ts': 'export const pure = 1;\n',
      'src/recording-capture/in-page/capture-script.ts':
        "import { pure } from '../domain/pure.ts';\nexport const entry = pure;\n",
      'src/tui/render/screen.ts':
        "import { kernel } from '../../shared/domain/kernel.ts';\nexport const screen = kernel;\n",
    });
    expect(violations).toEqual([]);
  });

  it('rejects a domain module that imports an adapter', () => {
    const violations = cruise({
      ...MAIN_IMPORTING(['./replay/domain/bad.ts']),
      'src/replay/domain/bad.ts':
        "import { spawn } from '../adapters/spawner.ts';\nexport const bad = spawn;\n",
      'src/replay/adapters/spawner.ts': 'export const spawn = 1;\n',
    });
    expect(violations).toContain('domain-pure');
  });

  it('rejects a domain module that imports a Node core module', () => {
    const violations = cruise({
      ...MAIN_IMPORTING(['./replay/domain/io.ts']),
      'src/replay/domain/io.ts':
        "import { readFileSync } from 'node:fs';\nexport const io = readFileSync;\n",
    });
    expect(violations).toContain('domain-pure');
  });

  it('keeps the cli feature pure: its domain may not import an adapter or node:util', () => {
    const adapter = cruise({
      ...MAIN_IMPORTING(['./cli/domain/bad.ts']),
      'src/cli/domain/bad.ts':
        "import { tokenize } from '../adapters/tokenize.ts';\nexport const bad = tokenize;\n",
      'src/cli/adapters/tokenize.ts': 'export const tokenize = 1;\n',
    });
    const nodeCore = cruise({
      ...MAIN_IMPORTING(['./cli/domain/io.ts']),
      'src/cli/domain/io.ts':
        "import { parseArgs } from 'node:util';\nexport const io = parseArgs;\n",
    });
    expect(adapter).toContain('domain-pure');
    expect(nodeCore).toContain('domain-pure');
  });

  it('keeps the cli application behind its ports and away from other features', () => {
    const adapter = cruise({
      ...MAIN_IMPORTING(['./cli/application/run.ts']),
      'src/cli/application/run.ts':
        "import { out } from '../adapters/out.ts';\nexport const run = out;\n",
      'src/cli/adapters/out.ts': 'export const out = 1;\n',
    });
    const feature = cruise({
      ...MAIN_IMPORTING(['./cli/application/run.ts']),
      'src/cli/application/run.ts':
        "import { start } from '../../replay/application/start.ts';\nexport const run = start;\n",
      'src/replay/application/start.ts': 'export const start = 1;\n',
    });
    expect(adapter).toContain('application-no-io');
    expect(feature).toContain('no-cross-feature');
  });

  it('rejects one feature importing another', () => {
    const violations = cruise({
      ...MAIN_IMPORTING(['./replay/domain/a.ts']),
      'src/replay/domain/a.ts':
        "import { b } from '../../tui/domain/b.ts';\nexport const a = b;\n",
      'src/tui/domain/b.ts': 'export const b = 1;\n',
    });
    expect(violations).toContain('no-cross-feature');
  });

  it('allows composition to wire features together', () => {
    const violations = cruise({
      ...MAIN_IMPORTING(['./composition/wire.ts']),
      'src/composition/wire.ts':
        "import { a } from '../replay/domain/a.ts';\nimport { b } from '../tui/domain/b.ts';\nexport const wire = [a, b];\n",
      'src/replay/domain/a.ts': 'export const a = 1;\n',
      'src/tui/domain/b.ts': 'export const b = 2;\n',
    });
    expect(violations).toEqual([]);
  });

  it('rejects patchright inside application code', () => {
    const violations = cruise({
      ...MAIN_IMPORTING(['./replay/application/runner.ts']),
      'src/replay/application/runner.ts':
        "import 'patchright';\nexport const run = 1;\n",
    });
    expect(violations).toContain('patchright-in-adapters');
    expect(violations).toContain('application-no-io');
  });

  it('allows patchright in adapters and in the composition root', () => {
    const violations = cruise({
      ...MAIN_IMPORTING([
        './replay/adapters/launch.ts',
        './composition/wire.ts',
      ]),
      'src/replay/adapters/launch.ts':
        "import 'patchright';\nexport const launch = 1;\n",
      'src/composition/wire.ts':
        "import 'patchright';\nexport const wire = 1;\n",
    });
    expect(violations).toEqual([]);
  });

  it.each([
    ['playwright', 'src/replay/adapters/launch.ts'],
    ['playwright-core', 'src/replay/adapters/launch.ts'],
    ['playwright', 'src/composition/wire.ts'],
  ])('rejects %s even where patchright is allowed (%s)', (library, file) => {
    const violations = cruise({
      ...MAIN_IMPORTING([`./${file.replace('src/', '')}`]),
      [file]: `import '${library}';\nexport const launch = 1;\n`,
    });
    expect(violations).toContain('no-playwright');
  });

  it('rejects an adapter import from a browser-profiles domain module', () => {
    const violations = cruise({
      ...MAIN_IMPORTING(['./browser-profiles/domain/bad.ts']),
      'src/browser-profiles/domain/bad.ts':
        "import { fs } from '../adapters/node-fs.ts';\nexport const bad = fs;\n",
      'src/browser-profiles/adapters/node-fs.ts': 'export const fs = 1;\n',
    });
    expect(violations).toContain('domain-pure');
  });

  it('rejects an adapter import from a browser-selection domain module', () => {
    const violations = cruise({
      ...MAIN_IMPORTING(['./browser-selection/domain/bad.ts']),
      'src/browser-selection/domain/bad.ts':
        "import { probe } from '../adapters/node-probe.ts';\nexport const bad = probe;\n",
      'src/browser-selection/adapters/node-probe.ts':
        'export const probe = 1;\n',
    });
    expect(violations).toContain('domain-pure');
  });

  it('rejects an in-page module that imports outside its allow-list', () => {
    const violations = cruise({
      ...MAIN_IMPORTING(['./recording-capture/in-page/capture-script.ts']),
      'src/recording-capture/in-page/capture-script.ts':
        "import { parse } from '../../replay/domain/parse.ts';\nexport const entry = parse;\n",
      'src/replay/domain/parse.ts': 'export const parse = 1;\n',
    });
    expect(violations).toContain('in-page-allow-list');
  });

  it('rejects code outside in-page that imports in-page modules', () => {
    const violations = cruise({
      ...MAIN_IMPORTING(['./replay/application/runner.ts']),
      'src/replay/application/runner.ts':
        "import { entry } from '../../recording-capture/in-page/capture-script.ts';\nexport const run = entry;\n",
      'src/recording-capture/in-page/capture-script.ts':
        'export const entry = 1;\n',
    });
    expect(violations).toContain('in-page-sealed');
  });

  it('rejects a render module that imports application code', () => {
    const violations = cruise({
      ...MAIN_IMPORTING(['./tui/render/screen.ts']),
      'src/tui/render/screen.ts':
        "import { control } from '../application/controller.ts';\nexport const screen = control;\n",
      'src/tui/application/controller.ts': 'export const control = 1;\n',
    });
    expect(violations).toContain('render-pure');
  });

  it('rejects an orphan module', () => {
    const violations = cruise({
      ...MAIN_IMPORTING([]),
      'src/replay/domain/lonely.ts': 'export const lonely = 1;\n',
    });
    expect(violations).toContain('no-orphans');
  });

  describe('tests config', () => {
    const inTests = { root: 'tests', config: TESTS_CONFIG };

    it.each(['playwright', 'playwright-core'])(
      'rejects an installed %s imported from a test',
      (library) => {
        const violations = cruise(
          {
            'tests/unit/uses.test.ts': `import '${library}';\nexport const used = 1;\n`,
          },
          inTests,
        );
        expect(violations).toContain('no-playwright');
      },
    );

    it.each(['playwright', '@playwright/test'])(
      'rejects an uninstalled %s imported from a test',
      (library) => {
        const violations = cruise(
          {
            'tests/unit/uses.test.ts': `import '${library}';\nexport const used = 1;\n`,
          },
          { ...inTests, hasPlaywright: false },
        );
        expect(violations).toContain('no-playwright-unresolved');
      },
    );

    it('accepts a test that imports patchright', () => {
      const violations = cruise(
        {
          'tests/unit/uses.test.ts':
            "import 'patchright';\nexport const used = 1;\n",
        },
        inTests,
      );
      expect(violations).toEqual([]);
    });
  });
});

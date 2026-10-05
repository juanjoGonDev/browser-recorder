import { spawnSync } from 'node:child_process';
import {
  mkdirSync,
  mkdtempSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';

import { afterEach, describe, expect, it } from 'vitest';

import {
  classifyGitRange,
  classifyReleaseImpact,
  main,
  packageChangeAffectsBuild,
  pendingReleaseImpact,
} from '../../../scripts/release-impact-policy.ts';

const repositoryRoot = process.cwd();
const policyPath = resolve(repositoryRoot, 'scripts/release-impact-policy.ts');
const temporaryDirectories: string[] = [];

/** A minimal, build-relevant manifest for the in-process cases. */
const manifest = {
  name: 'browser-recorder',
  version: '1.0.0',
  dependencies: { playwright: '1.62.1' },
};

type Classification = {
  publish: boolean;
  paths: string[];
};

type PendingImpact = {
  publish: boolean;
  commitCount: number;
  commits: string[];
};

function temporaryDirectory(prefix: string): string {
  const directory = mkdtempSync(join(tmpdir(), prefix));
  temporaryDirectories.push(directory);
  return directory;
}

function runPolicy(
  args: string[],
  cwd = process.cwd(),
): Classification | PendingImpact {
  const policyArgs = ['--experimental-strip-types', policyPath, ...args];
  const result = spawnSync(process.execPath, policyArgs, {
    cwd,
    encoding: 'utf8',
  });
  if (result.status !== 0) {
    throw new Error(result.stderr || 'release impact policy failed');
  }
  return JSON.parse(result.stdout) as Classification | PendingImpact;
}

function classify(
  paths: string[],
  beforePackage: Record<string, unknown>,
  afterPackage: Record<string, unknown>,
): Classification {
  const directory = temporaryDirectory('browser-recorder-release-policy-');
  const pathsFile = join(directory, 'paths.bin');
  const beforeFile = join(directory, 'before-package.json');
  const afterFile = join(directory, 'after-package.json');

  writeFileSync(pathsFile, `${paths.join('\0')}\0`, 'utf8');
  writeFileSync(beforeFile, JSON.stringify(beforePackage), 'utf8');
  writeFileSync(afterFile, JSON.stringify(afterPackage), 'utf8');

  return runPolicy([
    'classify',
    pathsFile,
    beforeFile,
    afterFile,
  ]) as Classification;
}

function git(directory: string, ...args: string[]): string {
  const result = spawnSync('git', args, { cwd: directory, encoding: 'utf8' });
  if (result.status !== 0) {
    throw new Error(result.stderr || `git ${args.join(' ')} failed`);
  }
  return result.stdout.trim();
}

/** A throwaway repository with a committer configured. */
function newRepository(): string {
  const directory = temporaryDirectory('browser-recorder-release-repo-');
  git(directory, 'init');
  git(directory, 'config', 'user.name', 'Browser Recorder Test');
  git(directory, 'config', 'user.email', 'recorder@example.test');
  return directory;
}

function commitFile(
  directory: string,
  path: string,
  content: string,
  message: string,
): string {
  const absolutePath = join(directory, path);
  mkdirSync(dirname(absolutePath), { recursive: true });
  writeFileSync(absolutePath, content, 'utf8');
  git(directory, 'add', path);
  git(directory, 'commit', '-m', message);
  return git(directory, 'rev-parse', 'HEAD');
}

describe('scripts/release-impact-policy.ts', () => {
  afterEach(() => {
    for (const directory of temporaryDirectories.splice(0)) {
      rmSync(directory, { force: true, recursive: true });
    }
  });

  describe('release impact policy', () => {
    const packageJson = {
      name: 'browser-recorder',
      version: '1.0.0',
      dependencies: { playwright: '1.62.1' },
    };

    it.each([
      'src/main.ts',
      'src/recording-capture/in-page/capture-script.ts',
      '.npmrc',
      'tsconfig.base.json',
      'tsconfig.node.json',
      'tsconfig.in-page.json',
      'scripts/build.ts',
      'scripts/lib/script-runtime.ts',
    ])('classifies %s as release-impacting', (path) => {
      expect(classify([path], packageJson, packageJson)).toEqual({
        publish: true,
        paths: [path],
      });
    });

    it.each([
      'README.md',
      'AGENTS.md',
      'tests/unit/repository/workflows.test.ts',
      '.github/workflows/release.yml',
      '.github/workflows/dependabot-auto-merge.workflow.yml',
      'scripts/release-impact-policy.ts',
      'scripts/install-hooks.ts',
      'tsconfig.tests.json',
      'pnpm-lock.yaml',
    ])('skips release-neutral path %s', (path) => {
      expect(classify([path], packageJson, packageJson)).toEqual({
        publish: false,
        paths: [],
      });
    });

    it('skips a tooling-only dev dependency bump with its lockfile', () => {
      const before = { ...packageJson, devDependencies: { vitest: '4.1.11' } };
      const after = { ...packageJson, devDependencies: { vitest: '5.0.0' } };

      expect(
        classify(['package.json', 'pnpm-lock.yaml'], before, after),
      ).toEqual({ publish: false, paths: [] });
    });

    // Commit linting only runs in hooks; it never reaches the built output.
    it('skips a commitlint bump with its lockfile', () => {
      const before = {
        ...packageJson,
        devDependencies: { '@commitlint/cli': '21.2.2' },
      };
      const after = {
        ...packageJson,
        devDependencies: { '@commitlint/cli': '21.2.3' },
      };

      expect(
        classify(['package.json', 'pnpm-lock.yaml'], before, after),
      ).toEqual({ publish: false, paths: [] });
    });

    // The prefix match runs on the raw dependency name, so a bare 'vitest'
    // entry never covers the scoped packages: '@vitest/coverage-v8' starts
    // with '@'. Without the '@vitest/' entry these bumps published a
    // byte-identical app.
    it.each(['@vitest/coverage-v8', '@vitest/eslint-plugin'])(
      'skips a scoped %s dev dependency bump with its lockfile',
      (dependency) => {
        const before = {
          ...packageJson,
          devDependencies: { [dependency]: '1.0.0' },
        };
        const after = {
          ...packageJson,
          devDependencies: { [dependency]: '1.0.1' },
        };

        expect(
          classify(['package.json', 'pnpm-lock.yaml'], before, after),
        ).toEqual({ publish: false, paths: [] });
      },
    );

    it('classifies a packaged dev dependency bump as release-impacting', () => {
      const before = {
        ...packageJson,
        devDependencies: { esbuild: '0.28.2' },
      };
      const after = { ...packageJson, devDependencies: { esbuild: '0.29.0' } };

      expect(
        classify(['package.json', 'pnpm-lock.yaml'], before, after),
      ).toEqual({ publish: true, paths: ['package.json', 'pnpm-lock.yaml'] });
    });

    it('classifies a production dependency bump as release-impacting', () => {
      const after = { ...packageJson, dependencies: { playwright: '1.63.0' } };

      expect(
        classify(['package.json', 'pnpm-lock.yaml'], packageJson, after),
      ).toEqual({
        publish: true,
        paths: ['package.json', 'pnpm-lock.yaml'],
      });
    });

    it('skips a package.json version-only change', () => {
      expect(
        classify(['package.json'], packageJson, {
          ...packageJson,
          version: '1.0.1',
        }),
      ).toEqual({ publish: false, paths: [] });
    });

    it('skips a top-level package.json key reorder', () => {
      const reorderedPackageJson = {
        dependencies: { playwright: '1.62.1' },
        version: '1.0.0',
        name: 'browser-recorder',
      };

      expect(
        classify(['package.json'], packageJson, reorderedPackageJson),
      ).toEqual({ publish: false, paths: [] });
    });

    it('skips a nested dependency key reorder', () => {
      const beforePackage = {
        ...packageJson,
        dependencies: {
          playwright: '1.62.1',
          'playwright-core': '1.62.1',
        },
      };
      const afterPackage = {
        ...packageJson,
        dependencies: {
          'playwright-core': '1.62.1',
          playwright: '1.62.1',
        },
      };

      expect(classify(['package.json'], beforePackage, afterPackage)).toEqual({
        publish: false,
        paths: [],
      });
    });

    it('publishes for a semantic package.json dependency change', () => {
      expect(
        classify(['package.json'], packageJson, {
          ...packageJson,
          version: '1.0.1',
          dependencies: { playwright: '1.63.0' },
        }),
      ).toEqual({ publish: true, paths: ['package.json'] });
    });

    it('publishes mixed changes when one build input changes', () => {
      expect(
        classify(['README.md', 'src/main.ts'], packageJson, packageJson),
      ).toEqual({ publish: true, paths: ['src/main.ts'] });
    });

    it('counts only release-impacting first-parent commits', () => {
      const directory = temporaryDirectory('browser-recorder-release-history-');
      git(directory, 'init');
      git(directory, 'config', 'user.name', 'Browser Recorder Test');
      git(directory, 'config', 'user.email', 'recorder@example.test');

      commitFile(
        directory,
        'package.json',
        JSON.stringify(packageJson),
        'chore: baseline',
      );
      git(directory, 'tag', 'v1.0.0');

      commitFile(directory, 'README.md', 'docs', 'docs: update readme');
      const releaseCommit = commitFile(
        directory,
        'src/main.ts',
        'export const value = 1;\n',
        'feat: add product behavior',
      );
      commitFile(
        directory,
        '.github/workflows/ci.yml',
        'name: CI\n',
        'chore(actions): pin checkout',
      );
      commitFile(
        directory,
        'package.json',
        JSON.stringify({ ...packageJson, version: '1.0.1' }),
        'chore(release): prepare v1.0.1',
      );

      expect(runPolicy(['pending', 'v1.0.0', 'HEAD'], directory)).toEqual({
        publish: true,
        commitCount: 1,
        commits: [releaseCommit],
      });
    });
  });

  describe('classifyReleaseImpact', () => {
    it('trims and de-duplicates the paths it is given', () => {
      expect(
        classifyReleaseImpact(['  src/main.ts  ', 'src/main.ts', '', '   ']),
      ).toEqual({ publish: true, paths: ['src/main.ts'] });
    });

    it('returns the impacted paths sorted, not in input order', () => {
      expect(
        classifyReleaseImpact([
          'src/tray.ts',
          'src/z-last.ts',
          'src/a-first.ts',
        ]),
      ).toEqual({
        publish: true,
        paths: ['src/a-first.ts', 'src/tray.ts', 'src/z-last.ts'],
      });
    });
  });

  describe('packageChangeAffectsBuild', () => {
    it('treats an unreadable previous manifest as a change', () => {
      expect(packageChangeAffectsBuild('', JSON.stringify(manifest))).toBe(
        true,
      );
    });

    it('treats an unreadable current manifest as a change', () => {
      expect(packageChangeAffectsBuild(JSON.stringify(manifest), '')).toBe(
        true,
      );
    });

    it('names which side of a malformed manifest is invalid', () => {
      expect(() => packageChangeAffectsBuild('{', '{}')).toThrow(
        'Previous package.json is invalid',
      );
      expect(() => packageChangeAffectsBuild('{}', 'not json')).toThrow(
        'Current package.json is invalid',
      );
    });

    it('rejects a manifest whose root is not an object', () => {
      expect(() => packageChangeAffectsBuild('[]', '{}')).toThrow(
        'Previous package.json is invalid: root value must be an object',
      );
    });

    it('canonicalizes keys nested inside arrays', () => {
      // Without the recursive walk through arrays, the two serialize
      // differently and a pure key reorder would publish a release.
      const before = JSON.stringify({
        name: 'browser-recorder',
        files: [{ b: 1, a: 2 }],
      });
      const after = JSON.stringify({
        name: 'browser-recorder',
        files: [{ a: 2, b: 1 }],
      });
      expect(packageChangeAffectsBuild(before, after)).toBe(false);
    });

    it('keeps array ORDER significant', () => {
      const before = JSON.stringify({
        name: 'browser-recorder',
        files: ['a', 'b'],
      });
      const after = JSON.stringify({
        name: 'browser-recorder',
        files: ['b', 'a'],
      });
      expect(packageChangeAffectsBuild(before, after)).toBe(true);
    });
  });

  describe('classifyGitRange', () => {
    it('classifies a range by the paths git reports as changed', () => {
      const repository = newRepository();
      const base = commitFile(repository, 'README.md', 'docs\n', 'docs: seed');
      commitFile(
        repository,
        'src/main.ts',
        'export const value = 1;\n',
        'feat: product change',
      );
      const head = commitFile(
        repository,
        'AGENTS.md',
        'agents\n',
        'docs: agents',
      );

      expect(classifyGitRange(base, head, repository)).toEqual({
        publish: true,
        paths: ['src/main.ts'],
      });
    });

    it('reports no impact for a docs-only range', () => {
      const repository = newRepository();
      const base = commitFile(repository, 'README.md', 'docs\n', 'docs: seed');
      const head = commitFile(
        repository,
        'CHANGELOG.md',
        'notes\n',
        'docs: changelog',
      );

      expect(classifyGitRange(base, head, repository)).toEqual({
        publish: false,
        paths: [],
      });
    });

    it('reads both package.json revisions to skip a version-only bump', () => {
      const repository = newRepository();
      const base = commitFile(
        repository,
        'package.json',
        JSON.stringify(manifest),
        'chore: seed manifest',
      );
      const head = commitFile(
        repository,
        'package.json',
        JSON.stringify({ ...manifest, version: '1.0.1' }),
        'chore(release): prepare v1.0.1',
      );

      expect(classifyGitRange(base, head, repository)).toEqual({
        publish: false,
        paths: [],
      });
    });

    it('publishes when package.json did not exist at the base revision', () => {
      // `git show <base>:package.json` fails there; the missing manifest
      // cannot be fingerprinted, and an unknown previous manifest must not
      // be read as "unchanged".
      const repository = newRepository();
      const base = commitFile(repository, 'README.md', 'docs\n', 'docs: seed');
      const head = commitFile(
        repository,
        'package.json',
        JSON.stringify(manifest),
        'chore: add manifest',
      );

      expect(classifyGitRange(base, head, repository)).toEqual({
        publish: true,
        paths: ['package.json'],
      });
    });
  });

  describe('pendingReleaseImpact', () => {
    it('lists only the release-impacting commits, oldest first', () => {
      const repository = newRepository();
      commitFile(
        repository,
        'package.json',
        JSON.stringify(manifest),
        'chore: baseline',
      );
      git(repository, 'tag', 'v1.0.0');
      commitFile(repository, 'README.md', 'docs\n', 'docs: readme');
      const firstImpacting = commitFile(
        repository,
        'src/main.ts',
        'export const value = 1;\n',
        'feat: one',
      );
      commitFile(
        repository,
        'tests/sample.test.ts',
        'export {};\n',
        'test: add a case',
      );
      const secondImpacting = commitFile(
        repository,
        'src/a-first.ts',
        'export const value = 2;\n',
        'feat: two',
      );

      expect(pendingReleaseImpact('v1.0.0', 'HEAD', repository)).toEqual({
        publish: true,
        commitCount: 2,
        commits: [firstImpacting, secondImpacting],
      });
    });

    it('reports no pending impact when every commit is release-neutral', () => {
      const repository = newRepository();
      commitFile(
        repository,
        'package.json',
        JSON.stringify(manifest),
        'chore: baseline',
      );
      git(repository, 'tag', 'v1.0.0');
      commitFile(repository, 'README.md', 'docs\n', 'docs: readme');
      commitFile(repository, 'AGENTS.md', 'agents\n', 'docs: agents');

      expect(pendingReleaseImpact('v1.0.0', 'HEAD', repository)).toEqual({
        publish: false,
        commitCount: 0,
        commits: [],
      });
    });
  });

  describe('main', () => {
    function classifyFiles(paths: string[]): [string, string, string] {
      const directory = temporaryDirectory('browser-recorder-release-main-');
      const pathsFile = join(directory, 'paths.bin');
      const packageFile = join(directory, 'package.json');
      writeFileSync(pathsFile, `${paths.join('\0')}\0`, 'utf8');
      writeFileSync(packageFile, JSON.stringify(manifest), 'utf8');
      return [pathsFile, packageFile, packageFile];
    }

    it('classifies the null-delimited path list the classify mode names', () => {
      expect(
        main(['classify', ...classifyFiles(['README.md', 'src/main.ts'])]),
      ).toEqual({ publish: true, paths: ['src/main.ts'] });
    });

    it('ignores the empty trailing entry of the path list', () => {
      expect(main(['classify', ...classifyFiles(['README.md'])])).toEqual({
        publish: false,
        paths: [],
      });
    });

    it('runs the range mode against the repository it is given', () => {
      const repository = newRepository();
      const base = commitFile(repository, 'README.md', 'docs\n', 'docs: seed');
      const head = commitFile(
        repository,
        'src/main.ts',
        'export const value = 1;\n',
        'feat: product change',
      );

      expect(main(['range', base, head], repository)).toEqual({
        publish: true,
        paths: ['src/main.ts'],
      });
    });

    it('runs the pending mode against the repository it is given', () => {
      const repository = newRepository();
      commitFile(repository, 'README.md', 'docs\n', 'docs: seed');
      git(repository, 'tag', 'v1.0.0');
      const impacting = commitFile(
        repository,
        'src/z-last.ts',
        'png\n',
        'feat: new icon',
      );

      expect(main(['pending', 'v1.0.0', 'HEAD'], repository)).toEqual({
        publish: true,
        commitCount: 1,
        commits: [impacting],
      });
    });

    const usageCases: [string[], string][] = [
      [[], 'Expected mode: classify, range, or pending'],
      [['sync'], 'Expected mode: classify, range, or pending'],
      [
        ['classify'],
        'Usage: release-impact-policy.ts classify <paths-file> <before-package> <after-package>',
      ],
      [
        ['classify', 'paths'],
        'Usage: release-impact-policy.ts classify <paths-file> <before-package> <after-package>',
      ],
      [
        ['classify', 'paths', 'before'],
        'Usage: release-impact-policy.ts classify <paths-file> <before-package> <after-package>',
      ],
      [['range'], 'Usage: release-impact-policy.ts range <base> <head>'],
      [
        ['range', 'base'],
        'Usage: release-impact-policy.ts range <base> <head>',
      ],
      [['pending'], 'Usage: release-impact-policy.ts pending <base> <head>'],
      [
        ['pending', 'base'],
        'Usage: release-impact-policy.ts pending <base> <head>',
      ],
    ];

    it.each(usageCases)('refuses %j with a usage error', (argv, message) => {
      expect(() => main(argv)).toThrow(message);
    });
  });

  describe('command-line entrypoint', () => {
    it('runs main() when the checkout is reached through a symlink', () => {
      // `import.meta.url` is realpath-resolved by Node while
      // `process.argv[1]` is not, so comparing them raw made the guard
      // FALSE here: the script exited 0 having written nothing, and the
      // release workflows read that empty stdout as the impact JSON.
      const directory = temporaryDirectory('browser-recorder-release-symlink-');
      const checkout = join(directory, 'checkout');
      symlinkSync(repositoryRoot, checkout, 'dir');
      const pathsFile = join(directory, 'paths.bin');
      const packageFile = join(directory, 'package.json');
      writeFileSync(pathsFile, 'src/main.ts\0', 'utf8');
      writeFileSync(packageFile, JSON.stringify(manifest), 'utf8');

      const result = spawnSync(
        process.execPath,
        [
          '--experimental-strip-types',
          join(checkout, 'scripts', 'release-impact-policy.ts'),
          'classify',
          pathsFile,
          packageFile,
          packageFile,
        ],
        { encoding: 'utf8' },
      );

      expect(result.status, result.stderr).toBe(0);
      expect(
        result.stdout.trim(),
        'the symlinked checkout produced no stdout at all',
      ).not.toBe('');
      expect(JSON.parse(result.stdout)).toEqual({
        publish: true,
        paths: ['src/main.ts'],
      });
    });
  });
});

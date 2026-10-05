import { readdirSync, readFileSync, statSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const ROOT = path.resolve(import.meta.dirname, '..', '..', '..');
const WORKFLOWS = path.join(ROOT, '.github', 'workflows');

// The secrets and environment devbar's automation depends on. The names are
// the contract with the repository settings, so they must not drift.
const DEVBAR_SECRETS = [
  'GITHUB_TOKEN',
  'PAT_FINE',
  'REPOSITORY_AUTOMATION_TOKEN',
];
const REPOSITORY_GUARD = "github.repository == 'juanjoGonDev/browser-recorder'";

function readWorkflow(name: string): string {
  return readFileSync(path.join(WORKFLOWS, name), 'utf8');
}

const QUALITY_JOB = /^ {2}quality:$/m;
const TEST_JOB = /^ {2}test:$/m;

// ci.yml lists `quality` before `test`; the split keeps each job's own text.
function ciJobs(): { quality: string; test: string } {
  const [, afterQuality = ''] = readWorkflow('ci.yml').split(QUALITY_JOB);
  const [quality = '', test = ''] = afterQuality.split(TEST_JOB);
  return { quality, test };
}

function stepsOf(block: string): string[] {
  return block.split(/^ {6}- name: /m).slice(1);
}

function workflowNames(): string[] {
  return readdirSync(WORKFLOWS).filter((name) => name.endsWith('.yml'));
}

function sourceFiles(directory: string): string[] {
  return readdirSync(directory).flatMap((entry) => {
    const full = path.join(directory, entry);
    return statSync(full).isDirectory() ? sourceFiles(full) : [full];
  });
}

describe('workflow secret contract', () => {
  it('references exactly the secret names devbar uses', () => {
    const referenced = new Set(
      workflowNames().flatMap((name) =>
        [...readWorkflow(name).matchAll(/secrets\.([A-Za-z_]+)/g)].map(
          (match) => match[1],
        ),
      ),
    );
    expect([...referenced].sort()).toEqual([...DEVBAR_SECRETS].sort());
  });

  it('keeps the privileged jobs in the admin environment', () => {
    const withAdmin = workflowNames().filter((name) =>
      /^\s+environment: admin$/m.test(readWorkflow(name)),
    );
    expect(withAdmin.sort()).toEqual([
      'auto-merge-required-qa.workflow.yml',
      'auto-release.workflow.yml',
      'release-auto-merge.workflow.yml',
      'release.yml',
    ]);
  });
});

describe('workflow set', () => {
  it('contains every maintenance workflow adapted from devbar', () => {
    expect(workflowNames().sort()).toEqual([
      'auto-merge-required-qa.workflow.yml',
      'auto-release.workflow.yml',
      'ci.yml',
      'codeql.yml',
      'delete-cache.workflow.yml',
      'dependabot-auto-merge.workflow.yml',
      'dependabot-recreate-on-conflict.workflow.yml',
      'pr-title.workflow.yml',
      'release-auto-merge.workflow.yml',
      'release-impact-label.workflow.yml',
      'release-validation.yml',
      'release.yml',
      'version-bump.yml',
    ]);
  });

  it('keeps dependabot.yml for both the npm and github-actions ecosystems', () => {
    const text = readFileSync(
      path.join(ROOT, '.github', 'dependabot.yml'),
      'utf8',
    );
    expect(text).toContain("package-ecosystem: 'npm'");
    expect(text).toContain("package-ecosystem: 'github-actions'");
  });

  it('provides a pull request template', () => {
    const text = readFileSync(
      path.join(ROOT, '.github', 'pull_request_template.md'),
      'utf8',
    );
    expect(text).toContain('Conventional Commit');
  });

  it.each([
    'ci.yml',
    'pr-title.workflow.yml',
    'release.yml',
    'release-validation.yml',
    'auto-release.workflow.yml',
    'release-auto-merge.workflow.yml',
    'release-impact-label.workflow.yml',
    'version-bump.yml',
  ])('guards %s to the browser-recorder repository', (name) => {
    expect(readWorkflow(name)).toContain(REPOSITORY_GUARD);
  });

  it('mentions no devbar repository, package or Electron artifact anywhere', () => {
    const offenders = workflowNames().filter((name) =>
      /devbar|electron|\.dmg|\.AppImage|install-local|release:mac|run pack|run dist/i.test(
        readWorkflow(name),
      ),
    );
    expect(offenders).toEqual([]);
  });
});

describe('ci.yml', () => {
  const ci = readWorkflow('ci.yml');

  it('runs on ubuntu, macOS and Windows without failing fast', () => {
    expect(ci).toContain('fail-fast: false');
    expect(ci).toContain('runner: ubuntu-latest');
    expect(ci).toContain('runner: macos-15');
    expect(ci).toContain('runner: windows-latest');
  });

  it('installs Chromium, with system dependencies on Linux only', () => {
    expect(ci).toContain('pnpm exec patchright install chromium');
    expect(ci).toContain('pnpm exec patchright install --with-deps chromium');
    expect(ci).toMatch(
      /if: matrix\.os == 'linux'\n\s+run: pnpm exec patchright install --with-deps chromium/,
    );
  });

  it('never installs browsers through the Playwright CLI', () => {
    expect(ci).not.toMatch(/exec playwright\b/);
    expect(readWorkflow('auto-release.workflow.yml')).not.toMatch(
      /exec playwright\b/,
    );
  });

  it('audits once, in the quality job', () => {
    expect(ciJobs().quality).toMatch(
      /name: Audit\n\s+if: [^\n]+\n\s+run: pnpm audit --audit-level=moderate/,
    );
    expect(ci.match(/pnpm audit/g)).toHaveLength(1);
  });

  it('runs coverage and a build on every platform', () => {
    expect(ci).toContain('run: pnpm test:coverage');
    expect(ci).toContain('run: pnpm build');
  });
});

const PINNED_ACTION = /uses: \S+@[0-9a-f]{40} # v/;
const STATIC_GATE_COMMANDS = [
  'typecheck',
  'lint:strict',
  'format:check',
  'deadcode',
  'deps:check',
  'audit',
  'commitlint',
];

describe('ci.yml quality job', () => {
  const qualityBlock = ciJobs().quality;

  it('runs once on ubuntu with full history and no matrix', () => {
    expect(qualityBlock).toContain('runs-on: ubuntu-latest');
    expect(qualityBlock).toContain('fetch-depth: 0');
    expect(qualityBlock).not.toContain('matrix');
  });

  it.each([
    ['Typecheck', 'pnpm typecheck'],
    ['Authored source policy', "git ls-files '*.js'"],
    ['ESLint', 'pnpm lint:strict'],
    ['Prettier', 'pnpm format:check'],
    ['knip', 'pnpm deadcode'],
    ['dependency-cruiser', 'pnpm deps:check'],
    ['Audit', 'pnpm audit --audit-level=moderate'],
    ['Commitlint — commits', 'pnpm exec commitlint'],
  ])('has one named step %s running %s', (name, command) => {
    const steps = stepsOf(qualityBlock);
    const matching = steps.filter((step) => step.startsWith(`${name}\n`));
    expect(matching).toHaveLength(1);
    expect(matching[0]).toContain(command);
  });

  it('reports every failing gate instead of stopping at the first', () => {
    expect(qualityBlock).toContain(
      "if: ${{ !cancelled() && steps.install.outcome == 'success' }}",
    );
    expect(qualityBlock).toContain('id: install');
  });

  it('lints commits for human authors only, from the PR base to head', () => {
    const step = qualityBlock.split('- name: Commitlint — commits')[1];
    expect(step).toContain("github.event.pull_request.user.type != 'Bot'");
    expect(step).toContain('--from "$BASE_SHA" --to "$HEAD_SHA"');
    expect(step).toContain(
      'BASE_SHA: ${{ github.event.pull_request.base.sha }}',
    );
    expect(step).toContain(
      'HEAD_SHA: ${{ github.event.pull_request.head.sha }}',
    );
  });
});

describe('ci.yml test job', () => {
  const ci = readWorkflow('ci.yml');
  const testBlock = ciJobs().test;

  it('keeps coverage, build and both Chromium installs', () => {
    expect(testBlock).toContain('run: pnpm test:coverage');
    expect(testBlock).toContain('run: pnpm build');
    expect(testBlock).toContain('pnpm exec patchright install chromium');
    expect(testBlock).toContain(
      'pnpm exec patchright install --with-deps chromium',
    );
  });

  it.each(STATIC_GATE_COMMANDS)('does not repeat %s', (command) => {
    expect(testBlock).not.toContain(command);
  });

  it('uses the default checkout depth', () => {
    expect(testBlock).not.toContain('fetch-depth');
  });

  it('runs jobs in parallel and ignores title edits', () => {
    expect(ci).not.toMatch(/^\s+needs:/m);
    expect(ci).not.toContain('edited');
    expect(ci).not.toContain('pull_request.title');
  });
});

describe('pr-title.workflow.yml', () => {
  it('re-checks on every title-relevant event, including edits', () => {
    const title = readWorkflow('pr-title.workflow.yml');
    expect(title).toContain('types: [opened, edited, reopened, synchronize]');
  });

  it('has its own concurrency group and read-only token', () => {
    const title = readWorkflow('pr-title.workflow.yml');
    expect(title).toContain('group: pr-title-');
    expect(title).toContain('contents: read');
  });

  it('always runs, whether or not the title changed', () => {
    const title = readWorkflow('pr-title.workflow.yml');
    expect(title).not.toContain('changes.title');
  });

  it('reads the title only through an env entry and pipes it with printf', () => {
    const title = readWorkflow('pr-title.workflow.yml');
    const occurrences = title.match(/pull_request\.title/g) ?? [];
    expect(occurrences).toHaveLength(1);
    expect(title).toMatch(
      /PR_TITLE: \$\{\{ github\.event\.pull_request\.title \}\}/,
    );
    expect(title).toContain(
      `run: printf '%s\\n' "$PR_TITLE" | pnpm exec commitlint --verbose`,
    );
  });
});

describe('pull request triggers', () => {
  it.each([
    [
      'ci.yml',
      'synchronize',
      '${{ github.workflow }}-${{ github.head_ref || github.ref }}',
    ],
    [
      'pr-title.workflow.yml',
      'synchronize',
      'pr-title-${{ github.event.pull_request.number }}',
    ],
    [
      'pr-title.workflow.yml',
      'edited',
      'pr-title-${{ github.event.pull_request.number }}',
    ],
  ])(
    '%s restarts on %s with a per-PR cancelling group',
    (name, type, group) => {
      const text = readWorkflow(name);
      expect(text).toMatch(new RegExp(`types: \\[[^\\]]*\\b${type}\\b`));
      expect(text).toContain(`group: ${group}`);
      expect(text).toMatch(/cancel-in-progress: true/);
    },
  );

  it.each(['ci.yml', 'pr-title.workflow.yml'])(
    '%s runs for pull requests targeting any branch',
    (name) => {
      const text = readWorkflow(name);
      expect(text).toMatch(/^ {2}pull_request:$/m);
      expect(text).not.toMatch(/^\s+branches(-ignore)?:/m);
    },
  );
});

describe('workflow action pinning', () => {
  it.each(['ci.yml', 'pr-title.workflow.yml'])(
    'pins every action in %s to a commit SHA with a version comment',
    (name) => {
      const uses = readWorkflow(name)
        .split('\n')
        .filter((line) => /^\s+(- )?uses:/.test(line));
      expect(uses.length).toBeGreaterThan(0);
      expect(uses.filter((line) => !PINNED_ACTION.test(line))).toEqual([]);
    },
  );
});

describe('release.yml', () => {
  const release = readWorkflow('release.yml');

  it('creates a GitHub release with generated notes and no assets', () => {
    expect(release).toContain('gh release create "$RELEASE_TAG"');
    expect(release).toContain('--generate-notes');
    expect(release).not.toMatch(/dist\/release/);
    expect(release).not.toMatch(/upload-artifact|download-artifact/);
  });

  it('verifies the published release carries an empty asset set', () => {
    expect(release).toContain(
      `[[ "$(jq -r '.assets | length' <<<"$release_json")" == "0" ]]`,
    );
  });

  it('has no build or assemble jobs', () => {
    expect(release).not.toMatch(/^ {2}(build-[a-z]+|assemble):/m);
  });
});

describe('local-only policy', () => {
  it('never pushes from product code or scripts', () => {
    const offenders = ['src', 'scripts']
      .map((directory) => path.join(ROOT, directory))
      .flatMap(sourceFiles)
      .filter((file) =>
        /\bgit\b[^\n]{0,40}\bpush\b/.test(readFileSync(file, 'utf8')),
      );
    expect(offenders).toEqual([]);
  });
});

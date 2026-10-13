import { readdirSync, readFileSync, statSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const ROOT = path.resolve(import.meta.dirname, '..', '..', '..');
const WORKFLOWS = path.join(ROOT, '.github', 'workflows');

// Keep npm publishing on OIDC rather than adding a long-lived token secret.
const WORKFLOW_SECRETS = [
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
const PACKAGE_JOB = /^ {2}package:$/m;

// ci.yml lists quality, test, then package; the split keeps each job's own text.
function ciJobs(): { quality: string; test: string; package: string } {
  const [, afterQuality = ''] = readWorkflow('ci.yml').split(QUALITY_JOB);
  const [quality = '', afterTest = ''] = afterQuality.split(TEST_JOB);
  const [test = '', packageJob = ''] = afterTest.split(PACKAGE_JOB);
  return { quality, test, package: packageJob };
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
  it('references automation secrets without an npm publish token', () => {
    const referenced = new Set(
      workflowNames().flatMap((name) =>
        [...readWorkflow(name).matchAll(/secrets\.([A-Za-z_]+)/g)].map(
          (match) => match[1],
        ),
      ),
    );
    expect([...referenced].sort()).toEqual([...WORKFLOW_SECRETS].sort());
  });

  it('keeps the privileged jobs in the admin environment', () => {
    const withAdmin = workflowNames().filter((name) =>
      /^\s+environment: admin$/m.test(readWorkflow(name)),
    );
    expect(withAdmin.sort()).toEqual([
      'auto-merge-required-qa.workflow.yml',
      'auto-release.workflow.yml',
      'publish-npm.workflow.yml',
      'release-auto-merge.workflow.yml',
      'release.yml',
    ]);
  });
});

describe('workflow set', () => {
  it('contains the expected repository workflow set', () => {
    expect(workflowNames().sort()).toEqual([
      'auto-merge-required-qa.workflow.yml',
      'auto-release.workflow.yml',
      'ci.yml',
      'codeql.yml',
      'delete-cache.workflow.yml',
      'dependabot-auto-merge.workflow.yml',
      'dependabot-recreate-on-conflict.workflow.yml',
      'pr-title.workflow.yml',
      'publish-npm.workflow.yml',
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
    'publish-npm.workflow.yml',
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

describe('ci.yml package job', () => {
  const packageBlock = ciJobs().package;

  it('runs on Linux at the minimum supported Node version', () => {
    expect(packageBlock).toContain('runs-on: ubuntu-latest');
    expect(packageBlock).toContain('node-version: 22.13.0');
    expect(packageBlock).toContain(REPOSITORY_GUARD);
  });

  it('builds and runs the shared package smoke check', () => {
    expect(packageBlock).toContain('run: pnpm build');
    expect(packageBlock).toContain('bash scripts/verify-npm-package.sh');

    const smokeCheck = readFileSync(
      path.join(ROOT, 'scripts', 'verify-npm-package.sh'),
      'utf8',
    );
    expect(smokeCheck).toContain('mktemp -d');
    expect(smokeCheck).toContain('GITHUB_WORKSPACE');
    expect(smokeCheck).toContain('npm install --global --prefix');
    expect(smokeCheck).toContain('--ignore-scripts=false');
    expect(smokeCheck).toContain('npm publish --dry-run --access public');
    expect(smokeCheck).toContain('$consumer_root/bin/browser-recorder');
    expect(smokeCheck).toContain('$consumer_root/browser-recorder.cmd');
    expect(smokeCheck).toContain(
      '^package/(dist/.*|package\\.json|README\\.md|LICENSE)$',
    );
    expect(smokeCheck).toContain('--version');
  });

  it('checks required runtime files and excludes repository-only content', () => {
    const smokeCheck = readFileSync(
      path.join(ROOT, 'scripts', 'verify-npm-package.sh'),
      'utf8',
    );
    expect(smokeCheck).toContain('package/dist/main.js');
    expect(smokeCheck).toContain('package/dist/in-page/capture-script.js');
    expect(smokeCheck).toContain(
      '^package/(src|tests|openspec|\\.github|scripts)/',
    );
  });
});

describe('publish-npm.workflow.yml', () => {
  it('is manually dispatched with dry-run enabled by default', () => {
    const publish = readWorkflow('publish-npm.workflow.yml');
    expect(publish).toContain('workflow_dispatch:');
    expect(publish).toMatch(
      /dry_run:[\s\S]*?default: true[\s\S]*?type: boolean/u,
    );
    expect(publish).toContain('if: inputs.dry_run != true');
  });

  it('accepts automatic dispatch only with verified release metadata', () => {
    const publish = readWorkflow('publish-npm.workflow.yml');
    expect(publish).toContain('release_tag:');
    expect(publish).toContain('release_workflow_run_id:');
    expect(publish).toContain("github.actor == 'github-actions[bot]'");
    expect(publish).toContain('actions: read');
    expect(publish).toContain('actions/runs/${RELEASE_WORKFLOW_RUN_ID}');
    expect(publish).toContain('(.path // "") | split("@")[0]');
    expect(publish).toContain('"$run_conclusion" != \'success\'');
    expect(publish).toContain('refs/remotes/origin/${DEFAULT_BRANCH}');
    expect(publish).toContain('for attempt in $(seq 1 12)');
  });

  it('builds the immutable release tag and skips registry duplicates', () => {
    const publish = readWorkflow('publish-npm.workflow.yml');
    expect(publish).toContain('ref: ${{ inputs.release_tag || github.sha }}');
    expect(publish).toContain('already_published');
    expect(publish).toContain(
      "needs.validate.outputs.already_published != 'true'",
    );
    expect(publish).not.toContain('Reject an already published version');
  });

  it('guards jobs to the owner and default branch of this repository', () => {
    const publish = readWorkflow('publish-npm.workflow.yml');
    expect(publish).toContain(REPOSITORY_GUARD);
    expect(publish).toContain('github.actor == github.repository_owner');
    expect(publish).toContain('github.event.repository.fork == false');
    expect(publish).toContain(
      'github.ref_name == github.event.repository.default_branch',
    );
  });

  it('publishes a validated public tarball through protected OIDC', () => {
    const publish = readWorkflow('publish-npm.workflow.yml');
    const [, publishing = ''] = publish.split('  publish:');
    expect(publishing).toContain('environment: admin');
    expect(publishing).toContain('id-token: write');
    expect(publishing).toContain('node-version: 22.14.0');
    expect(publishing).toContain('npm install --global npm@11.5.1');
    expect(publishing).toContain('npm publish "$TARBALL" --access public');
    expect(publishing).not.toContain('NODE_AUTH_TOKEN');
    expect(publishing).not.toContain('NPM_AUTH_TOKEN');
    expect(publish).toContain('npm view');
  });

  it('validates and publishes the exact packed tarball', () => {
    const publish = readWorkflow('publish-npm.workflow.yml');
    expect(publish).toContain('bash scripts/verify-npm-package.sh');
    expect(publish).toContain('path: ${{ steps.package.outputs.tarball }}');
    expect(publish).toContain('actions/upload-artifact@');
    expect(publish).toContain('actions/download-artifact@');
    expect(publish).toContain('TARBALL: ${{ runner.temp }}/npm-package/');
    expect(publish.indexOf('npm view')).toBeLessThan(
      publish.indexOf('npm publish'),
    );
    expect(publish).toContain('npm publish "$TARBALL" --access public');
    expect(publish).not.toContain('--provenance');
  });

  it('requires the protected environment only for a real publication', () => {
    const publish = readWorkflow('publish-npm.workflow.yml');
    const [validation = '', publishing = ''] = publish.split('  publish:');
    expect(validation).not.toContain('environment: admin');
    expect(publishing).toContain('needs: validate');
    expect(publishing).toContain('environment: admin');
    expect(publishing).toContain('inputs.dry_run != true');
  });

  it('does not require a long-lived npm token', () => {
    const publish = readWorkflow('publish-npm.workflow.yml');
    expect(publish).not.toContain('NPM_AUTH_TOKEN');
    expect(publish).not.toContain('NODE_AUTH_TOKEN');
  });

  it('pins every action to a full SHA', () => {
    const uses = readWorkflow('publish-npm.workflow.yml')
      .split('\n')
      .filter((line) => /^\s+(- )?uses:/.test(line));
    expect(uses.length).toBeGreaterThan(0);
    expect(uses.filter((line) => !PINNED_ACTION.test(line))).toEqual([]);
  });
});

describe('pr-title.workflow.yml', () => {
  it('re-checks on every title-relevant event, including edits', () => {
    const title = readWorkflow('pr-title.workflow.yml');
    expect(title).toContain('types: [opened, edited, reopened, synchronize]');
  });

  it('has no bot guard on the title lint', () => {
    const title = readWorkflow('pr-title.workflow.yml');
    expect(title).not.toMatch(/user\.type/);
    expect(title).not.toMatch(/'Bot'/);
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

describe('preserved guards and permissions', () => {
  it.each(['ci.yml', 'pr-title.workflow.yml'])(
    '%s keeps permissions read-all and job-level contents: read',
    (name) => {
      const text = readWorkflow(name);
      expect(text).toMatch(/^permissions: read-all$/m);
      expect(text).toMatch(/^ {4}permissions:\n {6}contents: read$/m);
    },
  );

  it('keeps the draft guard on both ci.yml jobs', () => {
    const { quality, test } = ciJobs();
    for (const block of [quality, test]) {
      expect(block).toContain('github.event.pull_request.draft == false');
    }
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

  it('dispatches the existing npm workflow after release verification', () => {
    const [, publishing = ''] = release.split(/^ {2}publish:\n/m);
    const verifyIndex = publishing.indexOf('name: Verify published release');
    const dispatchIndex = publishing.indexOf('name: Dispatch npm publication');
    expect(publishing).toContain('actions: write');
    expect(publishing).toContain('gh workflow run publish-npm.workflow.yml');
    expect(publishing).toContain('-f release_tag="$RELEASE_TAG"');
    expect(publishing).toContain('-f release_workflow_run_id="$GITHUB_RUN_ID"');
    expect(verifyIndex).toBeGreaterThanOrEqual(0);
    expect(dispatchIndex).toBeGreaterThan(verifyIndex);
  });

  it('can re-dispatch npm publication after verifying an existing release', () => {
    const [detect = '', publishing = ''] = release.split(/^ {2}publish:\n/m);
    expect(detect).toContain('echo "release_exists=true" >> "$GITHUB_OUTPUT"');
    expect(detect).toContain('echo "publish=true" >> "$GITHUB_OUTPUT"');
    expect(publishing).toContain(
      'RELEASE_EXISTS: ${{ needs.detect.outputs.release_exists }}',
    );
    expect(publishing).toMatch(/RELEASE_EXISTS" != 'true'/);
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

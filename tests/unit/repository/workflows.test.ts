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
    expect(ci).toContain('pnpm exec playwright install chromium');
    expect(ci).toContain('pnpm exec playwright install --with-deps chromium');
    expect(ci).toMatch(
      /if: matrix\.os == 'linux'\n\s+run: pnpm exec playwright install --with-deps chromium/,
    );
  });

  it('audits dependencies on Linux only', () => {
    expect(ci).toMatch(
      /name: Audit dependencies\n\s+if: matrix\.os == 'linux'\n\s+run: pnpm audit --audit-level=moderate/,
    );
  });

  it('runs coverage and a build on every platform', () => {
    expect(ci).toContain('run: pnpm test:coverage');
    expect(ci).toContain('run: pnpm build');
  });
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

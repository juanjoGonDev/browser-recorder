import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';

import { describe, expect, it } from 'vitest';

import { classifyReleaseImpact } from '../../../scripts/release-impact-policy.ts';

const autoReleaseWorkflow = readFileSync(
  '.github/workflows/auto-release.workflow.yml',
  'utf8',
);
const releaseWorkflow = readFileSync('.github/workflows/release.yml', 'utf8');
const labelWorkflow = readFileSync(
  '.github/workflows/release-impact-label.workflow.yml',
  'utf8',
);
const releaseNotesConfig = readFileSync('.github/release.yml', 'utf8');
const policyCommand =
  'node --experimental-strip-types scripts/release-impact-policy.ts';
const nodeSetup = 'uses: actions/setup-node@';

describe('release impact workflow integration', () => {
  it('sets up Node before every workflow can execute the TypeScript policy', () => {
    const autoReleaseSetupIndex = autoReleaseWorkflow.indexOf(nodeSetup);
    const autoReleasePolicyIndex = autoReleaseWorkflow.indexOf(policyCommand);
    expect(autoReleaseSetupIndex).toBeGreaterThanOrEqual(0);
    expect(autoReleasePolicyIndex).toBeGreaterThan(autoReleaseSetupIndex);

    const releaseSetupIndex = releaseWorkflow.indexOf(nodeSetup);
    const releasePolicyIndex = releaseWorkflow.indexOf(policyCommand);
    expect(releaseSetupIndex).toBeGreaterThanOrEqual(0);
    expect(releasePolicyIndex).toBeGreaterThan(releaseSetupIndex);
  });

  it('labels pull requests from the same policy that gates releases', () => {
    const labelSetupIndex = labelWorkflow.indexOf(nodeSetup);
    const labelPolicyIndex = labelWorkflow.indexOf(policyCommand);
    expect(labelSetupIndex).toBeGreaterThanOrEqual(0);
    expect(labelPolicyIndex).toBeGreaterThan(labelSetupIndex);
    expect(labelWorkflow).toContain(
      `${policyCommand} range "$BASE_SHA" "$HEAD_SHA"`,
    );
  });

  it('recomputes the label on every pull request revision', () => {
    expect(labelWorkflow).toContain('pull_request_target:');
    expect(labelWorkflow).toContain('types: [opened, reopened, synchronize]');
  });

  it('never checks out the pull request head it labels', () => {
    expect(labelWorkflow).toContain(
      'ref: ${{ github.event.pull_request.base.sha }}',
    );
    expect(labelWorkflow).not.toContain(
      'ref: ${{ github.event.pull_request.head.sha }}',
    );
    expect(labelWorkflow).toContain('pull-requests: write');
  });

  it('drives the label in both directions', () => {
    expect(labelWorkflow).toContain('--add-label "$LABEL"');
    expect(labelWorkflow).toContain('--remove-label "$LABEL"');
  });

  it('excludes release-neutral pull requests from the generated notes', () => {
    expect(releaseNotesConfig).toContain('release-neutral');
  });

  it('counts only release-impacting commits toward automatic releases', () => {
    expect(autoReleaseWorkflow).toContain(
      `${policyCommand} pending "$current_tag" HEAD`,
    );
    expect(autoReleaseWorkflow).toContain(
      'commit_count=$(jq -r \'.commitCount\' <<<"$impact_json")',
    );
    expect(autoReleaseWorkflow).toContain(
      'Only $commit_count release-impacting commits since $current_tag',
    );
    expect(autoReleaseWorkflow).not.toContain(
      'git rev-list --count "${current_tag}..HEAD"',
    );
  });

  it('derives automatic SemVer only from release-impacting commits', () => {
    expect(autoReleaseWorkflow).toContain(
      'mapfile -t release_commits < <(jq -r \'.commits[]\' <<<"$impact_json")',
    );
    expect(autoReleaseWorkflow).toContain(
      'git show -s --format=\'%s%n%b\' "$sha"',
    );
    expect(autoReleaseWorkflow).not.toContain('git log "${CURRENT_TAG}..HEAD"');
  });

  it('skips automatic publication without pending artifact impact', () => {
    expect(releaseWorkflow).toContain(
      'if [[ "$EVENT_NAME" != "workflow_dispatch" ]]; then',
    );
    expect(releaseWorkflow).toContain(
      `${policyCommand} pending "$latest_release_tag" "$release_sha"`,
    );
    expect(releaseWorkflow).toContain(
      'No release-impacting commits exist between $latest_release_tag and $release_sha; release skipped.',
    );
    expect(releaseWorkflow).toContain(
      "if: needs.detect.outputs.publish == 'true'",
    );
  });

  it("never derives a checkout ref from another job's outputs", () => {
    // In a cache-writable workflow CodeQL treats such refs as untrusted code
    // (cache-poisoning alerts). Every checkout is a plain immutable-sha one.
    expect(releaseWorkflow).not.toMatch(/ref:\s*\$\{\{\s*needs\./u);
    const checkouts = releaseWorkflow.match(/uses: actions\/checkout@/gu) ?? [];
    expect(checkouts).toHaveLength(1);
  });

  it('tags the release at the resolved commit via the explicit --target', () => {
    expect(releaseWorkflow).toContain(
      '- name: Checkout trusted default branch',
    );
    expect(releaseWorkflow).toContain('- name: Create immutable release tag');
    expect(releaseWorkflow).toContain('- name: Verify published release');
    expect(
      releaseWorkflow,
      'the release must target the resolved commit, not the event SHA',
    ).toContain('--target "$RELEASE_SHA"');
    expect(releaseWorkflow).toContain('workflow_dispatch:');
  });

  // The policy decides whether a change needs a release; release-validation.yml
  // decides whether that change gets a dry run. If a script the policy calls
  // release-impacting is missing from the workflow filter, it ships without
  // ever being dry-run. Assert the containment instead of trusting two
  // hand-maintained copies.
  it('dry-runs every release-impacting script in release-validation.yml', () => {
    const validation = readFileSync(
      '.github/workflows/release-validation.yml',
      'utf8',
    );
    const filtered = new Set(
      [...validation.matchAll(/^\s+- '([^']+)'$/gmu)].map(
        (match) => match[1] ?? '',
      ),
    );
    expect(filtered.size).toBeGreaterThan(0);

    // --others so a newly added, not-yet-committed script is covered too:
    // that is exactly when the two lists drift apart.
    const trackedScripts = spawnSync(
      'git',
      ['ls-files', '--cached', '--others', '--exclude-standard', 'scripts/'],
      { encoding: 'utf8' },
    )
      .stdout.split('\n')
      .filter((path) => path.length > 0);
    expect(trackedScripts.length).toBeGreaterThan(0);

    const uncovered = trackedScripts.filter(
      (path) => classifyReleaseImpact([path]).publish && !filtered.has(path),
    );
    expect(
      uncovered,
      'release-impacting scripts missing from the release-validation.yml path filter',
    ).toEqual([]);
  });
});

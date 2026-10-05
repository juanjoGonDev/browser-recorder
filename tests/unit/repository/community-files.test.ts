import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const ROOT = path.resolve(import.meta.dirname, '..', '..', '..');
const REPO_URL = 'https://github.com/juanjoGonDev/browser-recorder';

function read(name: string): string {
  return readFileSync(path.join(ROOT, name), 'utf8');
}

describe('LICENSE', () => {
  const text = read('LICENSE');

  it('is the PolyForm Noncommercial License 1.0.0 with the required notice', () => {
    expect(text).toContain('# PolyForm Noncommercial License 1.0.0');
    expect(text).toContain('## Noncommercial Purposes');
    expect(text).toContain(
      'Required Notice: Copyright (c) 2026 Juan José González (https://github.com/juanjoGonDev)',
    );
  });
});

describe('package.json metadata', () => {
  const pkg = JSON.parse(read('package.json')) as Record<string, unknown>;

  it('declares the license, repository links and author', () => {
    expect(pkg['license']).toBe('PolyForm-Noncommercial-1.0.0');
    expect(pkg['private']).toBe(true);
    expect(pkg['homepage']).toBe(`${REPO_URL}#readme`);
    expect(pkg['bugs']).toEqual({ url: `${REPO_URL}/issues` });
    expect(pkg['repository']).toEqual({
      type: 'git',
      url: `git+${REPO_URL}.git`,
    });
    expect(pkg['author']).toContain('juanjoGonDev');
  });
});

describe('README.md', () => {
  const readme = read('README.md');

  it('has CI and license badges', () => {
    expect(readme).toContain(`${REPO_URL}/actions/workflows/ci.yml`);
    expect(readme).toContain('PolyForm Noncommercial');
  });

  it('states accurately that it is source-available, not open source', () => {
    const start = readme.indexOf('\n## License\n');
    expect(start).toBeGreaterThanOrEqual(0);
    const section = readme.slice(start);
    expect(section).toMatch(/source-available/i);
    expect(section).toMatch(/not an OSI/i);
    expect(section).toMatch(/commercial use/i);
  });
});

describe('issue templates', () => {
  it('disables blank issues and links private security reporting', () => {
    const config = read('.github/ISSUE_TEMPLATE/config.yml');
    expect(config).toContain('blank_issues_enabled: false');
    expect(config).toContain(`${REPO_URL}/security/advisories/new`);
  });

  it('bug report asks for the environment and warns about redaction', () => {
    const form = read('.github/ISSUE_TEMPLATE/bug_report.yml');
    for (const field of ['version', 'os', 'node', 'steps', 'expected']) {
      expect(form).toContain(`id: ${field}`);
    }
    expect(form).toContain('macOS');
    expect(form).toContain('Windows');
    expect(form).toContain('Linux');
    expect(form).toMatch(/redact/i);
    expect(form).toContain('recording.json');
  });

  it('feature request form exists', () => {
    expect(read('.github/ISSUE_TEMPLATE/feature_request.yml')).toContain(
      'name: Feature request',
    );
  });
});

describe('pull request template', () => {
  const template = read('.github/pull_request_template.md');

  it.each([
    '## What and why',
    '## How',
    '## Testing',
    '## Risks and rollback',
    '## Checklist',
    'Conventional Commit',
    'strict TDD',
    'Co-Authored-By',
    'CHANGELOG',
  ])('mentions %s', (needle) => {
    expect(template).toContain(needle);
  });
});

describe('contributor docs', () => {
  it('CONTRIBUTING.md covers setup, workflow and security reporting', () => {
    const text = read('CONTRIBUTING.md');
    for (const needle of [
      'pnpm install',
      'macOS',
      'Windows',
      'Linux',
      'AGENTS.md',
      '<type>/<slug>',
      'BROWSER_RECORDER_HEADED_TESTS',
      'SECURITY.md',
      'LICENSE',
    ]) {
      expect(text).toContain(needle);
    }
    expect(text).not.toMatch(/\bnpm install\b|\byarn\b/);
  });

  it('CODE_OF_CONDUCT.md is Contributor Covenant 2.1 with a contact', () => {
    const text = read('CODE_OF_CONDUCT.md');
    expect(text).toContain('# Contributor Covenant Code of Conduct');
    expect(text).toContain('version 2.1');
    expect(text).not.toContain('[INSERT CONTACT METHOD]');
    expect(text).toContain(`${REPO_URL}/security/advisories/new`);
  });

  it('SECURITY.md states supported versions and plaintext recordings', () => {
    const text = read('SECURITY.md');
    expect(text).toContain('## Supported versions');
    expect(text).toContain('## Scope');
    expect(text).toMatch(/plaintext/i);
    expect(text).toContain(`${REPO_URL}/security/advisories/new`);
  });

  it('CODEOWNERS assigns everything to the owner', () => {
    expect(read('.github/CODEOWNERS')).toContain('* @juanjoGonDev');
  });
});

describe('cross-OS hygiene', () => {
  it('.gitattributes normalizes to LF and marks binaries', () => {
    const text = read('.gitattributes');
    expect(text).toContain('* text=auto eol=lf');
    expect(text).toMatch(/\*\.png\s+binary/);
  });

  it('.editorconfig matches the Prettier style', () => {
    expect(existsSync(path.join(ROOT, '.editorconfig'))).toBe(true);
    const text = read('.editorconfig');
    expect(text).toContain('root = true');
    expect(text).toContain('end_of_line = lf');
    expect(text).toContain('indent_size = 2');
    expect(text).toContain('insert_final_newline = true');
  });
});

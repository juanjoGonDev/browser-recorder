import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const ROOT = path.resolve(import.meta.dirname, '..', '..', '..');

function readDoc(name: string): string {
  return readFileSync(path.join(ROOT, name), 'utf8');
}

/** The body of a `## ` section, so a phrase has to sit under its heading. */
function section(text: string, heading: string): string {
  const start = text.indexOf(`\n## ${heading}\n`);
  expect(start, `missing heading ${heading}`).toBeGreaterThanOrEqual(0);
  const rest = text.slice(start + heading.length + 5);
  const next = rest.search(/\n## /);
  return next === -1 ? rest : rest.slice(0, next);
}

describe('README.md browser and profile selection', () => {
  const readme = readDoc('README.md');
  const browsers = section(readme, 'Browsers and profiles');

  it('names the engine as Patchright and no longer tells people to use Playwright', () => {
    expect(readme).toMatch(/Patchright/);
    expect(readme).not.toMatch(/pnpm exec playwright/);
    expect(readme).not.toMatch(/imports only `playwright`/);
  });

  it('lists the browsers it can use and the ones it cannot', () => {
    for (const name of ['Brave', 'Chrome', 'Edge', 'Vivaldi', 'Opera']) {
      expect(browsers).toContain(name);
    }
    expect(browsers).toMatch(/Firefox and Safari are not supported/);
  });

  it('describes the three profile modes', () => {
    expect(browsers).toMatch(/Managed/);
    expect(browsers).toMatch(/Copy of/);
    expect(browsers).toMatch(/Ephemeral/);
  });

  it('explains the real profile copy honestly', () => {
    expect(browsers).toMatch(/copies? .* on every launch/is);
    expect(browsers).toMatch(/never (modifies|writes to) the original/i);
    expect(browsers).toMatch(/Chrome 136/);
    expect(browsers).toMatch(/keychain/i);
    expect(browsers).toMatch(/app-bound/i);
    expect(browsers).toMatch(/Opera/);
  });

  it('documents the opt-in test switches', () => {
    expect(readme).toContain('BROWSER_RECORDER_REAL_BROWSER_TESTS=1');
    expect(readme).toContain('tests/fixtures/profiles');
  });
});

describe('SECURITY.md profile handling', () => {
  const security = readDoc('SECURITY.md');

  it('warns that copied profiles hold session cookies', () => {
    expect(security).toMatch(/session cookies/i);
    expect(security).toMatch(/0700/);
    expect(security).toMatch(/app-data/i);
    expect(security).toMatch(/deleted/i);
  });

  it('names Patchright as the browser engine to report upstream', () => {
    expect(security).toMatch(/Patchright/);
    expect(security).not.toMatch(/Playwright downloading/);
  });
});

describe('AGENTS.md and CONTRIBUTING.md wording', () => {
  it('say Patchright wherever they used to say Playwright', () => {
    for (const name of ['AGENTS.md', 'CONTRIBUTING.md']) {
      const text = readDoc(name);
      expect(text, name).not.toMatch(/playwright/i);
    }
    expect(readDoc('AGENTS.md')).toMatch(/Patchright is the only runtime/);
    expect(readDoc('CONTRIBUTING.md')).toContain(
      'pnpm exec patchright install-deps chromium',
    );
  });

  it('keep the real profile rule in the agent agreement', () => {
    expect(readDoc('AGENTS.md')).toMatch(
      /never (read|write)s? .*real browser profile/i,
    );
  });
});

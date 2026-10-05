import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const ROOT = path.resolve(import.meta.dirname, '..', '..', '..');

function readDoc(name: string): string {
  return readFileSync(path.join(ROOT, name), 'utf8');
}

// Every section the agent agreement must carry, with a phrase that proves
// the section says what the spec requires rather than merely having a title.
const REQUIRED_SECTIONS: readonly (readonly [string, RegExp])[] = [
  ['## Spec-driven development', /SDD is always used/],
  ['## No review budget', /no line limit/i],
  ['## Single pull request', /single pull request/i],
  ['## Autonomy', /autonomous/i],
  ['## Strict TDD', /RED.*GREEN.*REFACTOR/s],
  ['## Clean code and SOLID', /SOLID/],
  ['## Architecture', /screaming/i],
  ['## Naming and lint rules', /kebab-case/],
  [
    '## Parallel agents and worktrees',
    /min\(floor\(\(freeRAM_GB - 2\) \/ 1\.5\), cpuCores - 2\)/,
  ],
  ['## Branching and pull requests', /squash \+ merge/i],
  ['## Pushing and pull requests', /only when the owner asks/i],
  ['## Recordings are plaintext', /plaintext/i],
  ['## Quality gate', /pnpm quality/],
];

describe('CLAUDE.md', () => {
  it('imports AGENTS.md', () => {
    expect(readDoc('CLAUDE.md').trim()).toBe('@AGENTS.md');
  });
});

describe('AGENTS.md', () => {
  const agents = readDoc('AGENTS.md');

  it.each(REQUIRED_SECTIONS)('has the section %s', (heading, phrase) => {
    const start = agents.indexOf(`\n${heading}\n`);
    expect(start, `missing heading ${heading}`).toBeGreaterThanOrEqual(0);
    const rest = agents.slice(start + heading.length + 2);
    const next = rest.search(/\n## /);
    const body = next === -1 ? rest : rest.slice(0, next);
    expect(body).toMatch(phrase);
  });

  it('sizes parallel worktrees under the sibling worktrees directory', () => {
    expect(agents).toContain('../browser-recorder-worktrees/');
    expect(agents).toContain('git worktree remove');
  });

  it('keeps every test run headless', () => {
    expect(agents).toContain('BROWSER_RECORDER_HEADED_TESTS=1');
  });

  it('states a self-contained branch naming rule', () => {
    expect(agents).toContain('<type>/<slug>');
  });

  it('forbids rebasing, force pushes and AI attribution', () => {
    expect(agents).toMatch(/git merge main/);
    expect(agents).toMatch(/never rebase/i);
    expect(agents).toMatch(/force push/i);
    expect(agents).toMatch(/Co-Authored-By/);
  });
});

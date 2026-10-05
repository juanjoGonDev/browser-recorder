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

describe('AGENTS.md cli feature', () => {
  const architecture = section(readDoc('AGENTS.md'), 'Architecture');

  it('lists cli among the capabilities under src/', () => {
    expect(architecture).toMatch(/`cli`/u);
  });

  it('keeps its output behind the command output port, not the console', () => {
    expect(readDoc('AGENTS.md')).toMatch(/Terminal` port/u);
    expect(architecture).toMatch(/cli.*(port|never)/isu);
  });
});

describe('README.md command line', () => {
  const readme = readDoc('README.md');
  const cli = section(readme, 'Command line');

  it('shows both ways to replay one recording', () => {
    expect(cli).toContain('browser-recorder replay <name|slug>');
    expect(cli).toContain('pnpm replay <name|slug>');
  });

  it.each([
    '-r, --random',
    '-d, --delay <min-max>',
    '--headless',
    '-h, --help',
    '-v, --version',
    '250-900',
    '60000',
  ])('documents %s', (fragment) => {
    expect(cli).toContain(fragment);
  });

  it('lists every exit code', () => {
    for (const code of ['0', '1', '2', '130', '143']) {
      expect(cli).toMatch(new RegExp(`\\b${code}\\b`, 'u'));
    }
  });

  it('explains the human timing mode, its environment and what stays the same', () => {
    expect(cli).toMatch(/human/iu);
    expect(cli).toContain('BROWSER_RECORDER_TIMING');
    expect(cli).toContain('BROWSER_RECORDER_HUMAN_DELAY');
    expect(cli).toContain('BROWSER_RECORDER_SEED');
    expect(cli).toMatch(/exact (recorded )?value/iu);
    expect(cli).toMatch(/not (saved|stored|remembered)/iu);
  });

  it('says what goes to stdout and stderr, and that no browser is installed', () => {
    expect(cli).toMatch(/stdout/u);
    expect(cli).toMatch(/stderr/u);
    expect(cli).toMatch(/never installs/iu);
    expect(cli).toMatch(/NO_COLOR/u);
  });

  it('has a Windows note on cancelling', () => {
    expect(cli).toMatch(/Windows/u);
    expect(cli).toMatch(/Ctrl\+C/u);
  });

  it('lists the timing key of the library in the keys table', () => {
    expect(readme).toMatch(/\| Library\s+\|[^\n]*`h`/u);
  });

  it('no longer claims the interactive terminal is always required', () => {
    expect(readme).not.toMatch(
      /An interactive terminal \(the UI refuses to start through a pipe\)\./u,
    );
    expect(readme).toMatch(/interactive terminal/iu);
  });
});

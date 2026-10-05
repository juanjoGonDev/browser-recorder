import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const ROOT = path.resolve(import.meta.dirname, '..', '..', '..');
const COMMITLINT_BIN = path.join(
  ROOT,
  'node_modules',
  '@commitlint',
  'cli',
  'cli.js',
);

function lintMessage(message: string): {
  status: number | null;
  output: string;
} {
  const result = spawnSync(process.execPath, [COMMITLINT_BIN], {
    cwd: ROOT,
    input: message,
    encoding: 'utf8',
  });
  return { status: result.status, output: result.stdout + result.stderr };
}

/** The `run:` commands of one lefthook hook, in file order. */
function hookCommands(hook: string): string[] {
  const text = readFileSync(path.join(ROOT, 'lefthook.yml'), 'utf8');
  const block = new RegExp(`^${hook}:\\n((?:[ \\t].*\\n?|\\n)*)`, 'm').exec(
    text,
  );
  const body = block?.[1] ?? '';
  return [...body.matchAll(/run:\s*(.+)/g)].map((match) => match[1].trim());
}

describe('commitlint', () => {
  it('rejects a message that is not a Conventional Commit', () => {
    const { status, output } = lintMessage('fixed stuff');
    expect(status).toBe(1);
    expect(output).toContain('subject may not be empty');
  });

  it('accepts a Conventional Commit', () => {
    expect(lintMessage('feat: add x').status).toBe(0);
  });

  it('rejects an unknown commit type', () => {
    const { status, output } = lintMessage('wip: add x');
    expect(status).toBe(1);
    expect(output).toContain('type must be one of');
  });
});

describe('lefthook.yml', () => {
  it('formats staged files, then lints, typechecks and builds on pre-commit', () => {
    expect(hookCommands('pre-commit')).toEqual([
      'pnpm prettier --write {staged_files}',
      'pnpm lint:strict',
      'pnpm typecheck',
      'pnpm build',
    ]);
  });

  it('lints the commit message on commit-msg', () => {
    expect(hookCommands('commit-msg')).toEqual([
      'pnpm exec commitlint --edit {1}',
    ]);
  });

  it('runs formatting, coverage, deadcode, deps and audit on pre-push', () => {
    expect(hookCommands('pre-push')).toEqual([
      'pnpm format:check',
      'pnpm test:coverage',
      'pnpm deadcode',
      'pnpm deps:check',
      'pnpm audit --audit-level=moderate',
    ]);
  });

  it('re-stages files prettier rewrote', () => {
    const text = readFileSync(path.join(ROOT, 'lefthook.yml'), 'utf8');
    expect(text).toContain('stage_fixed: true');
  });
});

describe('postinstall', () => {
  it('installs the git hooks through scripts/install-hooks.ts', () => {
    const manifest = JSON.parse(
      readFileSync(path.join(ROOT, 'package.json'), 'utf8'),
    ) as { scripts: Record<string, string> };
    expect(manifest.scripts['postinstall']).toBe(
      'node --experimental-strip-types scripts/install-hooks.ts',
    );
  });
});

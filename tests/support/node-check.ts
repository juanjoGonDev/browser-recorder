import { spawnSync } from 'node:child_process';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';

export interface SyntaxCheck {
  readonly isValid: boolean;
  readonly stderr: string;
}

/** Runs `node --check` on the source as an ES module, like the replay does. */
export function checkModuleSyntax(source: string): SyntaxCheck {
  const directory = mkdtempSync(path.join(tmpdir(), 'node-check-'));
  try {
    const file = path.join(directory, 'subject.mjs');
    writeFileSync(file, source);
    const result = spawnSync(process.execPath, ['--check', file], {
      encoding: 'utf8',
    });
    return { isValid: result.status === 0, stderr: result.stderr };
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
}

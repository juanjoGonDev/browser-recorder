import { spawnSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, readFileSync, rmSync } from 'node:fs';
import path from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { buildApp } from '../../../scripts/build.ts';

const ROOT = path.resolve(import.meta.dirname, '..', '..', '..');
// Inside the repository so the emitted entry resolves `playwright` like the
// real build does.
const SCRATCH_PARENT = path.join(ROOT, 'recordings');
// A real tsc run: seconds alone, much longer while the whole suite shares the
// CPU with its browsers.
const BUILD_TIMEOUT_MS = 120_000;

describe('scripts/build.ts against the real toolchain', () => {
  let outDir = '';

  beforeAll(async () => {
    mkdirSync(SCRATCH_PARENT, { recursive: true });
    outDir = mkdtempSync(path.join(SCRATCH_PARENT, 'build-out-'));
    await buildApp({ root: ROOT, outDir });
  }, BUILD_TIMEOUT_MS);

  afterAll(() => {
    rmSync(outDir, { recursive: true, force: true });
  });

  it('emits the CLI entry with its shebang', () => {
    const main = readFileSync(path.join(outDir, 'main.js'), 'utf8');
    expect(main.startsWith('#!/usr/bin/env node')).toBe(true);
  });

  it('refuses to start without an interactive terminal, with a message', () => {
    const result = spawnSync(process.execPath, [path.join(outDir, 'main.js')], {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    expect(result.status).toBe(1);
    expect(result.stderr).toContain('interactive terminal');
    expect(result.stdout).toBe('');
  });

  it('emits the in-page script as an IIFE with no imports or exports', () => {
    const bundle = readFileSync(
      path.join(outDir, 'in-page', 'capture-script.js'),
      'utf8',
    );
    expect(bundle).toMatch(/\(\(\) => \{[\s\S]*\}\)\(\);/);
    expect(bundle).not.toMatch(/^\s*import[\s{*]/m);
    expect(bundle).not.toMatch(/^\s*export[\s{*]/m);
  });
});

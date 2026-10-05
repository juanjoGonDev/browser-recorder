import { spawnSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { buildApp } from '../../../scripts/build.ts';

const ROOT = path.resolve(import.meta.dirname, '..', '..', '..');

describe('scripts/build.ts against the real toolchain', () => {
  let outDir = '';

  beforeAll(async () => {
    outDir = mkdtempSync(path.join(tmpdir(), 'br-build-out-'));
    await buildApp({ root: ROOT, outDir });
  });

  afterAll(() => {
    rmSync(outDir, { recursive: true, force: true });
  });

  it('emits the CLI entry with its shebang', () => {
    const main = readFileSync(path.join(outDir, 'main.js'), 'utf8');
    expect(main.startsWith('#!/usr/bin/env node')).toBe(true);
  });

  it('runs the emitted CLI entry to a clean exit', () => {
    const result = spawnSync(process.execPath, [path.join(outDir, 'main.js')], {
      encoding: 'utf8',
    });
    expect(result.status).toBe(0);
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

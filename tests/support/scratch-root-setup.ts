import { rmSync } from 'node:fs';

import { SCRATCH_ROOT } from './scratch-root.ts';

const SWEPT_VARIABLE = 'BROWSER_RECORDER_SCRATCH_SWEPT';

function sweep(): void {
  rmSync(SCRATCH_ROOT, { recursive: true, force: true });
}

/**
 * Vitest `globalSetup`: removes scratch left by a killed or timed-out run, and
 * removes this run's scratch at teardown.
 */
export default function scratchRoot(): () => void {
  // Several projects run this setup in one process: sweep only once.
  if (process.env[SWEPT_VARIABLE] !== undefined) return () => undefined;
  process.env[SWEPT_VARIABLE] = '1';
  sweep();
  return sweep;
}

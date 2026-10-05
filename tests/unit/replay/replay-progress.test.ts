import { describe, expect, it } from 'vitest';

import {
  applyExit,
  applyMessage,
  applyStderrLine,
  createReplayProgress,
  STDERR_TAIL_LINES,
} from '../../../src/replay/domain/replay-progress.ts';

const OFFSETS = [0, 500, 1200];

describe('replay-progress', () => {
  it('starts running with every step pending and no drift', () => {
    const progress = createReplayProgress(OFFSETS);

    expect(progress.status).toBe('running');
    expect(progress.lastStepIndex).toBeNull();
    expect(progress.steps.map((step) => step.status)).toEqual([
      'pending',
      'pending',
      'pending',
    ]);
    expect(progress.steps[1]).toMatchObject({
      offsetMs: 500,
      elapsedMs: null,
      driftMs: null,
    });
  });

  it('marks earlier steps done and computes drift for the running one', () => {
    let progress = createReplayProgress(OFFSETS);
    progress = applyMessage(progress, {
      kind: 'step',
      index: 0,
      elapsedMs: 12,
    });
    progress = applyMessage(progress, {
      kind: 'step',
      index: 1,
      elapsedMs: 540,
    });

    expect(progress.lastStepIndex).toBe(1);
    expect(progress.steps.map((step) => step.status)).toEqual([
      'done',
      'running',
      'pending',
    ]);
    expect(progress.steps[0]?.driftMs).toBe(12);
    expect(progress.steps[1]?.driftMs).toBe(40);
  });

  it('reports a negative drift when a step starts early', () => {
    const progress = applyMessage(createReplayProgress(OFFSETS), {
      kind: 'step',
      index: 2,
      elapsedMs: 1100,
    });

    expect(progress.steps[2]?.driftMs).toBe(-100);
  });

  it('leaves drift null when drift is not tracked, as in human timing', () => {
    const progress = applyMessage(
      createReplayProgress(OFFSETS, { isDriftTracked: false }),
      { kind: 'step', index: 1, elapsedMs: 4000 },
    );

    expect(progress.steps[1]).toMatchObject({
      status: 'running',
      elapsedMs: 4000,
      driftMs: null,
    });
  });

  it('still computes drift when it is tracked explicitly', () => {
    const progress = applyMessage(
      createReplayProgress(OFFSETS, { isDriftTracked: true }),
      { kind: 'step', index: 1, elapsedMs: 540 },
    );

    expect(progress.steps[1]?.driftMs).toBe(40);
  });

  it('keeps drift null when the marker carries no elapsed time', () => {
    const progress = applyMessage(createReplayProgress(OFFSETS), {
      kind: 'step',
      index: 1,
      elapsedMs: null,
    });

    expect(progress.steps[1]).toMatchObject({
      status: 'running',
      elapsedMs: null,
      driftMs: null,
    });
  });

  it('ignores a step index beyond the recorded steps but remembers it', () => {
    const progress = applyMessage(createReplayProgress(OFFSETS), {
      kind: 'step',
      index: 9,
      elapsedMs: 1,
    });

    expect(progress.steps).toHaveLength(3);
    expect(progress.lastStepIndex).toBe(9);
  });

  it('marks every step done on the done marker', () => {
    const progress = applyMessage(createReplayProgress(OFFSETS), {
      kind: 'done',
      elapsedMs: 2000,
    });

    expect(progress.steps.every((step) => step.status === 'done')).toBe(true);
  });

  it('records the error message and keeps the last step index', () => {
    let progress = applyMessage(createReplayProgress(OFFSETS), {
      kind: 'step',
      index: 1,
      elapsedMs: 500,
    });
    progress = applyMessage(progress, {
      kind: 'error',
      index: 1,
      message: 'locator gone',
    });

    expect(progress.errorMessage).toBe('locator gone');
    expect(progress.lastStepIndex).toBe(1);
  });

  it('ignores log messages', () => {
    const before = createReplayProgress(OFFSETS);

    expect(applyMessage(before, { kind: 'log', text: 'hi' })).toEqual(before);
  });

  it('keeps only the last stderr lines', () => {
    let progress = createReplayProgress(OFFSETS);
    for (let line = 0; line < STDERR_TAIL_LINES + 3; line += 1) {
      progress = applyStderrLine(progress, `line ${String(line)}`);
    }

    expect(progress.stderrTail).toHaveLength(STDERR_TAIL_LINES);
    expect(progress.stderrTail[0]).toBe('line 3');
    expect(progress.stderrTail.at(-1)).toBe(
      `line ${String(STDERR_TAIL_LINES + 2)}`,
    );
  });

  it('succeeds on exit code 0', () => {
    const progress = applyExit(createReplayProgress(OFFSETS), 0, false);

    expect(progress).toMatchObject({
      status: 'succeeded',
      exitCode: 0,
      errorMessage: null,
    });
  });

  it('fails on a non-zero exit and names the code when no error was sent', () => {
    const progress = applyExit(createReplayProgress(OFFSETS), 3, false);

    expect(progress.status).toBe('failed');
    expect(progress.exitCode).toBe(3);
    expect(progress.errorMessage).toContain('3');
  });

  it('keeps the script error message over the generic one', () => {
    let progress = applyMessage(createReplayProgress(OFFSETS), {
      kind: 'error',
      index: null,
      message: 'boom',
    });
    progress = applyExit(progress, 1, false);

    expect(progress).toMatchObject({ status: 'failed', errorMessage: 'boom' });
  });

  it('fails when the process was killed by a signal', () => {
    const progress = applyExit(createReplayProgress(OFFSETS), null, false);

    expect(progress.status).toBe('failed');
    expect(progress.exitCode).toBeNull();
  });

  it('is cancelled when the user asked to stop, whatever the exit code', () => {
    expect(applyExit(createReplayProgress(OFFSETS), 130, true).status).toBe(
      'cancelled',
    );
    expect(applyExit(createReplayProgress(OFFSETS), null, true).status).toBe(
      'cancelled',
    );
  });
});

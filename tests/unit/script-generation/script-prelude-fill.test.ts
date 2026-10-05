import { describe, expect, it } from 'vitest';

import { scriptPrelude } from '../../../src/script-generation/domain/script-prelude.ts';
import { runNodeModule } from '../../support/run-node-module.ts';

const HUMAN_ENV = {
  BROWSER_RECORDER_TIMING: 'human',
  BROWSER_RECORDER_HUMAN_DELAY: '100-100',
  BROWSER_RECORDER_SEED: '7',
};

// A field that behaves like a text box; `dropsEuro` loses the euro sign the
// way a masked input would, `failsRead` cannot report its value.
const FAKES = String.raw`
import { EventEmitter } from 'node:events';
const waits = [];
const sleep = async (ms) => { waits.push(ms); };
const ops = [];
function field({ dropsEuro = false, failsRead = false } = {}) {
  let text = 'stale';
  return {
    ops,
    fill: async (value) => { ops.push('fill:' + JSON.stringify(value)); text = value; },
    pressSequentially: async (key) => {
      ops.push('type:' + JSON.stringify(key));
      if (!(dropsEuro && key === '€')) text += key;
    },
    inputValue: async () => { if (failsRead) throw new Error('no value'); return text; },
    read: () => text,
  };
}
const rt = createRuntime(new EventEmitter(), { sleep });
`;

function run(body: string, env: Record<string, string> = HUMAN_ENV) {
  return runNodeModule(`${scriptPrelude}\n${FAKES}\n${body}\n`, { env });
}

describe('src/script-generation/domain/script-prelude.ts fill', () => {
  it('fills at once in recorded mode', async () => {
    const result = await run(
      `const box = field(); await rt.fill(box, 'hello');
       console.log(JSON.stringify({ ops, waits, text: box.read() }));`,
      { BROWSER_RECORDER_TIMING: 'recorded' },
    );
    expect(JSON.parse(result.stdout)).toStrictEqual({
      ops: ['fill:"hello"'],
      waits: [],
      text: 'hello',
    });
  });

  it('types a value with quotes, a newline and a euro sign key by key', async () => {
    const result = await run(
      `const value = 'a"b\\n€';
       const box = field(); await rt.fill(box, value);
       console.log(JSON.stringify({ ops, waits, text: box.read(), isExact: box.read() === value }));`,
    );
    const outcome = JSON.parse(result.stdout) as {
      ops: string[];
      waits: number[];
      isExact: boolean;
    };
    expect(outcome.ops).toStrictEqual([
      'fill:""',
      'type:"a"',
      'type:"\\""',
      'type:"b"',
      'type:"\\n"',
      'type:"€"',
    ]);
    expect(outcome.waits).toStrictEqual([10, 10, 10, 10, 10]);
    expect(outcome.isExact).toBe(true);
  });

  it('types an astral character as one key, not two halves', async () => {
    const result = await run(
      `const box = field(); await rt.fill(box, 'x😀');
       console.log(JSON.stringify(ops));`,
    );
    expect(JSON.parse(result.stdout)).toStrictEqual([
      'fill:""',
      'type:"x"',
      'type:"😀"',
    ]);
  });

  it('reconciles with fill(value) when the typed text differs', async () => {
    const result = await run(
      `const box = field({ dropsEuro: true }); await rt.fill(box, 'a€');
       console.log(JSON.stringify({ last: ops.at(-1), text: box.read() }));`,
    );
    expect(JSON.parse(result.stdout)).toStrictEqual({
      last: 'fill:"a€"',
      text: 'a€',
    });
  });

  it('reconciles with fill(value) when the value cannot be read back', async () => {
    const result = await run(
      `const box = field({ failsRead: true }); await rt.fill(box, 'ab');
       console.log(JSON.stringify(ops.at(-1)));`,
    );
    expect(JSON.parse(result.stdout)).toBe('fill:"ab"');
  });

  it('prints a sensitive value nowhere', async () => {
    const result = await run(
      `rt.start();
       const box = field({ dropsEuro: true });
       await rt.at(0); rt.mark(0);
       await rt.fill(box, 'p@ss€word');
       rt.done();`,
    );
    expect(result.stdout + result.stderr).not.toContain('p@ss');
    expect(result.stdout).toMatch(/^::step 0 \d+\n::done \d+\n$/u);
  });
});

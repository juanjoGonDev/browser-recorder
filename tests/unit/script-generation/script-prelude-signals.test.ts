import { describe, expect, it } from 'vitest';

import { scriptPrelude } from '../../../src/script-generation/domain/script-prelude.ts';
import { runNodeModule } from '../../support/run-node-module.ts';

const FAKES = String.raw`
import { EventEmitter } from 'node:events';
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const context = new EventEmitter();
const rt = createRuntime(context, { settleCapMs: 8000 });
`;

function body(extra: string): string {
  return `${scriptPrelude}\n${FAKES}
rt.start();
rt.onAbort(async () => { console.log('closed'); });
console.log('ready');
${extra}`;
}

// Windows cannot deliver SIGINT/SIGTERM to a child with kill(): the CI run on
// Windows covers the console Ctrl+C path instead.
const isPosix = process.platform !== 'win32';

describe('src/script-generation/domain/script-prelude.ts signals', () => {
  it.skipIf(!isPosix).each(['SIGINT', 'SIGTERM'] as const)(
    'closes the browser and exits 130 on %s',
    async (name) => {
      const result = await runNodeModule(body('await sleep(8000);'), {
        signal: { name, afterOutput: 'ready' },
      });
      expect(result.stdout).toBe('ready\nclosed\n');
      expect(result.exitCode).toBe(130);
    },
  );

  it.skipIf(!isPosix)(
    'stops at once on a signal without waiting for the network to settle',
    async () => {
      const result = await runNodeModule(
        body(`context.emit('request', { url: () => 'https://site.test/x' });
void rt.settle();
await sleep(8000);`),
        { signal: { name: 'SIGTERM', afterOutput: 'ready' } },
      );
      expect(result.stdout).toBe('ready\nclosed\n');
      expect(result.exitCode).toBe(130);
    },
  );

  it('does not close anything when the script finishes without a signal', async () => {
    const result = await runNodeModule(body('rt.done();'));
    expect(result.stdout).toMatch(/^ready\n::done \d+\n$/u);
    expect(result.exitCode).toBe(0);
  });
});

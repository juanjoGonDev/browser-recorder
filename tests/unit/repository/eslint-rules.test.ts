import path from 'node:path';
import { ESLint } from 'eslint';
import { describe, expect, it } from 'vitest';

const ROOT = path.resolve(import.meta.dirname, '..', '..', '..');
const FIXTURES = path.join(ROOT, 'tests', 'fixtures', 'lint');

// The fixtures break one rule each on purpose. The repository config ignores
// them (so `pnpm lint` stays green); `ignore: false` re-enables them here.
const eslint = new ESLint({
  cwd: FIXTURES,
  overrideConfigFile: path.join(ROOT, 'eslint.config.ts'),
  ignore: false,
});

async function lintRuleIds(fixture: string): Promise<string[]> {
  const results = await eslint.lintFiles([path.join('src', fixture)]);
  return results.flatMap((result) =>
    result.messages.map((message) => message.ruleId ?? 'parse'),
  );
}

describe('eslint repository rules', () => {
  it.each([
    ['long-function.ts', 'max-lines-per-function'],
    ['MyFile.ts', 'unicorn/filename-case'],
    ['bad-boolean.ts', '@typescript-eslint/naming-convention'],
    ['i-prefixed-interface.ts', '@typescript-eslint/naming-convention'],
    ['four-params.ts', 'max-params'],
    ['deep-nesting.ts', 'max-depth'],
    ['uses-console.ts', 'no-console'],
    ['headed-browser.ts', 'no-restricted-syntax'],
  ])('reports %s through %s', async (fixture, ruleId) => {
    expect(await lintRuleIds(fixture)).toContain(ruleId);
  });

  it('accepts a module that follows every rule', async () => {
    expect(await lintRuleIds('clean-module.ts')).toEqual([]);
  });
});

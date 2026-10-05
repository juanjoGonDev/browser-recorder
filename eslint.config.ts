import vitest from '@vitest/eslint-plugin';
import { defineConfig } from 'eslint/config';
import unicorn from 'eslint-plugin-unicorn';
import tseslint from 'typescript-eslint';

const typedFiles = ['src/**/*.ts', 'scripts/**/*.ts', 'tests/**/*.ts'];
const inPageFiles = ['src/recording-capture/in-page/**/*.ts'];
const testFiles = ['tests/**/*.ts'];
const vitestFiles = ['tests/**/*.test.ts'];

// Ported from devbar on purpose, so upstream fixes stay diffable. Their JSON
// wire format (`publish`, read by the release workflows through jq) and their
// style predate these rules; rewriting them would fork the contract.
const vendoredFiles = [
  'scripts/install-hooks.ts',
  'scripts/release-impact-policy.ts',
  'scripts/lib/script-runtime.ts',
  'tests/unit/repository/install-hooks.test.ts',
  'tests/unit/repository/release-impact-policy.test.ts',
  'tests/unit/repository/release-workflow-impact.test.ts',
  'tests/unit/repository/script-runtime.test.ts',
];

const BOOLEAN_PREFIXES = ['is', 'has', 'should', 'can', 'did', 'was', 'will'];

/** Size and shape limits that keep every unit small enough to review. */
const engineeringRules = {
  'max-lines-per-function': [
    'error',
    { max: 40, skipBlankLines: true, skipComments: true },
  ],
  'max-lines': [
    'error',
    { max: 300, skipBlankLines: true, skipComments: true },
  ],
  complexity: ['error', 10],
  'max-depth': ['error', 3],
  'max-params': ['error', 3],
  'max-nested-callbacks': ['error', 3],
} as const;

const namingConvention = [
  'error',
  { selector: 'default', format: ['camelCase'] },
  {
    selector: 'variable',
    modifiers: ['const', 'global'],
    format: ['camelCase', 'UPPER_CASE'],
  },
  { selector: 'import', format: ['camelCase', 'PascalCase'] },
  // PascalCase, and no Hungarian `I` prefix: IFoo is Foo.
  {
    selector: 'typeLike',
    format: ['PascalCase'],
    custom: { regex: '^I[A-Z]', match: false },
  },
  // A leading underscore is reserved for parameters that are never read.
  {
    selector: 'parameter',
    modifiers: ['unused'],
    format: ['camelCase'],
    leadingUnderscore: 'allow',
  },
  // Booleans read as a question: isReady, hasFocus, shouldRetry.
  {
    selector: ['variable', 'parameter', 'classProperty', 'typeProperty'],
    types: ['boolean'],
    format: ['PascalCase'],
    prefix: BOOLEAN_PREFIXES,
  },
  // These mirror an external shape the frozen contracts keep verbatim: the
  // DOM `checked` property and the `ctrl`, `meta`, `shift` flags of Node's
  // readline keypress event.
  {
    selector: 'typeProperty',
    filter: { regex: '^(checked|ctrl|meta|shift)$', match: true },
    format: null,
  },
  // Object literals feed external APIs (fs, child_process, Playwright) whose
  // option names are not ours to rename; env var names are UPPER_CASE.
  {
    selector: 'objectLiteralProperty',
    format: ['camelCase', 'UPPER_CASE'],
  },
  {
    selector: [
      'objectLiteralProperty',
      'typeProperty',
      'classProperty',
      'method',
    ],
    modifiers: ['requiresQuotes'],
    format: null,
  },
] as const;

const typedRules = {
  '@typescript-eslint/naming-convention': namingConvention,
  '@typescript-eslint/explicit-module-boundary-types': 'error',
  '@typescript-eslint/consistent-type-imports': 'error',
  '@typescript-eslint/no-floating-promises': 'error',
  '@typescript-eslint/switch-exhaustiveness-check': 'error',
  '@typescript-eslint/restrict-template-expressions': [
    'error',
    { allowNumber: true },
  ],
  '@typescript-eslint/no-unused-vars': [
    'error',
    { argsIgnorePattern: '^_', varsIgnorePattern: '^_' },
  ],
  'unicorn/filename-case': ['error', { case: 'kebabCase' }],
  ...engineeringRules,
} as const;

const vitestLayoutRules = {
  'vitest/consistent-test-it': ['error', { fn: 'it' }],
  'vitest/expect-expect': [
    'error',
    {
      assertFunctionNames: [
        'expect',
        'expectValid',
        'expectInvalid',
        'expectFailed',
        'expectSucceeded',
        'expectPresent',
        'expectOccurrence',
        'expectTypeOf',
      ],
    },
  ],
  'vitest/no-focused-tests': 'error',
  'vitest/no-identical-title': 'error',
  'vitest/no-standalone-expect': 'error',
  'vitest/require-top-level-describe': 'error',
  'vitest/valid-describe-callback': 'error',
  'vitest/valid-expect': ['error', { maxArgs: 2 }],
  'vitest/valid-expect-in-promise': 'error',
  'vitest/valid-title': ['error', { ignoreTypeOfDescribeName: true }],
} as const;

export default defineConfig(
  {
    ignores: [
      'dist/**',
      'coverage/**',
      'node_modules/**',
      'recordings/**',
      'openspec/**',
      '.atl/**',
      // Deliberately broken sources: eslint-rules.test.ts lints them with
      // `ignore: false` to prove each rule fires.
      'tests/fixtures/**',
      'eslint.config.ts',
      'vitest.config.ts',
    ],
  },
  {
    files: typedFiles,
    extends: [tseslint.configs.strictTypeChecked],
    plugins: { unicorn },
    languageOptions: {
      parserOptions: {
        project: [
          './tsconfig.node.json',
          './tsconfig.in-page.json',
          './tsconfig.tests.json',
        ],
        tsconfigRootDir: import.meta.dirname,
      },
    },
    rules: typedRules,
  },
  {
    files: inPageFiles,
    languageOptions: {
      parserOptions: {
        project: ['./tsconfig.in-page.json'],
        tsconfigRootDir: import.meta.dirname,
      },
    },
  },
  {
    // The console is the TUI's output channel only through the Terminal
    // port; any other console call in product code is a leftover.
    files: ['src/**/*.ts'],
    rules: { 'no-console': 'error' },
  },
  {
    files: testFiles,
    rules: {
      'max-lines-per-function': 'off',
      // describe > it > a callback handed to expect/it.each is three deep
      // before any helper callback, so tests get two more levels.
      'max-nested-callbacks': ['error', 5],
      'max-lines': [
        'error',
        { max: 800, skipBlankLines: true, skipComments: true },
      ],
    },
  },
  {
    files: vitestFiles,
    plugins: { vitest },
    rules: vitestLayoutRules,
  },
  {
    files: vendoredFiles,
    rules: {
      '@typescript-eslint/naming-convention': 'off',
      '@typescript-eslint/no-unnecessary-condition': 'off',
      '@typescript-eslint/no-dynamic-delete': 'off',
      complexity: 'off',
      'max-params': 'off',
    },
  },
);

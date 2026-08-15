import js from '@eslint/js';
import importX from 'eslint-plugin-import-x';
import simpleImportSort from 'eslint-plugin-simple-import-sort';
import svelte from 'eslint-plugin-svelte';
import unusedImports from 'eslint-plugin-unused-imports';
import globals from 'globals';
import tseslint from 'typescript-eslint';

const typedFiles = ['**/*.ts', '**/*.svelte'];
const typeCheckedConfigs = [
  ...tseslint.configs.strictTypeChecked,
  ...tseslint.configs.stylisticTypeChecked,
].map((config) => ({ ...config, files: typedFiles }));

const privateImportPattern = {
  group: ['@ttrpg-map/*/*'],
  message: 'Import another package through its declared public entry point.',
};

const noMathRandomRule = [
  'error',
  {
    selector: "CallExpression[callee.object.name='Math'][callee.property.name='random']",
    message: 'Use an explicitly injected deterministic random stream.',
  },
];

const deterministicPathRules = {
  'no-restricted-globals': [
    'error',
    { name: 'Date', message: 'Deterministic output cannot read the wall clock.' },
    { name: 'Intl', message: 'Deterministic output cannot depend on locale behavior.' },
    { name: 'performance', message: 'Deterministic output cannot read an ambient clock.' },
    { name: 'document', message: 'Deterministic packages cannot access the DOM.' },
    { name: 'window', message: 'Deterministic packages cannot access the DOM.' },
  ],
  'no-restricted-syntax': [...noMathRandomRule],
};

export default tseslint.config(
  {
    ignores: [
      '**/node_modules/**',
      '**/dist/**',
      '**/target/**',
      '**/coverage/**',
      'docs/archive/**',
      'apps/desktop/src-tauri/**',
    ],
  },
  js.configs.recommended,
  ...typeCheckedConfigs,
  ...svelte.configs['flat/recommended'],
  ...svelte.configs['flat/prettier'],
  {
    languageOptions: {
      parserOptions: {
        projectService: true,
        tsconfigRootDir: import.meta.dirname,
      },
    },
    linterOptions: {
      reportUnusedDisableDirectives: 'error',
    },
    plugins: {
      'import-x': importX,
      'simple-import-sort': simpleImportSort,
      'unused-imports': unusedImports,
    },
    rules: {
      'import-x/no-cycle': ['error', { ignoreExternal: true }],
      'simple-import-sort/exports': 'error',
      'simple-import-sort/imports': 'error',
      'unused-imports/no-unused-imports': 'error',
      'unused-imports/no-unused-vars': [
        'error',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_' },
      ],
    },
  },
  {
    files: typedFiles,
    rules: {
      'no-unused-vars': 'off',
      '@typescript-eslint/consistent-type-imports': [
        'error',
        { fixStyle: 'inline-type-imports', prefer: 'type-imports' },
      ],
      '@typescript-eslint/no-non-null-assertion': 'error',
      '@typescript-eslint/no-unused-vars': 'off',
      '@typescript-eslint/switch-exhaustiveness-check': 'error',
    },
  },
  {
    files: ['**/*.svelte'],
    languageOptions: {
      parserOptions: {
        parser: tseslint.parser,
        projectService: true,
        extraFileExtensions: ['.svelte'],
        tsconfigRootDir: import.meta.dirname,
      },
    },
  },
  {
    files: ['**/*.{js,mjs,cjs}'],
    ...tseslint.configs.disableTypeChecked,
    languageOptions: {
      globals: globals.node,
    },
  },
  {
    files: ['apps/desktop/src/**/*.{ts,svelte}'],
    languageOptions: {
      globals: globals.browser,
    },
    rules: {
      'no-restricted-imports': ['error', { patterns: [privateImportPattern] }],
    },
  },
  {
    files: ['packages/core/**/*.ts'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            privateImportPattern,
            {
              group: ['@ttrpg-map/*'],
              message: 'The core package cannot import another internal package.',
            },
          ],
        },
      ],
    },
  },
  {
    files: [
      'packages/core/src/deterministic-random-stream.ts',
      'packages/core/src/seed-derivation.ts',
      'packages/core/src/seed-input.ts',
      'packages/core/src/sha-256.ts',
    ],
    rules: {
      'no-restricted-syntax': noMathRandomRule,
    },
  },
  {
    files: ['packages/generation/**/*.ts'],
    rules: {
      ...deterministicPathRules,
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            privateImportPattern,
            {
              group: [
                '@ttrpg-map/assets',
                '@ttrpg-map/desktop',
                '@ttrpg-map/persistence',
                '@ttrpg-map/render',
                'fs',
                'fs/*',
                'node:fs',
                'node:fs/*',
              ],
              message:
                'Generation may depend only on the core internal package and cannot access filesystem modules.',
            },
          ],
        },
      ],
    },
  },
  {
    files: ['packages/assets/**/*.ts'],
    rules: {
      ...deterministicPathRules,
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            privateImportPattern,
            {
              group: [
                '@ttrpg-map/desktop',
                '@ttrpg-map/generation',
                '@ttrpg-map/persistence',
                '@ttrpg-map/render',
              ],
              message: 'Assets may depend only on the core internal package.',
            },
          ],
        },
      ],
    },
  },
  {
    files: ['packages/render/**/*.ts'],
    rules: {
      ...deterministicPathRules,
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            privateImportPattern,
            {
              group: [
                '@ttrpg-map/assets',
                '@ttrpg-map/desktop',
                '@ttrpg-map/generation',
                '@ttrpg-map/persistence',
              ],
              message: 'Render may depend only on the core internal package.',
            },
          ],
        },
      ],
    },
  },
  {
    files: ['packages/persistence/**/*.ts'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            privateImportPattern,
            {
              group: [
                '@ttrpg-map/assets',
                '@ttrpg-map/desktop',
                '@ttrpg-map/generation',
                '@ttrpg-map/render',
              ],
              message: 'Persistence may depend only on the core internal package.',
            },
          ],
        },
      ],
    },
  },
);

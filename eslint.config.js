import globals from 'globals';
import eslintPluginImport from 'eslint-plugin-import';

/** @type {import('eslint').Linter.Config[]} */
export default [
  {
    plugins: {
      import: eslintPluginImport,
    },
    languageOptions: {
      parserOptions: {
        ecmaVersion: 'latest',
        sourceType: 'module',
      },
      globals: {
        ...globals.es2020,
        ...globals.browser,
        ...globals.node,
        jest: true,
      },
    },
    rules: {
      'import/no-unresolved': 'error',
      'import/named': 'error',
      'no-undef': 'error',
      'no-constant-condition': 'error',
      'no-throw-literal': 'error',
      'no-empty': 'error',
      'no-unused-vars': 'off',
      'no-console': 'warn',
      'no-empty-function': 'warn',
      'no-restricted-syntax': 'off',
    },
  },
];

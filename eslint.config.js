// @mdr/dev-typescript eslint template v1.1.0
import eslint from '@eslint/js';
import tseslint from 'typescript-eslint';
import localRules from '@mdr/dev-typescript/eslint-rules';

export default tseslint.config(
  eslint.configs.recommended,
  ...tseslint.configs.recommended,
  {
    plugins: { local: localRules },
    rules: {
      '@typescript-eslint/no-explicit-any': 'off', // Pragmatic for CLI tools
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_', varsIgnorePattern: '^_' }],
      'no-control-regex': 'off', // Allows \x1b for ANSI stripping
      'local/require-minimist': 'error',
      'local/internal-underscore': 'error',
    },
  },
  {
    ignores: ['dist/**', 'node_modules/**'],
  }
);

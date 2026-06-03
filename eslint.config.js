const js = require('@eslint/js');
const globals = require('globals');

module.exports = [
  js.configs.recommended,
  {
    files: ['**/*.js'],
    languageOptions: {
      sourceType: 'commonjs',
      ecmaVersion: 'latest',
      globals: {
        ...globals.node,
      },
    },
    rules: {
      'no-unused-vars': ['warn', { argsIgnorePattern: '^_' }],
      'no-console': 'off',
      'prefer-const': 'warn',
      'no-var': 'warn',
    },
  },
  {
    files: ['tests/**/*.js'],
    languageOptions: {
      globals: {
        ...globals.jest,
      },
    },
  },
  {
    files: ['src/assets/js/**/*.js'],
    languageOptions: {
      globals: {
        ...globals.browser,
        mermaid: 'readonly',
      },
    },
    rules: {
      'no-var': 'off',
    },
  },
  {
    ignores: ['dist/**', 'node_modules/**', 'src/assets/vendor/**', '.content-tmp/**'],
  },
];

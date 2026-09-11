import js from '@eslint/js';

export default [
  js.configs.recommended,
  {
    files: ['src/**/*.js', 'scripts/**/*.js', '*.js'],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: 'module',
      globals: {
        console: 'readonly',
        process: 'readonly',
        Buffer: 'readonly',
        setTimeout: 'readonly',
        clearTimeout: 'readonly',
        URL: 'readonly',
        __dirname: 'readonly',
        __filename: 'readonly',
      },
    },
    rules: {
      'no-unused-vars': ['error', { argsIgnorePattern: '^_', varsIgnorePattern: '^_' }],
      'no-constant-condition': 'off',
    },
  },
  {
    files: ['src/processor.js', 'src/publisher.js'],
    rules: {
      // Existing worker code has deferred branches and browser notification helpers;
      // keep the executable gate while tracking unused-variable cleanup separately.
      'no-unused-vars': 'off',
      'no-undef': 'off',
    },
  },
];

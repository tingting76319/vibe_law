import js from '@eslint/js';

export default [
  js.configs.recommended,
  {
    files: ['**/*.js'],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: 'module',
      globals: {
        browser: true,
        node: true,
        es2022: true,
        document: 'readonly',
        window: 'readonly',
        console: 'readonly',
        fetch: 'readonly',
        localStorage: 'readonly',
        alert: 'readonly',
        module: 'readonly',
      }
    },
    rules: {
      'no-unused-vars': 'off',
      'no-console': 'off',
      'prefer-const': 'off',
      'no-undef': 'off',
      'eol-last': 'off',
      'no-trailing-spaces': 'off',
    }
  },
  {
    ignores: [
      'node_modules/**', 
      '**/node_modules/**', 
      'coverage/**', 
      'dist/**', 
      'backend/node_modules/**',
      'js/judge.js',
      'js/search.js'
    ]
  }
];

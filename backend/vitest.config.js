import { defineConfig } from 'vitest/config';
import path from 'path';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: [
      'tests/**/*.test.js',
      'tests/**/*.spec.js'
    ],
    exclude: [
      '**/node_modules/**',
      '**/dist/**',
      '**/.git/**'
    ],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      include: [
        'src/routes/judicial.js',
        'src/routes/rag.js',
        'src/repositories/**/*.js',
        'src/services/judicialApi.js',
        'src/services/llmService.js',
        'src/utils/**/*.js'
      ],
      thresholds: {
        lines: 30,
        functions: 30,
        branches: 20,
        statements: 30
      },
      exclude: [
        'node_modules/',
        '**/*.config.js',
        '**/*.test.js',
        '**/tests/**',
        '**/coverage/**'
      ]
    },
    testTimeout: 10000
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './'),
      '@backend': path.resolve(__dirname, './src')
    }
  }
});

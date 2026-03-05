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
        'src/routes/upload.js',
        'src/repositories/**/*.js',
        'src/services/judicialApi.js',
        'src/services/llmService.js',
        'src/utils/**/*.js'
      ],
      // 優化的 Coverage Gate - v0.6.1
      thresholds: {
        lines: 10,
        functions: 10,
        branches: 30,
        statements: 10
      },
      exclude: [
        'node_modules/',
        '**/*.config.js',
        '**/*.test.js',
        '**/tests/**',
        '**/coverage/**'
      ]
    },
    testTimeout: 15000,
    hookTimeout: 15000
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './'),
      '@backend': path.resolve(__dirname, './src')
    }
  }
});

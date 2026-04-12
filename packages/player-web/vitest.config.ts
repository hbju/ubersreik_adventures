import { defineConfig } from 'vitest/config';
import path from 'node:path';

export default defineConfig({
  resolve: {
    alias: {
      '@wfrp/shared': path.resolve(__dirname, '../shared/src/index.ts'),
      '@': path.resolve(__dirname, 'src'),
    },
  },
  test: {
    root: __dirname,
    include: ['test/**/*.{test,spec}.?(c|m)[jt]s?(x)'],
    testTimeout: 1000 * 29,
    environment: 'node',
  },
});

import { defineConfig } from 'vitest/config'
import path from 'node:path'

export default defineConfig({
  resolve: {
    alias: {
      '@wfrp/shared': path.join(__dirname, '../shared/src/index.ts'),
      '@': path.join(__dirname, 'src'),
    },
  },
  test: {
    root: __dirname,
    include: [
      'test/**/*.{test,spec}.?(c|m)[jt]s?(x)',
      'src/**/*.{test,spec}.?(c|m)[jt]s?(x)',
    ],
    testTimeout: 1000 * 29,
  },
})

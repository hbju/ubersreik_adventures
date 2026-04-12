import path from 'node:path'
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  resolve: {
    alias: {
      '@': path.join(__dirname, 'src'),
      '@wfrp/shared': path.join(__dirname, '../shared/src/index.ts'),
    },
  },
  plugins: [react()],
  server: {
    host: true,
    port: 5174,
  },
  clearScreen: false,
})

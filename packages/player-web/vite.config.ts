import path from 'node:path'
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// Web SPA — no Electron. Dev port must differ from gm-app (5173).
export default defineConfig({
  resolve: {
    alias: {
      '@': path.join(__dirname, 'src'),
      '@wfrp/shared': path.join(__dirname, '../shared/src/index.ts'),
    },
  },
  plugins: [react()],
  server: {
    port: 5174,
    strictPort: true,
  },
  clearScreen: false,
})

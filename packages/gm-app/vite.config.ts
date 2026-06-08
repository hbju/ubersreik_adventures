import { rmSync } from 'node:fs'
import path from 'node:path'
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import electron from 'vite-plugin-electron/simple'
import pkg from './package.json'

// https://vitejs.dev/config/
export default defineConfig(({ command }) => {
  rmSync('dist-electron', { recursive: true, force: true })

  const isServe = command === 'serve'
  const isBuild = command === 'build'
  const sourcemap = isServe || !!process.env.VSCODE_DEBUG

  return {
    resolve: {
      alias: [
        { find: '@', replacement: path.join(__dirname, 'src') },
        { find: '@wfrp/shared/combat', replacement: path.join(__dirname, '../shared/src/combat/index.ts') },
        { find: '@wfrp/shared', replacement: path.join(__dirname, '../shared/src/index.ts') },
      ],
    },
    plugins: [
      react(),
      electron({
        main: {
          // Shortcut of `build.lib.entry`
          entry: 'electron/main/index.ts',
          onstart(args) {
            if (process.env.VSCODE_DEBUG) {
              console.log(/* For `.vscode/.debug.script.mjs` */'[startup] Electron App')
            } else {
              args.startup()
            }
          },
          vite: {
            resolve: {
              alias: [
                { find: '@wfrp/shared/combat', replacement: path.join(__dirname, '../shared/src/combat/index.ts') },
                { find: '@wfrp/shared', replacement: path.join(__dirname, '../shared/src/index.ts') },
              ],
            },
            build: {
              sourcemap,
              minify: isBuild,
              outDir: 'dist-electron/main',
              rollupOptions: {
                // Bundle @wfrp/shared into the electron main process (don't externalize it)
                external: Object.keys('dependencies' in pkg ? pkg.dependencies : {}).filter(dep => dep !== '@wfrp/shared'),
              },
            },
          },
        },
        preload: {
          // Shortcut of `build.rollupOptions.input`.
          // Preload scripts may contain Web assets, so use the `build.rollupOptions.input` instead `build.lib.entry`.
          input: 'electron/preload/index.ts',
          vite: {
            resolve: {
              alias: [
                { find: '@wfrp/shared/combat', replacement: path.join(__dirname, '../shared/src/combat/index.ts') },
                { find: '@wfrp/shared', replacement: path.join(__dirname, '../shared/src/index.ts') },
              ],
            },
            build: {
              sourcemap: sourcemap ? 'inline' : undefined, // #332
              minify: isBuild,
              outDir: 'dist-electron/preload',
              rollupOptions: {
                // Bundle @wfrp/shared into the preload process (don't externalize it)
                external: Object.keys('dependencies' in pkg ? pkg.dependencies : {}).filter(dep => dep !== '@wfrp/shared'),
              },
            },
          },
        },
        // Ployfill the Electron and Node.js API for Renderer process.
        // If you want use Node.js in Renderer process, the `nodeIntegration` needs to be enabled in the Main process.
        // See 👉 https://github.com/electron-vite/vite-plugin-electron-renderer
        renderer: {},
      }),
    ],
    server: process.env.VSCODE_DEBUG && (() => {
      const url = new URL(pkg.debug.env.VITE_DEV_SERVER_URL)
      return {
        host: true,
        port: 5173,
      }
    })(),
    clearScreen: false,
  }
})

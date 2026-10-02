import { resolve } from 'path'
import { defineConfig, externalizeDepsPlugin } from 'electron-vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  main: {
    // Only native better-sqlite3 stays external; JS deps are bundled into out/main.
    plugins: [externalizeDepsPlugin({ exclude: ['date-fns', 'date-fns-tz', 'dotenv'] })],
    build: {
      rollupOptions: {
        input: {
          index: resolve(__dirname, 'electron/main/index.ts'),
        },
      },
    },
    resolve: {
      alias: {
        '@shared': resolve('shared'),
      },
    },
  },
  preload: {
    // Preload has no production npm deps — avoid externalizing anything into node_modules.
    plugins: [],
    build: {
      rollupOptions: {
        input: {
          index: resolve(__dirname, 'electron/preload/index.ts'),
        },
        external: ['electron'],
      },
    },
    resolve: {
      alias: {
        '@shared': resolve('shared'),
      },
    },
  },
  renderer: {
    root: '.',
    build: {
      rollupOptions: {
        input: {
          index: resolve(__dirname, 'index.html'),
        },
      },
    },
    resolve: {
      alias: {
        '@': resolve('src'),
        '@shared': resolve('shared'),
      },
    },
    plugins: [react(), tailwindcss()],
  },
})

import { defineConfig } from 'vitest/config'
import { resolve } from 'path'

export default defineConfig({
  test: {
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.ts'],
    globals: true,
  },
  resolve: {
    alias: {
      '@': resolve(__dirname, './src'),
    },
  },
  server: {
    fs: {
      // Tests read the example CSV files in the repo `docs/` folder, which is outside the app root.
      allow: [__dirname, resolve(__dirname, '../docs')],
    },
  },
})

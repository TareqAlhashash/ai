import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import tsconfigPaths from 'vite-tsconfig-paths'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

export default defineConfig({
  plugins: [tsconfigPaths(), react()],
  resolve: {
    alias: {
      'server-only': path.resolve(__dirname, 'src/lib/__tests__/__mocks__/server-only.js'),
    },
  },
  test: {
    environment: 'jsdom',
    environmentMatchGlobs: [['src/lib/__tests__/auth.test.ts', 'node']],
  },
})
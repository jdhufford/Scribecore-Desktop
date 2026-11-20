import { defineConfig } from '@playwright/test'

// End-to-end tests drive the built app (run `npm run build` first).
export default defineConfig({
  testDir: 'tests/e2e',
  timeout: 30_000,
  workers: 1,
  retries: process.env['CI'] ? 1 : 0,
  reporter: process.env['CI'] ? [['list'], ['github']] : 'list',
  use: { trace: 'retain-on-failure' },
  outputDir: 'test-results',
})

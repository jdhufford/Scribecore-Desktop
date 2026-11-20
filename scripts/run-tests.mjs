// Run Vitest inside Electron's Node runtime (ELECTRON_RUN_AS_NODE), so native
// modules such as better-sqlite3-multiple-ciphers are tested with the exact
// binary the app ships, built for Electron's ABI by `electron-builder install-app-deps`.
import { spawnSync } from 'node:child_process'
import { createRequire } from 'node:module'
import { dirname, join } from 'node:path'

const require = createRequire(import.meta.url)
const electron = require('electron') // path to the Electron binary when required from Node
const vitest = join(dirname(require.resolve('vitest/package.json')), 'vitest.mjs')

const result = spawnSync(electron, [vitest, ...process.argv.slice(2)], {
  stdio: 'inherit',
  env: { ...process.env, ELECTRON_RUN_AS_NODE: '1' },
})
if (result.error) throw result.error
process.exit(result.status ?? 1)

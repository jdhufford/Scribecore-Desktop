/// <reference types="svelte" />
/// <reference types="vite/client" />

import type { ScribeCoreApi } from '../../shared/types'

declare global {
  interface Window {
    scribecore: ScribeCoreApi
  }
}

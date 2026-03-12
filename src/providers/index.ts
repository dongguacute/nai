import { createBunProvider } from './bun.ts'
import { createNpmProvider } from './npm.ts'
import { createPnpmProvider } from './pnpm.ts'
import { createVltProvider } from './vlt.ts'
import { createYarnProvider } from './yarn.ts'
import type { Provider } from '../type.ts'

export const providers: Provider[] = [
  createPnpmProvider(),
  createYarnProvider(),
  createBunProvider(),
  createVltProvider(),
  createNpmProvider(),
]

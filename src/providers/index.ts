import { createPnpmProvider } from './pnpm.ts'
import type { Provider } from '../type.ts'

export const providers: Provider[] = [createPnpmProvider()]

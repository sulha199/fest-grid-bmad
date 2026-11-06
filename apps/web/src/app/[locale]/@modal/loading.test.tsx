import { expect, test, vi } from 'vitest'
import { existsSync } from 'node:fs'
import { join } from 'node:path'

vi.mock('@festgrid/ui', () => ({
  RouteLoader: () => null,
}))

// Regression: the event-detail loader appeared at the bottom of the page because the @modal slot
// inherited app/[locale]/loading.tsx. A slot-root loading.tsx must exist so the loader renders
// inside the dialog (see the comment in ./loading.tsx).
test('the @modal slot has its own loading boundary rendering the shared RouteLoader', async () => {
  const { default: ModalLoading } = await import('./loading')
  const { RouteLoader } = await import('@festgrid/ui')
  const element = ModalLoading() as { type: unknown }
  expect(element.type).toBe(RouteLoader)
})

test('no [slug]-keyed loading.tsx under the intercepted modal route (flashes on Next/Previous)', () => {
  const dir = join(__dirname, '(.)events', '[slug]', 'loading.tsx')
  expect(existsSync(dir)).toBe(false)
})

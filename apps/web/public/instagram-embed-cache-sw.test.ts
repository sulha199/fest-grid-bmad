import { describe, it, expect, vi, beforeEach } from "vitest"
import { readFileSync } from "node:fs"
import { join } from "node:path"
import vm from "node:vm"

// Story 0.38 (Task 1.5) — this service worker is a plain `.js` file loaded by
// the browser at a public URL, not a TS module under a bundler, so it can't
// be `import`ed directly. Instead this test loads its source text and
// evaluates it inside an isolated `vm` context with mocked `self`/`caches`/
// `fetch` globals, exactly the "lower-level unit test against the SW file's
// fetch-handler logic in isolation" escape hatch called out by the story's
// own Task 1.5/Testing Requirements (full e2e SW registration+cache-hit
// testing is flaky in CI; Playwright SW interception is not used here).

function loadServiceWorker() {
  const source = readFileSync(join(__dirname, "instagram-embed-cache-sw.js"), "utf-8")

  const listeners: Record<string, ((event: any) => void)[]> = {}
  const fakeSelf = {
    addEventListener: (type: string, handler: (event: any) => void) => {
      listeners[type] = listeners[type] || []
      listeners[type].push(handler)
    },
    skipWaiting: vi.fn(),
    clients: { claim: vi.fn().mockResolvedValue(undefined) },
  }

  const cacheStore = new Map<string, any>()
  const fakeCache = {
    match: vi.fn(async (request: any) => cacheStore.get(request.url)),
    put: vi.fn(async (request: any, response: any) => {
      cacheStore.set(request.url, response)
    }),
  }
  const fakeCaches = { open: vi.fn(async () => fakeCache) }

  const fakeFetch = vi.fn()

  const context: any = {
    self: fakeSelf,
    caches: fakeCaches,
    fetch: fakeFetch,
    URL,
    console,
  }
  vm.createContext(context)
  vm.runInContext(source, context)

  return { listeners, fakeCache, cacheStore, fakeFetch, fakeSelf }
}

function makeFetchEvent(url: string) {
  let respondWithPromise: Promise<any> | undefined
  return {
    request: { url },
    respondWith: vi.fn((p: Promise<any>) => {
      respondWithPromise = p
    }),
    getRespondWithPromise: () => respondWithPromise,
  }
}

describe("instagram-embed-cache-sw.js (Story 0.38, AC1-AC4)", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it("registers install/activate lifecycle handlers (skipWaiting/clients.claim)", async () => {
    const { listeners, fakeSelf } = loadServiceWorker()

    expect(listeners.install).toHaveLength(1)
    listeners.install[0]({})
    expect(fakeSelf.skipWaiting).toHaveBeenCalledTimes(1)

    expect(listeners.activate).toHaveLength(1)
    const waitUntilSpy = vi.fn()
    listeners.activate[0]({ waitUntil: waitUntilSpy })
    expect(waitUntilSpy).toHaveBeenCalledTimes(1)
    await waitUntilSpy.mock.calls[0][0]
    expect(fakeSelf.clients.claim).toHaveBeenCalledTimes(1)
  })

  it("AC3 — applies stale-while-revalidate for exactly https://www.instagram.com/embed.js, serving the cache immediately when present", async () => {
    const { listeners, cacheStore, fakeFetch } = loadServiceWorker()
    const url = "https://www.instagram.com/embed.js"
    const cachedResponse = { ok: true, clone: () => cachedResponse }
    cacheStore.set(url, cachedResponse)

    const networkResponse = { ok: true, clone: () => networkResponse }
    fakeFetch.mockResolvedValue(networkResponse)

    const event = makeFetchEvent(url)
    listeners.fetch[0](event)

    expect(event.respondWith).toHaveBeenCalledTimes(1)
    const resolved = await event.getRespondWithPromise()
    expect(resolved).toBe(cachedResponse)
    // Background revalidation still happened.
    expect(fakeFetch).toHaveBeenCalledWith(event.request)
  })

  it("AC3 — fetches from network and caches the response when nothing is cached yet", async () => {
    const { listeners, fakeCache, fakeFetch } = loadServiceWorker()
    const url = "https://www.instagram.com/embed.js"
    const networkResponse = { ok: true, clone: () => networkResponse }
    fakeFetch.mockResolvedValue(networkResponse)

    const event = makeFetchEvent(url)
    listeners.fetch[0](event)

    const resolved = await event.getRespondWithPromise()
    expect(resolved).toBe(networkResponse)
    expect(fakeCache.put).toHaveBeenCalledWith(event.request, expect.anything())
  })

  it("AC3 — matches by hostname+pathname (new URL()), not a substring check", async () => {
    const { listeners, fakeFetch } = loadServiceWorker()
    fakeFetch.mockResolvedValue({ ok: true, clone: () => ({}) })

    // Same-origin file that merely contains "embed.js" in its path must NOT match.
    const event = makeFetchEvent("https://festdaily.app/embed.js")
    listeners.fetch[0](event)

    expect(event.respondWith).not.toHaveBeenCalled()
  })

  it("AC4 — never calls respondWith for any other request within scope (page JS, GraphQL, images)", () => {
    const { listeners } = loadServiceWorker()

    for (const url of [
      "https://festdaily.app/_next/static/chunk.js",
      "https://festdaily.app/graphql",
      "https://scontent-abc-1.cdninstagram.com/some-image.jpg",
    ]) {
      const event = makeFetchEvent(url)
      listeners.fetch[0](event)
      expect(event.respondWith).not.toHaveBeenCalled()
    }
  })
})

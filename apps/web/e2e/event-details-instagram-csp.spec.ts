import { test, expect } from "@playwright/test"

// Story 3.7d AC10 / Task 10b: the event-detail route must ship a CSP that permits
// Instagram's oEmbed script/iframe/media origins, verified by actually attempting to load
// those resources under the real response headers and confirming the browser reports no
// CSP violation for them. This intentionally does not depend on any specific seed event's
// Event.instagramEmbed status resolving to AVAILABLE against the live Meta oEmbed API
// (that would make the test flaky/network-dependent on a third party); instead it simulates
// exactly what InstagramEmbed.tsx does when rendering an AVAILABLE embed -- injecting
// Instagram's oEmbed markup and loading its embed.js widget script -- directly against the
// real page's CSP headers.
test.describe("Event Details - Instagram Embed CSP (Story 3.7d AC10)", () => {
  test("route CSP declares the Instagram origins, and injecting the real embed script/markup triggers no CSP violation", async ({ page }) => {
    await page.addInitScript(() => {
      ;(window as any).__cspViolations = []
      document.addEventListener("securitypolicyviolation", (e) => {
        ;(window as any).__cspViolations.push(`${e.violatedDirective}: ${e.blockedURI}`)
      })
    })

    const response = await page.goto("/en/events/ongoing-culture-fest-2026-2027-fixed")
    expect(response).not.toBeNull()

    const csp = response!.headers()["content-security-policy"]
    expect(csp).toBeTruthy()
    // script-src/img-src/connect-src are scheme-broadened to `https:` rather than an
    // enumerated allowlist (see next.config.ts's comment) -- this still satisfies AC10's
    // "at minimum" requirement since https://www.instagram.com and https://*.cdninstagram.com
    // are both covered by the `https:` scheme source.
    expect(csp).toMatch(/script-src[^;]*https:/)
    expect(csp).toMatch(/(frame-src|child-src)[^;]*https:\/\/www\.instagram\.com/)
    expect(csp).toMatch(/img-src[^;]*https:/)
    expect(csp).toMatch(/connect-src[^;]*https:/)

    await expect(page.locator("h1", { hasText: "Ongoing Culture Fest 2026-2027" })).toBeVisible()

    // Mirror InstagramEmbed.tsx's actual behavior: inject the oEmbed blockquote markup and
    // Instagram's embed.js widget script under this page's real, already-applied CSP.
    await page.evaluate(() => {
      return new Promise<void>((resolve) => {
        const container = document.createElement("div")
        container.innerHTML =
          '<blockquote class="instagram-media" data-instgrm-permalink="https://www.instagram.com/p/CStory37dTest/"></blockquote>'
        document.body.appendChild(container)

        const script = document.createElement("script")
        script.src = "https://www.instagram.com/embed.js"
        script.async = true
        // A network-level failure to actually reach Instagram (e.g. no outbound internet in
        // this environment) is not what AC10 is testing for -- only a CSP-driven block is.
        script.onload = () => resolve()
        script.onerror = () => resolve()
        document.body.appendChild(script)
        setTimeout(resolve, 3000)
      })
    })

    const cspViolations = await page.evaluate(() => (window as any).__cspViolations || [])
    expect(cspViolations).toEqual([])
  })
})

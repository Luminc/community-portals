import { afterEach, describe, expect, test } from "bun:test"
import { join } from "node:path"
import { buildSearchUrl, runSearch, sinceParameter } from "../src/commands/search.js"

const originalFetch = globalThis.fetch
const originalStdoutWrite = process.stdout.write
const fixture = (name: string): Promise<string> => Bun.file(join(import.meta.dir, "fixtures", name)).text()

function captureStdout(): () => string {
  let stdout = ""
  process.stdout.write = (chunk: string | Uint8Array): boolean => {
    stdout += chunk.toString()
    return true
  }
  return () => stdout
}

/** Serve the captured page and component; any other request fails the test. */
async function serveFixtures(requested: URL[]): Promise<void> {
  const page = await fixture("search-page.html")
  const component = await fixture("search-component.html")
  globalThis.fetch = Object.assign(
    async (input: RequestInfo | URL): Promise<Response> => {
      const url = new URL(input instanceof Request ? input.url : String(input))
      requested.push(url)
      if (url.origin !== "https://www.werkenbijdeoverheid.nl" || url.pathname !== "/vacatures") {
        throw new Error(`unexpected request to ${url}`)
      }
      return new Response(url.searchParams.has("_hn:type") ? component : page)
    },
    { preconnect: originalFetch.preconnect },
  )
}

afterEach(() => {
  globalThis.fetch = originalFetch
  process.stdout.write = originalStdoutWrite
})

describe("search", () => {
  test("discovers the current results component and returns its cards", async () => {
    const requested: URL[] = []
    await serveFixtures(requested)
    const stdout = captureStdout()

    const code = await runSearch({ query: "communicatie", page: 1, limit: 20, format: "json" })

    expect(code).toBe(0)
    expect(requested.map((u) => u.searchParams.get("_hn:ref"))).toEqual([null, "r18_r1_r4"])
    expect(JSON.parse(stdout())).toMatchObject({
      meta: { count: 2, page: 1, total: 601 },
      results: [{ company: "Ministerie van Defensie" }, { company: "Veiligheidsregio Utrecht" }],
    })
  })

  test("--location filters on the card's place and --limit caps the output", async () => {
    await serveFixtures([])
    const stdout = captureStdout()

    await runSearch({ query: "communicatie", location: "utrecht", page: 1, limit: 20, format: "json" })
    expect(JSON.parse(stdout()).results.map((r: { location: string }) => r.location)).toEqual(["Utrecht"])
  })

  test("--limit 1 emits one result", async () => {
    await serveFixtures([])
    const stdout = captureStdout()

    await runSearch({ query: "communicatie", page: 1, limit: 1, format: "json" })
    expect(JSON.parse(stdout()).results).toHaveLength(1)
  })
})

describe("search URL", () => {
  test("maps --jobage to the site's own publication filter", () => {
    expect(sinceParameter(undefined)).toBeNull()
    expect(sinceParameter(1)).toBe("gisteren")
    expect(sinceParameter(2)).toBe("3d")
    expect(sinceParameter(7)).toBe("7d")
    expect(sinceParameter(14)).toBe("1m")
    expect(sinceParameter(60)).toBeNull()
  })

  test("sets term, page and sinds", () => {
    const url = new URL(buildSearchUrl({ query: "web redacteur", jobage: 7, page: 2, limit: 20, format: "json" }))
    expect(url.origin + url.pathname).toBe("https://www.werkenbijdeoverheid.nl/vacatures")
    expect(url.searchParams.get("term")).toBe("web redacteur")
    expect(url.searchParams.get("pagina")).toBe("2")
    expect(url.searchParams.get("sinds")).toBe("7d")
  })
})

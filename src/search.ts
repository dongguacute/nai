export interface NpmSearchResult {
  name: string
  description: string
  version: string
}

interface NpmRegistryResponse {
  objects: { package: NpmSearchResult }[]
}

/**
 * Search the npm registry for packages matching a query.
 * Returns up to `size` results (default 20).
 */
export async function searchNpmPackages(
  query: string,
  size = 20,
): Promise<NpmSearchResult[]> {
  const url = `https://registry.npmjs.com/-/v1/search?text=${encodeURIComponent(query)}&size=${size}`
  const res = await fetch(url)
  if (!res.ok) return []
  const data = (await res.json()) as NpmRegistryResponse
  return data.objects.map((o) => o.package)
}

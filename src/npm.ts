import { getLatestVersion } from 'fast-npm-meta'

export interface SearchResult {
  name: string
  version: string
  description: string
  author?: string
  date?: string
  keywords?: string[]
}

export interface OutdatedInfo {
  name: string
  current: string
  latest: string
  wanted: string
  dependent: string
}

/**
 * Search npm registry for packages matching a query.
 */
export async function searchNpm(
  query: string,
  options?: { size?: number },
): Promise<SearchResult[]> {
  const size = options?.size ?? 20
  const url = `https://registry.npmjs.org/-/v1/search?text=${encodeURIComponent(query)}&size=${size}`

  const response = await fetch(url)
  if (!response.ok) {
    throw new Error(`Search failed: ${response.statusText}`)
  }

  const data = (await response.json()) as {
    objects: Array<{
      package: {
        name: string
        version: string
        description?: string
        author?: { name?: string } | string
        date?: string
        keywords?: string[]
      }
    }>
  }

  return data.objects.map((obj) => ({
    name: obj.package.name,
    version: obj.package.version,
    description: obj.package.description ?? '',
    author:
      typeof obj.package.author === 'string'
        ? obj.package.author
        : obj.package.author?.name,
    date: obj.package.date,
    keywords: obj.package.keywords,
  }))
}

/**
 * Fetch all available versions for a package.
 */
export async function getPackageVersions(
  packageName: string,
): Promise<string[]> {
  const url = `https://registry.npmjs.org/${encodeURIComponent(packageName)}`

  const response = await fetch(url)
  if (!response.ok) {
    throw new Error(`Failed to fetch versions: ${response.statusText}`)
  }

  const data = (await response.json()) as {
    versions?: Record<string, unknown>
    error?: string
  }

  if (data.error) {
    throw new Error(`Package not found: ${packageName}`)
  }

  return Object.keys(data.versions ?? {}).sort().reverse()
}

/**
 * Check for outdated packages by comparing current versions with latest.
 */
export async function checkOutdated(
  deps: Record<string, string>,
  options?: { logger?: (msg: string) => void },
): Promise<OutdatedInfo[]> {
  const log = options?.logger ?? (() => {})
  const outdated: OutdatedInfo[] = []

  for (const [name, currentSpec] of Object.entries(deps)) {
    // Skip catalog: references and workspace: references
    if (currentSpec.startsWith('catalog:') || currentSpec.startsWith('workspace:')) {
      continue
    }

    // Extract version from spec (remove ^, ~, etc.)
    const currentVersion = currentSpec.replace(/^[\^~>=<]+/, '')

    try {
      const meta = await getLatestVersion(name)
      if (!meta.version) continue

      const latestVersion = meta.version
      // For simple version comparison, check if current is different from latest
      if (currentVersion !== latestVersion && !currentVersion.includes('*')) {
        outdated.push({
          name,
          current: currentSpec,
          latest: `^${latestVersion}`,
          wanted: `^${latestVersion}`,
          dependent: 'root',
        })
        log(`Checking ${name}: ${currentSpec} -> ^${latestVersion}`)
      }
    } catch {
      // Skip packages that can't be fetched
    }
  }

  return outdated
}

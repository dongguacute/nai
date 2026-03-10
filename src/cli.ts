#!/usr/bin/env node
import process from 'node:process'
import * as p from '@clack/prompts'
import cac from 'cac'
import { getLatestVersion } from 'fast-npm-meta'
import { providers } from './providers/index.ts'
import type { LogTool, Provider } from './type.ts'

interface ParsedPackage {
  name: string
  version?: string
}

interface ResolvedDep {
  name: string
  version: string
  catalogName: string
  /** Whether the entry already exists in catalog (skip addCatalog) */
  existsInCatalog: boolean
}

/** Parse a package specifier like "react@^18.3.1" or "@types/node@^20" */
function parsePackageSpec(spec: string): ParsedPackage {
  const atIndex = spec.indexOf('@', spec.startsWith('@') ? 1 : 0)
  if (atIndex <= 0) return { name: spec }
  return {
    name: spec.slice(0, atIndex),
    version: spec.slice(atIndex + 1) || undefined,
  }
}

/** Auto-detect the first available provider with catalog support */
async function detectProvider(): Promise<Provider | undefined> {
  for (const provider of providers) {
    const { exists } = await provider.checkExistence()
    if (exists) return provider
  }
}

/** Guard against user cancellation (Ctrl+C) in prompts */
function guardCancel<T>(value: T | symbol): T {
  if (p.isCancel(value)) {
    p.cancel('Operation cancelled.')
    process.exit(0)
  }
  return value
}

const log: LogTool = {
  info: (msg) => p.log.info(msg),
  error: (msg) => p.log.error(msg),
}

async function run(
  names: string[],
  options: { dev?: boolean; peer?: boolean; catalog?: string },
) {
  p.intro('nip')

  // --- Detect package manager ---
  const provider = await detectProvider()
  if (!provider) {
    // TODO: fallback to traditional ni logic
    log.error('No package manager with catalog support detected.')
    p.outro('Exiting')
    process.exit(1)
  }
  log.info(`Detected: ${provider.name}`)

  // --- Parse or prompt for package names ---
  let packages: ParsedPackage[]
  if (names.length > 0) {
    packages = names.map(parsePackageSpec)
  } else {
    const input = guardCancel(
      await p.text({
        message: 'Package names to install (space-separated)',
        placeholder: 'e.g. react vue@^3.5 lodash',
        validate: (v) => {
          if (!v?.trim()) return 'Please enter at least one package name.'
        },
      }),
    )
    packages = input.trim().split(/\s+/).map(parsePackageSpec)
  }

  // --- Get existing catalogs & select target ---
  const { catalogs } = await provider.listCatalogs()
  const catalogNames = Object.keys(catalogs)

  let targetCatalog: string
  if (options.catalog != null) {
    targetCatalog = options.catalog
  } else if (catalogNames.length === 0) {
    targetCatalog = guardCancel(
      await p.text({
        message: 'No catalogs found. Enter a name for the new catalog',
        placeholder: 'e.g. default',
        validate: (v) => {
          if (!v?.trim()) return 'Catalog name is required.'
        },
      }),
    )
  } else {
    const selected = guardCancel(
      await p.select({
        message: 'Select a catalog',
        options: [
          ...catalogNames.map((name) => ({
            value: name,
            label: name || '(default)',
            hint: `${Object.keys(catalogs[name]).length} deps`,
          })),
          { value: '__new__', label: '+ Create new catalog' },
        ],
      }),
    )

    if (selected === '__new__') {
      targetCatalog = guardCancel(
        await p.text({
          message: 'New catalog name',
          validate: (v) => {
            if (!v?.trim()) return 'Catalog name is required.'
          },
        }),
      )
    } else {
      targetCatalog = selected
    }
  }

  // --- Resolve version for each package ---
  const resolved: ResolvedDep[] = []

  for (const pkg of packages) {
    // 1) Version specified in command -> use directly
    if (pkg.version) {
      resolved.push({
        name: pkg.name,
        version: pkg.version,
        catalogName: targetCatalog,
        existsInCatalog: false,
      })
      continue
    }

    // 2) Check if dep exists in any catalog
    const existingEntries: { catalogName: string; version: string }[] = []
    for (const [catName, deps] of Object.entries(catalogs)) {
      if (pkg.name in deps) {
        existingEntries.push({ catalogName: catName, version: deps[pkg.name] })
      }
    }

    if (existingEntries.length > 0) {
      const existingOptions = [
        ...existingEntries.map((e) => ({
          value: `${e.catalogName}\0${e.version}`,
          label: `Use: ${e.catalogName || '(default)'} → ${e.version}`,
        })),
        {
          value: '',
          label: 'Fetch latest from npm',
        },
      ]
      const selected = guardCancel(
        await p.select({
          message: `"${pkg.name}" found in existing catalog(s)`,
          options: existingOptions,
        }),
      )

      if (selected) {
        const [catalogName, version] = selected.split('\0')
        resolved.push({
          name: pkg.name,
          version,
          catalogName,
          existsInCatalog: true,
        })
        continue
      }
    }

    // 3) Fetch latest version from npm
    const s = p.spinner()
    s.start(`Fetching latest version of ${pkg.name}`)
    try {
      const meta = await getLatestVersion(pkg.name)
      if (!meta.version) {
        s.stop(`Package "${pkg.name}" not found`)
        log.error(`Could not resolve version for "${pkg.name}". Skipping.`)
        continue
      }
      s.stop(`${pkg.name} → ^${meta.version}`)
      resolved.push({
        name: pkg.name,
        version: `^${meta.version}`,
        catalogName: targetCatalog,
        existsInCatalog: false,
      })
    } catch (error) {
      s.stop(`Failed to fetch ${pkg.name}`)
      log.error(
        `Could not fetch "${pkg.name}": ${error instanceof Error ? error.message : error}`,
      )
    }
  }

  if (resolved.length === 0) {
    log.error('No packages to install.')
    p.outro('Exiting')
    return
  }

  // --- Select workspace packages (if monorepo) ---
  const { packages: repoPackages } = await provider.listPackages()
  let targetDirs: string[]

  if (repoPackages.length <= 1) {
    targetDirs = repoPackages.length === 1 ? [repoPackages[0].directory] : ['.']
  } else {
    targetDirs = guardCancel(
      await p.multiselect({
        message: 'Select packages to install to',
        options: repoPackages.map((pkg) => ({
          value: pkg.directory,
          label: pkg.name,
          hint: pkg.description || undefined,
        })),
      }),
    )
  }

  // --- Execute: add catalog entries, then dependencies, then install ---
  const s = p.spinner()

  for (const dep of resolved) {
    if (!dep.existsInCatalog) {
      s.start(
        `Adding ${dep.name}@${dep.version} to catalog "${dep.catalogName}"`,
      )
      await provider.addCatalog({
        catalogName: dep.catalogName,
        depName: dep.name,
        depVersion: dep.version,
      })
      s.stop(`Added ${dep.name} to catalog "${dep.catalogName}"`)
    }
  }

  for (const dir of targetDirs) {
    for (const dep of resolved) {
      s.start(`Adding ${dep.name} to ${dir}`)
      await provider.addDependency({
        directory: dir,
        depName: dep.name,
        depVersion: dep.catalogName,
        isCatalog: true,
        dev: options.dev ?? false,
        peer: options.peer ?? false,
      })
      s.stop(`Added ${dep.name} → ${dir}`)
    }
  }

  s.start('Installing dependencies')
  await provider.runInstall({})
  s.stop('Dependencies installed')

  p.outro('Done!')
}

// --- CLI Setup ---
const cli = cac('nip')

cli
  .command('[...names]', 'Install packages with catalog support')
  .option('-D, --dev', 'Install as dev dependency')
  .option('--peer', 'Install as peer dependency')
  .option('-C, --catalog <name>', 'Specify catalog name')
  .action(run)

cli.help()
cli.version('0.0.0')
cli.parse()

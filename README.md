# @rizumu/nai

> **n**pm **a**dd, **i**nteractive ✨

An interactive CLI that makes installing dependencies easy — with first-class **catalog** support.

<img height="500" alt="Ghostty 2026-03-11 01 32 41" src="https://github.com/user-attachments/assets/83d164f3-8a13-41f1-a453-23ffd81ed387" />

## 📦 Install

```bash
npm i -g @rizumu/nai
```

## 🚀 Usage

```bash
# Interactive mode — prompts for everything
nai

# Pass package names directly
nai react vue@^3.5 lodash

# Install as devDependencies
nai vitest -D

# Install as peerDependencies
nai react --peer

# Specify a catalog
nai zod -C prod

# Search npm for packages
nai search react
nai s vue router

# Update packages to latest versions
nai update
nai up react lodash

# Manage catalogs
nai catalog
nai catalog --list
```

Run `nai --help` for all available options.

## 💡 Why nai?

Installing dependencies in modern projects is getting painful:

- Which package manager? `npm`, `pnpm`, `yarn`, `bun`?
- Remember the exact package name — no typos allowed
- `-D` or not? `--save-peer`?
- Monorepo? Which workspace package? (`-F`, `-w`, ...)
- Catalogs? Manually edit `pnpm-workspace.yaml` every time...

Too many flags. Too many files to touch. Too many things to remember.

`nai` solves this with a beautiful interactive UI that guides you through each step:

1. 🔍 **Auto-detect** your package manager
2. 📦 **Resolve versions** — reuse existing catalog entries or fetch latest from npm
3. 🗂️ **Pick a catalog** — or skip, or create a new one
4. 📁 **Select workspace packages** in monorepo
5. 🏷️ **Choose dep type** — `dependencies` / `devDependencies` / `peerDependencies`
6. ✅ **Review & confirm** — colorful summary before any file is changed
7. 🚀 **Install** — writes config files and runs install for you

## 📋 Commands

| Command | Alias | Description |
|---------|-------|-------------|
| `nai [packages]` | - | Install packages interactively |
| `nai search [query]` | `nai s` | Search npm for packages |
| `nai update [packages]` | `nai up` | Update packages to latest versions |
| `nai remove [packages]` | `nai rm` | Remove packages from dependencies |
| `nai catalog` | - | Browse and manage catalog versions |

### 🔍 Search

Search npm registry interactively:

```bash
nai search react
nai s "ui framework"
```

Results show package names, versions, and descriptions. Select a package to install it directly.

### 📦 Update

Check and update outdated packages:

```bash
# Check all packages for updates
nai update

# Update specific packages
nai update react lodash

# Interactive mode
nai update -i
```

### 🗂️ Catalog

Browse catalogs and change dependency versions:

```bash
# Interactive catalog browser
nai catalog

# List all catalogs
nai catalog --list
```

Select packages within a catalog and choose new versions from npm.

## 🗂️ What is a Catalog?

Catalogs let you define dependency versions in one central place (e.g. `pnpm-workspace.yaml`) and reference them in `package.json` with `catalog:name`. This keeps versions consistent across a monorepo.

```yaml
# pnpm-workspace.yaml
catalogs:
  prod:
    react: ^19.0.0
    vue: ^3.5.0
```

```json
// package.json
{
  "dependencies": {
    "react": "catalog:prod"
  }
}
```

`nai` manages this for you — no manual file editing needed.

## 🛠️ Supported Package Managers

| Package Manager | Status       |
| --------------- | ------------ |
| pnpm            | ✅ Supported |
| yarn            | ✅ Supported |
| bun             | ✅ Supported |
| vlt             | 🚧 Planned   |
| npm             | 🚧 Planned   |

## 📄 License

[MIT](./LICENSE)

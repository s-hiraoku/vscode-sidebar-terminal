import { readFileSync, writeFileSync, existsSync } from 'fs'
import { resolve, dirname } from 'path'

const ROOT = resolve(dirname(new URL(import.meta.url).pathname), '../..')
const WEBSITE = resolve(ROOT, 'website')

interface PackageJson {
  contributes: {
    commands?: Array<{ command: string; title: string; category?: string; icon?: unknown }>
    configuration?: {
      properties?: Record<string, {
        type?: string
        default?: unknown
        description?: string
        enum?: string[]
        minimum?: number
        maximum?: number
        markdownDescription?: string
      }>
    }
    keybindings?: Array<{
      command: string
      key?: string
      mac?: string
      when?: string
    }>
  }
}

function loadPackageJson(): PackageJson {
  return JSON.parse(readFileSync(resolve(ROOT, 'package.json'), 'utf-8'))
}

function generateSettingsPage(pkg: PackageJson): string {
  const props = pkg.contributes.configuration?.properties ?? {}
  const entries = Object.entries(props).sort(([a], [b]) => a.localeCompare(b))

  const categories = new Map<string, Array<{ key: string; meta: typeof props[string] }>>()

  for (const [key, meta] of entries) {
    const parts = key.replace('secondaryTerminal.', '').split('.')
    const category = parts.length > 1 ? parts[0] : 'general'
    if (!categories.has(category)) categories.set(category, [])
    categories.get(category)!.push({ key, meta })
  }

  let md = `---\ntitle: Settings Reference\n---\n\n# Settings Reference\n\n`
  md += `Secondary Terminal provides **${entries.length}** configurable settings.\n\n`
  md += `::: tip\nAll settings use the \`secondaryTerminal.\` prefix. For example, \`fontSize\` is set as \`secondaryTerminal.fontSize\` in your VS Code settings.\n:::\n\n`

  for (const [category, settings] of categories) {
    const title = category.charAt(0).toUpperCase() + category.slice(1).replace(/([A-Z])/g, ' $1')
    md += `## ${title}\n\n`
    md += `| Setting | Type | Default | Description |\n`
    md += `|---------|------|---------|-------------|\n`

    for (const { key, meta } of settings) {
      const shortKey = key.replace('secondaryTerminal.', '')
      const type = meta.type ?? ''
      let defaultVal = meta.default !== undefined ? `\`${JSON.stringify(meta.default)}\`` : '-'
      if (defaultVal.length > 40) defaultVal = '*(see docs)*'
      const desc = (meta.markdownDescription ?? meta.description ?? '').replace(/\|/g, '\\|').replace(/\n/g, ' ')
      md += `| \`${shortKey}\` | ${type} | ${defaultVal} | ${desc} |\n`
    }
    md += '\n'
  }

  return md
}

function generateCommandsPage(pkg: PackageJson): string {
  const commands = pkg.contributes.commands ?? []
  const keybindings = pkg.contributes.keybindings ?? []

  const keyMap = new Map<string, { key?: string; mac?: string }>()
  for (const kb of keybindings) {
    keyMap.set(kb.command, { key: kb.key, mac: kb.mac })
  }

  let md = `---\ntitle: Commands Reference\n---\n\n# Commands Reference\n\n`
  md += `Secondary Terminal provides **${commands.length}** commands.\n\n`
  md += `| Command | Title | Shortcut (Win/Linux) | Shortcut (Mac) |\n`
  md += `|---------|-------|---------------------|----------------|\n`

  for (const cmd of commands.sort((a, b) => a.command.localeCompare(b.command))) {
    const kb = keyMap.get(cmd.command)
    const winKey = kb?.key ?? '-'
    const macKey = kb?.mac ?? kb?.key ?? '-'
    const title = cmd.category ? `${cmd.category}: ${cmd.title}` : cmd.title
    md += `| \`${cmd.command}\` | ${title} | ${winKey} | ${macKey} |\n`
  }

  return md
}

function generateKeyboardShortcutsPage(pkg: PackageJson): string {
  const keybindings = pkg.contributes.keybindings ?? []
  const commands = pkg.contributes.commands ?? []
  const cmdMap = new Map<string, string>()
  for (const cmd of commands) {
    cmdMap.set(cmd.command, cmd.category ? `${cmd.category}: ${cmd.title}` : cmd.title)
  }

  const isPanelNav = (kb: { when?: string }) =>
    kb.when?.includes('panelNavigationMode') || kb.when?.includes('panelNavigation.enabled')

  const general = keybindings.filter(kb => !isPanelNav(kb))
  const panelNav = keybindings.filter(kb => isPanelNav(kb))

  let md = `---\ntitle: Keyboard Shortcuts\n---\n\n# Keyboard Shortcuts\n\n`

  md += `## General Shortcuts\n\n`
  md += `| Action | Windows / Linux | macOS |\n`
  md += `|--------|----------------|-------|\n`
  for (const kb of general) {
    const title = cmdMap.get(kb.command) ?? kb.command.replace('secondaryTerminal.', '')
    const winKey = kb.key ? `\`${kb.key}\`` : '-'
    const macKey = kb.mac ? `\`${kb.mac}\`` : winKey
    md += `| ${title} | ${winKey} | ${macKey} |\n`
  }

  if (panelNav.length > 0) {
    md += `\n## Panel Navigation Mode\n\n`
    md += `::: tip\nThese shortcuts are only active when Panel Navigation Mode is enabled (\`panelNavigation.enabled: true\`) and you are in navigation mode (\`Ctrl+P\` to toggle).\n:::\n\n`
    md += `| Action | Key |\n`
    md += `|--------|-----|\n`
    for (const kb of panelNav) {
      const title = cmdMap.get(kb.command) ?? kb.command.replace('secondaryTerminal.', '')
      const key = kb.key ? `\`${kb.key}\`` : '-'
      md += `| ${title} | ${key} |\n`
    }
  }

  return md
}

function copyRootDoc(filename: string, outputPath: string, title: string): void {
  const src = resolve(ROOT, filename)
  if (!existsSync(src)) return
  let content = readFileSync(src, 'utf-8')
  // Add frontmatter if not present
  if (!content.startsWith('---')) {
    content = `---\ntitle: ${title}\n---\n\n${content}`
  }
  writeFileSync(resolve(WEBSITE, outputPath), content)
  console.log(`  Synced ${filename} -> ${outputPath}`)
}

// Main
console.log('Syncing docs...')
const pkg = loadPackageJson()

// Generate reference pages
const settingsMd = generateSettingsPage(pkg)
writeFileSync(resolve(WEBSITE, 'reference/settings.md'), settingsMd)
console.log(`  Generated reference/settings.md (${Object.keys(pkg.contributes.configuration?.properties ?? {}).length} settings)`)

const commandsMd = generateCommandsPage(pkg)
writeFileSync(resolve(WEBSITE, 'reference/commands.md'), commandsMd)
console.log(`  Generated reference/commands.md (${(pkg.contributes.commands ?? []).length} commands)`)

const shortcutsMd = generateKeyboardShortcutsPage(pkg)
writeFileSync(resolve(WEBSITE, 'reference/keyboard-shortcuts.md'), shortcutsMd)
console.log(`  Generated reference/keyboard-shortcuts.md`)

// Copy root docs
copyRootDoc('CHANGELOG.md', 'changelog.md', 'Changelog')
copyRootDoc('CONTRIBUTING.md', 'contributing.md', 'Contributing')
copyRootDoc('PRIVACY.md', 'privacy.md', 'Privacy Policy')

console.log('Done!')

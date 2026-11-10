#!/usr/bin/env node
/**
 * better-sqlite3 is a native addon. Vitest needs the Node ABI; Electron needs
 * Electron's. Whichever rebuilt last "wins" and breaks the other.
 *
 * We keep a small stamp next to the addon and rebuild only when the desired
 * runtime (and its version) changes.
 *
 * Usage: node scripts/ensure-sqlite-abi.mjs electron|node
 */
import { spawnSync } from 'node:child_process'
import { createRequire } from 'node:module'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const target = process.argv[2]
if (target !== 'electron' && target !== 'node') {
  console.error('Usage: node scripts/ensure-sqlite-abi.mjs electron|node')
  process.exit(2)
}

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const requireFromRoot = createRequire(path.join(root, 'package.json'))
const stampPath = path.join(root, 'node_modules', 'better-sqlite3', '.open-tick-abi')

function desiredStamp() {
  if (target === 'electron') {
    const ver = requireFromRoot('electron/package.json').version
    return `electron:${ver}`
  }
  return `node:${process.version}`
}

function readStamp() {
  try {
    return fs.readFileSync(stampPath, 'utf8').trim()
  } catch {
    return null
  }
}

function writeStamp(value) {
  fs.mkdirSync(path.dirname(stampPath), { recursive: true })
  fs.writeFileSync(stampPath, `${value}\n`)
}

function run(command, args) {
  const env = { ...process.env }
  // Allow install/rebuild scripts; CI must not skip electron-rebuild here.
  delete env.CI
  const result = spawnSync(command, args, {
    cwd: root,
    stdio: 'inherit',
    shell: process.platform === 'win32',
    env,
  })
  if (result.status !== 0) process.exit(result.status ?? 1)
}

function addonPresent() {
  return fs.existsSync(
    path.join(root, 'node_modules', 'better-sqlite3', 'build', 'Release', 'better_sqlite3.node'),
  )
}

/** True when the addon actually loads in this Node process (catches stale Electron ABI). */
function nodeAddonLoads() {
  try {
    requireFromRoot('better-sqlite3')
    return true
  } catch {
    return false
  }
}

const wanted = desiredStamp()
const stampOk = readStamp() === wanted && addonPresent()
if (target === 'node') {
  if (stampOk && nodeAddonLoads()) process.exit(0)
} else if (stampOk) {
  process.exit(0)
}

if (target === 'node') {
  console.log('Rebuilding better-sqlite3 for Node (tests)…')
  run('npm', ['rebuild', 'better-sqlite3'])
  if (!nodeAddonLoads()) {
    console.error(
      'better-sqlite3 still fails to load for Node after rebuild (wrong ABI or blocked install scripts).',
    )
    process.exit(1)
  }
} else {
  console.log('Rebuilding better-sqlite3 for Electron…')
  run('npm', ['run', 'rebuild:native'])
}

writeStamp(wanted)

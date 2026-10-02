/**
 * Ensure better-sqlite3 is a Windows PE binary before packaging for win32.
 * Cross-packaging from Linux otherwise ships an ELF .node → DB init crash, no window.
 */
const { execSync } = require('node:child_process')
const fs = require('node:fs')
const path = require('node:path')
const https = require('node:https')
const { createWriteStream } = require('node:fs')
const { pipeline } = require('node:stream/promises')

function readMagic(filePath, len) {
  const fd = fs.openSync(filePath, 'r')
  const buf = Buffer.alloc(len)
  fs.readSync(fd, buf, 0, len, 0)
  fs.closeSync(fd)
  return buf
}

function isWindowsPe(filePath) {
  const buf = readMagic(filePath, 2)
  return buf[0] === 0x4d && buf[1] === 0x5a // "MZ"
}

function isLinuxElf(filePath) {
  const buf = readMagic(filePath, 4)
  return buf[0] === 0x7f && buf[1] === 0x45 && buf[2] === 0x4c && buf[3] === 0x46
}

function download(url, dest) {
  return new Promise((resolve, reject) => {
    const follow = (current, redirects = 0) => {
      if (redirects > 5) {
        reject(new Error('Too many redirects'))
        return
      }
      https
        .get(current, (res) => {
          if (res.statusCode && res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
            follow(res.headers.location, redirects + 1)
            return
          }
          if (res.statusCode !== 200) {
            reject(new Error(`HTTP ${res.statusCode} for ${current}`))
            res.resume()
            return
          }
          const out = createWriteStream(dest)
          pipeline(res, out).then(resolve).catch(reject)
        })
        .on('error', reject)
    }
    follow(url)
  })
}

async function fetchWinPrebuild(projectDir, electronVersion) {
  const modDir = path.join(projectDir, 'node_modules', 'better-sqlite3')
  const sqliteVersion = require(path.join(modDir, 'package.json')).version
  const abi = require('node-abi').getAbi(electronVersion, 'electron')
  const asset = `better-sqlite3-v${sqliteVersion}-electron-v${abi}-win32-x64.tar.gz`
  const url = `https://github.com/WiseLibs/better-sqlite3/releases/download/v${sqliteVersion}/${asset}`

  const cacheDir = path.join(projectDir, '.prebuild-cache')
  fs.mkdirSync(cacheDir, { recursive: true })
  const tarball = path.join(cacheDir, asset)

  if (!fs.existsSync(tarball)) {
    console.log(`[beforePack] Downloading ${url}`)
    await download(url, tarball)
  } else {
    console.log(`[beforePack] Using cached ${asset}`)
  }

  const releaseDir = path.join(modDir, 'build', 'Release')
  fs.mkdirSync(releaseDir, { recursive: true })

  execSync(`tar -xzf "${tarball}" -C "${modDir}"`, { stdio: 'inherit' })

  // prebuild tarballs usually extract build/Release/better_sqlite3.node relative to package root
  const nodePath = path.join(releaseDir, 'better_sqlite3.node')
  if (!fs.existsSync(nodePath)) {
    // Some archives nest differently — search once
    const found = execSync(`find "${modDir}" -name better_sqlite3.node`, { encoding: 'utf8' })
      .trim()
      .split('\n')
      .filter(Boolean)[0]
    if (!found) throw new Error('better_sqlite3.node not found after extract')
    fs.copyFileSync(found, nodePath)
  }
  return nodePath
}

exports.default = async function beforePack(context) {
  if (context.electronPlatformName !== 'win32') return

  const projectDir = context.packager.projectDir
  const electronVersion =
    context.electronVersion ||
    require(path.join(projectDir, 'node_modules', 'electron', 'package.json')).version

  console.log(`[beforePack] Installing better-sqlite3 Electron ${electronVersion} win32-x64…`)

  let nodePath
  try {
    const modDir = path.join(projectDir, 'node_modules', 'better-sqlite3')
    const cacheDir = path.join(projectDir, '.prebuild-cache')
    fs.mkdirSync(cacheDir, { recursive: true })
    execSync(
      `npx --yes prebuild-install --platform win32 --arch x64 --runtime electron --target ${electronVersion} --force --verbose`,
      {
        cwd: modDir,
        stdio: 'inherit',
        env: {
          ...process.env,
          npm_config_cache: cacheDir,
          npm_config_platform: 'win32',
          npm_config_arch: 'x64',
        },
      },
    )
    nodePath = path.join(modDir, 'build', 'Release', 'better_sqlite3.node')
  } catch (err) {
    console.warn('[beforePack] prebuild-install failed, trying direct GitHub download…', err.message)
    nodePath = await fetchWinPrebuild(projectDir, electronVersion)
  }

  if (!fs.existsSync(nodePath)) {
    throw new Error(`[beforePack] Missing ${nodePath}`)
  }
  if (isLinuxElf(nodePath)) {
    throw new Error(
      '[beforePack] better_sqlite3.node is still a Linux ELF binary. Windows package would not start a window.',
    )
  }
  if (!isWindowsPe(nodePath)) {
    throw new Error(
      '[beforePack] better_sqlite3.node is not a Windows PE binary (expected MZ header).',
    )
  }
  console.log('[beforePack] better-sqlite3 win32 binary OK')
}

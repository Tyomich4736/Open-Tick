import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'

/** Matches package.json `desktopName` / WM_CLASS. */
export const LINUX_AUTOSTART_DESKTOP = 'open-tick.desktop'

export function linuxAutostartPath(
  env: NodeJS.ProcessEnv = process.env,
  homedir: string = os.homedir(),
): string {
  const configHome = env.XDG_CONFIG_HOME?.trim() || path.join(homedir, '.config')
  return path.join(configHome, 'autostart', LINUX_AUTOSTART_DESKTOP)
}

/** AppImage must relaunch via $APPIMAGE — process.execPath is a transient FUSE mount. */
export function linuxAutostartExecPath(
  env: NodeJS.ProcessEnv = process.env,
  execPath: string = process.execPath,
): string {
  const appImage = env.APPIMAGE?.trim()
  return appImage && appImage.length > 0 ? appImage : execPath
}

/** Pure builder for XDG autostart `.desktop` contents. */
export function buildLinuxAutostartDesktopEntry(options: {
  name: string
  execPath: string
}): string {
  const escaped = options.execPath.replace(/\\/g, '\\\\').replace(/"/g, '\\"')
  return [
    '[Desktop Entry]',
    'Type=Application',
    `Name=${options.name}`,
    `Exec="${escaped}"`,
    'Terminal=false',
    'X-GNOME-Autostart-enabled=true',
    '',
  ].join('\n')
}

/**
 * Enable/disable Linux login autostart via `~/.config/autostart/`.
 * Electron's `setLoginItemSettings` is macOS/Windows-only.
 */
export function applyLinuxAutoStart(enabled: boolean): void {
  const file = linuxAutostartPath()
  if (!enabled) {
    fs.rmSync(file, { force: true })
    return
  }
  fs.mkdirSync(path.dirname(file), { recursive: true })
  fs.writeFileSync(
    file,
    buildLinuxAutostartDesktopEntry({
      name: 'Open Tick',
      execPath: linuxAutostartExecPath(),
    }),
    'utf8',
  )
}

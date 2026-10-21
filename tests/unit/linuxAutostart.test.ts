import { describe, expect, it } from 'vitest'
import {
  buildLinuxAutostartDesktopEntry,
  linuxAutostartExecPath,
  linuxAutostartPath,
} from '../../electron/main/desktop/linuxAutostart'

describe('linuxAutostartExecPath', () => {
  it('prefers APPIMAGE over process.execPath', () => {
    expect(
      linuxAutostartExecPath(
        { APPIMAGE: '/home/me/Apps/Open Tick-1.0.0.AppImage' },
        '/tmp/.mount_OpenTiXXXX/open-tick',
      ),
    ).toBe('/home/me/Apps/Open Tick-1.0.0.AppImage')
  })

  it('falls back to execPath when not an AppImage', () => {
    expect(linuxAutostartExecPath({}, '/usr/lib/open-tick/open-tick')).toBe(
      '/usr/lib/open-tick/open-tick',
    )
  })

  it('ignores blank APPIMAGE', () => {
    expect(linuxAutostartExecPath({ APPIMAGE: '  ' }, '/opt/bin/open-tick')).toBe(
      '/opt/bin/open-tick',
    )
  })
})

describe('linuxAutostartPath', () => {
  it('uses XDG_CONFIG_HOME when set', () => {
    expect(linuxAutostartPath({ XDG_CONFIG_HOME: '/custom/config' }, '/home/me')).toBe(
      '/custom/config/autostart/open-tick.desktop',
    )
  })

  it('falls back to ~/.config/autostart', () => {
    expect(linuxAutostartPath({}, '/home/me')).toBe(
      '/home/me/.config/autostart/open-tick.desktop',
    )
  })
})

describe('buildLinuxAutostartDesktopEntry', () => {
  it('quotes Exec path and enables GNOME autostart', () => {
    const text = buildLinuxAutostartDesktopEntry({
      name: 'Open Tick',
      execPath: '/home/me/Apps/Open Tick.AppImage',
    })
    expect(text).toContain('Name=Open Tick')
    expect(text).toContain('Exec="/home/me/Apps/Open Tick.AppImage"')
    expect(text).toContain('X-GNOME-Autostart-enabled=true')
    expect(text.startsWith('[Desktop Entry]\n')).toBe(true)
  })
})

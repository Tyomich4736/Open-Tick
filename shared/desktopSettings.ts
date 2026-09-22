/** Desktop / notifications settings keys and defaults (Phase 12). */

export const DESKTOP_SETTING_KEYS = {
  notificationsEnabled: 'notifications_enabled',
  notificationLeadMinutes: 'notification_lead_minutes',
  minimizeToTray: 'minimize_to_tray',
  autoStart: 'desktop.auto_start',
  shortcutQuickCapture: 'desktop.global_shortcut_quick_capture',
  shortcutNewSticky: 'desktop.global_shortcut_new_sticky',
  stickyPinByDefault: 'sticky.pin_by_default',
  windowBounds: 'window.bounds',
  windowMaximized: 'window.maximized',
} as const

export const DESKTOP_DEFAULTS = {
  notificationsEnabled: true,
  notificationLeadMinutes: 15,
  minimizeToTray: false,
  autoStart: false,
  shortcutQuickCapture: 'CommandOrControl+Shift+Space',
  shortcutNewSticky: 'CommandOrControl+Shift+N',
  stickyPinByDefault: false,
} as const

export interface WindowBounds {
  x: number
  y: number
  width: number
  height: number
}

export interface DesktopSettingsSnapshot {
  notificationsEnabled: boolean
  notificationLeadMinutes: number
  minimizeToTray: boolean
  autoStart: boolean
  shortcutQuickCapture: string
  shortcutNewSticky: string
  stickyPinByDefault: boolean
}

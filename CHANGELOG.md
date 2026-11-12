# Changelog

## [1.2.3] - 2026-11-12

### Fixed

- Timed due dates were incorrectly pushed to TickTick as all-day / date-only
- Recurring tasks were wrongly marked completed on pull when a prior cycle left a stale completed time

## [1.2.2] - 2026-11-05

### Added

- Push pending TickTick changes with Ctrl+S

### Fixed

- Due-date sorting and reminders for tasks with a date but no time
- Tasks with no time were incorrectly treated as all-day when syncing to TickTick
- All-day checkbox behavior
- Reminders firing before a task’s end time
- Date/time preview formatting

## [1.2.1] - 2026-10-31

### Fixed

- Drag-and-drop of tasks between sections
- List deletion issues

## [1.2.0] - 2026-10-31

### Added

- Settings → Sync tab for TickTick sync options, including “Pull on application startup”

### Fixed

- Pull from TickTick no longer skips local dirty rows incorrectly, and correctly reconciles tasks completed or deleted remotely

## [1.1.0] - 2026-10-23

### Added

- List sections: create and manage sections, move tasks between them, and sync sections with TickTick
- Group by in list view (section, date, list, tag, or priority)
- Pending sync tasks list in the Integration panel

## [1.0.1] - 2026-10-21

### Fixed

- Linux AppImage autostart now registers correctly
- Stopped reminder notifications from flooding on application startup
- Windows launch failure related to ICU data / sandbox install ACLs (NSIS installer)

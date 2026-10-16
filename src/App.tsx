import { Route, Routes } from 'react-router-dom'
import { AppShell } from '@/components/layout/AppShell'
import { CalendarPage } from '@/routes/CalendarPage'
import { DefaultSmartListRedirect } from '@/routes/DefaultSmartListRedirect'
import { SettingsPage } from '@/routes/SettingsPage'
import { StickyNoteWindowFromRoute } from '@/routes/StickyNoteWindow'
import { TaskViewPageFromRoute } from '@/routes/TaskViewPage'
import { TaskWindowPage } from '@/routes/TaskWindowPage'

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<AppShell />}>
        <Route index element={<DefaultSmartListRedirect />} />
        <Route path="inbox" element={<TaskViewPageFromRoute />} />
        <Route path="today" element={<TaskViewPageFromRoute />} />
        <Route path="tomorrow" element={<TaskViewPageFromRoute />} />
        <Route path="week" element={<TaskViewPageFromRoute />} />
        <Route path="overdue" element={<TaskViewPageFromRoute />} />
        <Route path="completed" element={<TaskViewPageFromRoute />} />
        <Route path="project/:projectId" element={<TaskViewPageFromRoute />} />
        <Route path="tag/:tagName" element={<TaskViewPageFromRoute />} />
        <Route path="calendar" element={<CalendarPage />} />
        <Route path="settings" element={<SettingsPage />} />
        <Route path="task-window/:taskId" element={<TaskWindowPage />} />
        <Route path="sticky/:taskId" element={<StickyNoteWindowFromRoute />} />
      </Route>
    </Routes>
  )
}

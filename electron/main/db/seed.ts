import { addDays, formatISO } from 'date-fns'
import type { Repositories } from './openDatabase'

export function seedDatabase(repos: Repositories): void {
  const taskCount = repos.db.prepare('SELECT COUNT(*) as count FROM tasks').get() as { count: number }
  if (taskCount.count > 0) return

  const inbox = repos.projects.ensureInbox()
  const workFolder = repos.folders.create({ name: 'Work' })
  const work = repos.projects.create({ name: 'Work', color: '#4772FA', folder_id: workFolder.id })
  const personal = repos.projects.create({ name: 'Personal', color: '#FE7777' })
  repos.projects.create({ name: 'Learning', color: '#34C759', folder_id: workFolder.id })

  const tags = ['errands', 'urgent', 'home', 'review'].map((name) => repos.tags.create({ name }))

  const now = new Date()
  const projects = [inbox, work, personal]
  const priorities = [0, 1, 3, 5] as const

  for (let i = 0; i < 20; i++) {
    const project = projects[i % projects.length]
    const dueOffset = (i % 7) - 2
    const dueDate = dueOffset >= 0 ? formatISO(addDays(now, dueOffset)) : null

    const task = repos.tasks.create({
      title: `Sample task ${i + 1}`,
      project_id: project.id,
      content: i % 3 === 0 ? 'Notes for this task' : '',
      priority: priorities[i % priorities.length],
      due_date: dueDate,
      tags: i % 2 === 0 ? [tags[i % tags.length].name] : [],
    })

    if (i < 5) {
      repos.tasks.create({
        title: `Subtask ${i + 1}.1`,
        project_id: project.id,
        parent_id: task.id,
      })
      if (i % 2 === 0) {
        repos.tasks.complete(
          repos.tasks.create({
            title: `Subtask ${i + 1}.2 (done)`,
            project_id: project.id,
            parent_id: task.id,
          }).id,
        )
      }
    }

    if (i === 19) {
      repos.tasks.complete(task.id)
    }
  }
}

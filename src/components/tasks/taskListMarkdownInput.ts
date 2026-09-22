import { InputRule } from '@tiptap/core'
import type { EditorState } from '@tiptap/pm/state'
import TaskItem from '@tiptap/extension-task-item'

function isInsideNode(state: EditorState, name: string): boolean {
  const { $from } = state.selection
  for (let d = $from.depth; d > 0; d -= 1) {
    if ($from.node(d).type.name === name) return true
  }
  return false
}

/**
 * TipTap's built-in task shortcut is only `[ ] `. Typing `- [ ] ` first matches the
 * bullet rule (`- `), so the checkbox never becomes a task item. This replaces the
 * default rule and converts `[ ] ` / `[x] ` (with optional leading `- ` / `* `)
 * into a proper task list, including when already inside a bullet list.
 */
export const TaskItemWithMarkdownInput = TaskItem.extend({
  addInputRules() {
    return [
      new InputRule({
        find: /(?:^|\s)([-+*]\s+)?\[( |x|X)\]\s$/,
        handler: ({ state, range, match, chain }) => {
          const checked = match[2].toLowerCase() === 'x'
          const inTaskItem = isInsideNode(state, 'taskItem')
          const inListItem = isInsideNode(state, 'listItem')

          const runner = chain().deleteRange({ from: range.from, to: range.to })

          if (inTaskItem) {
            runner.updateAttributes('taskItem', { checked }).run()
            return
          }

          if (inListItem) {
            runner.toggleList('taskList', 'taskItem').updateAttributes('taskItem', { checked }).run()
            return
          }

          runner.toggleTaskList().updateAttributes('taskItem', { checked }).run()
        },
      }),
    ]
  },
}).configure({ nested: true })

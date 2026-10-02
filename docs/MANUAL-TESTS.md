# Manual tests

Stuff to click through by hand. Unit tests don’t cover this.

Open Tick is local-first. TickTick plan limits only matter when you pull from or push to a TickTick account — the app itself doesn’t enforce free-plan quotas.

---

## How to run

**Profiles**

| Mark | Meaning |
|------|---------|
| **Local** | No TickTick account. Disconnect first, or use a fresh install. |
| **Both** | Same expected result on a free account and on a premium account. Run it twice. |
| **Free** | Free TickTick account only. The premium result is different. |
| **Premium** | Premium TickTick account only. A free account cannot complete this successfully. |

**Before an integration pass**

1. Use a dedicated TickTick test account. Do not use a personal account while push is enabled.
2. Prefix every list, folder, and task you create with `QA-` so it is easy to delete afterward.
3. In **Settings → Account**, save Client ID, Client Secret, region, and redirect URI (`http://127.0.0.1:18463/callback` must match the developer portal).
4. Leave **Enable push to TickTick** off until a case says to turn it on. Push is off by default.
5. After connect, confirm the Integration panel shows a successful pull before you edit anything.
6. Compare results in the official TickTick app or on [ticktick.com](https://ticktick.com) after each push or pull.
7. When switching between free and premium, disconnect, then start from a clean local database (export a backup first, or use a separate OS user / fresh `userData`). Leftover local rows will mix the two accounts.

**Pass / fail**

- **Pass** — the expected result happens, and a restart still shows the same data.
- **Fail** — wrong data, a crash, a silent drop, or a push/pull that reports success while TickTick disagrees.
- **Plan limit** — TickTick rejects the change because of the account tier. Record the error text from the Integration panel. That is a pass for **Free** cases that expect a rejection, and a fail if a **Premium** account is rejected the same way.

**Out of scope** — do not file these as bugs: habits, Focus / Pomodoro, countdowns, attachments, comments, collaboration / shared lists, email or location reminders, checklist-item reminders, Kanban, timeline, custom smart lists, task templates. Open Tick does not implement them.

---

## TickTick plan limits

From the [TickTick upgrade page](https://ticktick.com/upgrade) — their quotas, not ours.

| Limit | Free | Premium |
|-------|------|---------|
| Lists | 9 | 299 |
| Tasks and notes per list | 99 | 999 |
| Checklist items (subtasks) per task | 19 | 199 |
| Reminders per task | 2 | 5 |
| Attachments per day | 1 | 199 |
| Members on a shared list | 2 | 29 |

Premium-only TickTick features that this app can still create locally, and that sync must be checked against:

| TickTick capability | Open Tick behavior |
|---------------------|--------------------|
| Task duration (start and end) | Local duration tasks are allowed on any install. Pushing `startDate` to a **free** account may be rejected or stripped. |
| 3rd–5th reminder on one task | The editor allows up to **5** reminders locally. A **free** account accepts **2**. |
| 10th list, 100th task, 20th subtask | Allowed locally. Push fails or is truncated on a **free** account. |
| Calendar month / week / day views | Local calendar. It does not depend on TickTick Premium. |
| Themes, fonts, sticky notes, tray | Local only. They are not synced. |

Folders (TickTick project groups) are expected to sync on **both** tiers. If a free account rejects folder create, record the API error and treat that case as a newly discovered plan limit.

---

## 1. Launch and layout

| ID | Profile | Steps | Expected |
|----|---------|-------|----------|
| L-01 | Local | Start the app with `npm run dev` (or a packaged build). | A window opens. Sidebar, task list, and task panel are visible. No crash, no blank screen. |
| L-02 | Local | Quit and launch again. | Tasks, lists, sidebar width, and window size are the same as before quit. |
| L-03 | Local | Drag the divider between sidebar and list. Drag the divider between list and task panel. | Sidebar stays within about 180–360 px. Panel stays within about 280–560 px. The list column remains usable. |
| L-04 | Local | Double-click each divider. | Widths return to the default. |
| L-05 | Local | Collapse the sidebar, then expand it. Restart. | Icons-only mode sticks until you expand. The previous width comes back. State survives restart. |
| L-06 | Local | Resize the window near the minimum (about 900×600). | Panels keep their minimums. Text is not clipped into an unusable layout. |
| L-07 | Local | Open Settings, then return to Inbox. | Settings replace the three-pane layout. Returning restores sidebar, list, and panel. |
| L-08 | Local | With nothing selected, look at the right panel. | Empty state: “Select a task to view details” and a way to add a task. |
| L-09 | Local | Select a task, then click empty space in the list, then press Esc. | One click selects that task in the panel. Empty click or Esc clears the selection and shows the empty state. |

---

## 2. Sidebar, lists, and folders

| ID | Profile | Steps | Expected |
|----|---------|-------|----------|
| S-01 | Local | Check the smart lists in order. | Inbox, Today, Tomorrow, Next 7 Days, Overdue, Completed. Today shows a count badge of pending tasks due today. |
| S-02 | Local | Create a list from the sidebar (**+** / new project). Name it `QA-List`. | The list appears under projects, opens, and survives restart. |
| S-03 | Local | Right-click the list → Rename. Change the name. | The new name shows in the sidebar and in the list header. |
| S-04 | Local | Right-click the list → Delete list. Confirm. | The list and its tasks disappear. Cancel leaves them in place. |
| S-05 | Local | Create a folder. Create a list inside it from the folder menu (**Add list**). | The list is nested under the folder. |
| S-06 | Local | Collapse and expand the folder. Restart. | Open or closed state is remembered. |
| S-07 | Local | Right-click the folder → Rename. Then Delete folder and confirm. | Rename updates the folder. Delete removes the folder only. Lists inside move to the top level and are not deleted. |
| S-08 | Local | Right-click a list → Move to a folder. Then Move to top level. | The list changes parent. It does not duplicate. |
| S-09 | Local | Drag a list into a folder, out of a folder, and reorder lists and folders. Restart. | Order and folder membership persist. |
| S-10 | Local | Right-click Inbox, Today, Tomorrow, Next 7 Days, and Completed → Add task. | A task is created with a sensible default: Today is due today, Tomorrow is due tomorrow, Inbox has no extra due date unless the menu sets one. |
| S-11 | Local | Open the Tags section in the sidebar. Click a tag. | The list filters to tasks with that tag. An empty tag state is understandable. |
| S-12 | Local | Collapse the Projects and Tags section headers. Restart. | Each section stays collapsed or expanded as you left it. |

---

## 3. Tasks

| ID | Profile | Steps | Expected |
|----|---------|-------|----------|
| T-01 | Local | In Inbox, type a title in quick add and press Enter. | The task appears at the top (or at the position the current sort uses). The panel selects it. |
| T-02 | Local | Quick-add with Shift+Enter if the field supports it; otherwise create and confirm the panel opens. | The new task is selected and the detail panel is ready to edit. |
| T-03 | Local | Edit the title in the panel. Click away. Restart. | The new title is saved without an extra Save button. |
| T-04 | Local | Double-click the title in the list and edit it inline. | The list and the panel show the same title. |
| T-05 | Local | Click the checkbox. | The task is completed: strikethrough, checked box. It leaves active smart lists and appears in Completed. |
| T-06 | Local | In Completed, mark the task incomplete from the checkbox or context menu. | It returns to pending and shows again in its list. |
| T-07 | Local | Right-click → Duplicate. | A second task exists in the same list with the same title and main fields. Editing one does not change the other. |
| T-08 | Local | Right-click → Delete. Cancel, then confirm. | Cancel keeps the task. Confirm removes it from the list and from Completed. |
| T-09 | Local | Right-click → Move to list, pick another project. | The task leaves the old list and appears in the new one. Subtasks move with it. |
| T-10 | Local | Right-click → Copy link. Paste the link. | A toast says the link was copied. The link identifies that task. |
| T-11 | Local | Create a task with an empty title (if the UI allows submit). | The app refuses the create or substitutes a visible placeholder. It does not save a blank row that cannot be opened. |
| T-12 | Local | Toggle **Completed** in the list header on a project. | Completed tasks in that project show or hide. Smart lists keep their own rules. |
| T-13 | Local | On a long list, scroll while a task is selected. | Selection stays on that task. The row stays highlighted when it scrolls back into view. |

---

## 4. Detail panel, description, and subtasks

| ID | Profile | Steps | Expected |
|----|---------|-------|----------|
| D-01 | Local | In the description, apply bold, italic, a heading, a bullet list, a numbered list, a link, and a code block. Restart. | Formatting is still there after restart. The list row does not dump raw markdown in a broken way. |
| D-02 | Local | Put a blank line between two paragraphs. | The blank line is kept, including after a later pull if this task is synced (**Both** follow-up: P-10). |
| D-03 | Local | Ctrl+click (Cmd+click) a link in the description. | The link opens. A plain click does not navigate away by accident while typing. |
| D-04 | Local | Context menu → Add subtask. Type two subtasks and check one. | Panel shows the checklist. The list row shows progress such as `1/2`. |
| D-05 | Local | Reorder subtasks if drag is available. Complete the parent task. | Subtask order is saved. Completing the parent does not erase subtask text. |
| D-06 | Local | Delete a subtask. | Only that subtask disappears. The parent remains. |
| D-07 | Local | Add 19 subtasks, then a 20th, on a local-only task. | All 20 exist locally. Open Tick does not stop at the free TickTick cap of 19. The cap is tested in F-04 and M-04. |
| D-08 | Local | Select one task, then another. | The panel cross-fades or replaces content. It never shows two editors at once. |
| D-09 | Local | Confirm the panel does not contain priority, tag, move, or delete as primary buttons. | Those actions are on the task context menu (or on read-only chips that open the same controls). |

---

## 5. Dates, duration, reminders, and repeat

| ID | Profile | Steps | Expected |
|----|---------|-------|----------|
| R-01 | Local | Context menu → Date & reminder → Today, Tomorrow, Next week, Clear date. | The due chip updates. Cleared tasks disappear from Today. Today / Tomorrow / Next 7 Days membership matches the chip. |
| R-02 | Local | Set a due date with a time (not all-day). | The chip shows the time. Today includes it on that calendar day in the app timezone (**Settings → General**). |
| R-03 | Local | Change **Settings → General → Timezone** to a zone other than the system zone. Put a task at 23:30. | Today / Tomorrow use the selected timezone, not a shifted UTC day. |
| R-04 | Local | Switch time format between 12-hour and 24-hour. | Chips, pickers, and calendar labels follow the format. |
| R-05 | Local | Set a duration: start and end on the same day, with times. | The chip shows a range such as `10:00–12:00`. The panel metadata shows start and end. |
| R-06 | Local | Set an all-day duration across three days. | The chip shows a date span. Today includes the task on each day the span covers, not only the end date. |
| R-07 | Local | Set an end before the start. | The app shows an error and does not save the invalid range. |
| R-08 | Local | Clear the duration back to a single due date. | `start` is gone. The chip is a single date again. |
| R-09 | Local | Add reminders: At due time, 15 minutes before, 1 day before. Restart. | All three persist. The summary reads correctly. |
| R-10 | Local | Add reminders until the editor stops you. | The cap is **5**. A sixth cannot be added. The hint says the maximum is 5. |
| R-11 | Local | Remove every reminder, including At due time. | The task has no reminders. A later push sends an empty reminder list (**Both**: U-08). |
| R-12 | Local | Set repeat to Every day, Every week (two weekdays), Every month, Every year. | The chip matches the rule. Weekday selection is saved for weekly. |
| R-13 | Local | Set a custom interval (every 2 days) and an end: Never, On date, After N times. | Each end condition is stored and shown. |
| R-14 | Local | Complete a daily repeating task. | The completed occurrence moves to Completed. A next pending occurrence appears with the following due date. |
| R-15 | Local | On a repeating task, choose **This occurrence only** and change the title. Then change the series with **This and all future**. | The single occurrence keeps its own title. The series edit does not rewrite that exception. |
| R-16 | Local | Put an overdue dated task in the past. Open Overdue and Today. | Overdue lists it. Today does not, unless a duration span still overlaps today. The due chip uses overdue styling. |

---

## 6. Priority, tags, sort, and reorder

| ID | Profile | Steps | Expected |
|----|---------|-------|----------|
| P-01 | Local | Set priority to High, Medium, Low, and None from the context menu. | The priority bar color changes: high red, medium amber, low blue, none has no bar. Color is not the only cue; the menu shows the label. |
| P-02 | Local | Create two tags by applying them (or via the tag UI). Toggle one off. | Tags render on a second line under the title. Removing a tag updates the row and the tag sidebar. |
| P-03 | Local | Sort a project by Custom, Due date, Title, and Priority. Restart. | Order changes immediately. The same sort is selected after restart for that list. |
| P-04 | Local | With sort set to Custom, drag a task above another. Restart. | The new order persists. |
| P-05 | Local | Change sort to Title, then try to drag. | Either drag is disabled, or dropping switches back to Custom and the drop is kept. The list must not show a custom order while the control still says Title. |
| P-06 | Local | Open Completed. | Tasks are ordered by completion time, newest first. The sort control is hidden or ignored there. |

---

## 7. Multi-select

| ID | Profile | Steps | Expected |
|----|---------|-------|----------|
| M-01 | Local | Ctrl+click (Cmd+click) three tasks. Shift+click from the first to a later row. | Ctrl toggles individual rows. Shift selects the range in the current list order. The header shows `N selected`. |
| M-02 | Local | With two or more selected, look at the right panel. | Summary only: “N tasks selected” and a hint to right-click. No second editor. At most a short read-only title list. |
| M-03 | Local | Click one row with no modifier. | Multi-select clears. The panel shows that one task. |
| M-04 | Local | Right-click the selection. Set a due date, a priority, add a tag, and move all to another list. | Each action applies to every selected task. A toast summarizes the result. |
| M-05 | Local | Multi-select a mix of complete and pending tasks. Mark complete, then mark incomplete. | Complete closes the pending ones. Incomplete reopens the completed ones. Actions that apply to none of the selection are disabled. |
| M-06 | Local | Multi-select three tasks → Delete → confirm. | All three are deleted. Cancel deletes none. |
| M-07 | Local | Check a checkbox while several rows are selected. | That task toggles complete. The multi-selection is not cleared by the checkbox. |
| M-08 | Local | Switch to another list while a multi-selection is active. | Selection clears (or stays only if the same list is still showing). The panel does not keep editing a task from the previous list. |

---

## 8. Calendar

These views are local. A free TickTick account is not required, and TickTick Premium is not required.

| ID | Profile | Steps | Expected |
|----|---------|-------|----------|
| C-01 | Local | Switch List ↔ Calendar from the view control. | Calendar opens. List returns to the previous list path. |
| C-02 | Local | Open Month, Week, Days, Day, and Agenda. | Each view renders. Month shows a count or dots per day. Agenda lists upcoming tasks. |
| C-03 | Local | **Settings → Calendar**: week starts on Monday, then Sunday. | Month and week headers follow that setting. |
| C-04 | Local | Set visible hours to 08:00–18:00. | Week, Days, and Day grids show that range. |
| C-05 | Local | Place an all-day task and a timed task on the same date. | All-day sits in the all-day row. The timed task sits at the correct hour. A duration block’s height matches its length. |
| C-06 | Local | Create a multi-day all-day duration. Look at Month. | The task is visible on every day in the span. |
| C-07 | Local | On Week or Day, drag a time range on the grid. | A new task is created with that start and end, and the panel focuses the title. |
| C-08 | Local | Click a day in Month. | The view moves to that day (or shows that day’s agenda). |
| C-09 | Local | Turn **Show all iterations** on. Look at a daily task across the visible range. Turn it off. | On: future cycles appear in the visible range. Off: only the current occurrence is shown. |
| C-10 | Local | Change a task’s date in the list, then look at the calendar without restarting. | The calendar matches the list. Both read the local database. |

---

## 9. Task window and sticky notes

| ID | Profile | Steps | Expected |
|----|---------|-------|----------|
| N-01 | Local | Context menu → Open in new window. Edit the title and description there. | A separate window opens. Edits show in the main window immediately. Closing the extra window does not delete the task. |
| N-02 | Local | With a task selected, press Ctrl+Shift+O (Cmd+Shift+O). | The same task window opens. |
| N-03 | Local | Context menu → Open as sticky note. | A frameless sticky shows the task title and description. Opening it again focuses the existing sticky instead of creating a second one for the same task. |
| N-04 | Local | Edit the sticky title and description. Edit the same task in the main window. | Both directions update the same task. |
| N-05 | Local | Drag the sticky by its title bar. Resize from the corner. Quit and relaunch. | Position and size come back. |
| N-06 | Local | Pin the sticky (pin button and F12). Unpin it. | Pinned stays above other windows. Unpinned does not. The icon shows which state is active. |
| N-07 | Local | **Settings → Desktop → Pin by default**. Open a new sticky. | New stickies open pinned. Existing ones keep their own pin state. |
| N-08 | Local | Close the sticky with ×. | The sticky closes. The task remains in its list. |
| N-09 | Local | Open two stickies for two tasks. Change the app theme. | Both stickies stay open and pick up the theme. |

---

## 10. Search and command palette

| ID | Profile | Steps | Expected |
|----|---------|-------|----------|
| K-01 | Local | Press Ctrl+K (Cmd+K). Type a distinctive word that appears only in a task title. | The palette opens, focuses the field, and lists that task. Enter opens it in the right list. |
| K-02 | Local | Search for a word that appears only in the markdown body. | The task is found. |
| K-03 | Local | Search for a completed task. | Completed tasks are included in palette results. |
| K-04 | Local | Search for text that matches nothing. Press Esc. | Empty results, no crash. Esc closes the palette and does not delete a task. |
| K-05 | Local | From the palette, run the visible commands (settings, calendar, sticky, new task) if they are listed. | Each command navigates or creates what its label says. |

---

## 11. Settings

### General

| ID | Profile | Steps | Expected |
|----|---------|-------|----------|
| G-01 | Local | Set time format, timezone, and list density (Comfortable / Compact). Restart. | Values persist. Density changes row spacing immediately. Timezone behavior matches R-03. |

### Calendar

Covered by C-03, C-04, and C-09. Re-open Settings after restart and confirm the same values are selected.

### Appearance

| ID | Profile | Steps | Expected |
|----|---------|-------|----------|
| G-02 | Local | Change font family and size. | Sidebar, list, panel, and settings use the new font immediately. |
| G-03 | Local | Enter a custom `font-family` string if the control offers it. | The custom stack is applied. An unknown font falls back without breaking layout. |
| G-04 | Local | Set theme mode to Light, Dark, and System. | Light and Dark override the OS. System follows the OS theme. |
| G-05 | Local | Pick each preset theme. | Colors update across the app, including an open sticky and the Integration panel. |
| G-06 | Local | Theme source → From image. Upload a jpg or png. | A readable palette is extracted. Text stays legible. Replacing the image regenerates the palette. |
| G-07 | Local | Theme source → Custom colors. Set background, sidebar, text, accent, and border. Pick a low-contrast text/background pair. | Colors apply and persist. A contrast warning appears and does not block the choice. |
| G-08 | Local | Reset appearance. Restart. | Defaults return and stay after restart. |

Appearance is local. Connecting either TickTick plan must not overwrite these settings on pull.

### Notifications

| ID | Profile | Steps | Expected |
|----|---------|-------|----------|
| G-09 | Local | Enable notifications. Put a task due two minutes from now with **At due time**. Wait. | An OS notification fires around the due time. |
| G-10 | Local | Disable notifications. Repeat with another task. | No OS notification. The task is otherwise unchanged. |
| G-11 | Local | Set a reminder 5 minutes before a due time and wait. | The notification fires at due-minus-5, not only at the default lead time. |
| G-12 | Local | Complete the task before the reminder time. | The reminder does not fire. |

### Desktop and backup

| ID | Profile | Steps | Expected |
|----|---------|-------|----------|
| G-13 | Local | Enable **Minimize to tray**. Close the window. | The process stays in the tray. The window can be shown again from the tray. Quit from the tray actually exits. |
| G-14 | Local | Disable minimize to tray. Close the window. | The app quits. |
| G-15 | Local | Enable **Start with system**. Sign out and back in, or inspect the OS autostart entry. Then disable it. | The app is registered, then unregistered. A failed registration shows an error rather than a silent success. |
| G-16 | Local | Change the quick-capture shortcut to a free accelerator. Press it. | A small capture window opens. Enter creates an Inbox task. Esc or close does not create a task. The main window does not have to be focused. |
| G-17 | Local | Press the new-sticky shortcut with a task selected, then with nothing selected. | Selected: sticky for that task. None selected: a new Inbox task named “New sticky note” (or the current default) opens as a sticky. |
| G-18 | Local | Set a shortcut that is already taken by the OS. | The app reports that registration failed. The previous working shortcut still works, or the field shows the failure clearly. |
| G-19 | Local | **Reset window size**. | The window returns to the default size and position. |
| G-20 | Local | Export a backup. Add a task. Restore the backup and let the app restart. | Data matches the backup. The task added after export is gone. Cancelling the file dialog does nothing. |
| G-21 | Local | Restore a file that is not a database. | The app shows an error and the current data is still there. |

---

## 12. Account connection

Run the connection cases on **both** tiers. The OAuth flow is the same. Quotas are not involved yet.

| ID | Profile | Steps | Expected |
|----|---------|-------|----------|
| A-01 | Both | Open Settings → Account with empty credentials. | Status is **Not configured**. Connect is disabled. |
| A-02 | Both | Save Client ID and secret, wrong region (TickTick vs Dida365). Connect. | Connect fails with a visible error. Local tasks are untouched. Cancel returns the UI to idle. |
| A-03 | Both | Save the correct region and redirect URI. Connect. Approve in the browser. | Status becomes **Connected**. A pull starts. A toast mentions lists or that pull started. The Integration panel opens. |
| A-04 | Both | Close the browser window during connect, or press Cancel in the app. | Status stays disconnected. No partial token is treated as connected. |
| A-05 | Both | Click **Verify connection**. | Toast reports success and a list count. Last verified time updates. |
| A-06 | Both | Disconnect. | Status is Not connected. Local tasks remain. Pull and Push in the Integration panel are disabled. |
| A-07 | Both | Connect again. | A new pull runs. Remote lists reappear. Local-only lists that were never pushed are still present. |
| A-08 | Local | Optional dev path: save a personal access token and connect. | Status says connected with a personal access token. This is a dev shortcut, not the normal user path. |

---

## 13. Pull

Do these on **both** accounts after a clean local database. Create the remote data in the official TickTick app first, then **Pull now**.

| ID | Profile | Steps | Expected |
|----|---------|-------|----------|
| P-01 | Both | In TickTick, create a folder, a list inside it, a top-level list, and an Inbox task. Pull. | Sidebar matches: folder, nested list, top-level list, Inbox task. Integration shows success and counts for folders, lists, and tasks. |
| P-02 | Both | Remote task with title, markdown notes, priority high, two tags, and an all-day due date. Pull. | Each field matches. Tags appear under the title. |
| P-03 | Both | Remote timed task (due today at a specific time) in a non-UTC timezone. Pull. | The local chip shows the same clock time in that timezone. It does not shift by the UTC offset. |
| P-04 | Both | Remote subtasks under a parent. Pull. | Parent and children are nested. Progress on the row matches. |
| P-05 | Both | Remote task with repeat every week on specific weekdays. Pull. | The recurrence chip matches. Completing it locally creates the next occurrence (U-07 checks the push back). |
| P-06 | Both | Remote completed task. Pull. Open Completed. | It is completed locally with a completion time if TickTick sent one. |
| P-07 | Both | Rename a list and a folder in TickTick. Move a list between folders. Pull. | Local sidebar matches. No duplicate lists. |
| P-08 | Both | Delete a remote task and a remote list. Pull. | They disappear locally if the local copies were still `synced`. |
| P-09 | Both | While a pull is running, keep using the list (select, scroll, quick-add a local task). | The UI stays responsive. The new local task is not deleted by the pull. |
| P-10 | Both | Remote description with a blank line between paragraphs. Pull. | The blank line is still there in the editor. |
| P-11 | Both | Click the footer sync chip. Press Ctrl+Shift+S. | The chip opens the Integration panel. The shortcut opens it and starts a pull when connected and online. |
| P-12 | Both | Disconnect the network. Pull now. | Pull is disabled or fails with a clear offline / network error. Local data stays. Reconnect and pull succeeds. |
| P-13 | Both | Edit a synced task locally and do **not** push. Change the same task in TickTick. Pull. | The dirty local edit is kept. The panel reports skipped dirty rows if that count is shown. The remote change is not applied on top of the dirty row. |

---

## 14. Push

Turn on **Settings → Account → Enable push to TickTick** only for this section. Push from the Integration panel (**Push now**). Then confirm in the official TickTick app.

Run every **Both** row on free and on premium.

| ID | Profile | Steps | Expected |
|----|---------|-------|----------|
| U-01 | Both | With push off, create `QA-List` and a task. Open Integration. | Pending push counts increase (lists and tasks). **Push now** stays disabled. Nothing appears in TickTick. |
| U-02 | Both | Enable push. Push now. | Toast reports how many items were pushed. Pending counts drop to zero. TickTick shows the list and task. A following pull does not duplicate them. |
| U-03 | Both | Edit the synced task title, notes, priority, tags, and due date. Push. | TickTick shows the same values. |
| U-04 | Both | Complete the task. Push. Then mark it incomplete. Push. | TickTick completion state matches after each push. |
| U-05 | Both | Delete the task. Push. | The task is gone in TickTick and locally. |
| U-06 | Both | Create a folder and a list inside it. Push. Rename both. Move the list to top level. Push. | TickTick folder membership matches after each push. |
| U-07 | Both | Create a weekly repeating task with one reminder. Push. Complete it. Push. | TickTick shows the rule and the reminder. The next occurrence exists on both sides. |
| U-08 | Both | On a synced task, remove all reminders. Push. | TickTick no longer shows those reminders. |
| U-09 | Both | Add two subtasks. Push. Check one. Push. | Parent and subtasks exist in TickTick. Checked state matches. |
| U-10 | Both | Move a synced task to another synced list. Push. | The task is in the destination list in TickTick, not duplicated in the source. |
| U-11 | Both | Delete a synced list that still has tasks. Confirm locally. Push. | The list and its tasks are gone in TickTick. |
| U-12 | Both | Create a task while offline. Reconnect. Push. | The task uploads once. A second push does not create a duplicate. |
| U-13 | Both | Turn push off again after the pass. | Further local edits stay local. Pending counts may rise. Push now is disabled. |

---

## 15. Free account limits

Use a **free** TickTick account. Local create is allowed past these caps. The check is what TickTick accepts on push, and what a pull does with data that was created on premium and then opened on free.

Prepare the account so you can still add one more list and one more task (stay under the cap until the case says to cross it). Inbox counts toward the list quota.

| ID | Profile | Steps | Expected |
|----|---------|-------|----------|
| F-01 | Free | In TickTick, confirm the account is free (upgrade page or account settings). Connect and pull. | Pull succeeds. List count is at most 9. |
| F-02 | Free | Locally create lists until a push would make TickTick hold a **10th** list. Push. | TickTick rejects the list that crosses 9, or the push reports an error for that list. Already synced lists remain. The error is visible in the Integration panel and can be copied. The app does not mark the failed list as synced. |
| F-03 | Free | In one list, create tasks until a push would make the **100th** task. Push. | The task past 99 is rejected or left pending. Tasks already within the cap stay synced. No duplicate of the successful ones. |
| F-04 | Free | On one task, add a **20th** subtask. Push. | TickTick keeps at most 19 checklist items. The 20th stays pending locally or the push error names that task. The first 19 match. |
| F-05 | Free | Add **3** reminders on one task (At due time, 15 minutes before, 1 day before). Push. | TickTick keeps at most **2** reminders. The third is rejected or dropped, and the local task is not marked fully synced if the payload was refused. |
| F-06 | Free | Create a duration task (start 10:00, end 12:00). Push. Pull. | A free account does not gain a true duration. Either push fails, or TickTick stores a single due time and the next pull no longer shows a range. Record which of those happened. Do not treat a local-only range as synced. |
| F-07 | Free | In TickTick’s own UI, try to set a third reminder and a duration. | The official app blocks both. This confirms the account tier before blaming Open Tick. |
| F-08 | Free | Push a normal task: title, notes, one tag, priority, one due date, **2** reminders, daily repeat, **19** subtasks. | All of that succeeds on free. Premium is not required for this set. |

---

## 16. Premium account capabilities

Use a **premium** account. Repeat the free-limit cases that should now succeed. Stay well under the premium caps (299 lists, 999 tasks, 199 subtasks) so a rejection means a bug.

| ID | Profile | Steps | Expected |
|----|---------|-------|----------|
| M-01 | Premium | Connect, pull, and confirm the account is premium. | Pull succeeds. Existing premium-only fields on remote tasks (duration, 3–5 reminders) import. |
| M-02 | Premium | Push an **10th** list (and, if practical, a handful more). | Lists above 9 appear in TickTick. No quota error. |
| M-03 | Premium | Push the **100th** task in a list. | The task appears in TickTick. |
| M-04 | Premium | Push a task with **20** subtasks. | All 20 exist in TickTick. |
| M-05 | Premium | Push a task with **5** reminders. | TickTick shows all 5. A sixth still cannot be added in Open Tick (local cap). |
| M-06 | Premium | Push a same-day timed duration and a multi-day all-day duration. Pull on a second run. | TickTick shows start and end. After pull, Open Tick still shows a range, not a single point. |
| M-07 | Premium | In TickTick, create a duration task with 4 reminders and 20 subtasks. Pull into a clean local DB. | Local task matches start, end, reminders, and subtask count. |
| M-08 | Premium | Change that duration in Open Tick and push. | TickTick updates the range. A later pull does not revert it. |

---

## 17. Sync edge cases

| ID | Profile | Steps | Expected |
|----|---------|-------|----------|
| Y-01 | Both | Edit the same synced task title in Open Tick and in TickTick before pushing. Push, then pull. | The local dirty title is pushed (local wins while the row is pending). After a successful push, a later remote edit wins on the next pull. |
| Y-02 | Both | Delete a task in TickTick. Edit that same task locally so it is dirty. Pull, then push. | Document the result: remote delete should win once the local row is no longer protected as dirty, or the push reports that the remote task is gone. The task must not be resurrected as a second copy. |
| Y-03 | Both | Create a task, push, pull, push again with no new edits. | One remote task. Pending count stays zero. |
| Y-04 | Both | Start a pull and immediately start a push (or press the shortcut twice). | Only one sync runs at a time. The second action waits or is ignored. No duplicate creates. |
| Y-05 | Both | Revoke the app in the TickTick account security page, or wait until the token is invalid. Pull. | Status becomes an auth error. Reconnect works from the panel or Account settings. Local data remains. |
| Y-06 | Both | Cause a failed push (free-limit case F-02 is enough). Copy error details. Fix the cause and push again. | The error text is copyable. The failed item retries and can succeed later. Successful siblings are not pushed twice. |
| Y-07 | Local | With a connected account, change theme, font, sidebar width, and a sticky position. Pull. | Those local settings are unchanged. Pull does not reset appearance. |
| Y-08 | Both | Inbox with zero tasks on a brand-new account. Pull, then create the first Inbox task locally and push. | Pull handles an empty Inbox. The first task lands in TickTick Inbox, not in a new project. |

---

## 18. Smoke pass

Use this when there is no time for the full list. It does not replace sections 15 and 16 before a sync change.

**Local (about 15 minutes):** L-01, L-02, S-02, S-05, S-07, T-01, T-05, T-08, D-01, D-04, R-01, R-05, R-14, M-01, M-04, C-02, C-07, N-03, N-04, K-01, G-20.

**Free account:** A-03, P-01, P-02, P-13, U-01, U-02, U-04, F-05, F-06, F-08.

**Premium account:** A-03, P-01, U-02, M-05, M-06, M-07.

---

## Recording results

For each failed row, note:

- Case ID and profile (local / free / premium)
- Build or git revision
- Steps you actually took
- Integration panel error text, if any
- What TickTick showed after the push or pull

A free-account rejection on F-02 through F-06 is a pass when the error is visible and local data is kept. The same rejection on M-02 through M-06 is a fail.

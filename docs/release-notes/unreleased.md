# Mindwtr Unreleased

Changes collected after `v1.1.5` and before the next version tag.

## Highlights

- Archive is easier to search on mobile and gains Filters, Sort, and Group controls on desktop. Large grouped desktop archives stay virtualized.
- Calendar can show completed work on its completion date, and the desktop Week view can display two to seven days.
- Self-hosted servers can publish a token-protected, read-only calendar subscription for scheduled tasks and deadlines.
- Multiline capture confirmations now remain visible on iOS and behave as a proper modal layer on Android.
- Desktop restores each monitor layout before showing the window, avoiding the default-size flash and repeated resizing.
- Mobile avoids re-rendering screens behind the current one, which keeps task updates responsive in large projects.
- Inbox processing preserves the project or area you chose, while sync settings and iCloud retries report failures and cooldowns more reliably.

<details>
<summary><strong>Full change list</strong> (grouped by area)</summary>

## Capture & Inbox

- Quick-add removes every command it successfully applies from the task title, while leaving unknown commands, paths, and links unchanged.
- Multiline paste and `.txt` imports now show their in-app confirmation on both capture surfaces. On Android, Back dismisses the confirmation before the capture screen, and TalkBack cannot move into the covered form. (#940, #941)
- Mobile closes and reopens the project sheet around quick add, so the project remains tappable and pending project edits are saved. (#938)
- Guided and Quick Inbox processing preserve the chosen project or area when an item moves to Reference, Someday, Done, or Waiting through delegation. (#958)
- Mobile bulk **Add tag** leaves existing tags untouched and uses the same tag ordering as desktop. (#949)
- The iOS Add task sheet keeps the title field pinned in place while the **More** panel scrolls, so returning to the title no longer jumps it off the top of the screen. (#887)
- The "enable a speech-to-text model in Settings" notice now appears over the mobile Add task sheet the moment you tap the mic, instead of waiting until the sheet is closed. (#886)

## Calendar

- Desktop Week view can show two to seven days and remembers the device-local choice. Shorter views are rolling ranges: Previous and Next advance by the visible day count, so no days disappear between pages. (#951)
- A device-local **Completed** toggle shows done and archived tasks on their completion date across desktop and mobile. It also includes older tasks that only carry the legacy completion timestamp. (#955)
- Mobile Calendar keeps long task titles clear of the **Schedule** action and shows the selected date in planning labels. Tapping a day now opens straight to task search followed by that day's own tasks and events; the next-action suggestion list no longer sits in between. (#972)
- Mobile Day and Week timelines label the hour as **10 PM** instead of a wrapped, half-cut `10:00 PM`, and the labels stay inside the gutter at large display sizes.
- Mobile Inbox processing scrolls each newly revealed question into view, so answering one no longer looks like it did nothing while the next question sits below the fold.
- Mobile Week view keeps its hour column visible while you scroll across the week, fits the full week on screen without clipping Saturday, and settles on whole days instead of stopping mid-column.
- Desktop Calendar gets more width for the week and month grids than a list view, while keeping a margin on both sides. (#966)
- A subscribed `.ics` feed that carries `CATEGORIES` splits into one calendar per category, each with its own colour and show/hide toggle. Desktop Week view keeps all-day and hourly columns aligned while showing midnight fully. (#966)
- Self-hosted servers can publish a token-protected, read-only calendar feed for scheduled tasks and deadlines. Feed generation now handles standalone carriage returns and timed start/due values without dropping events because of the server time zone, and the server throttles invalid-token requests. (#952)

## Lists & Performance

- Desktop Archive now offers Filters, Sort, and Group controls, including completion-date options, and keeps grouped archives virtualized at large sizes. Mobile Archive adds search plus the same filtering, sorting, and grouping model inside its filter sheet. (#959, #961)
- Archive bulk selection keeps the durable actions—**Restore to Inbox** and **Delete**—and no longer offers the temporary **Move to Done** action on desktop or mobile. (#959)
- Grouping by completion date splits anything older than a week into calendar months instead of one **Earlier** heading, so archives spanning years read as a timeline. (#959)
- The Archive and Trash search boxes match the search field used by every other list, and the Inbox capture bar draws its focus ring around the whole field instead of through the microphone and add buttons. (#959)
- Grouped lists put the ungrouped catch-all group (No project, No context, General, …) last on desktop and mobile, so the groups you are looking for come first. (#963)
- Desktop group headers collapse on every grouped list, not only Focus and Reference. Each list remembers which groups are folded per grouping mode on that device. (#963)
- Mobile grouping headings fold too — tap one on Inbox, Done, Reference, or Archive. Each list remembers its folded groups per grouping mode on that device, and a folded group's rows leave **Select all** and bulk actions the same way they do on desktop. (#970)
- Desktop Inbox now exposes the shared Filters panel, so filters chosen in another list remain visible and removable. (#956)
- Saving a task in a large desktop project no longer scrolls the pinned project row past the list and leaves a blank screen. (#916)
- Mobile stops re-rendering project screens behind the current route, reducing multi-second updates in large libraries while preserving each screen's state. (#766)
- iOS no longer draws duplicated rows or crashes when a long list shrinks, which happened when filtering Done by a tag or context or removing a tag in bulk. (#949, #969)

## Desktop

- Desktop time fields keep their text area available for manual entry; their native clock icon still opens the picker. (#896)
- Desktop applies saved geometry before showing the window, waits for the interface to paint, and keeps a separate size and position for each monitor layout. Existing `v1.1.5` geometry seeds the first profile; on a first run or new monitor layout, startup geometry seeds a normal window rectangle so closing while maximized or fullscreen cannot overwrite it. (#936)
- Search, feedback, and announcement dialogs stay within short windows and scroll their content while keeping actions reachable. (#957)
- Linux calendar settings list writable targets without opening every remote calendar, so slow or offline accounts no longer stall task edits or hide other calendars. (#575)
- Self-hosted and WebDAV settings confirm successful saves. Native configuration failures now appear as errors instead of leaving a false success state. (#920)
- Desktop uses the cleaned sidebar artwork, and Windows now ships a 32x32-first ICO so the taskbar selects a crisp native-size icon instead of upscaling 16x16. (#937)
- Desktop due dates turn red only once they have passed. A due date inside the next three days uses the warning color, as it already did on mobile. (#640)
- Desktop Archive rows are the same read-only rows Done uses, so an archived task's notes, subtasks and attachments open in place instead of needing the task restored first. Restore now sends an archived task back to the Inbox from the row as well as in bulk, and deleting one offers **Undo** instead of a confirmation. (#968)

## Settings

- Correcting a completed task's completion time to something older than the auto-archive limit now files it away immediately, instead of leaving it in Done until the twice-daily check runs. (#959)

## Sync & Automation

- Mobile no longer loses changes when the local database refuses writes. Saves that fall back to the JSON copy are now merged back on the next launch, and a database that still cannot take them is bypassed for reads instead of serving its older contents. (#964)
- iCloud sync doubles repeated CloudKit retry delays up to ten minutes, and automatic app-state triggers respect the active cooldown. **Sync now** still retries immediately. (#948)
- Cloud API, MCP, and desktop Local API task queries accept `isFocusedToday=true|false`; legacy MCP databases return the correct empty or unfocused result when the column is absent. (#960)
- The browser and self-hosted PWA build now fires task, start, due, and review reminders as Web Notifications while a tab is open — the scheduler was only started in the native desktop shell. A reminder reached between two checks (a background tab has its timers throttled) is now delivered late instead of skipped, on desktop as well. (#962)
- macOS desktop can sync with self-hosted and WebDAV servers that only accept TLS 1.3, which previously failed with a "bad protocol version" error. Certificates from the operating system store, including private and corporate roots, are still trusted on every desktop platform. (#973)

## Languages

- Korean gesture help now explains each action, and search-match text once again includes the result count. (#943)

</details>

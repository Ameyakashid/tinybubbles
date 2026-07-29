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

## Calendar

- Desktop Week view can show two to seven days, remembers the device-local choice, and keeps the selected weekday stable while paging. (#951)
- A device-local **Completed** toggle shows done and archived tasks on their completion date across desktop and mobile. It also includes older tasks that only carry the legacy completion timestamp. (#955)
- Self-hosted servers can publish a token-protected, read-only calendar feed for scheduled tasks and deadlines. Feed generation now handles standalone carriage returns and timed start/due values without dropping events because of the server time zone, and the server throttles invalid-token requests. (#952)

## Lists & Performance

- Desktop Archive now offers Filters, Sort, and Group controls, including completion-date options, and keeps grouped archives virtualized at large sizes. Mobile Archive adds search plus the same filtering, sorting, and grouping model inside its filter sheet. (#959, #961)
- Grouping by completion date splits anything older than a week into calendar months instead of one **Earlier** heading, so archives spanning years read as a timeline. (#959)
- The Archive and Trash search boxes match the search field used by every other list, and the Inbox capture bar draws its focus ring around the whole field instead of through the microphone and add buttons. (#959)
- Desktop Inbox now exposes the shared Filters panel, so filters chosen in another list remain visible and removable. (#956)
- Saving a task in a large desktop project no longer scrolls the pinned project row past the list and leaves a blank screen. (#916)
- Mobile stops re-rendering project screens behind the current route, reducing multi-second updates in large libraries while preserving each screen's state. (#766)

## Desktop

- Desktop applies saved geometry before showing the window, waits for the interface to paint, and keeps a separate size and position for each monitor layout. Existing `v1.1.5` geometry seeds the first profile; on a first run or new monitor layout, startup geometry seeds a normal window rectangle so closing while maximized or fullscreen cannot overwrite it. (#936)
- Search, feedback, and announcement dialogs stay within short windows and scroll their content while keeping actions reachable. (#957)
- Linux calendar settings list writable targets without opening every remote calendar, so slow or offline accounts no longer stall task edits or hide other calendars. (#575)
- Self-hosted and WebDAV settings confirm successful saves. Native configuration failures now appear as errors instead of leaving a false success state. (#920)
- Desktop uses the cleaned sidebar artwork, and Windows now ships a 32x32-first ICO so the taskbar selects a crisp native-size icon instead of upscaling 16x16. (#937)
- Desktop due dates turn red only once they have passed. A due date inside the next three days uses the warning color, as it already did on mobile. (#640)

## Sync & Automation

- Mobile no longer loses changes when the local database refuses writes. Saves that fall back to the JSON copy are now merged back on the next launch, and a database that still cannot take them is bypassed for reads instead of serving its older contents. (#964)
- iCloud sync doubles repeated CloudKit retry delays up to ten minutes, and automatic app-state triggers respect the active cooldown. **Sync now** still retries immediately. (#948)
- Cloud API, MCP, and desktop Local API task queries accept `isFocusedToday=true|false`; legacy MCP databases return the correct empty or unfocused result when the column is absent. (#960)

## Languages

- Korean gesture help now explains each action, and search-match text once again includes the result count. (#943)

</details>

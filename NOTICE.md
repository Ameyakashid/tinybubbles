# NOTICE

## Tiny Bubbles is a derivative of Mindwtr

Tiny Bubbles is a modified version of **Mindwtr**, an open-source Getting Things Done (GTD)
application.

| | |
|---|---|
| **Upstream project** | Mindwtr — https://github.com/dongdongbh/Mindwtr |
| **Upstream author** | dongdongbh and the Mindwtr contributors |
| **Upstream licence** | GNU Affero General Public License, version 3 (AGPL-3.0-only) |
| **Forked at commit** | `08b18222d8eaf5403d2b05b9a0be39a30008d5d2` |
| **Fork date** | 11 August 2026 |

All credit for the original design, architecture and implementation belongs to the upstream
authors. Tiny Bubbles would not exist without their work.

---

## Licence

Tiny Bubbles is released under the **GNU Affero General Public License, version 3
(AGPL-3.0-only)** — the same licence as the upstream project. The full licence text is in
[`LICENSE`](LICENSE) and is unmodified.

This program is free software: you can redistribute it and/or modify it under the terms of
the GNU Affero General Public License as published by the Free Software Foundation, either
version 3 of the License, or (at your option) any later version.

This program is distributed in the hope that it will be useful, but **WITHOUT ANY
WARRANTY**; without even the implied warranty of MERCHANTABILITY or FITNESS FOR A
PARTICULAR PURPOSE. See the GNU Affero General Public License for more details.

### What the AGPL requires of this project

Because Tiny Bubbles is a modified AGPL work, this project is obliged to:

1. **Keep the licence.** Tiny Bubbles is AGPL-3.0-only and cannot be relicensed to anything
   more restrictive. Any derivative of Tiny Bubbles inherits the same obligation.
2. **Preserve attribution.** The notices above, and every copyright and licence notice in
   the source, must be kept intact.
3. **State the changes.** See *Statement of changes* below.
4. **Offer the source — including over a network.** AGPL §13 means that if users interact
   with a Tiny Bubbles server remotely, they must be offered the complete corresponding
   source of *that running version*. This applies to the optional self-hosted cloud sync
   server in `apps/cloud/`. Anyone deploying it must make their modified source available to
   its users.

---

## Statement of changes

*Required by AGPL-3.0 §5(a): a modified work must carry prominent notices stating that it
was changed, and the date of the change.*

Tiny Bubbles was forked from Mindwtr at commit `08b1822` on **11 August 2026**.

### 11 August 2026 — rebrand

The initial change was an identity-only rebrand. No feature, layout, styling or behavioural
changes were made in this pass. Specifically:

- The product name "Mindwtr" was replaced with "Tiny Bubbles" throughout the source,
  documentation, user-facing strings and all translated locales.
- The application identifier was changed from `tech.dongdongbh.mindwtr` (a namespace
  belonging to the upstream author) to `app.tinybubbles`. The iOS App Group, iCloud
  container, widget and share-extension identifiers were changed to match.
- The deep-link URL scheme was changed from `mindwtr://` to `tinybubbles://`.
- Identifiers belonging to the upstream author were removed rather than reused: the Apple
  Developer Team ID, GitHub Sponsors and Ko-fi funding links, and the Contributor Licence
  Agreement. These were the upstream author's own accounts and legal instruments and are not
  ours to carry forward.
- Functional links (issue tracker, releases, support, security advisories) were repointed at
  this project. Links that credit the upstream project as this work's origin were
  deliberately left pointing at Mindwtr.
- Files and symbols whose names contained the old brand were renamed accordingly.

Subsequent changes are recorded in the project's git history and in `CHANGELOG.md`.

> **Note on `CHANGELOG.md`:** entries dated before 11 August 2026 describe releases of
> upstream *Mindwtr*, not of Tiny Bubbles. They are retained unaltered as an accurate
> historical record.

---

## Third-party components

This project inherits the dependency tree of upstream Mindwtr. Those dependencies remain
under their own respective licences, which are unaffected by this fork. See the manifests
(`package.json`, `bun.lock`, `Cargo.toml`, `Cargo.lock`) for the authoritative list.

The `patches/` directory contains modifications to third-party packages carried over from
upstream; those patches remain under the licence of the package they patch.

# Privacy Policy

*Last updated: 11 August 2026.*

Tiny Bubbles is local-first. This document is the complete policy — there is no separate
privacy website.

## The short version

Your tasks, notes and projects are stored on your device. Tiny Bubbles has no accounts, no
servers we operate, and no analytics service. Nothing leaves your device unless you switch
on a feature that needs the network, and each of those is off until you turn it on.

## What is stored, and where

All your data — tasks, projects, notes, attachments, settings — is stored locally on the
device where you use the app. We cannot see it. There is no Tiny Bubbles account to create
and no Tiny Bubbles server holding your content.

## Features that use the network

Each of these is **optional and off by default**. Turning one on means data goes to a
provider *you* choose, under *their* privacy policy — not ours.

| Feature | What is sent, and to whom |
|---|---|
| **Sync** | Your task data, to the backend you configure: iCloud, Dropbox, a WebDAV server, a shared folder, or a sync server you host yourself. Choosing a backend means trusting that provider with your data. |
| **AI assist** | The text of the task or project you ask it to work on, to the AI provider whose API key you supplied (OpenAI, Google, Anthropic), or to a local model on your own machine — in which case nothing leaves your computer. |
| **Calendar integration** | Reads your system or subscribed calendars; can write dated tasks back to them. Stays between the app and your calendar. |
| **Audio capture** | Audio is transcribed. Where that happens depends on the transcription setting you choose. |

## Analytics

**Tiny Bubbles collects no analytics and operates no analytics endpoint.**

The upstream project this fork is derived from supports an optional daily anonymous usage
heartbeat. That code is still present, but in Tiny Bubbles it is **disabled by default and
has no destination configured** — there is no server to receive it. If you build Tiny
Bubbles yourself and deliberately configure `VITE_ANALYTICS_HEARTBEAT_URL`, the heartbeat
goes to whatever endpoint you set, and it becomes your responsibility to disclose that to
your own users.

## Crash reports and telemetry

None are collected.

## Children

This project inherits its data model from a general-purpose task manager. It is not
designed for, or directed at, children, and it collects nothing that would identify anyone.

## Your choices

- Every network feature can be turned off in Settings.
- You can export all your data to JSON at any time.
- Because your data is local, deleting the app removes it (keep a backup first if you want
  to retain it).

## Self-hosting

If you run the optional sync server in `apps/cloud/` and let other people use it, you are
the data controller for whatever they store on it, and this policy does not cover you.
Note also that AGPL-3.0 §13 requires you to offer those users the source of your modified
version — see [`NOTICE.md`](../NOTICE.md).

## Changes

Material changes to this policy will be recorded in the repository's git history and
release notes.

## Contact

Questions about privacy: open an issue at
<https://github.com/Ameyakashid/tinybubbles/issues>. For anything sensitive, use the
[security advisory form](https://github.com/Ameyakashid/tinybubbles/security/advisories/new)
instead of a public issue.

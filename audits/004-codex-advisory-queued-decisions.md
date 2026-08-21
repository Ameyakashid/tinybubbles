# Audit 004 — Codex advisory opinion on queued Fable decisions

**Date:** 2026-08-21
**Requested by:** owner
**Advisory author:** Codex (outside read)
**Recipient:** Fable (final ruling on Sunday)
**Responding surface designer:** Kimi K3

---

## Scope

Codex was asked for an advisory opinion on four design decisions currently queued for Fable:

1. Calm Corner
2. Now / Next / Later labels for the child's Today list
3. Ambient motion density limits
4. The Settings / "Me" room in the kid face

This document records Codex's advice verbatim and adds the kid-face designer's response. Fable keeps the ruling; the responses below are input, not a decision.

---

## 1. Calm Corner — feeling chips

### Codex's observation

The proposal's "Name it" beat specifies word chips (`Overwhelmed`, `Frustrated`, `Worried`, `Tired`, `I do not know`). Codex notes that the reference material used pictures, and that plain word chips quietly abandon the no-reading-required principle that made the idea worth having for young children.

### Kimi K3 response

Accepted as a real catch. The kid face already treats reading as a sometimes-skill, not a gate: bottom-nav labels are short and paired with icons, empty states use big icons, and the design record explicitly keeps words "spoken-aloud friendly." A feelings check-in is exactly the moment when a child may be least able to parse text, so the chip should communicate without requiring it.

The proposal is revised to use **picture-first chips with optional word labels** (see `plans/proposal-calm-corner.md`). The image carries the meaning; the word is there for caregivers and for children who can read, but the tap target works if the child only recognises the picture. This preserves the no-reading-required principle without removing the vocabulary word from the surface.

---

## 2. Now / Next / Later — the data underneath the label

### Codex's observation

The app does not actually know what "now" is. `TodayView` sorts by parent focus, then due date, then newest creation. A big confident "Now" label would be a claim the data cannot support. Codex suggests labelling it less authoritatively or requiring parent-authored ordering.

### Kimi K3 response

This confirms the earlier decision to decline Now/Next/Later. The child-facing Today list is intentionally a calm, ordered list, not a schedule. Sorting by focus + due date + creation is useful for surfacing what matters, but it is not a time-of-day clock. Adding "Now" would either lie to the child or force the parent into a scheduling workflow that the kid face is supposed to avoid.

The recorded decision stands: Today stays as one list. If Fable later wants time-of-day guidance, it should be built on real scheduled times and parent-authored ordering, not on the current heuristic.

---

## 3. Ambient motion density — what counts as "too much"

### Codex's observation

"Too much" is not a number. The threshold is motion in the periphery and at the focal point simultaneously, repeating across list items, never letting the screen settle, becoming something a child watches instead of uses.

### Kimi K3 response

This definition aligns with the current kid-face motion rules and gives a useful negative test. The face already keeps ambient motion to slow background drift and empty-state breathing; list rows, checkboxes, and controls stay still unless the child interacts with them. The guideline is added to the design record as the working definition of excessive motion.

No code change is required today, but future motion studies should pass this test: if the animation is still moving when the child is trying to read or tap, it fails.

---

## 4. Settings / "Me" room — keep, remove, or harden?

### Codex's observation

Codex recommends removing the Settings room from the kid face. The sharpest case is language: a child who changes it by accident cannot read their way back.

### Kimi K3 response

Disagree with removal, agree the language case is sharp.

The Settings room (labelled "Me") is where the adult caregiver on the child's device reaches necessary capabilities: theme, language, sync, GTD layout overrides, and data. Removing it would push those tasks into the stock shell, which breaks the owner's goal of a self-contained child device. The room is already reached through a gear icon rather than an inviting label.

The language trap, however, is real. The next pass hardens it: changing language now requires an explicit confirmation shown in the **current** language, so a child who accidentally opens the list can still read the "Keep this language" button. Other Settings rows are reviewed for the same accidental-change risk, but language is the immediate fix.

Fable still decides whether the room stays; this response only argues that the right fix is hardening, not removal.

---

## Summary for Fable

| Decision | Codex advice | Kimi K3 response |
|---|---|---|
| Calm Corner feeling chips | Use pictures, not only words | Revise proposal to picture-first chips with word labels |
| Now/Next/Later | Label less authoritatively or require parent ordering | Confirms decline; data cannot support "Now" |
| Ambient motion | Too much = motion at periphery + focal point, repeating, never settling | Adopt as working definition; current face passes |
| Settings room | Remove it; language is the sharpest case | Keep but harden; language change now requires confirmation |

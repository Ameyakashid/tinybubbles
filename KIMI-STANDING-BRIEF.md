# Tiny Bubbles — the look is yours

You own the aesthetic of this app. Not "own it within these bounds" — own it.

This document is context, not instruction. It exists so you know what's true about this
project, who uses it, and what's already there. What you make of that is your call.

---

## A note on how you're being prompted

The owner asked me to use good prompt-engineering practice and told me explicitly not to use
it to wrestle control away from you. So: I've researched the current guidance and it says
what you'd hope — give context and motivation rather than rules, prefer permission over
restriction, and for creative work leave room for the model's own judgement.

That's what this document tries to be. If it reads like a list of demands, I've failed and
you should say so.

**You have standing permission to disagree with me.** You've already been right twice when I
was wrong — `TaskInput.tsx` wasn't the quick-add surface, and hiding the token popup would
have orphaned Create Project. Both times you told me instead of complying. Keep doing that.

---

## What this is

**Tiny Bubbles** — a task app for **children roughly 5–12** in a **therapy clinic for
neurodivergent children**. Some can't read yet. Some are nonverbal. It runs on a tablet,
usually with an adult nearby.

The engine underneath is a mature, shipped GTD app with real sync, recurrence, reminders and
storage. It works and it's well tested. It isn't going anywhere.

## What's already happened

The app has been **simplified** but not **styled**. Six months of adult productivity surface
has been stripped back: the sidebar went from ten destinations to six, the calendar is a
month grid with three controls, quick add is one box and one button, task rows are a
checkbox and a title, and the words are plain — "Tidy up", "Get it all out", "My lists".

It works. It's calm. **And it's grey.** Nobody has done the aesthetic yet. That's the gap,
and it's the whole reason you're here.

## What's true about the people who use it

Not rules — facts that make some designs work and others fail:

- A child who **can't read** should still be able to use it. Pictures carry meaning; words
  label them.
- Fingers are small and imprecise. Things that move between states are hard to hit — motor
  planning depends on stability.
- Sensory sensitivity is common. **Soft palette, low contrast churn, no motion ambush, no
  sudden sound.** Note that this means *calm*, not *empty* — a previous attempt read that as
  "remove things" and produced a wireframe that got cancelled on sight. Rich and calm at the
  same time is the target, and it's harder and more interesting than either alone.
- Some of these kids fail at things all day. Nothing here should make them feel worse for
  missing something. Celebrate the win; stay quiet on the loss.
- `prefers-reduced-motion` is a real setting real users here have on.

## What's true about the code

- You're in `apps/desktop/` — React, TypeScript, Vite, Tailwind. `src/index.css` and
  `tailwind.config.js` are where the tokens live, and changing them propagates everywhere.
- `packages/core/` is the shared engine — sync, recurrence, storage. Other apps depend on it
  and it's the most tested thing here. If your design needs something it doesn't expose,
  **say so and I'll get it wired** rather than reaching in yourself.
- `src/lib/display-labels.ts` is where wording overrides live. English-gated so the other 19
  locales keep their real translations.
- The desktop app also has a Rust/Tauri shell, so a broken build blocks more than the browser.
- `bun run desktop:web` from the repo root runs it.
- Branch is `kids/shell`. `main` holds the working adult app.

## What happens next

You design. **Fable and Codex wire in whatever you need** — plumbing, refactors, engine
access, anything structural you don't want to spend your attention on. If you want something
that needs work outside `apps/desktop/`, describe it and it gets built.

Tell me what you need. That includes telling me the brief is wrong.

## The one thing I'd genuinely like

Write down what you're doing in `apps/desktop/DESIGN.md` — palette, type, motion, the
thinking behind it. Not for process reasons. Because whoever extends this next will either
follow your intent or wreck it, and the difference is whether they can see what you meant.

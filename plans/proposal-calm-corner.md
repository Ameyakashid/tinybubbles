# Calm Corner — design proposal (awaiting Fable ruling)

**Status:** proposal, not a plan. No code exists. No surfaces are built.  
**Audience:** child using the kid face, when they feel overwhelmed, stuck, or upset.  
**Scope boundary:** this document uses only Tiny Bubbles' own tokens and runtime; nothing is taken from `kimi-ai-reference/`.

## What it is

A single-room pause space the child can reach from the kid face when a task feels too big, a feeling is too loud, or they need a moment before trying again. It is not a task list, a game, or a new bottom-nav stop. It is a brief, guided pause with three beats:

1. **Name it** — a small set of child-level feeling words (`Overwhelmed`, `Frustrated`, `Worried`, `Tired`, `I do not know`) presented as large tappable chips, not a diagnostic form.
2. **Breathe with it** — a gentle visual breathing buddy that expands and contracts. A default 4-in / 6-out cadence, with optional haptic pulse on supported devices.
3. **Get help** — a single, prominent help control whose only honest job is to start the adult-contact path the owner has already approved for the product.

The room returns the child to Today when they choose to leave; it never dumps them into Settings or a parent workflow.

## Why it belongs in the kid face

The existing rooms (Today, Add, Done, Calendar, Me) are all about doing. Calm Corner is about being stuck. For a child with ADHD, the moment of overwhelm is when the app is most likely to be abandoned or used with distress. A pause space keeps the child inside the same safe shell rather than handing them to a separate app or a generic help banner.

## Design constraints (non-negotiable)

- **No false assurance.** A help button that only sets a local banner is not acceptable; it teaches the child that help does nothing. The help control must connect to a real adult-contact mechanism already in the product.
- **No gamification.** No streaks, points, or rewards for "calming down." The payoff is returning to Today with the same tasks they had before.
- **No data collection beyond what is needed.** Feeling chips are ephemeral unless the owner explicitly decides they should be logged. A feelings log would require its own privacy review.
- **Respects reduced motion and every theme.** The breathing buddy must work as a static, non-animated fallback when motion is reduced, and it must remain visible across `light`, `dark`, `eink`, `sepia`, and every other theme the child can select.
- **Shallow navigation only.** It must be reachable without leaving the kid face and without adding friction to the normal task flow.

## Open questions Fable must decide

1. **How does the help button actually reach an adult?**
   - Does it send a push/parent notification through the existing sync channel?
   - Does it surface a prominent in-app alert on the adult's copy of Tiny Bubbles?
   - Does it trigger an OS-level share sheet / message to a configured caregiver contact?
   - Until this path is real, the help button must be disabled or absent; a placeholder button is a false promise.

2. **Does the feelings wording need clinical or child-development review?**
   - The proposed chips (`Overwhelmed`, `Frustrated`, `Worried`, `Tired`, `I do not know`) are plain-language labels, not clinical terms.
   - Should a clinician or educator review them for age range and emotional safety?
   - Should the wording change by locale, and who owns the native-speaker check?

3. **Should the breathing cadence be configurable?**
   - Default 4 seconds in / 6 seconds out.
   - Should the child or a caregiver adjust the cadence in Settings?
   - If configurable, what is the safe range (e.g., 3–8 seconds per phase)?

4. **Where does Calm Corner sit in the bottom-nav architecture?**
   - Option A: a dedicated bottom-nav stop (sixth item), which adds cognitive load to every room switch.
   - Option B: a floating action reachable from Today and the task sheet, so it appears only when a child is stuck on a task.
   - Option C: a top-level overflow in the existing `Me` / Settings room, though this hides it behind a less-trafficked stop.
   - The navigation model must not be decided by the implementer.

5. **How do reduced-motion and theme compliance work in detail?**
   - When `prefers-reduced-motion` is active, the breathing buddy becomes a static shape with text cues (`Breathe in`, `Breathe out`) timed by opacity or simply by a manual tap-to-advance control.
   - The shape must be theme-aware: it cannot rely on a fixed background gradient that disappears in high-contrast themes like `eink`.
   - Is the fallback sufficient, or should Calm Corner detect reduced motion and offer a shorter, text-only mode by default?

## Additional questions worth deciding before any code is written

6. **When is Calm Corner offered, and when is it not?**
   - Is it always reachable, or is it suggested contextually (e.g., after a task is toggled undone several times, or after the child taps a visible "I need a break" affordance)?
   - Should it ever auto-appear, or is it always child-initiated?

7. **Should there be sound or haptic guidance?**
   - A soft haptic pulse can reinforce the breathing rhythm on mobile/desktop devices that support it.
   - Should there be an optional audio cue? If so, who owns the audio asset and the mute logic?

8. **Should feelings be logged or be entirely ephemeral?**
   - Ephemeral is safer and simpler: the child taps a chip, breathes, and the choice is forgotten.
   - A log would require storage, sync, encryption-in-transit review, and a way for the child or caregiver to delete it.
   - If logged, what is the retention policy?

9. **Is Calm Corner also available in the adult / stock face?**
   - The kid face is the obvious first home, but an adult user under stress might benefit from the same pause surface.
   - If yes, it changes the localization, theme, and routing surface.

10. **What is the exit behavior?**
    - Return to Today with the same task list and scroll position?
    - Return to the task the child was stuck on?
    - Offer a gentle "Ready to try again?" prompt, or simply let the child tap a close control?

## What this proposal does not include

- No component code.
- No new bottom-nav item.
- No routes, no state, and no assets.
- No copy from `kimi-ai-reference/`.
- No claim that the help button works until the adult-contact path is designed.

## What would unblock implementation

1. A ruling on questions 1–5 above.
2. An approved adult-contact mechanism that the help control can honestly trigger.
3. A decision on whether feelings are ephemeral or logged.
4. Confirmation that the breathing cadence default is acceptable as a starting point.

## Suggested first implementation slice (after ruling)

1. Add a single `CalmCornerView.tsx` component in `apps/desktop/src/kidface/components/` with static, theme-aware markup and the breathing animation.
2. Wire it behind the routing/entry decision from question 4.
3. Implement the reduced-motion fallback using the existing `@media (prefers-reduced-motion: reduce)` pattern in `kidface.css`.
4. Add English display-label keys only; other locales fall back until reviewed.
5. Leave the help control disabled with an explanatory label until the adult-contact path is built.

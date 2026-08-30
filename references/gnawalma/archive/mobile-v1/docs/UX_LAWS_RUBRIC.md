# The 30 laws — audit rubric for Gnawalma mobile

One shared standard so every screen is judged the same way. Each law has a
**concrete, checkable test**. A screen scores a law as PASS, or fails it with a
specific, fixable violation. "Feels nice" is not a finding; "the primary action
is 61pt from the thumb rest while a destructive action is 14pt away" is.

Context that constrains every judgement:
- Users are Senegalese tailors and their clients. UI is French. Currency FCFA.
- Phones are mid-range Android and iPhone; one-handed use is the norm.
- The design language is "Atelier Ink": paper/ink, ONE terracotta accent spent
  on status only, flat cards with hairline borders, no shadows or gradients.
- Platform conventions must be honoured per-platform (Material on Android,
  Cupertino/HIG on iOS) — never a Material dialog on iOS.

---

## A. Perception & grouping (Gestalt)

1. **Proximity** — related items sit closer to each other than to unrelated
   ones. FAIL if the gap within a group ≥ the gap between groups. Tokens:
   within-group ≤ `AppSpacing.md`, between-group `AppSpacing.sectionSpacing`.
2. **Common Region** — a shared border/surface groups items. FAIL if a card
   wraps unrelated things, or related things straddle two cards.
3. **Similarity** — items that behave alike look alike. FAIL if two controls
   with the same role render differently (e.g. one pill CTA, one square CTA).
4. **Uniform Connectedness** — connected elements read as related. FAIL if a
   label is visually nearer a different control than the one it labels.
5. **Prägnanz / Occam** — simplest form that still carries the meaning. FAIL on
   ornament with no informational job (decorative dividers, nested cards,
   double borders, an icon repeating what the label already says).
6. **Closure & Figure/Ground** — foreground separates from background. FAIL if
   a surface is indistinguishable from the page in either theme, or a modal
   lacks a scrim.

## B. Decision cost

7. **Hick's Law** — time to decide grows with the number of choices. FAIL if a
   screen offers >5 co-equal primary choices, or a menu mixes destructive and
   routine actions without separation.
8. **Miller's Law / Chunking** — group into ~5–7 units. FAIL if a form runs
   more than ~7 fields with no sectioning, or a list shows >7 unchunked stats.
9. **Tesler's Law** — irreducible complexity belongs to the app, not the user.
   FAIL if the user must compute, remember, or re-enter something the app
   already knows (e.g. retyping a total, re-picking a client already chosen).
10. **Pareto** — the 20% of actions driving 80% of use must be the cheapest to
    reach. FAIL if a daily action is buried ≥3 taps while a rare one is on the
    main screen.
11. **Postel's Law** — accept sloppy input, emit strict output. FAIL if a phone
    field rejects spaces, a money field rejects "12 000", or a name field
    rejects an apostrophe.

## C. Motor & targeting

12. **Fitts's Law** — target size and distance. FAIL on any tappable < 44pt, or
    a primary action placed further from the thumb than a destructive one.
13. **Thumb zone** — on a ~6" phone the bottom third is easy, the top corners
    are not. FAIL if the main action of a screen sits top-right with no bottom
    equivalent.
14. **Steering / gesture safety** — FAIL if a swipe-to-delete has no undo, if a
    horizontal carousel traps vertical scroll, or if a drag target is < 44pt.

## D. Feedback & time

15. **Doherty Threshold** — respond within ~400ms or show progress. FAIL if a
    tap that starts async work gives no immediate visual acknowledgement.
16. **Visibility of system status** — the system always says what it is doing.
    FAIL on a silent save, a spinner with no label for waits > 2s, or an
    optimistic UI that never confirms.
17. **Progressive disclosure** — advanced/rare options are revealed on demand.
    FAIL if a first-run user meets every optional field at once.
18. **Skeleton fidelity** — loading placeholders match the real layout. FAIL if
    content jumps position when data lands.

## E. Memory & recognition

19. **Recognition over recall** — FAIL if the user must remember a value from a
    previous screen (e.g. a total shown on step 2 and required on step 4), or
    an icon-only control has no label/tooltip.
20. **Serial Position** — first and last items are best remembered. FAIL if the
    most important item is buried mid-list.
21. **Von Restorff (isolation)** — exactly one thing should stand out per view.
    FAIL if two or more elements compete as "the" emphasis, or if the accent
    colour appears more than twice on one screen.
22. **Jakob's Law** — behave like the apps users already know, per platform.
    FAIL on non-native dialogs/pickers/switches, a back gesture that does not
    go back, or a tab bar that does not reset its stack.

## F. Motivation & flow

23. **Zeigarnik Effect** — surface unfinished work. FAIL if a multi-step task
    gives no visible progress, or an abandoned draft is silently lost.
24. **Goal-Gradient** — effort rises as the goal nears. FAIL if a wizard hides
    how many steps remain, or the final step is the heaviest.
25. **Peak-End Rule** — the peak and the ending define the memory. FAIL if a
    completed order/payment ends on a bare pop with no confirmation moment.
26. **Flow / uninterrupted** — FAIL if a modal or keyboard interrupts a task
    that could have continued inline, or focus is stolen mid-typing.

## G. Safety & recovery

27. **Error prevention** — prevent rather than warn. FAIL if a destructive
    action has no confirm, if a form allows an invalid submit instead of
    disabling it, or if leaving a dirty form loses data with no guard.
28. **User control & freedom** — a visible way out. FAIL if there is no back
    affordance, no cancel on a modal, or a destructive action with no undo.
29. **Error recovery** — errors are stated in plain French, name the cause, and
    offer the next step. FAIL on raw exception text, a dead end with no retry,
    or a failure rendered as an empty state.
30. **Accessibility floor** — FAIL if text contrast < 4.5:1 in either theme, if
    an interactive element has no semantic label, if the layout breaks at
    textScale 1.3, or if colour alone carries meaning (status shown only by
    hue, with no icon or text).

---

## Scoring

Per screen: `PASS` count out of 30. Report every FAIL as:

`<file>:<line> — L<n> <law> — <what is wrong> — <concrete fix>`

Only report what you can point at in the code. Do not speculate about runtime
behaviour you have not read. If a law does not apply to a screen (e.g. Postel
on a screen with no input), mark `N/A` and it does not count against the score.

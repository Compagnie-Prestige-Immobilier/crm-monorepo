# popover

2026-08-16, transformation engine. `Content` split into `Portal > Positioner > Popup`; `Anchor` rebuilt on top of the Positioner's `anchor` prop; `onOpenAutoFocus` restructured into `initialFocus`.

## Changed

- `apps/web/src/components/ui/popover.tsx:3` — `* as PopoverPrimitive from '@radix-ui/react-popover'` → `{ Popover as PopoverPrimitive } from '@base-ui/react/popover'`.
- `Popover` is a thin wrapper that hosts the anchor context and renders `Popover.Root` — the primitive's Root renders no element and its props are generic over `<Payload>`.
- `PopoverContent` (line 39) now renders `Portal > Positioner > Popup`. The four positioning props are **declared, destructured and forwarded explicitly** to the Positioner (`align`, `alignOffset`, `side`, `sideOffset`); left in `...props` they would have landed on the Popup and silently broken placement with no type error. The wrapper's own defaults are unchanged: `align="start"`, `sideOffset={4}`.
- Positioner carries `className="isolate z-50"`; the Popup keeps `z-50` and all of its previous skin classes.
- CSS var rewritten: `origin-(--radix-popover-content-transform-origin)` → `origin-(--transform-origin)` (set on the Positioner, inherited by the Popup).
- Animation selectors rewritten, keyframes kept: `data-[state=open]:animate-in fade-in-0 zoom-in-95` / `data-[state=closed]:animate-out …` → `data-open:animate-in data-open:fade-in-0 data-open:zoom-in-95` / `data-closed:animate-out …`. The `tw-animate-css` classes and the 150ms duration are unchanged.
- **`PopoverAnchor` kept.** Base UI has no Anchor part — the Positioner takes an `anchor` prop instead — so the wrapper restores the Radix API with a small context (`PopoverAnchorContext`): `Popover` provides it, `PopoverAnchor` registers its element through a ref callback, and `PopoverContent` reads it and forwards it to the Positioner. `PopoverAnchor` renders a `display: contents` `<span>`, so it adds no box to the layout. With no anchor declared the value stays `null`, `anchor` is `undefined`, and the Positioner falls back to the trigger — Radix's behaviour exactly. It still has zero consumers, but the exported API is unchanged.
- `apps/web/src/components/filters/date-picker.tsx:86` — `<PopoverTrigger asChild><Button …>` → `render={<Button … />}` with children hoisted; the manual `aria-expanded={open}` was dropped (Base UI sets it).
- `apps/web/src/components/filters/filter-combobox.tsx:114` — same conversion; `aria-expanded` dropped. Line 144: `w-(--radix-popover-trigger-width)` → `w-(--anchor-width)`.
- `apps/web/src/components/stats/stat-info.tsx:65` — `onOpenAutoFocus={(event) => { if (!pinned) event.preventDefault() }}` → `initialFocus={pinned}`. Same intent: take focus only when the popover was pinned open, never on hover.
- `apps/web/package.json` — `@radix-ui/react-popover` removed.

Leftover scan: `grep -n "radix-ui\|@radix-ui\|asChild" apps/web/src/components/ui/popover.tsx apps/web/src/components/filters/date-picker.tsx apps/web/src/components/filters/filter-combobox.tsx apps/web/src/components/stats/stat-info.tsx` → clean.

## Left alone

- `apps/web/src/components/ui/command.tsx` (cmdk) rendered inside `filter-combobox`'s popover — third-party, untouched.
- Collision props (`avoidCollisions`, `collisionBoundary`) were never passed by any call site, so no `collisionAvoidance` object conversion was needed. `arrowPadding` shifted upstream (0 → 5) and is left as-is: no wrapper renders an arrow.

## Behavior changes

- **Collision padding: restored.** `collisionPadding` defaults to `0` (Base UI's default is 5px) and is exposed in the props so a call site can raise it.
- **Animations: kept as keyframes.** The `tw-animate-css` classes are unchanged; only the selectors moved from `data-[state=…]` to `data-open`/`data-closed`.
- `Popover` is now a wrapper function rather than a bare re-export, because it hosts the anchor context. Its props are still `Popover.Root.Props`; `children` is cast to `ReactNode` since Base UI's Root also accepts a payload render function, which this wrapper does not forward.
- `onOpenChange` gains an `eventDetails` argument with a `reason` (`'trigger-hover'`, `'outside-press'`, `'escape-key'`, …) and `cancel()`.
- Base UI's Trigger exposes `openOnHover` / `delay` / `closeDelay`; `stat-info.tsx` still drives hover open/close through its own `onMouseEnter`/`onFocus` state, unchanged.
- The popup's transform origin now comes from `--transform-origin` on the Positioner. If a popover ever appears to scale from the wrong corner, that variable is the thing to inspect.

## Verify by hand

1. `/prospects` filter bar → the date picker: open it, confirm the panel is left-aligned with the trigger and 4px below it; check the month and year selects inside still work (a Select inside a Popover, two nested portals).
2. `filter-combobox` (e.g. "Banque demandeuse" on `/demandes-clients`): the panel must match the trigger's width exactly (`--anchor-width`), cmdk search must filter, and Enter must select.
3. Same combobox: after selecting, focus must return to the trigger button (`triggerRef.current?.focus()` still fires).
4. `/statistiques` → hover a stat's info icon: the popover must appear WITHOUT stealing keyboard focus. Then click it to pin: focus must move inside.
5. Open a popover near the bottom of the viewport and confirm it flips above the trigger rather than overflowing.

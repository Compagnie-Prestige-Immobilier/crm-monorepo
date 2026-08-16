# popover

2026-08-16, transformation engine. `Content` split into `Portal > Positioner > Popup`; `Anchor` dropped; `onOpenAutoFocus` restructured into `initialFocus`.

## Changed

- `apps/web/src/components/ui/popover.tsx:3` — `* as PopoverPrimitive from '@radix-ui/react-popover'` → `{ Popover as PopoverPrimitive } from '@base-ui/react/popover'`.
- `Popover` is now a bare re-export of `Popover.Root` (line 10) — no element, generic `<Payload>` props.
- `PopoverContent` (line 39) now renders `Portal > Positioner > Popup`. The four positioning props are **declared, destructured and forwarded explicitly** to the Positioner (`align`, `alignOffset`, `side`, `sideOffset`); left in `...props` they would have landed on the Popup and silently broken placement with no type error. The wrapper's own defaults are unchanged: `align="start"`, `sideOffset={4}`.
- Positioner carries `className="isolate z-50"`; the Popup keeps `z-50` and all of its previous skin classes.
- CSS var rewritten: `origin-(--radix-popover-content-transform-origin)` → `origin-(--transform-origin)` (set on the Positioner, inherited by the Popup).
- Animation idiom rewritten: `data-[state=open]:animate-in fade-in-0 zoom-in-95` / `data-[state=closed]:animate-out …` → `transition-[opacity,transform] duration-150` + `data-starting-style:*` / `data-ending-style:*`.
- **`PopoverAnchor` removed from the file and from the exports.** Base UI has no Anchor part (the Positioner takes an `anchor` prop instead). It had zero consumers: `grep -rn "PopoverAnchor" apps/web/src` → no matches outside the wrapper.
- `apps/web/src/components/filters/date-picker.tsx:86` — `<PopoverTrigger asChild><Button …>` → `render={<Button … />}` with children hoisted; the manual `aria-expanded={open}` was dropped (Base UI sets it).
- `apps/web/src/components/filters/filter-combobox.tsx:114` — same conversion; `aria-expanded` dropped. Line 144: `w-(--radix-popover-trigger-width)` → `w-(--anchor-width)`.
- `apps/web/src/components/stats/stat-info.tsx:65` — `onOpenAutoFocus={(event) => { if (!pinned) event.preventDefault() }}` → `initialFocus={pinned}`. Same intent: take focus only when the popover was pinned open, never on hover.
- `apps/web/package.json` — `@radix-ui/react-popover` removed.

Leftover scan: `grep -n "radix-ui\|@radix-ui\|asChild" apps/web/src/components/ui/popover.tsx apps/web/src/components/filters/date-picker.tsx apps/web/src/components/filters/filter-combobox.tsx apps/web/src/components/stats/stat-info.tsx` → clean.

## Left alone

- `apps/web/src/components/ui/command.tsx` (cmdk) rendered inside `filter-combobox`'s popover — third-party, untouched.
- Collision props (`avoidCollisions`, `collisionPadding`, `collisionBoundary`) were never passed by any call site, so no `collisionAvoidance` object conversion was needed. Note the defaults DID shift upstream: `collisionPadding` 0 → 5 and `arrowPadding` 0 → 5.

## Behavior changes

- **`PopoverAnchor` no longer exists.** Any future need for a non-trigger anchor must use `Positioner`'s `anchor` prop, which this wrapper does not yet expose.
- Collision padding default changed from Radix's 0 to Base UI's 5px: popovers now keep 5px clearance from the viewport edge. Not patched.
- `onOpenChange` gains an `eventDetails` argument with a `reason` (`'trigger-hover'`, `'outside-press'`, `'escape-key'`, …) and `cancel()`.
- Base UI's Trigger exposes `openOnHover` / `delay` / `closeDelay`; `stat-info.tsx` still drives hover open/close through its own `onMouseEnter`/`onFocus` state, unchanged.
- The popup's transform origin now comes from `--transform-origin` on the Positioner. If a popover ever appears to scale from the wrong corner, that variable is the thing to inspect.

## Verify by hand

1. `/prospects` filter bar → the date picker: open it, confirm the panel is left-aligned with the trigger and 4px below it; check the month and year selects inside still work (a Select inside a Popover, two nested portals).
2. `filter-combobox` (e.g. "Banque demandeuse" on `/demandes-clients`): the panel must match the trigger's width exactly (`--anchor-width`), cmdk search must filter, and Enter must select.
3. Same combobox: after selecting, focus must return to the trigger button (`triggerRef.current?.focus()` still fires).
4. `/statistiques` → hover a stat's info icon: the popover must appear WITHOUT stealing keyboard focus. Then click it to pin: focus must move inside.
5. Open a popover near the bottom of the viewport and confirm it flips above the trigger rather than overflowing.

# tabs

2026-08-16, transformation engine. `Trigger` → `Tab`, `Content` → `Panel`; public wrapper names unchanged.

## Changed

- `apps/web/src/components/ui/tabs.tsx:3` — `* as TabsPrimitive from '@radix-ui/react-tabs'` → `{ Tabs as TabsPrimitive } from '@base-ui/react/tabs'`.
- `TabsTrigger` renders `TabsPrimitive.Tab` (line 48); `TabsContent` renders `TabsPrimitive.Panel` (line 71). The exported names stay `TabsTrigger` / `TabsContent` so no consumer changed.
- Class rewrites in `TabsTrigger`: `data-[state=active]:*` → `data-active:*` (verified against `TabsTabDataAttributes` in the installed package, which emits `data-active`), and `disabled:pointer-events-none disabled:opacity-40` → `data-disabled:*` — Base UI's Tab surfaces disabled state as `data-disabled`/`aria-disabled`, so the `:disabled` pseudo-class variants would have been dead code.
- Props typed `Omit<TabsPrimitive.<Part>.Props, 'className'> & { className?: string }`.
- `apps/web/package.json` — `@radix-ui/react-tabs` removed.

Leftover scan: `grep -n "radix-ui\|@radix-ui\|data-\[state=" apps/web/src/components/ui/tabs.tsx` → clean.

## Left alone

- All consumers (`/notifications`, `/demandes-clients`, …) pass only `value` / `defaultValue` / `onValueChange`; none passed `activationMode`, so no call site changed. `grep -rn "activationMode" apps/web/src` → no matches.

## Behavior changes

- **Activation mode, flagged not patched.** Radix defaulted to `activationMode="automatic"`: arrow keys moved the selection immediately. Base UI defaults to **manual** activation — arrow keys move focus, Enter/Space selects. The near-equivalent opt-in is `<TabsList activateOnFocus>`; it was deliberately NOT added, matching the shadcn base registry. If the automatic feel is wanted back, add that prop to `TabsList`.
- `onValueChange` now receives `(value, eventDetails)` with a `reason` (`'none'`, `'initial'`, `'disabled'`, `'missing'`). Existing single-argument handlers are unaffected.
- `TabsPanel` gains `data-hidden`, `data-starting-style`, `data-ending-style` and `data-index` hooks. Nothing styles them yet.
- Base UI ships a `Tabs.Indicator` part with no Radix counterpart; unused.

## Verify by hand

1. `/notifications`: click between the "Réception" and "Émission" tabs — content must swap and the active tab must get `bg-card` + the extra-small shadow.
2. Focus a tab and press Left/Right: focus must move but **the panel must not change until you press Enter or Space**. That is the intended new behaviour; confirm it is acceptable for this screen.
3. Tab into the panel body and confirm the focus ring is still drawn (the panel is focusable, `tabIndex=0`).
4. Deep-link a tab via the URL (`?onglet=reception`) and confirm the right tab is selected on load.

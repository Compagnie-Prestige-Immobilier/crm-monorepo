# dialog

2026-08-16, transformation engine. `Overlay` → `Backdrop`, `Content` → `Popup` (centred modal, no Positioner), keyframe animations rewritten as transitions.

## Changed

- `apps/web/src/components/ui/dialog.tsx:3` — `* as DialogPrimitive from '@radix-ui/react-dialog'` → `{ Dialog as DialogPrimitive } from '@base-ui/react/dialog'`.
- `Dialog` is now a bare re-export (`const Dialog = DialogPrimitive.Root`, line 15). `Dialog.Root` renders no element, so it accepts neither `className` nor the old inert `data-slot="dialog"`; its props are generic over `<Payload>`, which breaks the `React.ComponentProps` pattern. A French comment records both reasons.
- `DialogOverlay` now renders `DialogPrimitive.Backdrop` (line 47). Public name kept.
- `DialogContent` now renders `DialogPrimitive.Popup` (line 74), still inside `DialogPortal`, still with no Positioner (centred modal).
- Animation idiom rewritten (lines 52–54, 78–81): `data-[state=open]:animate-in fade-in-0 zoom-in-95` / `data-[state=closed]:animate-out …` → `transition-[opacity,transform] duration-200` + `data-starting-style:opacity-0 data-starting-style:scale-95` + `data-ending-style:*`. The backdrop uses `transition-opacity` only.
- `apps/web/src/components/ui/command.tsx:40` — `CommandDialog`'s props were `React.ComponentProps<typeof Dialog>`, whose `children` is now `ReactNode | PayloadChildRenderFunction`. Narrowed to `Omit<…, 'children'> & { children?: React.ReactNode }`.
- `apps/web/package.json` — `@radix-ui/react-dialog` removed (it also backed `sheet.tsx`).

Leftover scan: `grep -n "radix-ui\|@radix-ui" apps/web/src/components/ui/dialog.tsx apps/web/src/components/ui/command.tsx` → clean.

## Left alone

- `apps/web/src/components/ui/command.tsx` body — cmdk, not Radix. Only the `CommandDialog` props type was touched (above).
- No consumer passed `onOpenAutoFocus` / `onCloseAutoFocus` / `onEscapeKeyDown` / `onInteractOutside` to a dialog, so no `initialFocus` / `finalFocus` / `onOpenChange`-reason restructuring was needed here. (`stat-info.tsx` did, but on a Popover — see `.migration/popover.md`.)
- `@radix-ui/react-dialog` still appears in `pnpm-lock.yaml` as a transitive dependency of `cmdk`. Expected; cmdk is out of scope by policy.

## Behavior changes

- `onOpenChange` now receives a second `eventDetails` argument (`{ reason, cancel(), … }`). Every existing handler takes one argument, so all remain type-safe; none needed the old event object.
- Enter/exit animation is now a CSS **transition** rather than a keyframe animation. The 200ms duration and the fade+95% scale are preserved, but the easing comes from the default transition timing rather than `tw-animate-css`'s keyframes. Visually near-identical; worth one look.
- Base UI's Portal renders an extra wrapping `<div>` that Radix did not. No layout impact for a `position: fixed` popup.
- `modal` now also accepts `'trap-focus'` (traps focus without scroll lock). Not used.

## Verify by hand

1. `/prospects` → edit a prospect. On open, focus must land inside the dialog; on Escape, it must return to the row's action button.
2. Same dialog: click the backdrop — it must close; press Escape — it must close.
3. Watch the open and close animation at 200ms: fade + slight zoom, no jump, no flash of an unstyled centred box.
4. Open the command palette (`CommandDialog`) and confirm the cmdk list still filters and that arrow keys move the highlight.
5. Open a dialog on a short viewport and confirm the page behind is scroll-locked.

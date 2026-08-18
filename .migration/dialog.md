# dialog

2026-08-16, transformation engine. `Overlay` → `Backdrop`, `Content` → `Popup` (centred modal, no Positioner); the `tw-animate-css` keyframes are kept, only their data-attribute selectors change.

## Changed

- `apps/web/src/components/ui/dialog.tsx:3` — `* as DialogPrimitive from '@radix-ui/react-dialog'` → `{ Dialog as DialogPrimitive } from '@base-ui/react/dialog'`.
- `Dialog` is now a bare re-export (`const Dialog = DialogPrimitive.Root`, line 15). `Dialog.Root` renders no element, so it accepts neither `className` nor the old inert `data-slot="dialog"`; its props are generic over `<Payload>`, which breaks the `React.ComponentProps` pattern. A French comment records both reasons.
- `DialogOverlay` now renders `DialogPrimitive.Backdrop` (line 47). Public name kept.
- `DialogContent` now renders `DialogPrimitive.Popup` (line 74), still inside `DialogPortal`, still with no Positioner (centred modal).
- Animation selectors rewritten, keyframes kept: `data-[state=open]:animate-in fade-in-0 zoom-in-95` / `data-[state=closed]:animate-out …` → `data-open:animate-in data-open:fade-in-0 data-open:zoom-in-95` / `data-closed:animate-out …`. The `tw-animate-css` classes and the 200ms duration are unchanged; Base UI keeps the popup and backdrop mounted until the animation finishes, exactly as Radix did.
- `apps/web/src/components/ui/command.tsx:40` — `CommandDialog`'s props were `React.ComponentProps<typeof Dialog>`, whose `children` is now `ReactNode | PayloadChildRenderFunction`. Narrowed to `Omit<…, 'children'> & { children?: React.ReactNode }`.
- `apps/web/package.json` — `@radix-ui/react-dialog` removed (it also backed `sheet.tsx`).

Leftover scan: `grep -n "radix-ui\|@radix-ui" apps/web/src/components/ui/dialog.tsx apps/web/src/components/ui/command.tsx` → clean.

## Left alone

- `apps/web/src/components/ui/command.tsx` body — cmdk, not Radix. Only the `CommandDialog` props type was touched (above).
- No consumer passed `onOpenAutoFocus` / `onCloseAutoFocus` / `onEscapeKeyDown` / `onInteractOutside` to a dialog, so no `initialFocus` / `finalFocus` / `onOpenChange`-reason restructuring was needed here. (`stat-info.tsx` did, but on a Popover — see `.migration/popover.md`.)
- `@radix-ui/react-dialog` still appears in `pnpm-lock.yaml` as a transitive dependency of `cmdk`. Expected; cmdk is out of scope by policy.

## Behavior changes

- `onOpenChange` now receives a second `eventDetails` argument (`{ reason, cancel(), … }`). Every existing handler takes one argument, so all remain type-safe; none needed the old event object.
- Enter/exit animation is unchanged: same `tw-animate-css` keyframes, same 200ms, only the data-attribute selectors moved.
- Base UI's Portal renders an extra wrapping `<div>` that Radix did not. No layout impact for a `position: fixed` popup.
- `modal` now also accepts `'trap-focus'` (traps focus without scroll lock). Not used.

## Verify by hand

1. `/prospects` → edit a prospect. On open, focus must land inside the dialog; on Escape, it must return to the row's action button.
2. Same dialog: click the backdrop — it must close; press Escape — it must close.
3. Watch the open and close animation at 200ms: fade + slight zoom, no jump, no flash of an unstyled centred box.
4. Open the command palette (`CommandDialog`) and confirm the cmdk list still filters and that arrow keys move the highlight.
5. Open a dialog on a short viewport and confirm the page behind is scroll-locked.

# sheet

2026-08-16, transformation engine. Same primitive as dialog (`@base-ui/react/dialog`); the per-side `tw-animate-css` slide keyframes are kept, only their data-attribute selectors change.

## Changed

- `apps/web/src/components/ui/sheet.tsx:3` — `* as SheetPrimitive from '@radix-ui/react-dialog'` → `{ Dialog as SheetPrimitive } from '@base-ui/react/dialog'`.
- `Sheet` is now a bare re-export of `Dialog.Root` (line 16): it renders no element and its props are generic over `<Payload>`.
- `Overlay` → `Backdrop` (line 49), `Content` → `Popup` (line 58). `data-slot="sheet-overlay"` / `"sheet-content"` kept.
- Slide animation: selectors rewritten, keyframes kept. `data-[state=open]:slide-in-from-right` / `data-[state=closed]:slide-out-to-right` (and the three other sides) → `data-open:slide-in-from-right` / `data-closed:slide-out-to-right`. Durations unchanged: 300ms on enter, 200ms on exit.
- Backdrop fade likewise: `data-open:animate-in data-open:fade-in-0` / `data-closed:animate-out data-closed:fade-out-0`.
- `apps/web/src/components/layout/topbar.tsx:33` — `<SheetTrigger asChild><Button …>` → `<SheetTrigger render={<Button … />}>` with the `MenuIcon` moved to the trigger's children.

Leftover scan: `grep -n "radix-ui\|@radix-ui\|asChild" apps/web/src/components/ui/sheet.tsx apps/web/src/components/layout/topbar.tsx` → clean.

## Left alone

- Sheet is only used for the mobile sidebar (`topbar.tsx` → `SheetContent side="left"`). The `top`/`right`/`bottom` branches are unused today but were migrated for parity.
- `SheetPortal` was never exported by this wrapper and still is not.

## Behavior changes

- Enter/exit is unchanged: same `tw-animate-css` slide keyframes, same directions, distances, durations and `ease-in-out`. Only the data-attribute selectors moved.
- `onOpenChange` gains a second `eventDetails` argument; the existing `setOpen` handler is unaffected.
- Base UI's Portal adds a wrapping `<div>`; the popup is `position: fixed`, so there is no layout impact.

## Verify by hand

1. Narrow the window under 768px, open the burger menu in the top bar. The sidebar must slide in from the left over ~300ms and out over ~200ms — no fade-only, no instant snap.
2. While it is open: Escape closes it, clicking the scrim closes it, and focus is trapped inside.
3. Confirm the panel is 17rem wide, borderless on the right (`border-r-0`), and painted with the bordeaux `bg-sidebar`.
4. Check the close button's focus ring uses `outline-sidebar-ring` (it sits on the dark surface).

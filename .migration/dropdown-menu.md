# dropdown-menu

2026-08-16, transformation engine. Renamed primitive (`DropdownMenu` → `Menu`) plus the canonical menu restructuring; the biggest change is that highlight is no longer DOM focus.

## Changed

- `apps/web/src/components/ui/dropdown-menu.tsx:3` — `* as DropdownMenuPrimitive from '@radix-ui/react-dropdown-menu'` → `{ Menu as DropdownMenuPrimitive } from '@base-ui/react/menu'`. Public wrapper names all kept.
- Part renames: `Label` → `GroupLabel` (line 147), `ItemIndicator` → `CheckboxItemIndicator` (line 131), `Sub` → `SubmenuRoot` (line 170, bare re-export), `SubTrigger` → `SubmenuTrigger` (line 177).
- `DropdownMenu` is now a bare re-export of `Menu.Root` (line 12) — renders no element, generic `<Payload>` props.
- `DropdownMenuContent` (line 40) now renders `Portal > Positioner > Popup`. `align`, `alignOffset`, `side`, `sideOffset` are declared, destructured and forwarded to the Positioner explicitly; wrapper defaults unchanged (`align="end"`, `sideOffset={4}`). Positioner gets `isolate z-50 outline-none`; the Popup keeps `z-50` and `outline-none`.
- `DropdownMenuSubContent` (line 200) now composes the public `DropdownMenuContent` with the load-bearing submenu defaults `align="start" alignOffset={-3} side="right" sideOffset={0}`.
- **`focus:` → `data-highlighted:` throughout** (lines 96–97, 124–125, 181–182). Radix moved real DOM focus between items; Base UI keeps focus on the popup and marks the active item with `data-highlighted`. Every `focus:bg-secondary` / `focus:outline-…` would have become dead CSS. The 1.16:1-contrast rationale comment was kept and updated.
- `data-[disabled]:` → `data-disabled:`; SubTrigger's open marker `data-[state=open]:bg-secondary` → `data-popup-open:bg-secondary`.
- CSS var: `origin-(--radix-dropdown-menu-content-transform-origin)` → `origin-(--transform-origin)`.
- Animation idiom rewritten to `transition-[opacity,transform] duration-150` + `data-starting-style:*` / `data-ending-style:*`.
- Eight `<DropdownMenuTrigger asChild><Button …>` call sites converted to `render={<Button … />}` with the icon children hoisted onto the trigger: `apps/web/src/components/layout/user-menu.tsx:42`, `apps/web/src/components/layout/theme-toggle.tsx:34`, `apps/web/src/components/notifications/notification-bell.tsx:153`, `apps/web/src/components/prospects/columns.tsx:240`, `apps/web/src/components/prospects/export-menu.tsx:40`, `apps/web/src/components/bank/bank-export-menu.tsx:36`, `apps/web/src/components/bank/bank-stages-view.tsx:347`, `apps/web/src/components/commerciaux/commerciaux-view.tsx:339`.
- `apps/web/package.json` — `@radix-ui/react-dropdown-menu` removed.

Leftover scan: `grep -n "radix-ui\|@radix-ui\|asChild\|data-\[state=\|focus:bg" apps/web/src/components/ui/dropdown-menu.tsx` → clean.

**Note on how these call sites were found:** `tsc` with its incremental cache reported "no errors" while `asChild` was still present in eight files. Re-running with `--incremental false` surfaced them. Any future verification of this migration should disable the tsbuildinfo cache.

## Left alone

- `DropdownMenuGroup`, `DropdownMenuCheckboxItem`, `DropdownMenuSub`, `DropdownMenuSubTrigger`, `DropdownMenuSubContent` have **no consumers** today (`grep -rn` across `apps/web/src` → nothing outside the wrapper). They were migrated anyway to keep the exported API intact, but they are unexercised by tests and by the app.
- `Menu.Separator` is a re-export of the standalone Base UI `Separator`; the wrapper uses it directly rather than the project's `Separator` wrapper, as before.

## Runtime breaks found by Playwright, not by tsc

Two defects survived a clean typecheck, a clean lint and 588 unit tests. Both were caught by the e2e suite and are fixed on this branch.

- **`onSelect` → `onClick`.** Radix's `Menu.Item` ran the action in `onSelect`; Base UI's runs it in `onClick` and declares no `onSelect`. The item renders a `<div>`, and `onSelect` is a legitimate DOM event on a `<div>`, so the prop compiled, landed on the element, and never fired. Fifteen call sites were dead: `prospects/columns.tsx` (4), `commerciaux/commerciaux-view.tsx` (3), `bank/bank-stages-view.tsx` (4), `prospects/export-menu.tsx` (2), `bank/bank-export-menu.tsx` (1), `layout/theme-toggle.tsx` (1), `layout/user-menu.tsx` (1). All converted. `DropdownMenuItemProps`, `DropdownMenuCheckboxItemProps` and `DropdownMenuSubTriggerProps` now intersect `{ onSelect?: never }`, so the same slip is a compile error from now on.
- **`user-menu.tsx`**: the logout item used `onSelect={(event) => { event.preventDefault(); … }}` — Radix's idiom for "do not close the menu". That became `closeOnClick={false}` plus a plain `onClick`.
- **`DropdownMenuLabel` threw `MenuGroupContext is missing`.** `Menu.GroupLabel` requires a `Menu.Group` ancestor; Radix's `Label` was a plain `<div>` placeable anywhere. The three menus carrying a label (`prospects/export-menu.tsx`, `bank/bank-export-menu.tsx`, `layout/user-menu.tsx`) crashed on open behind a Next runtime-error overlay. The wrapper now renders its own `Menu.Group` around the `GroupLabel`, so the label stays placeable anywhere. `DropdownMenuGroup` is still exported for real grouping of label + items.

## Behavior changes

- **Highlight is not focus.** Screen-reader and focus-debugging behaviour differs: `document.activeElement` now stays on the popup while arrowing through items. Styling was moved to `data-highlighted`, but any external tooling that watched focus will see a change.
- **Close-on-click: restored.** Base UI defaults `closeOnClick` to `false` on `CheckboxItem` (Radix closed the menu). `DropdownMenuCheckboxItem` now pins `closeOnClick = true`; a call site that wants a multi-check menu passes `closeOnClick={false}` explicitly. Plain `Item` always closed and still does.
- **Collision padding: restored.** `collisionPadding` defaults to `0` on the Positioner (Base UI's default is 5px) and is exposed in the props so a call site can raise it.
- **Animations: kept as keyframes.** The `tw-animate-css` classes are unchanged; only the selectors moved from `data-[state=open]`/`data-[state=closed]` to `data-open`/`data-closed`. Base UI keeps the popup mounted until the animation finishes.
- `onOpenChange` gains an `eventDetails` argument; existing `setOpen` handlers are unaffected.
- Base UI's `Menu.Root` adds `highlightItemOnHover`, `loopFocus`, `closeParentOnEsc`, `disabled`; none used.

## Verify by hand

1. Top bar → user menu: open with the mouse, then with Enter from the keyboard. Arrow Up/Down must move the highlight (grey background + focus ring), Enter must activate, Escape must close and return focus to the trigger.
2. Same menu: type the first letter of an item — typeahead must jump to it.
3. `/prospects` row actions (`columns.tsx`): the trigger must still be a 44px icon button; the menu must open aligned to its right edge (`align="end"`), 4px below.
4. `/prospects` → export menu: confirm the destructive-variant item shows `text-destructive` and, when highlighted, the `bg-destructive-surface` background.
5. Notification bell: open it, confirm the 22rem panel, scroll the inner list, click "Tout voir" (now a real `<a>`) and confirm the menu closes and navigation happens.
6. `/dossiers/etapes` row menu: check `disabled` items are non-interactive and at 40% opacity.

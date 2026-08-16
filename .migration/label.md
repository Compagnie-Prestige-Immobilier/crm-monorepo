# label

2026-08-16, transformation engine. Base UI has no `Label` primitive — replaced by a native `<label>`.

## Changed

- `apps/web/src/components/ui/label.tsx` — `@radix-ui/react-label` import removed entirely; the wrapper now renders a native `<label>` typed `React.ComponentProps<'label'>`. All classes kept byte-for-byte, `data-slot="label"` kept.
- `apps/web/package.json` — `@radix-ui/react-label` removed.

Leftover scan: `grep -n "radix-ui\|@radix-ui" apps/web/src/components/ui/label.tsx` → clean.

## Left alone

- No call site changed: every consumer already passed `htmlFor` (the wrapper never relied on Radix's click-forwarding for nested controls). `grep -rn "<Label" apps/web/src` shows all uses carry `htmlFor` or wrap the control.
- Base UI's `Field.Label` was NOT adopted: this project does not use Base UI's `Field`, and doing so would restructure every form.

## Behavior changes

- Radix's `Label` prevented text selection on double-click via an internal `onMouseDown` handler; a native `<label>` does not. The wrapper's own `select-none` class already covers the visible effect.
- Radix forwarded clicks to a _nested_ control even without `htmlFor`. A native `<label>` does this too (implicit association), so nothing is lost.

## Verify by hand

1. `/prospects` filter bar: click the "Recherche" label text — focus must land in the input.
2. `/commerciaux` → new user dialog: click the "Rôle" label — the select trigger must open or at least receive focus.
3. Inside a disabled group (`group-data-[disabled=true]`), the label must still dim to 40% and stop accepting pointer events.

# badge

2026-08-16, transformation engine. `Slot`/`asChild` → `useRender` + `mergeProps`.

## Changed

- `apps/web/src/components/ui/badge.tsx:1` — `@radix-ui/react-slot` → `@base-ui/react/merge-props` + `@base-ui/react/use-render`.
- `BadgeProps` is now `useRender.ComponentProps<'span'> & VariantProps<typeof badgeVariants>`; the `asChild` boolean and the `Slot`/`'span'` ternary are gone, replaced by the `render` prop.
- The object literal passed to `mergeProps` carries `data-slot`, so it is cast `as React.ComponentProps<'span'>` — `data-*` keys are only special-cased in JSX and otherwise fail excess-property checking. A French comment on the spot records why.
- All cva variant class strings kept byte-for-byte.

Leftover scan: `grep -n "radix-ui\|@radix-ui\|asChild" apps/web/src/components/ui/badge.tsx` → clean.

## Left alone

- No consumer used `<Badge asChild>`, so no call site changed. `grep -rn "Badge asChild" apps/web/src` → no matches.

## Behavior changes

None. `useRender` produces the same single merged element the Radix Slot did; class merging order (internal first, external overriding) is preserved.

## Verify by hand

1. Open `/demandes-clients` — the "En attente" warning badge must keep its amber surface and `accent-text` colour, not the decorative gold.
2. Open the notification bell with unread items — the count badge inside `DropdownMenuContent` must still render inline, `w-fit`, no wrap.
3. Check a `variant="secondary" className="font-mono"` badge in `/notifications` → Gabarits (variable chips): the external `font-mono` must win over the variant classes.

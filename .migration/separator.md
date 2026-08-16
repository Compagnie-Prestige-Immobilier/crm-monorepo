# separator

2026-08-16, transformation engine. Direct mapping to the callable `@base-ui/react/separator` primitive; the `decorative` prop is gone.

## Changed

- `apps/web/src/components/ui/separator.tsx:3` — `* as SeparatorPrimitive from '@radix-ui/react-separator'` → `{ Separator as SeparatorPrimitive } from '@base-ui/react/separator'`. Single-part primitive: `SeparatorPrimitive.Root` → callable `SeparatorPrimitive`.
- The `decorative = true` prop and its forwarding were deleted; a French comment records that Base UI always renders an exposed `role="separator"`.
- Props typed `Omit<SeparatorPrimitive.Props, 'className'> & { className?: string }` — Base UI's `className` accepts a state callback, which `cn()` cannot consume.
- `data-[orientation=…]` selectors kept: Base UI emits the same attribute.
- `apps/web/package.json` — `@radix-ui/react-separator` removed.

Leftover scan: `grep -n "radix-ui\|@radix-ui\|decorative" apps/web/src/components/ui/separator.tsx` → clean.

## Left alone

- `DropdownMenuSeparator` and `SelectSeparator` are separate parts of their own primitives and are covered by `.migration/dropdown-menu.md` and `.migration/select.md`.
- No call site passed `decorative` explicitly, so no consumer changed.

## Behavior changes

- **Accessibility delta, flagged not patched.** Radix rendered `role="none"` when `decorative` was true (the wrapper's default), hiding the rule from screen readers. Base UI always exposes `role="separator"`, so every separator is now announced. If a given rule is purely visual and the extra announcement is noise, add `aria-hidden="true"` at that call site — do not reintroduce a `decorative` prop.

## Verify by hand

1. `/parametres` or any card using `<Separator />`: confirm horizontal rules are still 1px full-width and vertical ones 1px full-height.
2. Run the VoiceOver/NVDA rotor over a screen with several separators and decide whether the new "separator" announcements are acceptable; add `aria-hidden` where they are not.

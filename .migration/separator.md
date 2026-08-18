# separator

2026-08-16, transformation engine. Direct mapping to the callable `@base-ui/react/separator` primitive; the `decorative` prop is gone.

## Changed

- `apps/web/src/components/ui/separator.tsx:3` — `* as SeparatorPrimitive from '@radix-ui/react-separator'` → `{ Separator as SeparatorPrimitive } from '@base-ui/react/separator'`. Single-part primitive: `SeparatorPrimitive.Root` → callable `SeparatorPrimitive`.
- `decorative` is **kept as a wrapper prop**, still defaulting to `true`, and is now translated into `role="none"`. Base UI's primitive has no such prop and always renders an exposed `role="separator"`.
- Props typed `Omit<SeparatorPrimitive.Props, 'className'> & { className?: string }` — Base UI's `className` accepts a state callback, which `cn()` cannot consume.
- `data-[orientation=…]` selectors kept: Base UI emits the same attribute.
- `apps/web/package.json` — `@radix-ui/react-separator` removed.

Leftover scan: `grep -n "radix-ui\|@radix-ui\|decorative" apps/web/src/components/ui/separator.tsx` → clean.

## Left alone

- `DropdownMenuSeparator` and `SelectSeparator` are separate parts of their own primitives and are covered by `.migration/dropdown-menu.md` and `.migration/select.md`.
- No call site passed `decorative` explicitly, so no consumer changed.

## Behavior changes

- **Accessibility: restored.** Radix rendered `role="none"` when `decorative` was true (the wrapper's default), hiding purely visual rules from screen readers. Base UI always exposes `role="separator"`, which would have turned every layout rule in the panel into an announcement. The wrapper now emits `role="none"` for `decorative` separators, so the announcement profile is unchanged from before the migration.
- `aria-orientation` is not emitted on a `role="none"` element, same as under Radix.
- Menu and Select separators are **not** affected: `DropdownMenuSeparator` and `SelectSeparator` are parts of their own primitives, and Radix announced those too.

## Verify by hand

1. `/parametres` or any card using `<Separator />`: confirm horizontal rules are still 1px full-width and vertical ones 1px full-height.
2. Inspect a `<Separator />` in devtools: it must carry `role="none"`. Pass `decorative={false}` on one and confirm it becomes `role="separator"`.
3. Run the VoiceOver/NVDA rotor over a screen with several rules — no separator should be announced.

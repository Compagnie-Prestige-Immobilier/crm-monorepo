# avatar

2026-08-16, transformation engine. Direct 1:1 part mapping.

## Changed

- `apps/web/src/components/ui/avatar.tsx:3` — `* as AvatarPrimitive from '@radix-ui/react-avatar'` → `{ Avatar as AvatarPrimitive } from '@base-ui/react/avatar'`. `Root` / `Image` / `Fallback` keep their names.
- Each wrapper's props are now `Omit<AvatarPrimitive.<Part>.Props, 'className'> & { className?: string }` instead of `React.ComponentProps<typeof …>` — Base UI's `className` also accepts a state callback, which `cn()` cannot consume.
- All classes and `data-slot` values kept byte-for-byte.
- `apps/web/package.json` — `@radix-ui/react-avatar` removed.

Leftover scan: `grep -n "radix-ui\|@radix-ui" apps/web/src/components/ui/avatar.tsx` → clean.

## Left alone

- No call site changed. `delayMs` (which Base UI renames to `delay`) was never used: `grep -rn "delayMs" apps/web/src` → no matches. Every consumer renders `<Avatar><AvatarFallback>…` with no image.

## Behavior changes

- `AvatarRoot` renders a `<span>` in Base UI (Radix rendered a `<span>` too) — no layout delta.
- Base UI exposes `data-image-loading-status` on the root and a `transitionStatus` state on the image; nothing styles them yet.
- `AvatarImage.onLoadingStatusChange` replaces Radix's identically-named prop with the same signature. Unused here.

## Verify by hand

1. Open the top bar user menu — the circular avatar with initials must stay 32px (`size-8`) inside the trigger and 36px (`size-9`) by default elsewhere.
2. Confirm the fallback keeps `bg-secondary` + 600-weight 12px initials, and that overflow is still clipped to the circle.

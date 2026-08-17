# button

2026-08-16, transformation engine (no shadcn `components.json`, no golden pair available). Migrated to the real `@base-ui/react/button` primitive; `asChild` is gone from the public API.

## Changed

- `apps/web/src/components/ui/button.tsx:1` — `@radix-ui/react-slot` → `@base-ui/react/button`. `ButtonProps` is now `ButtonPrimitive.Props & VariantProps<typeof buttonVariants>`; the `asChild` boolean and the `Slot`/`'button'` ternary are replaced by the primitive's native `render` prop. All cva class strings kept byte-for-byte; `disabled:*` variants remain valid because the primitive still renders a real `<button>` with the `disabled` attribute.
- 11 call sites that used `<Button asChild><Link/></Button>` were converted to a **styled link** (`<Link className={buttonVariants({...})}>`), not to `render`: `apps/web/src/app/not-found.tsx:51`, `apps/web/src/components/detail-back-link.tsx:31`, `apps/web/src/components/permission-denied.tsx:45`, `apps/web/src/components/bank/bank-case-form.tsx:436`, `apps/web/src/components/bank/bank-cases-view.tsx:103` and `:137`, `apps/web/src/components/bank/bank-export-view.tsx:100`, `apps/web/src/components/client-requests/client-requests-view.tsx:417` and `:424`, `apps/web/src/components/notifications/notification-bell.tsx:244`, `apps/web/src/components/representants/representants-import-view.tsx:126`, `apps/web/src/components/representants/representants-view.tsx:116`.
  Reason (found by the test suite, not by tsc): `<Button nativeButton={false} render={<Link/>}>` makes Base UI's `useButton` stamp `role="button"` on the `<a>`, which **destroys the link role**. Seven tests querying `getByRole('link', …)` failed. Rendering the anchor with `buttonVariants()` keeps the semantics and the exact same visual result.
- `apps/web/src/components/bank/bank-case-form.tsx` — the `type="button"` that Radix's Slot forwarded onto the `<a>` was dropped; it was meaningless on an anchor.
- `apps/web/package.json` — `@radix-ui/react-slot` removed; `@base-ui/react` added (`catalog:`).
- `pnpm-workspace.yaml:157` — catalog entry `'@base-ui/react': '1.7.0'` added, `@radix-ui/react-slot` removed.

Leftover scan: `grep -n "radix-ui\|@radix-ui\|asChild" apps/web/src/components/ui/button.tsx` → clean. Repo-wide `grep -rn "asChild" apps/web/src` → no matches.

## Left alone

- `apps/web/src/components/ui/command.tsx` (cmdk), `sonner.tsx` (sonner) — not Radix, untouched by policy. `cmdk` still pulls `@radix-ui/react-dialog` transitively; that is expected and out of scope.
- Every `<Button>` that renders a real button (the large majority) was not touched: only the props type changed, and it is source-compatible.

## Behavior changes

- `nativeButton` is now part of the public `ButtonProps`. When someone later uses `render` with a non-`<button>` element they MUST pass `nativeButton={false}`, and they must accept that Base UI then sets `role="button"`. For links, use `buttonVariants()` instead (see above).
- Base UI's Button adds a `data-disabled` attribute alongside `disabled`. No styling depends on it today.
- `focusableWhenDisabled` (Base UI only, default `false`) is now available; not used.

## Verify by hand

1. Open `/dossiers` → the "Nouveau dossier" link: keyboard-focus it, press Enter, confirm navigation, and check in devtools it is an `<a>` with no `role` attribute.
2. On a detail screen (`/campagnes/<id>`), tab to the back link and confirm the focus ring is the same 2px offset ring as before.
3. Submit a form with a disabled submit button (e.g. `/dossiers/nouveau` while pending): the button must lose colour and shadow, not fade to 40% opacity.
4. Check a `size="icon-sm"` row action in the prospects table still has a 44px touch target (the `before:` pseudo-element).

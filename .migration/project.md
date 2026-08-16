# project — Radix UI → Base UI, whole-project migration

2026-08-16. `apps/web` only (the mobile app is Flutter, the API has no UI). Nine `@radix-ui/react-*` packages replaced by a single `@base-ui/react@1.7.0`.

## Mode and strategy

Whole-project. **No golden pair was available**: this repository has no `components.json`, `shadcn info` cannot describe it, and the eleven `ui/` wrappers carry heavy project-specific customisation (44px touch targets, WCAG contrast rationales, French design-system comments). Retargeting them onto a `base-<style>` registry variant would have replaced the CPI design system with shadcn's.

So: the **transformation engine** was used on the project's own files, keeping every class string and every comment, with the shadcn `base-nova` registry consulted read-only as a shape reference for `select.tsx` (Positioner/Popup composition, item anatomy). The design is unchanged; only the primitives underneath moved.

## Dependency swap

- `pnpm-workspace.yaml` catalog: nine `@radix-ui/react-*` entries removed, `'@base-ui/react': '1.7.0'` added (line 157).
- `apps/web/package.json`: same nine removed, `@base-ui/react: catalog:` added.
- `apps/web/eslint.config.mjs`: `import-x/no-internal-modules` allow-list `'@radix-ui/**'` → `'@base-ui/react/**'` (Base UI ships subpath-only entry points).
- `pnpm install` regenerated the lockfile. `@radix-ui/*` still appears there **as a transitive dependency of `cmdk`** — expected and out of scope by policy.

## Per-component reports

`button`, `badge`, `label`, `separator`, `avatar`, `dialog`, `sheet`, `popover`, `tabs`, `dropdown-menu`, `select` — one file each in this directory.

## App-code sweep summary

The call-site break surface was much larger than `asChild` alone:

1. **`asChild` → `render`** — 20 sites. Eleven of them wrapped a `<Link>` and were converted to a **styled link** (`<Link className={buttonVariants(...)}>`) rather than to `render`, because `<Button nativeButton={false} render={<Link/>}>` makes Base UI stamp `role="button"` on the anchor and destroy the link role. The test suite caught this (seven `getByRole('link')` failures); `tsc` could not. The other nine (`DropdownMenuTrigger`, `SheetTrigger`, `PopoverTrigger` over real buttons) became `render={<Button …/>}` with children hoisted onto the trigger.
2. **`Select` label resolution** — 30 selects across 17 files needed an `items` table on the Root. See `.migration/select.md`; this is the largest and most fragile part of the change, and it produces **no type error** when forgotten.
3. **`onValueChange` widening** — `(value: string)` → `(value: Value | null, eventDetails)`. Every Select handler gained a null guard; seven now-redundant `as` casts were removed.
4. **`onOpenAutoFocus` → `initialFocus`** — one site (`stats/stat-info.tsx`).
5. **`onSelect` → `onClick`** — 15 menu items. Base UI's `Menu.Item` has no `onSelect`, but the item renders a `<div>` where `onSelect` is a legal DOM event, so the prop compiled and never fired. See the Playwright section below.
6. **Class-hook rewrites** — `data-[state=open/closed]` → `data-open`/`data-closed`, `data-[state=active]` → `data-active`, `focus:` → `data-highlighted:` on menu and select items, `data-[disabled]` → `data-disabled`, `--radix-*` CSS vars → `--transform-origin` / `--available-height` / `--anchor-width`. The `tw-animate-css` keyframes themselves are kept verbatim; only their selectors moved.
7. **`aria-expanded`** dropped from two trigger call sites — Base UI sets it.

### Trap worth recording

`tsc -p tsconfig.json --noEmit` reported **"No errors found" while eight files still used `asChild`**, because the `tsconfig.tsbuildinfo` incremental cache was reusing stale results. Every verification in this migration was re-run with `--incremental false`. Do the same when auditing this work.

## Verification (final, all re-run after the dependency removal)

| Check                                             | Result                         |
| ------------------------------------------------- | ------------------------------ |
| `tsc -p tsconfig.json --noEmit` (non-incremental) | pass                           |
| `tsc -p tsconfig.e2e.json --noEmit`               | pass                           |
| `eslint src`                                      | pass, 0 problems               |
| `vitest run`                                      | **588 passed / 588**, 52 files |
| `next build`                                      | pass, all 24 routes emitted    |

Baseline before the migration was identical (clean typecheck, clean lint, 588 passing) once `@crm/api-client` was built — the first baseline run failed only because that workspace package had not been compiled yet. No pre-existing failures were inherited or masked.

### Playwright — run, and it earned its keep

The e2e suite was run against a live stack (`docker compose -f infra/docker/docker-compose.yml up -d`, migrations, seed, `pnpm --filter @crm/api dev`), on this branch **and** on `dev`, so failures could be attributed rather than guessed:

| Run                     | passed | failed |
| ----------------------- | ------ | ------ |
| `dev` (baseline, Radix) | 11     | 6      |
| this branch, final      | 11     | 6      |

**Same six failures, same eleven passes: zero regressions.** The six are pre-existing on `dev` and unrelated to this work:

- `accessibility.spec.ts`, `prospects.spec.ts:101`, `roles.anon.spec.ts:177` expect an `<h1>` reading **"Téléconseillers"** on `/commerciaux`. Commit `85f21ec` renamed that nav entry to **"Utilisateurs"** and the specs were never updated.
- `roles.anon.spec.ts:166`/`:224` and `workspaces.spec.ts:51` need the demo-mode accounts (`demo.banque@cpi.sn`), which a freshly migrated + seeded database does not have.

**Two real regressions were caught here and only here** — both invisible to `tsc` and to all 588 unit tests:

1. **`onSelect` silently died.** Radix's `Menu.Item` took the action in `onSelect`; Base UI takes it in `onClick` and has no `onSelect`. But the item renders a `<div>`, and `onSelect` _is_ a valid DOM event on a `<div>` — so fifteen menu actions compiled, rendered, and did nothing: both Excel exports, "Se déconnecter", every row action on prospects, users and bank stages. Fixed at all fifteen call sites, and `DropdownMenuItem` / `CheckboxItem` / `SubTrigger` now declare `onSelect?: never` so the same mistake is a compile error.
2. **`DropdownMenuLabel` crashed the page.** `Menu.GroupLabel` throws `MenuGroupContext is missing` unless wrapped in a `Menu.Group`; Radix's `Label` was a plain `<div>` you could put anywhere. The three menus carrying a label (both export menus and the account menu) threw on open. The wrapper now provides its own `Menu.Group`. `SelectLabel` had the identical latent bug (`SelectGroupContext is missing`) and got the same treatment — it has no consumers yet, so nothing had failed.

Both classes of bug share a shape worth remembering: **a Radix prop or composition that Base UI silently accepts and ignores, or accepts and rejects only at runtime.** Type-checking cannot see either.

## Behaviour deltas — closed

Six deltas were first shipped as flags, then closed in a follow-up commit. Each is now pinned at the wrapper level, so the wrapper's default reproduces the Radix behaviour and a caller can still opt out explicitly.

1. **Tabs activate on arrow keys again.** `TabsList` defaults to `activateOnFocus={true}`. Base UI's own default is manual activation (arrows move focus, Enter/Space selects); the panel has always activated on move.
2. **Separators are decorative again.** The `decorative` prop is back on the `Separator` wrapper, defaulting to `true` as before, and is translated into `role="none"`. Base UI's primitive always renders `role="separator"`, so without this every rule in the panel became an announcement. `decorative={false}` stays available where a rule really does separate two groups of meaning. (Menu and Select separators are untouched: Radix announced those too.)
3. **Checkbox menu items close on click again.** `DropdownMenuCheckboxItem` defaults to `closeOnClick={true}`; Base UI's default is `false`.
4. **`PopoverAnchor` is back.** Base UI has no Anchor part — the `Positioner` takes an `anchor` prop instead. The wrapper restores the Radix API with a small context: `<PopoverAnchor>` registers its element, `PopoverContent` reads it and forwards it to the Positioner. With no anchor declared the value stays `null` and the Positioner falls back to the trigger, exactly as Radix did.
5. **Collision padding is 0 again.** `collisionPadding` defaults to `0` on the popover, dropdown-menu and select wrappers (Base UI's default is 5px), and is exposed so a call site can raise it. `arrowPadding` is untouched — no wrapper renders an arrow.
6. **Enter/exit animations are keyframes again.** The `tw-animate-css` classes (`animate-in`, `fade-in-0`, `zoom-in-95`, `slide-in-from-*`, and their `-out` counterparts) are kept verbatim on dialog, sheet, popover, dropdown-menu and select; only the selectors changed, `data-[state=open]` becoming `data-open`. Base UI keeps the popup mounted until the animation finishes, same as Radix, so no `data-starting-style` / `data-ending-style` transition is needed.

## Behaviour deltas — still open

These have no wrapper-level fix and remain true:

- **Menu/Select highlight is not DOM focus.** `data-highlighted` replaces `:focus`; `document.activeElement` stays on the popup. Styling was moved accordingly, but external tooling that watched focus will see a change.
- **Select scroll arrows do not render on touch input.** Radix's did.
- **`onOpenChange` / `onValueChange` gain an `eventDetails` argument.** Existing single-argument handlers are unaffected.

## Left alone (intentionally)

- `command.tsx` (cmdk), `sonner.tsx` (sonner) — not Radix. `cmdk` keeps `@radix-ui/react-dialog` as a transitive dependency.
- `input.tsx`, `textarea.tsx`, `card.tsx`, `table.tsx`, `skeleton.tsx` — plain elements, never used Radix.
- `tw-animate-css` stays in `devDependencies`: it is still used elsewhere in the stylesheet (`animate-rise`, `animate-bell-swing`, `animate-badge-pulse`), only the popup enter/exit keyframes stopped using it.

## What's left

**0 wrappers remain on Radix.** `grep -rln "radix" apps/web/src/components/ui/` returns nothing.

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
5. **Class-hook rewrites** — `data-[state=open/closed]` → `data-open`/`data-closed`, `data-[state=active]` → `data-active`, `focus:` → `data-highlighted:` on menu and select items, `data-[disabled]` → `data-disabled`, `--radix-*` CSS vars → `--transform-origin` / `--available-height` / `--anchor-width`, and every `animate-in`/`animate-out` keyframe pair rewritten as a transition with `data-starting-style` / `data-ending-style`.
6. **`aria-expanded`** dropped from two trigger call sites — Base UI sets it.

### Trap worth recording

`tsc -p tsconfig.json --noEmit` reported **"No errors found" while eight files still used `asChild`**, because the `tsconfig.tsbuildinfo` incremental cache was reusing stale results. Every verification in this migration was re-run with `--incremental false`. Do the same when auditing this work.

## Verification (final, all re-run after the dependency removal)

| Check | Result |
|---|---|
| `tsc -p tsconfig.json --noEmit` (non-incremental) | pass |
| `tsc -p tsconfig.e2e.json --noEmit` | pass |
| `eslint src` | pass, 0 problems |
| `vitest run` | **588 passed / 588**, 52 files |
| `next build` | pass, all 24 routes emitted |

Baseline before the migration was identical (clean typecheck, clean lint, 588 passing) once `@crm/api-client` was built — the first baseline run failed only because that workspace package had not been compiled yet. No pre-existing failures were inherited or masked.

**Not run: the Playwright e2e suite** (`pnpm test:e2e`), which needs a live server and database. It includes `e2e/accessibility.spec.ts` (axe over every panel route) and is the natural place to catch the accessibility deltas flagged below. Running it is the recommended next step.

## Behaviour deltas — flagged, not patched

1. **Tabs activate manually.** Radix moved the selection on arrow keys; Base UI moves focus and waits for Enter/Space. Opt back in with `<TabsList activateOnFocus>` if wanted.
2. **Separators are announced.** Radix's `decorative` prop (defaulted to `true` here, i.e. `role="none"`) has no Base UI equivalent; every rule now carries `role="separator"`.
3. **Menu/Select highlight is not DOM focus.** `data-highlighted` replaces `:focus`; `document.activeElement` stays on the popup.
4. **Checkbox/radio menu items no longer close the menu on click** (`closeOnClick` defaults to `false`). No consumer uses these parts yet.
5. **`PopoverAnchor` was deleted** — no Base UI equivalent, and it had zero consumers. A future non-trigger anchor needs `Positioner`'s `anchor` prop, which the wrapper does not yet expose.
6. **Collision defaults shifted upstream**: `collisionPadding` 0 → 5px, `arrowPadding` 0 → 5px on every positioned popup.
7. **Select scroll arrows do not render on touch input.**
8. **Enter/exit animations are transitions, not keyframes.** Durations and distances were preserved, but easing now comes from the default transition timing rather than `tw-animate-css`.

## Left alone (intentionally)

- `command.tsx` (cmdk), `sonner.tsx` (sonner) — not Radix. `cmdk` keeps `@radix-ui/react-dialog` as a transitive dependency.
- `input.tsx`, `textarea.tsx`, `card.tsx`, `table.tsx`, `skeleton.tsx` — plain elements, never used Radix.
- `tw-animate-css` stays in `devDependencies`: it is still used elsewhere in the stylesheet (`animate-rise`, `animate-bell-swing`, `animate-badge-pulse`), only the popup enter/exit keyframes stopped using it.

## What's left

**0 wrappers remain on Radix.** `grep -rln "radix" apps/web/src/components/ui/` returns nothing.

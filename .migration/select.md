# select

2026-08-16, transformation engine, cross-checked against the shadcn `base-nova` registry wrapper (fetched from `https://ui.shadcn.com/r/styles/base-nova/select.json`) for the target shape. This is the widest-reaching component of the migration: `Select.Value` no longer resolves item labels by itself, so **every call site had to declare an `items` table**.

## Changed

### Wrapper — `apps/web/src/components/ui/select.tsx`

- Line 3: `* as SelectPrimitive from '@radix-ui/react-select'` → `{ Select as SelectPrimitive } from '@base-ui/react/select'`.
- Line 17: `Select` is now a bare re-export of `Select.Root`. Its props are generic over `<Value, Multiple>`; wrapping it would have collapsed `value` to `unknown` at every call site.
- Part renames: `Label` → `GroupLabel` (line 122), `Viewport` → `List` (line 108), `ScrollUpButton` → `ScrollUpArrow` (line 181), `ScrollDownButton` → `ScrollDownArrow` (line 200). Public wrapper names kept.
- `SelectContent` (line 79) renders `Portal > Positioner > Popup`. Positioning props declared, destructured and forwarded explicitly.
- `position="popper"` → `alignItemWithTrigger={false}` as the wrapper default, preserving the previous popper behaviour. `align="start"` is passed explicitly because Base UI's default is `'center'` where Radix's was `'start'`.
- `SelectTrigger`'s icon: `<SelectPrimitive.Icon asChild><ChevronDownIcon/></SelectPrimitive.Icon>` → `<SelectPrimitive.Icon render={<ChevronDownIcon …/>} />`.
- `SelectItem` (line 137) anatomy rebuilt: `ItemText` first, then `ItemIndicator render={<span …/>}` wrapping the check icon.
- Class rewrites: `focus:` → `data-highlighted:` (Base UI marks the active item instead of moving DOM focus), `data-[disabled]:` → `data-disabled:`, `data-[placeholder]:` → `data-placeholder:`, `max-h-(--radix-select-content-available-height)` → `max-h-(--available-height)`, `min-w-(--radix-select-trigger-width)` → `min-w-[max(8rem,var(--anchor-width))]`, `origin-(--radix-…-transform-origin)` → `origin-(--transform-origin)`.
- Animation idiom → `transition-[opacity,transform] duration-150` + `data-starting-style:*` / `data-ending-style:*`. The `position === 'popper' && data-[side=…]:translate-y-1` nudge was dropped in favour of `sideOffset={4}`.

### Call sites — `items` tables (30 selects across 17 files)

Base UI's `Select.Value` renders `resolveSelectedLabel(value, items, …)`, which falls back to stringifying the **raw value** when the Root has no `items`. Without this work the triggers would have displayed `TELECONSEILLER`, `SYSTEME`, `desactives`, `0`, or raw UUIDs instead of French labels. `items` accepts either `{value,label}[]` or `Record<value, label>`, so existing label maps were reused where possible rather than duplicated:

- `filters/date-picker.tsx` — `items={MONTHS}` (the existing `{value,label}[]`). The year select needs none (value === label).
- `prospects/prospects-table.tsx`, `bank/bank-cases-view.tsx` — page-size selects need none (value === label).
- `prospects/prospect-edit-dialog.tsx` — `items={PROSPECT_STATUT_LABELS}` (record reused directly) + three derived arrays for banque / syndicat / représentant, which now also feed the `SelectItem` loops so label and table cannot drift.
- `commerciaux/commerciaux-view.tsx` — new `ROLE_ITEMS`, `ACTIVE_ITEMS` module constants; the `SelectItem` loops read from them.
- `commerciaux/user-form-dialog.tsx` — `roleItems`, `departementItems`.
- `bank/bank-stages-view.tsx` — `items={COLOR_ROLES}` (already `{value,label}[]`).
- `bank/bank-case-detail-view.tsx`, `bank/bank-case-form.tsx`, `bank/client-request-dialog.tsx`, `referentiels/referentiel-form-dialog.tsx`, `client-requests/client-request-review-dialogs.tsx` (syndicats), `notifications/notification-composer.tsx` (gabarits, départements) — inline `.map()` tables built from the query data.
- `client-requests/client-request-review-dialogs.tsx` — `items={ENROLLMENT_METHOD_LABELS}` (record reused).
- `representants/representants-filters-bar.tsx` — new `PRESENCE_ITEMS`, `SORT_ITEMS`, `DIRECTION_ITEMS`, typed with `RepresentantSortField` / `SortDirection` so the handlers stay type-safe without casts.
- `notifications/notifications-view.tsx` — `STATUS_ITEMS`, `CATEGORY_ITEMS`.
- `notifications/notification-composer.tsx` — `CATEGORY_ITEMS`, `AUDIENCE_ITEMS`, `ROLE_ITEMS`.
- `notifications/template-manager.tsx` — `CATEGORY_ITEMS`.
- `phase2/spread-days-field.tsx` — `DAY_ITEMS`, which now also drives the `SelectItem` loop.

### Call sites — `onValueChange` signature

`onValueChange` widened from `(value: string)` to `(value: Value | null, eventDetails)`. Every handler gained an early `if (value === null) return;` guard. Eight of these were hard type errors; the rest (`Number(value)` calls) compiled but would have coerced `null` to `0`.

Because `items` now pins the Root's `Value` generic, seven `value as SomeUnion` casts became provably unnecessary and were deleted (ESLint `no-unnecessary-type-assertion`) — the handlers are now typed by inference rather than by assertion.

### Config

- `apps/web/eslint.config.mjs` — `'@radix-ui/**'` replaced by `'@base-ui/react/**'` in the `import-x/no-internal-modules` allow-list. Base UI ships only subpath entry points.
- `apps/web/package.json` — `@radix-ui/react-select` removed.

Leftover scan: `grep -n "radix-ui\|@radix-ui\|asChild\|focus:bg\|data-\[state=" apps/web/src/components/ui/select.tsx` → clean. Repo-wide `grep -rn "radix" apps/web/src` → clean.

## Left alone

- `SelectGroup` / `SelectLabel` / `SelectSeparator` / `SelectScrollUpButton` / `SelectScrollDownButton` have no consumers today; migrated for API parity, unexercised.
- `filter-combobox.tsx` is a Popover + cmdk, not a Select — see `.migration/popover.md`.

## Behavior changes

- **`Select.Value` no longer derives its text from the selected `SelectItem`.** It reads the Root's `items` table. Every current call site now supplies one, but any NEW `<Select>` whose values differ from their labels must add `items` or it will display the raw value. This is the single most fragile spot in the migration.
- **Highlight is not focus** (same as dropdown-menu): `data-highlighted` replaces `:focus`. `document.activeElement` stays on the popup.
- `align` default differs upstream (Radix `start`, Base UI `center`); the wrapper pins `start`, so nothing moved.
- Collision padding default 0 → 5px; `arrowPadding` 0 → 5px.
- Base UI's scroll arrows do not render on touch input; Radix's did.
- `Select.Root` renders a hidden `<input>` when `name` is set — unused here (all selects are controlled).
- `textValue` (typeahead override) is now `label`. Unused.

## Verify by hand

1. **Label display is the priority check.** Open each of these and confirm the trigger shows a French label and never a code: `/commerciaux` (Rôle, État du compte), `/notifications` (État, Catégorie), `/representants` advanced panel (Prospects apportés, Trier par, Sens), `/prospects` → edit (Statut, Banque, Syndicat, Représentant), `/dossiers/nouveau` (Banque de traitement), `/demandes-clients` → approve (Syndicat, Méthode d'enrôlement).
2. `/prospects` filter bar → date picker → month select: it must read "janvier", not "0". This one is nested in a Popover, so it also exercises two stacked portals.
3. Keyboard: open a select, arrow through, type a few letters for typeahead, press Enter. The highlighted row must show the grey background AND the focus ring.
4. Open a select with many options (`/notifications` → Catégorie, or the spread-days field with 31 entries): the list must cap at `--available-height`, scroll, and show the up/down arrows on a mouse-driven browser.
5. Confirm the panel is never narrower than its trigger (`--anchor-width`) and never narrower than 8rem.
6. Pick a value, reopen: the check indicator must sit on the right of the selected row.
7. `/parametres` and any dialog-hosted select: confirm the select popup renders ABOVE the dialog (z-index/portal stacking).

# Unused Modules Audit

Date: 2026-02-15
Scope: `lib/app/modules/*` reachability from real in-app navigation (routes + call sites).

## Method
- Checked module directories under `lib/app/modules`.
- Checked route registration in `lib/app/routes/app_router.dart`.
- Checked actual navigation call sites (`AppNavigator.*`, `AppNavigator.to(AppRoutes.*)`, `context.go/push`).
- Marked as unused only if there is no in-app entry point.

## Result

### Unused Modules (No In-App Entry Point)
1. `patterns`
- Route exists: `lib/app/routes/app_router.dart:193`.
- No external calls to pattern navigation helpers (`toPatterns`, `toPatternDetail`, `toAddEditPattern`) outside helper definitions.
- No `AppNavigator.to(AppRoutes.patterns)` usage found.

2. `tools`
- Route exists: `lib/app/routes/app_router.dart:126`.
- No external calls to `toTools` outside helper definition.
- No `AppNavigator.to(AppRoutes.tools)` usage found.

3. `reports`
- Route exists: `lib/app/routes/app_router.dart:208`.
- No external calls to `toReports` outside helper definition.
- No `AppNavigator.to(AppRoutes.reports)` usage found.

### Partially Orphaned (Inside Active Module)
1. `projects` list screen route (`/projects`) appears orphaned
- Route exists: `lib/app/routes/app_router.dart:112`.
- Only navigation to `/projects` found in: `lib/app/modules/dashboard/controllers/dashboard_provider.dart:377`.
- That method itself has no call site (not invoked by any view/provider).
- Note: this does NOT mean the whole `projects` module is unused. Project detail/edit/invoice flows are actively used.

### NOT Unused (Needed)
1. `shell`
- Root app shell route and navigation container: `lib/app/routes/app_router.dart:48`, `lib/app/routes/app_router.dart:84`.

2. `dashboard`, `stock`, `clients`, `more`
- Active shell branches: `lib/app/routes/app_router.dart:88`, `lib/app/routes/app_router.dart:94`, `lib/app/routes/app_router.dart:99`, `lib/app/routes/app_router.dart:104`.

3. `orders`
- Used from Dashboard and More actions via `AppNavigator.toOrders(...)`: `lib/app/modules/dashboard/views/dashboard_view.dart:70`, `lib/app/modules/more/views/more_view.dart:76`.

4. `projects` (core flows)
- Project detail is navigated from multiple places: `lib/app/modules/dashboard/views/dashboard_view.dart:144`, `lib/app/modules/clients/controllers/client_detail_provider.dart:153`, `lib/app/modules/orders/widgets/order_item_list.dart:53`.

5. `preferences` and `profile`
- Preferences entry from More: `lib/app/modules/more/views/more_view.dart:62`.
- Business profile entry from More/Preferences: `lib/app/modules/more/views/more_view.dart:49`, `lib/app/modules/preferences/views/preferences_view.dart:47`.

6. `onboarding`, `setup_wizard`, `security`
- Startup/lock flow depends on these routes and redirects: `lib/app/routes/app_router.dart:55`, `lib/app/routes/app_router.dart:79`, `lib/app/routes/app_router.dart:213`.

## Safe Deletion Candidates
- Full module deletion candidates (feature removal):
1. `lib/app/modules/patterns`
2. `lib/app/modules/tools`
3. `lib/app/modules/reports`

- Optional additional cleanup (orphan route only):
1. Remove `/projects` route and `projects` list screen wiring if you do not want that screen.

## Required Cleanup If You Delete
- Remove route registrations in `lib/app/routes/app_router.dart`.
- Remove route constants in `lib/app/routes/app_routes.dart`.
- Remove unused helper methods in `lib/app/core/navigation/app_navigator.dart`.
- Re-run analyzer and build to catch residual references.

## Final Verdict
Your suspicion is mostly correct.
- `tools`, `reports`, and `patterns` are currently unused by in-app navigation.
- `shell` is definitely not unused.
- `projects` is partially used: core project flows are active, but the projects list route appears orphaned.

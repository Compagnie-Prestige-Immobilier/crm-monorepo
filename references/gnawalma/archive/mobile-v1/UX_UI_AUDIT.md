# UX/UI Audit: Commandes, Projects, Stock, Clients

Date: 2026-02-15
Project: Gnawalma Flutter app

## Scope
This audit covers the four requested modules end-to-end:
- `commandes` (`orders` module)
- `project` (`projects` module)
- `stock` (`stock` module)
- `client` (`clients` module)

It also includes a deep trace of:
- Dashboard queue (`commandes` cards)
- Click card -> digital ticket
- Click `Modifier` in ticket
- Whether the app differentiates `commande` vs `project`

## Executive Summary
The core UX issue is confirmed: the app frequently presents `ProjectModel` data as if it were an `Order/Commande` object. This creates user confusion, especially in the dashboard and digital ticket edit flow.

Most critical risks:
1. The dashboard queue and ticket detail are project-driven but labeled as commandes.
2. `Modifier` in ticket edits project fields only, not the parent order.
3. `New Order` flow writes projects directly via repository, bypassing stock orchestration in `ProjectService`.
4. Payment/deposit and stock quantity validation gaps can produce inconsistent or unrealistic business data.

## Data Model Truth (Requested Clarification)
Your assumption is correct by current design: one commande can contain many projects.

Evidence:
- `OrderModel` explicitly stores `List<int> projectIds` and exposes `projectCount`: `lib/app/data/models/order_model.dart:67`, `lib/app/data/models/order_model.dart:139`.
- `OrderDetailProvider` loads associated projects by filtering all projects using `order.projectIds`: `lib/app/modules/orders/controllers/order_detail_provider.dart:52`, `lib/app/modules/orders/controllers/order_detail_provider.dart:57`.

So the cardinality is currently:
- `Order (Commande) 1 -> N Projects`

## Module Audit: Commandes (`orders`)

### Top-to-bottom flow
- List and filters: `lib/app/modules/orders/views/orders_view.dart:17`
- State/filter logic: `lib/app/modules/orders/controllers/orders_provider.dart:21`
- Creation wizard (3 steps): `lib/app/modules/orders/views/new_order_view.dart:16`
- Payment step: `lib/app/modules/orders/views/steps/payment_step.dart:15`
- Project item builder: `lib/app/modules/orders/views/steps/item_builder_step.dart:16`
- Order details: `lib/app/modules/orders/views/order_detail_view.dart:21`

### Findings

#### High
- Deposit can exceed order total in new order flow.
- `PaymentStep` sets deposit from input without max-total validation: `lib/app/modules/orders/views/steps/payment_step.dart:79`, `lib/app/modules/orders/views/steps/payment_step.dart:86`.
- `createOrder()` persists deposit and computes remaining directly, allowing negative remaining: `lib/app/modules/orders/controllers/new_order_provider.dart:473`, `lib/app/modules/orders/controllers/new_order_provider.dart:474`.
- UX impact: user can create financially inconsistent orders (negative balance).

#### Medium
- Fabric usage quantity is not validated against available stock.
- Quantity input only calls `setFabricQuantity`: `lib/app/modules/orders/widgets/stock_selector_widget.dart:89`, `lib/app/modules/orders/widgets/stock_selector_widget.dart:92`.
- `setFabricQuantity` has no stock-bound check: `lib/app/modules/orders/controllers/new_order_provider.dart:153`.
- UX impact: order can require unavailable fabric, causing execution failure later.

#### Medium
- Order detail fetches all projects then filters in-memory.
- `getAllProjects()` + filter by `projectIds`: `lib/app/modules/orders/controllers/order_detail_provider.dart:55`, `lib/app/modules/orders/controllers/order_detail_provider.dart:57`.
- UX impact: poor scalability and slower detail loading as data grows.

#### Medium
- Partial failure in order creation can leave orphaned projects.
- Projects are created first in loop before order creation: `lib/app/modules/orders/controllers/new_order_provider.dart:454`, `lib/app/modules/orders/controllers/new_order_provider.dart:461`.
- If exception occurs later, there is no rollback/delete for created projects.
- UX impact: users may see stray projects not tied to a valid order.

## Module Audit: Projects (`projects`)

### Top-to-bottom flow
- Projects list view (labeled "Mes Commandes"): `lib/app/modules/projects/views/projects_view.dart:17`, `lib/app/modules/projects/views/projects_view.dart:32`
- FAB opens new order flow, not pure project form: `lib/app/modules/projects/controllers/projects_provider.dart:105`
- Project detail (digital ticket): `lib/app/modules/projects/views/project_detail_view.dart:15`
- Ticket widget: `lib/app/modules/projects/views/widgets/digital_ticket.dart:12`
- Edit flow provider: `lib/app/modules/projects/controllers/add_edit_project_provider.dart:26`

### Findings

#### High
- `New Order` creates projects via repository directly, bypassing `ProjectService` stock logic.
- Repository write in order flow: `lib/app/modules/orders/controllers/new_order_provider.dart:456`, `lib/app/modules/orders/controllers/new_order_provider.dart:461`.
- Stock orchestration exists only in `ProjectService.createProject`: `lib/app/data/services/project_service.dart:38`, `lib/app/data/services/project_service.dart:43`.
- UX impact: stock appears wrong vs real production usage.

#### High
- Digital ticket edit path updates project only, not order.
- Edit button in detail triggers `navigateToEdit()`: `lib/app/modules/projects/views/project_detail_view.dart:59`, `lib/app/modules/projects/controllers/project_detail_provider.dart:214`.
- Route is `addEditProject`: `lib/app/modules/projects/controllers/project_detail_provider.dart:216`.
- UX impact: user expects "commande" edit but modifies only project-level fields.

#### Medium
- Ticket financial display uses project estimates while invoice can use actual price.
- Ticket total uses `project.estimatedPrice`: `lib/app/modules/projects/views/widgets/digital_ticket.dart:156`.
- Invoice table uses `actualPrice ?? estimatedPrice`: `lib/app/modules/projects/widgets/invoice/invoice_items_table.dart:85`.
- UX impact: contradictory amounts between ticket and invoice.

#### Medium
- Project detail state has no order object, reinforcing conceptual mismatch.
- `ProjectDetailState` holds project/client/fabric/pattern only: `lib/app/modules/projects/controllers/project_detail_state.dart:12`.
- Provider never loads parent order during detail load: `lib/app/modules/projects/controllers/project_detail_provider.dart:72`.

#### Medium
- Wizard/form validation is weak for required project/business fields.
- Next step advances directly: `lib/app/modules/projects/controllers/add_edit_project_provider.dart:227`.
- Save parses missing/invalid financial fields to zero: `lib/app/modules/projects/controllers/add_edit_project_provider.dart:326`.
- If no selected client, provider creates placeholder "Client": `lib/app/modules/projects/controllers/add_edit_project_provider.dart:315`.
- UX impact: low-quality data and accidental placeholder records.

#### Low
- Naming inconsistency increases cognitive load.
- Projects view title says "Mes Commandes": `lib/app/modules/projects/views/projects_view.dart:32`.
- Add/Edit title toggles "Modifier le Projet" vs "Nouvelle Commande": `lib/app/modules/projects/views/add_edit_project_view.dart:41`.

## Module Audit: Stock (`stock`)

### Top-to-bottom flow
- Stock root view: `lib/app/modules/stock/views/stock_view.dart:30`
- Fabric state/filtering: `lib/app/modules/stock/controllers/stock_provider.dart:24`
- Add/edit fabric: `lib/app/modules/stock/views/add_edit_fabric_view.dart:18`
- Fabric detail: `lib/app/modules/stock/views/fabric_detail_view.dart:19`

### Findings

#### High
- Key model attributes (`color`, `lowStockThreshold`) are not editable in UI and defaulted generically.
- Model requires `color`, `lowStockThreshold`: `lib/app/data/models/fabric_model.dart:27`, `lib/app/data/models/fabric_model.dart:60`.
- Save path hardcodes for new fabrics: `color = 'N/A'`, `lowStockThreshold = 5.0`: `lib/app/modules/stock/controllers/add_edit_fabric_provider.dart:168`, `lib/app/modules/stock/controllers/add_edit_fabric_provider.dart:169`.
- Add/edit view has no input controls for these fields: `lib/app/modules/stock/views/add_edit_fabric_view.dart:52`.
- UX impact: low-stock alerts and color-based search become misleading.

#### Medium
- Fabric detail does not refresh after edit navigation.
- Edit action only navigates: `lib/app/modules/stock/views/fabric_detail_view.dart:46`, `lib/app/modules/stock/controllers/fabric_detail_provider.dart:99`.
- No awaited result or refresh trigger after edit return.
- UX impact: user sees stale data and may think save failed.

#### Medium
- Fabric card quick action "Gérer le stock" is a dead end.
- Action only shows info toast, no stock management flow: `lib/app/shared/widgets/cards/fabric_card.dart:150`, `lib/app/shared/widgets/cards/fabric_card.dart:153`.
- UX impact: broken affordance and trust erosion.

## Module Audit: Clients (`clients`)

### Top-to-bottom flow
- Client list: `lib/app/modules/clients/views/clients_view.dart:24`
- Client list/provider stream logic: `lib/app/modules/clients/controllers/clients_provider.dart:24`
- Add/edit client (2-step form): `lib/app/modules/clients/views/add_edit_client_view.dart:16`
- Client detail: `lib/app/modules/clients/views/client_detail_view.dart:15`
- Measurement add/edit: `lib/app/modules/clients/views/add_edit_measurement_view.dart:16`

### Findings

#### Medium
- Clients list has no explicit error state for stream/repo failures.
- Provider falls back with `maybeWhen(... orElse ...)` and does not surface error model: `lib/app/modules/clients/controllers/clients_provider.dart:29`, `lib/app/modules/clients/controllers/clients_provider.dart:41`.
- View shows loading or empty states only: `lib/app/modules/clients/views/clients_view.dart:79`, `lib/app/modules/clients/views/clients_view.dart:86`.
- UX impact: failure can masquerade as empty customer list.

#### Medium
- Step-1 validation in add/edit client uses toast-level blocking with weak inline guidance.
- Next-step guard uses provider check + toast: `lib/app/modules/clients/controllers/add_edit_client_provider.dart:154`, `lib/app/modules/clients/controllers/add_edit_client_provider.dart:159`.
- Navigation button triggers `nextStep` directly: `lib/app/modules/clients/views/add_edit_client_view.dart:380`.
- UX impact: users get blocked with low-context errors during step progression.

#### Medium
- Measurement form allows saving blank records.
- Save only depends on `formKey.validate()`, but measurement fields have no validators: `lib/app/modules/clients/controllers/add_edit_measurement_provider.dart:137`, `lib/app/modules/clients/views/add_edit_measurement_view.dart:332`.
- This can persist empty `MeasurementRecord` values.
- UX impact: noisy history and low-quality measurement data.

#### Medium
- `latestMeasurement` mutates historical order on read.
- Getter sorts `measurements` list in-place: `lib/app/data/models/client_model.dart:98`.
- UX impact: non-deterministic history ordering side effects.

#### Medium
- Client wardrobe can become stale in detail screen.
- Projects loaded once in `build`: `lib/app/modules/clients/controllers/client_detail_provider.dart:26`, `lib/app/modules/clients/controllers/client_detail_provider.dart:28`.
- `refresh()` exists but is not wired in view interactions: `lib/app/modules/clients/controllers/client_detail_provider.dart:74`, `lib/app/modules/clients/views/client_detail_view.dart:49`.
- UX impact: newly created projects may not appear immediately in wardrobe section.

## Deep Trace: Dashboard -> Ticket Digital -> Modifier

### What actually happens
1. Dashboard queue is based on `ProjectModel`, not `OrderModel`.
- Dashboard state holds only project lists: `lib/app/modules/dashboard/controllers/dashboard_state.dart:11`.
- Queue cards receive `project` directly: `lib/app/modules/dashboard/views/dashboard_view.dart:141`.

2. Tap opens project detail route.
- Navigation uses `project.id` and `projectDetail` route: `lib/app/modules/dashboard/controllers/dashboard_provider.dart:355`, `lib/app/modules/dashboard/controllers/dashboard_provider.dart:356`.

3. The screen is titled as commande, but backed by project state.
- App bar: `Dossier Commande`: `lib/app/modules/projects/views/project_detail_view.dart:43`.
- Detail state excludes order context: `lib/app/modules/projects/controllers/project_detail_state.dart:12`.

4. Ticket financial lines are project-level values.
- `TOTAL COMMANDE` uses `project.estimatedPrice`: `lib/app/modules/projects/views/widgets/digital_ticket.dart:156`.
- `ACOMPTE` uses `project.advancePayment`: `lib/app/modules/projects/views/widgets/digital_ticket.dart:158`.

5. `Modifier` edits project form only.
- Edit icon triggers `navigateToEdit()`: `lib/app/modules/projects/views/project_detail_view.dart:59`.
- Route is `addEditProject` with project argument: `lib/app/modules/projects/controllers/project_detail_provider.dart:216`.

### Conclusion
Yes: the flow currently conflates concepts in UX language.
- Data entity in this path: `ProjectModel`
- User-facing label: often `Commande`
- Result: users expect order-level edit but get project-level edit.

## Root Cause Analysis (Commande vs Project)

### Root cause A (Primary)
The UI language uses "commande" in project surfaces without loading order context.
- Evidence: queue cards + ticket labels + project-only providers.

### Root cause B
Editing entry points from dashboard/ticket are wired to `addEditProject`, not an order editor.
- Evidence: `navigateToEditProject(...)` and `navigateToEdit()` both lead to project editing.

### Root cause C
Order-project relation exists but is implemented as one-way ID list with late lookup.
- `OrderModel.projectIds` references projects, while project does not hold `orderId`.
- This weakens direct context resolution in project-centric screens.

## Prioritized Remediation Plan

### Phase 1 (Fast UX stabilization)
1. Rename labels where entity is project.
- Replace "commande" wording on project-only screens/cards with "projet" (or hybrid wording with explicit context).

2. Make edit intent explicit on ticket.
- Change button copy to `Modifier le projet` until order-aware edit is implemented.

3. Add strict financial guards in new order payment step.
- Block `deposit > totalAmount` before `createOrder()`.

4. Validate stock quantity against selected fabric availability.
- Prevent saving item when requested meters exceed `quantityInMeters`.

5. Add stock detail refresh after edit return.
- Await edit route result and call `refresh()`.

6. Remove or implement quick action "Gérer le stock".
- Avoid dead-end interaction.

### Phase 2 (Model/UI alignment)
1. Introduce order-aware ticket view-model.
- When opening ticket from dashboard, resolve parent `OrderModel` and pass both order + project context.

2. Separate edit actions.
- `Modifier la commande` -> order form (`addEditOrder`).
- `Modifier le projet` -> project form (`addEditProject`).

3. Harmonize financial source-of-truth.
- Decide whether ticket totals come from order-level or project-level values and enforce consistency with invoice rendering.

4. Add transactional safety in order creation.
- If project creation or order creation fails, rollback intermediate writes.

### Phase 3 (Data integrity hardening)
1. Add stronger relation model (recommended):
- Add `orderId` on `ProjectModel` or repository query by `projectIds` directly.

2. Improve client measurement integrity.
- Reject fully empty measurement saves.
- Make `latestMeasurement` non-mutating (sort copy, not source list).

## Final Answer to Your Core Doubt
- Yes, by current model design, a commande can include many projects.
- The bug is less about cardinality and more about UX/route coupling: project data is presented and edited as if it were order data in the dashboard/ticket path.

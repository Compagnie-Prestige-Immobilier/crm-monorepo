# UX Brutal Audit (10 Roles)

Date: 2026-02-15
Scope: Commande creation, dashboard, order/project detail, payment journeys
Method: code audit + heuristic UX review (no live interview/analytics dataset)

## Executive Verdict
The product is moving in the right direction, but it is still in a mixed state:
- The app now has an order-centric dashboard architecture.
- Some flows still feel article-centric and can confuse payment and ownership context.
- Research, analytics instrumentation, and accessibility for key modules are still weak.

## What Improved Since Last Audit
- Dashboard now renders order view models (`waitingOrders`, `readyOrders`, `deliveredUnpaidOrders`) and order cards, not raw project cards: `lib/app/modules/dashboard/controllers/dashboard_state.dart:17`, `lib/app/modules/dashboard/views/dashboard_view.dart:126`.
- Beneficiary "self" display was improved in the chooser (`selfLabel` based on selected client): `lib/app/modules/orders/widgets/beneficiary_list.dart:18`.
- Project generated title is no longer `"... pour ..."`; it uses garment type directly: `lib/app/modules/orders/controllers/new_order_provider.dart:257`.
- Default beneficiary state is now `Cliente`, not `Moi-meme`: `lib/app/modules/orders/controllers/new_order_state.dart:26`.

## 1) Product UX Designer
Question: What problem are we solving?

Finding:
The core problem is now mostly correct (1 commande = N articles), but the experience still mixes order-level and article-level control in critical moments.

Evidence:
- Dashboard is order-first: `lib/app/modules/dashboard/views/dashboard_view.dart:126`.
- Project detail still has a primary article-level payment CTA in digital ticket: `lib/app/modules/projects/views/widgets/digital_ticket.dart:186`, `lib/app/modules/projects/views/widgets/digital_ticket.dart:197`.

Risk:
Users may think they are settling one full order while they are only paying one article.

Recommendation:
Keep order-level payment as the default everywhere; keep article-level payment as an advanced explicit option.

## 2) UX Researcher
Question: Let us test before we assume.

Finding:
No explicit usability research loop is visible for this journey.

Evidence:
- I infer this from the repository: there are no test artifacts for interview synthesis, usability scripts, or task benchmark reports in these flows.

Risk:
You can ship local fixes that still miss real shop-floor behavior (atelier reality, customer communication pressure, rush hours).

Recommendation:
Run 5 focused sessions with one script:
- Task A: one client, two beneficiaries, one order.
- Task B: partial payment then final payment.
- Task C: find and edit one article within a multi-article order.

## 3) UX Strategist
Question: Where should this product go?

Finding:
The product direction is not fully unified yet between "Order OS" and "Article tracker".

Evidence:
- Order-centric pivot exists in dashboard model: `lib/app/modules/dashboard/models/dashboard_order_card_vm.dart:5`.
- Legacy project-level structures are still kept in state for transition: `lib/app/modules/dashboard/controllers/dashboard_provider.dart:320`.

Risk:
Strategy drift: teams may keep adding both paradigms and make complexity permanent.

Recommendation:
Declare a product north star:
- Commercial surface = commande-first.
- Production surface = article-first.
- Explicitly separate these modes in IA and copy.

## 4) Information Architect
Question: Where does everything live?

Finding:
Main nav still hides "Orders" from persistent bottom navigation, which hurts discoverability and creates detours.

Evidence:
- Bottom nav has `ACCUEIL`, `STOCK`, `CLIENTS`, `PLUS` only: `lib/app/shared/widgets/navigation/bottom_nav_bar.dart:112`.
- Orders are reachable indirectly from dashboard sections/actions.

Risk:
Users memorize workarounds instead of clear pathways.

Recommendation:
Add a first-class `Commandes` tab or a persistent top-level entry in shell navigation.

## 5) Service Designer
Question: What happens beyond the screen?

Finding:
Core digital flow exists (order creation, schedule notification, payment records), but the service blueprint is incomplete for real-world handoff/support moments.

Evidence:
- Delivery reminder scheduling exists: `lib/app/modules/orders/controllers/new_order_provider.dart:505`.
- Payment history exists at order level: `lib/app/data/models/order_model.dart:55`.

Risk:
Gaps in "customer-facing moments": payment proof, dispute handling, adjustment flows, after-delivery follow-up.

Recommendation:
Define service blueprint with lanes:
- Tailor actions
- Customer touchpoint (WhatsApp/receipt)
- System state updates
- Recovery path for mistakes/refunds

## 6) UX Writer (Content Designer)
Question: Words are part of UX.

Finding:
Copy is improved but still inconsistent by context and entity naming.

Evidence:
- In project detail, empty state says `Commande introuvable` in a project screen: `lib/app/modules/projects/views/project_detail_view.dart:85`.
- Order card now correctly uses `DESTINATAIRE`: `lib/app/modules/dashboard/views/widgets/order_card.dart:287`.
- CTA `FINALISER ET PAYER` appears before user enters payment step: `lib/app/modules/orders/widgets/order_bottom_bar.dart:73`.

Risk:
Entity confusion (commande vs article) and premature-payment wording increases cognitive load.

Recommendation:
Content rules:
- In project screens: always "article" / "dossier article".
- In order screens: always "commande".
- Replace `FINALISER ET PAYER` with `Continuer vers paiement` on step transitions.

## 7) Behavioral Designer
Question: What motivates users?

Finding:
The flow uses strong action language and quick actions, but some behavior shaping encourages speed over clarity.

Evidence:
- Fast primary CTA in item builder: `lib/app/modules/orders/widgets/order_bottom_bar.dart:55`.
- Long-press quick actions in cards can bypass context depth: `lib/app/modules/dashboard/views/widgets/order_card.dart:66`.

Risk:
Fast decisions with wrong scope (article vs order) under time pressure.

Recommendation:
Use progressive disclosure:
- Keep quick actions.
- Add one-line scope label near payment actions: `Paiement commande` vs `Paiement article`.

## 8) Usability Analyst
Question: Where do users struggle?

Finding:
There is a likely data-join fragility that can produce "missing/odd grouping" perception.

Evidence:
- Dashboard VM maps projects to orders only via `p.orderId == order.id`: `lib/app/modules/dashboard/controllers/dashboard_provider.dart:188`.
- It does not fallback to `order.projectIds` if back-reference is missing.

Risk:
If one back-link write fails, an article may disappear from grouped order cards or appear inconsistent across modules.

Recommendation:
Map related projects by union rule:
- `p.orderId == order.id` OR `order.projectIds.contains(p.id)`.

## 9) UX Data Analyst
Question: Let the numbers speak.

Finding:
Business metrics exist (cash/day), but UX funnel instrumentation is missing.

Evidence:
- Daily cash computation exists: `lib/app/modules/dashboard/controllers/dashboard_provider.dart:87`.
- Repository scan found no user-event tracking calls (`logEvent`, `track`, etc.) in key flows.

Risk:
You cannot prove where users drop in `new order -> add second article -> payment -> success`.

Recommendation:
Instrument funnel events minimally:
- `order_create_started`
- `article_added`
- `beneficiary_selected`
- `payment_step_opened`
- `order_created_success`
- `order_created_failed`

## 10) Accessibility UX Specialist
Question: Is this usable by everyone?

Finding:
Accessibility support is uneven: clients module has semantics, but dashboard/orders/projects modules do not show semantic wrappers and rely on very small typography.

Evidence:
- No `Semantics(...)` usage found in `dashboard/orders/projects` modules (repo scan).
- Multiple key labels use very small fonts (8-10): `lib/app/modules/dashboard/views/widgets/order_card.dart:189`, `lib/app/modules/dashboard/views/widgets/order_card.dart:212`, `lib/app/shared/widgets/navigation/bottom_nav_bar.dart:165`.

Risk:
Low readability and screen-reader discoverability issues for high-frequency operational screens.

Recommendation:
- Introduce semantics labels for order cards, payment CTA, and article rows.
- Raise minimum operational text size (target >= 12 for dense UI, 14+ for core actions).
- Avoid all-caps where not necessary for readability.

## Priority Roadmap

P0 (now):
- Enforce payment scope clarity (commande-first default, article payment explicitly secondary).
- Fix naming inconsistency in project detail copy (`Commande introuvable` -> project-specific wording).
- Update item-step CTA wording (`Continuer vers paiement`).

P1 (next):
- Harden dashboard grouping join (`orderId` + `order.projectIds` fallback).
- Add `Commandes` as first-class nav destination.

P2 (quality):
- Add event instrumentation for funnel analytics.
- Accessibility pass for dashboard/orders/projects modules.

## Final Brutal Answer
Your direction is valid. The app is no longer as broken as before, but it is still not fully coherent under pressure.

The remaining problem is not "database relation" anymore.
It is "scope clarity" (order vs article), plus discoverability, measurement, and accessibility maturity.

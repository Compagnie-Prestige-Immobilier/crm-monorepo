# UX AUDIT: Payment + Livraison Actions (Order Detail)
**Date:** 2026-02-12
**Module:** `OrderDetailView`
**Goal:** Choose action pattern and fully audit payment vs delivery behavior

---

## Recommendation (Short Answer)

Choose **Interpretation C (Contextual Actions)** with a lightweight hybrid:
- Keep one prominent payment action when unpaid/partial.
- Show only next relevant operational actions by state.
- Do **not** hard-block delivery when unpaid, but show a clear warning + payment shortcut.

This matches your requirement: livraison can proceed, but the UI strongly nudges payment first.

---

## 1) Current Screen: What Users See Today

In `OrderDetailView`, the page is:
1. Header (`OrderDetailHeader`)
2. Client info
3. Payment summary (`OrderPaymentSection`)
4. Project list
5. Timeline (`OrderTimeline`)
6. Status actions (`OrderActionsBar`)
7. Floating payment FAB (only when not fully paid)

References:
- `lib/app/modules/orders/views/order_detail_view.dart:88`
- `lib/app/modules/orders/widgets/order_payment_section.dart:10`
- `lib/app/modules/orders/widgets/order_actions_bar.dart:9`

---

## 2) Current Behavior Audit (Code-Verified)

## Critical/High findings

### A1. Delivery status can be set even when unpaid, with no guard or warning
- `OrderActionsBar` shows all statuses except current (`pending`, `inProgress`, `completed`, `delivered`, `cancelled`) as direct buttons.
- `updateOrderStatus` writes status immediately.
- No payment-related check before setting `delivered`.

References:
- `lib/app/modules/orders/widgets/order_actions_bar.dart:44`
- `lib/app/modules/orders/controllers/order_detail_provider.dart:92`

Risk:
- Users may mark orders delivered while balance remains due, with no friction or reminder.

### A2. Payment dialog allows overpayment (amount > remaining)
- Dialog validation checks only `amount > 0`.
- `recordPayment` blindly adds amount to `depositPaid`.

References:
- `lib/app/modules/orders/views/order_detail_view.dart:181`
- `lib/app/data/models/order_model.dart:99`

Risk:
- Negative remaining amount appears (`total - deposit`), confusing accounting UX.

### A3. Redundant and split action model (FAB payment + status card)
- Payment action is in FAB only.
- Status actions are in a different section.
- User intent “finalize delivery and collect money” spans two distant controls.

References:
- `lib/app/modules/orders/views/order_detail_view.dart:88`
- `lib/app/modules/orders/widgets/order_actions_bar.dart:30`

Risk:
- Mental model mismatch and extra navigation effort.

### A4. Delivery timeline lacks actual delivery capture on status change
- `actualDeliveryDate` exists in model but not set in `updateOrderStatus`.

References:
- `lib/app/data/models/order_model.dart:37`
- `lib/app/modules/orders/controllers/order_detail_provider.dart:96`

Risk:
- Weak traceability for real fulfillment date.

## Medium findings

### A5. Payment dialog does not capture method/notes
- `PaymentRecord` supports method + notes, but UI records fixed default `Espèces` only.

References:
- `lib/app/data/models/order_model.dart:106`
- `lib/app/data/models/order_model.dart:141`

### A6. No explicit “next best action” guidance on screen
- Payment section is informative, not actionable.
- Status section is action-rich but not context-sensitive.

References:
- `lib/app/modules/orders/widgets/order_payment_section.dart:23`
- `lib/app/modules/orders/widgets/order_actions_bar.dart:40`

---

## 3) Pattern Decision

## Pick: Interpretation C (Contextual Actions)

Why C over A/B:
- Better than A: avoids clutter/redundancy while still improving visibility.
- Safer than B: no abrupt pattern replacement; can evolve incrementally.
- Supports your requirement exactly: unpaid delivery is not blocked, but strongly guided.

Practical hybrid:
- Keep FAB initially for speed.
- Add contextual primary action inside “Actions rapides”.
- Remove FAB later if analytics show new action bar is enough.

---

## 4) Proposed Screen Behavior (State Matrix)

### State 1: Unpaid (`paymentStatus=unpaid`)
Primary action:
- `Encaisser maintenant`
Secondary actions:
- `Marquer en cours` / `Marquer terminé` / `Livrer quand même`
When tapping `Livrer quand même`:
- Confirmation dialog: “Commande non soldée. Reste X FCFA. Continuer ?”
- Buttons: `Encaisser d'abord` (recommended), `Livrer quand même`

### State 2: Partial (`paymentStatus=partial`, remaining > 0)
Primary action:
- `Encaisser le solde (X FCFA)`
Secondary actions:
- Same operational statuses
Delivery tap:
- Same soft warning dialog with quick payment shortcut

### State 3: Paid (`paymentStatus=paid`)
Primary action:
- If not delivered: `Livrer au client`
- If delivered: `Commande livrée` (disabled/info)
Secondary actions:
- Operational status transitions that still make sense

### State 4: Delivered + unpaid/partial (edge case legacy data)
Top warning banner in payment section:
- `Commande livrée avec solde restant: X FCFA`
Primary action:
- `Encaisser le solde`

---

## 5) UX Copy (French, local-friendly)

- Payment CTA: `Encaisser`
- Payment CTA with amount: `Encaisser ${remaining} FCFA`
- Delivery soft guard title: `Paiement incomplet`
- Delivery soft guard body: `Il reste ${remaining} FCFA à payer. Voulez-vous encaisser avant la livraison ?`
- Guard buttons:
  - Primary: `Encaisser d'abord`
  - Secondary: `Livrer quand même`

---

## 6) Interaction Blueprint (what to change)

### In `OrderActionsBar`
- Rename section title from `Changer le statut` to `Actions rapides`.
- Add contextual primary button at top based on payment+status.
- Keep status chips below, but filter impossible or low-sense transitions.

Current ref:
- `lib/app/modules/orders/widgets/order_actions_bar.dart:30`

### In `OrderDetailView`
- Keep FAB temporarily (phase 1) for discoverability.
- After adoption, consider removing FAB to reduce duplicated CTAs.

Current ref:
- `lib/app/modules/orders/views/order_detail_view.dart:88`

### In payment dialog
- Validate `0 < amount <= remaining`.
- Add optional `method` selector + note field.

Current ref:
- `lib/app/modules/orders/views/order_detail_view.dart:164`

### In provider status update
- On `delivered`, set `actualDeliveryDate = now` if null.
- For unpaid/partial to delivered transition, trigger soft guard flow from UI.

Current ref:
- `lib/app/modules/orders/controllers/order_detail_provider.dart:92`

---

## 7) Should Payment Be Enforced Before Livraison?

Your policy target (recommended):
- **Not enforced technically** (delivery can proceed).
- **Enforced in UX guidance** (explicit warning + one-tap payment path).

This avoids blocking real-world exceptions while reducing accidental unpaid deliveries.

---

## 8) Implementation Priority

1. Prevent overpayment in dialog (A2).
2. Add soft warning before unpaid delivery (A1 + policy).
3. Add contextual primary action in status section (pattern C).
4. Set `actualDeliveryDate` on delivered status (A4).
5. Add payment method/notes capture (A5).
6. Reassess FAB redundancy via usage data.

---

## 9) Final Decision

For your question “payment in status section, and delivery may need payment but not enforced”:
- Use **Contextual Actions (C)**.
- Keep delivery possible without full payment.
- But always show a prominent payment action and a soft confirmation warning when delivering with balance due.

That gives operational flexibility without sacrificing cash-collection discipline.

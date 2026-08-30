import 'order_model.dart';

/// Translation between the local [OrderStatus] and the server's wire values.
///
/// The two vocabularies overlap on two of six values. The server speaks
/// `draft | confirmed | in_progress | ready | delivered | cancelled`
/// (`apps/api/src/contracts/schemas.ts`); the device speaks
/// `pending | inProgress | completed | delivered | cancelled`. Nothing
/// translated between them — `RemoteOrder.status` was kept as a raw `String`
/// with a `'confirmed'` fallback and never compared to the enum the UI renders,
/// so the two halves of the product simply never discussed order state.
///
/// `draft` has no local counterpart on purpose: `docs/PRODUCT.md` fixes the
/// product's statuses at five, and a draft is a server-side pre-state an
/// atelier never sees. It reads as [OrderStatus.pending].
extension OrderStatusWire on OrderStatus {
  /// The value to send to the API.
  String get wireValue => switch (this) {
    // A locally created order already exists, so it is `confirmed` rather
    // than `draft` — the device has no way to express a draft.
    OrderStatus.pending => 'confirmed',
    OrderStatus.inProgress => 'in_progress',
    OrderStatus.completed => 'ready',
    OrderStatus.delivered => 'delivered',
    OrderStatus.cancelled => 'cancelled',
  };

  /// Statuses this one may move to.
  ///
  /// Mirrors the server's state machine (`operations.service.ts`), which
  /// answers 409 on a violation. The device enforced nothing, so an order could
  /// be walked into a state the server would refuse — a rejection that only
  /// appeared at sync time, long after the atelier had moved on.
  Set<OrderStatus> get allowedTransitions => switch (this) {
    OrderStatus.pending => const {
      OrderStatus.inProgress,
      OrderStatus.cancelled,
    },
    OrderStatus.inProgress => const {
      OrderStatus.completed,
      OrderStatus.cancelled,
    },
    OrderStatus.completed => const {
      OrderStatus.delivered,
      OrderStatus.inProgress,
      OrderStatus.cancelled,
    },
    // Terminal.
    OrderStatus.delivered => const {},
    OrderStatus.cancelled => const {},
  };

  bool canMoveTo(OrderStatus next) => allowedTransitions.contains(next);
}

/// Reads a status off the wire.
///
/// Unknown values resolve to [OrderStatus.pending] rather than throwing: a
/// server that gains a status this build does not know should not make the
/// order unopenable on a device that cannot be updated today.
OrderStatus orderStatusFromWire(String? value) => switch (value) {
  'draft' => OrderStatus.pending,
  'confirmed' => OrderStatus.pending,
  'in_progress' => OrderStatus.inProgress,
  'ready' => OrderStatus.completed,
  'delivered' => OrderStatus.delivered,
  'cancelled' => OrderStatus.cancelled,
  _ => OrderStatus.pending,
};

/// Money crossing the API boundary.
///
/// The server is integer CFA everywhere (`cfa = z.number().int()`); local
/// models store `double`. The conversion used to be implicit, so a fractional
/// value was truncated by whichever side happened to serialise it. CFA has no
/// sub-unit, so rounding here is exact for every legitimate amount and the one
/// place a stray fraction becomes visible.
int toCfa(double amount) => amount.round();

double fromCfa(int amount) => amount.toDouble();

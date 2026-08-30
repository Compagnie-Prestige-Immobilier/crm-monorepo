import 'package:flutter/material.dart';
import 'package:isar_plus/isar_plus.dart';
import '../../shared/extensions/date_extensions.dart';
import '../../shared/theme/app_colors.dart';

part 'order_model.g.dart';

/// Represents a client order in the application
///
/// An order:
/// - Is associated with a client
/// - Contains one or more projects
/// - Tracks payment information
/// - Has delivery dates
/// - Maintains status
@collection
class OrderModel {
  int id = 0;

  // ===== Order Identification =====

  /// Auto-generated order number (format: "ORD-YYYYMMDD-XXX")
  late String orderNumber;

  /// Identifiant de la commande sur le serveur, une fois recopiée.
  ///
  /// Les commandes vivaient uniquement sur l'appareil. Depuis que les ateliers
  /// voient l'activité les uns des autres, chacune est recopiée côté serveur —
  /// au mieux : hors ligne elle reste locale, et ce champ dit si la copie a été
  /// faite, pour ne pas la faire deux fois.
  String? remoteId;

  /// Client ID (references ClientModel)
  @Index()
  int? clientId;

  // ===== Dates =====

  /// When the order was placed
  late DateTime orderDate;

  /// Expected delivery date
  DateTime? expectedDeliveryDate;

  /// Actual delivery date (set when order is delivered)
  DateTime? actualDeliveryDate;

  // ===== Financial Information =====

  /// Total amount for the order
  late double totalAmount;

  /// Deposit/acompte paid
  late double depositPaid;

  /// Remaining balance (computed: totalAmount - depositPaid)
  late double remainingBalance;

  /// Payment status
  late PaymentStatus paymentStatus;

  /// History of all payments made
  List<PaymentRecord> paymentHistory = [];

  // ===== Order Status =====

  /// Current status of the order
  late OrderStatus status;

  /// Whether this order is archived
  bool isArchived = false;

  // ===== Associated Projects =====

  /// IDs of projects included in this order
  List<int> projectIds = [];

  // ===== Notes =====

  /// Additional notes about the order
  String? notes;

  // ===== Tracking =====

  /// When this order was created in the system
  late DateTime createdAt;

  /// Last time this order was updated
  DateTime? updatedAt;

  // ===== Helper Methods =====

  /// Calculate remaining balance
  void calculateRemainingBalance() {
    remainingBalance = (totalAmount - depositPaid).clamp(0, double.infinity);
  }

  /// Update payment status based on amounts
  void updatePaymentStatus() {
    if (depositPaid <= 0) {
      paymentStatus = PaymentStatus.unpaid;
    } else if (depositPaid >= totalAmount) {
      paymentStatus = PaymentStatus.paid;
    } else {
      paymentStatus = PaymentStatus.partial;
    }
  }

  /// Record a payment
  void recordPayment(double amount) {
    depositPaid += amount;

    // Add to history
    paymentHistory.add(
      PaymentRecord()
        ..amount = amount
        ..paymentDate = DateTime.now()
        ..paymentMethod = 'Espèces', // Default
    );

    calculateRemainingBalance();
    updatePaymentStatus();
    updatedAt = DateTime.now();
  }

  /// Check if order is overdue
  bool get isOverdue {
    if (expectedDeliveryDate == null) return false;
    if (status == OrderStatus.delivered || status == OrderStatus.cancelled) {
      return false;
    }
    return expectedDeliveryDate!.isBeforeToday;
  }

  /// Get days until delivery (negative if overdue)
  int? get daysUntilDelivery => expectedDeliveryDate?.daysFromNow;

  /// Check if order is fully paid
  bool get isFullyPaid => paymentStatus == PaymentStatus.paid;

  /// Get payment progress percentage (0-100)
  double get paymentProgress {
    if (totalAmount <= 0) return 0.0;
    return (depositPaid / totalAmount) * 100;
  }

  /// Get number of projects in this order
  int get projectCount => projectIds.length;
}

/// Represents a single payment transaction
@embedded
class PaymentRecord {
  late double amount;
  late DateTime paymentDate;
  String? paymentMethod;
  String? notes;
  int? projectId; // Link to specific article if applicable
}

/// Payment status for an order
enum PaymentStatus {
  /// No payment received yet
  unpaid,

  /// Partial payment received (deposit)
  partial,

  /// Fully paid
  paid,
}

extension PaymentStatusExtension on PaymentStatus {
  String get label {
    switch (this) {
      case PaymentStatus.unpaid:
        return 'Non payé';
      case PaymentStatus.partial:
        return 'Acompte';
      case PaymentStatus.paid:
        return 'Soldé';
    }
  }

  Color get color {
    switch (this) {
      case PaymentStatus.unpaid:
        return AppColors.error;
      case PaymentStatus.partial:
        return AppColors.warning;
      case PaymentStatus.paid:
        return AppColors.success;
    }
  }

  IconData get icon {
    switch (this) {
      case PaymentStatus.unpaid:
        return Icons.money_off_rounded;
      case PaymentStatus.partial:
        return Icons.payments_outlined;
      case PaymentStatus.paid:
        return Icons.check_circle_outline_rounded;
    }
  }
}

/// Order status
enum OrderStatus {
  /// Order is pending (just created)
  pending,

  /// Order is being worked on (one or more projects in progress)
  inProgress,

  /// All projects completed, ready for delivery
  completed,

  /// Order has been delivered to client
  delivered,

  /// Order was cancelled
  cancelled,
}

extension OrderStatusExtension on OrderStatus {
  String get label {
    switch (this) {
      case OrderStatus.pending:
        return 'En attente';
      case OrderStatus.inProgress:
        return 'En cours';
      case OrderStatus.completed:
        return 'Terminé';
      case OrderStatus.delivered:
        return 'Livré';
      case OrderStatus.cancelled:
        return 'Annulé';
    }
  }

  Color get color {
    switch (this) {
      case OrderStatus.pending:
        return AppColors.statusTodo;
      case OrderStatus.inProgress:
        return AppColors.statusInProgress;
      case OrderStatus.completed:
        return AppColors.statusCompleted;
      case OrderStatus.delivered:
        return AppColors.statusDelivered;
      case OrderStatus.cancelled:
        return AppColors.error;
    }
  }

  IconData get icon {
    switch (this) {
      case OrderStatus.pending:
        return Icons.schedule_rounded;
      case OrderStatus.inProgress:
        return Icons.play_circle_outline_rounded;
      case OrderStatus.completed:
        return Icons.check_circle_outline_rounded;
      case OrderStatus.delivered:
        return Icons.verified_outlined;
      case OrderStatus.cancelled:
        return Icons.cancel_outlined;
    }
  }
}

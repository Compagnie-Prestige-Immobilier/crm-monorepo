import '../../../data/models/order_model.dart';
import '../../../data/models/project_model.dart';
import '../../../data/models/client_model.dart';

class DashboardOrderCardVM {
  final OrderModel order;
  final List<ProjectModel> articles;
  final ClientModel? payer;
  final List<String> beneficiaries;
  final double aggregateProgress;

  const DashboardOrderCardVM({
    required this.order,
    required this.articles,
    this.payer,
    required this.beneficiaries,
    required this.aggregateProgress,
  });

  bool get isOverdue => order.isOverdue;
  bool get isFullyPaid => order.remainingBalance <= 0;

  String get statusLabel {
    final completedCount = articles
        .where(
          (a) =>
              a.status == ProjectStatus.completed ||
              a.status == ProjectStatus.delivered,
        )
        .length;
    return '$completedCount/${articles.length} TERMINÉS';
  }
}

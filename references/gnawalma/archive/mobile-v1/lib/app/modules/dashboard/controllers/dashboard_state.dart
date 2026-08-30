import 'package:freezed_annotation/freezed_annotation.dart';
import '../../../data/models/project_model.dart';
import '../../../data/models/business_profile_model.dart';
import '../models/daily_transaction.dart';
import '../models/dashboard_order_card_vm.dart';

part 'dashboard_state.freezed.dart';

@freezed
abstract class DashboardState with _$DashboardState {
  const factory DashboardState({
    @Default([]) List<ProjectModel> waitingProjects,
    @Default([]) List<ProjectModel> readyProjects,
    @Default([]) List<ProjectModel> deliveredUnpaidProjects,

    // Order-centric Pivot
    @Default([]) List<DashboardOrderCardVM> waitingOrders,
    @Default([]) List<DashboardOrderCardVM> readyOrders,
    @Default([]) List<DashboardOrderCardVM> deliveredUnpaidOrders,

    BusinessProfileModel? businessProfile,
    @Default(0.0) double dailyCash,
    @Default([]) List<DailyTransaction> dailyTransactions,
    @Default(0) int pendingCount,
    @Default(true) bool isLoading,

    /// Set when the dashboard load failed. Without it a failed read renders as
    /// an empty atelier, which reads as data loss.
    @Default(false) bool hasError,
  }) = _DashboardState;
}

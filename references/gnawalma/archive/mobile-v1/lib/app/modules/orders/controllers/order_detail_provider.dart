import 'dart:async';
import 'package:riverpod_annotation/riverpod_annotation.dart';
import '../../../data/models/order_model.dart';
import '../../../data/models/client_model.dart';
import '../../../data/models/project_model.dart';
import '../../../data/repositories/order_repository.dart';
import '../../../data/repositories/client_repository.dart';
import '../../../data/repositories/project_repository.dart';
import '../../../data/services/order_service.dart';
import '../../../data/services/notification_service.dart';
import '../../../shared/services/feedback_service.dart';
import '../../../shared/utils/app_logger.dart';
import '../../../shared/utils/app_money.dart';
import 'order_detail_state.dart';

part 'order_detail_provider.g.dart';

@riverpod
class OrderDetail extends _$OrderDetail {
  StreamSubscription<OrderModel?>? _orderSubscription;
  StreamSubscription<ClientModel?>? _clientSubscription;
  StreamSubscription<List<ProjectModel>>? _projectsSubscription;

  @override
  OrderDetailState build(int orderId) {
    ref.onDispose(() {
      _orderSubscription?.cancel();
      _clientSubscription?.cancel();
      _projectsSubscription?.cancel();
    });

    Future.microtask(() => _watchOrder(orderId));
    return const OrderDetailState();
  }

  void _watchOrder(int orderId) {
    final repoAsync = ref.read(orderRepositoryProvider);

    repoAsync.when(
      data: (repo) {
        _orderSubscription = repo
            .watchOrder(orderId)
            .listen(
              (orderData) {
                final oldClientId = state.order?.clientId;
                state = state.copyWith(order: orderData, isLoading: false);
                if (orderData != null) {
                  if (orderData.clientId != null &&
                      orderData.clientId != oldClientId) {
                    _watchClient(orderData.clientId!);
                  }
                  _watchProjects(orderData.projectIds);
                }
              },
              onError: (e) {
                AppLogger.e('Error watching order', e);
                state = state.copyWith(isLoading: false);
              },
            );
      },
      loading: () {},
      error: (e, stack) {
        AppLogger.e('Error getting order repo', e, stack);
        state = state.copyWith(isLoading: false);
      },
    );
  }

  void _watchClient(int clientId) {
    _clientSubscription?.cancel();
    final repoAsync = ref.read(clientRepositoryProvider);

    repoAsync.when(
      data: (repo) {
        _clientSubscription = repo
            .watchClient(clientId)
            .listen(
              (clientData) => state = state.copyWith(client: clientData),
              onError: (e) => AppLogger.e('Error watching order client', e),
            );
      },
      loading: () {},
      error: (e, stack) => AppLogger.e('Error getting client repo', e, stack),
    );
  }

  void _watchProjects(List<int> projectIds) {
    _projectsSubscription?.cancel();
    if (projectIds.isEmpty) {
      state = state.copyWith(orderProjects: []);
      return;
    }

    final repoAsync = ref.read(projectRepositoryProvider);

    repoAsync.when(
      data: (repo) {
        _projectsSubscription = repo.watchProjects().listen((allProjects) {
          final related = allProjects
              .where((p) => projectIds.contains(p.id))
              .toList();
          state = state.copyWith(orderProjects: related);
        }, onError: (e) => AppLogger.e('Error watching order projects', e));
      },
      loading: () {},
      error: (e, stack) => AppLogger.e('Error getting project repo', e, stack),
    );
  }

  Future<void> _loadOrder(int orderId) async {
    // Handled by _watchOrder
  }

  Future<void> refresh() async {
    _watchOrder(orderId);
  }

  Future<void> recordPayment(
    double amount, {
    String? method,
    String? notes,
  }) async {
    if (state.order == null) return;

    try {
      final orderService = await ref.read(orderServiceProvider.future);
      await orderService.recordPayment(
        state.order!.id,
        amount,
        method: method,
        notes: notes,
      );

      // Reload state
      await _loadOrder(state.order!.id);

      // 5. Success feedback
      ref
          .read(feedbackServiceProvider.notifier)
          .showSuccess(
            'Paiement enregistré',
            'Le paiement de ${ref.read(moneyFormatterProvider).format(amount)} a été enregistré.',
          );
    } catch (e) {
      AppLogger.e('Error recording payment', e);
      ref
          .read(feedbackServiceProvider.notifier)
          .showError('Erreur lors de l\'enregistrement du paiement');
    }
  }

  Future<void> updateOrderStatus(OrderStatus newStatus) async {
    if (state.order == null) return;

    try {
      final orderService = await ref.read(orderServiceProvider.future);
      await orderService.updateOrderAndProjectsStatus(
        state.order!.id,
        newStatus,
      );
      await _loadOrder(state.order!.id);

      ref
          .read(feedbackServiceProvider.notifier)
          .showSuccess('Succès', 'Statut de la commande mis à jour');
    } catch (e) {
      AppLogger.e('Error updating order status', e);
      ref
          .read(feedbackServiceProvider.notifier)
          .showError('Erreur lors de la mise à jour');
    }
  }

  Future<bool> deleteOrder() async {
    if (state.order == null) return false;

    try {
      final orderService = await ref.read(orderServiceProvider.future);
      await orderService.deleteOrder(state.order!.id);

      // Cancel notification
      try {
        final notificationService = await ref.read(notificationProvider.future);
        await notificationService.cancelNotification(state.order!.id);
      } catch (e) {
        AppLogger.e('Error cancelling notification', e);
      }

      ref
          .read(feedbackServiceProvider.notifier)
          .showSuccess('Supprimé', 'Commande supprimée avec succès');
      return true;
    } catch (e) {
      ref
          .read(feedbackServiceProvider.notifier)
          .showError('Erreur lors de la suppression');
      return false;
    }
  }
}

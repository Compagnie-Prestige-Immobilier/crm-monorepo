import 'package:flutter/foundation.dart';
import 'dart:async';
import 'package:riverpod_annotation/riverpod_annotation.dart';
import '../../../routes/app_routes.dart';
import '../../../core/navigation/app_navigator.dart';
import '../../../data/models/project_model.dart';
import '../../../data/models/order_model.dart';
import '../../../data/services/project_service.dart';
import '../../../data/services/business_profile_service.dart';
import '../../../data/services/client_service.dart';
import '../../../data/services/order_service.dart';
import '../../../data/repositories/order_repository.dart';
import '../../../data/repositories/project_repository.dart';
import '../../../shared/utils/app_dialogs.dart';
import '../../../shared/utils/app_logger.dart';
import '../../../shared/services/feedback_service.dart';
import '../models/daily_transaction.dart';
import '../models/dashboard_order_card_vm.dart';
import 'dashboard_state.dart';

part 'dashboard_provider.g.dart';

@riverpod
class Dashboard extends _$Dashboard {
  StreamSubscription<List<ProjectModel>>? _projectSubscription;
  StreamSubscription<List<OrderModel>>? _orderSubscription;

  @override
  DashboardState build() {
    if (kDebugMode) {
      debugPrint('🏗️ Dashboard.build()');
    }

    ref.onDispose(() {
      _projectSubscription?.cancel();
      _orderSubscription?.cancel();
    });

    // Watch for project changes
    final projectsAsync = ref.watch(projectRepositoryProvider);
    if (projectsAsync.hasValue) {
      final repository = projectsAsync.value!;
      // Set up watcher for real-time updates
      _setupProjectWatcher(repository);
    }

    // Watch for order changes
    final ordersAsync = ref.watch(orderRepositoryProvider);
    if (ordersAsync.hasValue) {
      final repository = ordersAsync.value!;
      _setupOrderWatcher(repository);
    }

    // Trigger initial data load
    Future.microtask(() => loadDashboardData());

    return const DashboardState();
  }

  void _setupProjectWatcher(dynamic repository) {
    _projectSubscription?.cancel();
    _projectSubscription = repository.watchProjects().listen(
      (projects) {
        _updateQueueData(projects);
      },
      onError: (e, stackTrace) {
        AppLogger.e('Error watching projects', e, stackTrace);
        ref
            .read(feedbackServiceProvider.notifier)
            .showError('Erreur de connexion aux données');
      },
    );
  }

  void _setupOrderWatcher(dynamic repository) {
    _orderSubscription?.cancel();
    _orderSubscription = repository.watchOrders().listen(
      (orders) {
        _updateDailyCash(orders);
      },
      onError: (e, stackTrace) {
        AppLogger.e('Error watching orders', e, stackTrace);
      },
    );
  }

  /// Calculate daily cash from list of orders
  /// FIXED: Proper day boundaries, N+1 optimization, cancelled order handling
  Future<({double total, List<DailyTransaction> transactions})>
  _calculateDailyCash(
    List<OrderModel> orders,
    ClientService clientService,
  ) async {
    final now = DateTime.now();
    final startOfDay = DateTime(now.year, now.month, now.day);
    // FIX #1: Use next day's midnight instead of 23:59:59
    // This includes payments up to 23:59:59.999
    final endOfDay = startOfDay.add(const Duration(days: 1));

    if (kDebugMode) {
      debugPrint('🔍 [DAILY CASH DEBUG] Calculating daily cash');
      debugPrint('📅 Today range: $startOfDay -> $endOfDay');
      debugPrint('📦 Total orders to check: ${orders.length}');
    }

    double total = 0.0;
    List<DailyTransaction> transactions = [];

    // FIX #3: Load all clients once (N+1 optimization)
    final allClients = await clientService.getAllClients();
    final clientMap = {for (var c in allClients) c.id: c};

    int ordersWithPayments = 0;
    int totalPaymentsChecked = 0;
    int paymentsMatchingToday = 0;

    for (var order in orders) {
      // FIX #5: Skip cancelled orders
      if (order.status == OrderStatus.cancelled) continue;

      if (order.paymentHistory.isNotEmpty) {
        ordersWithPayments++;
        if (kDebugMode) {
          debugPrint(
            '  📋 Order ${order.orderNumber}: ${order.paymentHistory.length} payments',
          );
        }
      }

      // O(1) lookup instead of DB query per order
      final client = order.clientId != null ? clientMap[order.clientId!] : null;
      final clientName = client?.displayName ?? 'Client inconnu';

      for (var payment in order.paymentHistory) {
        totalPaymentsChecked++;
        final paymentDate = payment.paymentDate;

        if (kDebugMode) {
          debugPrint('    💰 Payment: ${payment.amount}F at $paymentDate');
        }

        // FIX #1: Include payments at 00:00:00 and up to 23:59:59.999
        // !isBefore(startOfDay) means >= startOfDay (includes exact midnight)
        // isBefore(endOfDay) means < nextDay midnight (includes all of today)
        if (!paymentDate.isBefore(startOfDay) &&
            paymentDate.isBefore(endOfDay)) {
          paymentsMatchingToday++;
          total += payment.amount;

          if (kDebugMode) {
            debugPrint('    ✅ MATCHED! Adding ${payment.amount}F to total');
          }

          transactions.add(
            DailyTransaction(
              clientName: clientName,
              amount: payment.amount,
              time: paymentDate,
              orderId: order.id.toString(),
            ),
          );
        } else {
          if (kDebugMode) {
            debugPrint('    ❌ NOT TODAY: Payment date outside range');
          }
        }
      }
    }

    if (kDebugMode) {
      debugPrint('📊 [DAILY CASH SUMMARY]');
      debugPrint('  Orders with payments: $ordersWithPayments');
      debugPrint('  Total payments checked: $totalPaymentsChecked');
      debugPrint('  Payments matching today: $paymentsMatchingToday');
      debugPrint('  💵 TOTAL DAILY CASH: ${total}F');
      debugPrint('  📝 Transactions: ${transactions.length}');
    }

    // Sort by time (newest first)
    transactions.sort((a, b) => b.time.compareTo(a.time));

    return (total: total, transactions: transactions);
  }

  Future<List<DashboardOrderCardVM>> _mapToOrderVMs(
    List<OrderModel> orders,
    List<ProjectModel> allProjects,
    Map<int, dynamic> clientMap,
  ) async {
    final vms = <DashboardOrderCardVM>[];

    for (var order in orders) {
      final relatedProjects = allProjects
          .where((p) => p.orderId == order.id)
          .toList();
      if (relatedProjects.isEmpty) continue;

      final client = order.clientId != null ? clientMap[order.clientId!] : null;
      final beneficiaries = relatedProjects
          .map((p) => p.forWhom ?? 'Cliente')
          .toSet()
          .toList();

      // Aggregate progress
      double totalProgress = 0;
      for (var p in relatedProjects) {
        totalProgress += p.progressPercentage;
      }
      final aggregateProgress = relatedProjects.isEmpty
          ? 0.0
          : totalProgress / relatedProjects.length;

      vms.add(
        DashboardOrderCardVM(
          order: order,
          articles: relatedProjects,
          payer: client,
          beneficiaries: beneficiaries,
          aggregateProgress: aggregateProgress,
        ),
      );
    }

    return vms;
  }

  void _updateQueueData(List<dynamic> allProjects) async {
    await loadQueueData();
  }

  /// Update daily cash in real-time from watcher
  /// FIX #2: Use shared calculation method (no duplication)
  /// FIX #4: Proper error logging
  void _updateDailyCash(List<dynamic> orders) async {
    if (kDebugMode) {
      debugPrint(
        '🔔 [WATCHER] _updateDailyCash triggered with ${orders.length} orders',
      );
    }

    try {
      final clientService = await ref.read(clientServiceProvider.future);
      final result = await _calculateDailyCash(
        orders.cast<OrderModel>(),
        clientService,
      );

      if (kDebugMode) {
        debugPrint('💾 Updating state with dailyCash: ${result.total}F');
      }

      state = state.copyWith(
        dailyCash: result.total,
        dailyTransactions: result.transactions,
      );

      if (kDebugMode) {
        debugPrint('✅ State updated! Current dailyCash: ${state.dailyCash}F');
      }
    } catch (e, stackTrace) {
      // FIX #4: Log errors properly instead of silent failure
      AppLogger.e('Erreur mise à jour caisse du jour', e, stackTrace);
      if (kDebugMode) {
        debugPrint('❌ ERROR in _updateDailyCash: $e');
      }
      state = state.copyWith(dailyCash: 0.0, dailyTransactions: []);
    }
  }

  Future<void> loadDashboardData() async {
    if (kDebugMode) {
      debugPrint('🔄 Dashboard.loadDashboardData() started');
    }
    state = state.copyWith(isLoading: true, hasError: false);
    try {
      final orderRepo = await ref.read(orderRepositoryProvider.future);
      await orderRepo.archiveOldOrders(); // Auto-archive task

      await Future.wait([
        loadQueueData(),
        loadDailyCash(),
        loadBusinessProfile(),
      ]);
      if (kDebugMode) {
        debugPrint('✅ Dashboard.loadDashboardData() completed successfully');
      }
    } catch (e) {
      if (kDebugMode) {
        debugPrint('❌ Dashboard.loadDashboardData() failed: $e');
      }
      state = state.copyWith(hasError: true);
      ref
          .read(feedbackServiceProvider.notifier)
          .showError('Impossible de charger les données de l’atelier.');
    } finally {
      state = state.copyWith(isLoading: false);
    }
  }

  Future<void> loadQueueData() async {
    try {
      final projectRepo = await ref.read(projectRepositoryProvider.future);
      final orderRepo = await ref.read(orderRepositoryProvider.future);
      final clientService = await ref.read(clientServiceProvider.future);

      // 1. Fetch only active dashboard orders
      final activeOrders = await orderRepo.getActiveDashboardOrders();
      final activeOrderIds = activeOrders.map((o) => o.id).toList();

      // 2. Fetch only projects related to these orders
      final relevantProjects = await projectRepo.getProjectsForOrders(
        activeOrderIds,
      );

      // 3. Load all clients (still needed for payer name, but we could optimize this later if needed)
      final allClients = await clientService.getAllClients();
      final clientMap = {for (var c in allClients) c.id: c};

      final allVMs = await _mapToOrderVMs(
        activeOrders,
        relevantProjects,
        clientMap,
      );

      final waiting = allVMs.where((vm) {
        return vm.order.status == OrderStatus.pending ||
            vm.order.status == OrderStatus.inProgress;
      }).toList();

      final ready = allVMs.where((vm) {
        return vm.order.status == OrderStatus.completed;
      }).toList();

      final deliveredUnpaid = allVMs.where((vm) {
        return vm.order.status == OrderStatus.delivered &&
            vm.order.remainingBalance > 0;
      }).toList();

      state = state.copyWith(
        waitingOrders: waiting,
        readyOrders: ready,
        deliveredUnpaidOrders: deliveredUnpaid,
        pendingCount: waiting.length,
        // Update compatibility fields with the filtered data
        waitingProjects: relevantProjects
            .where(
              (p) =>
                  p.status == ProjectStatus.todo ||
                  p.status == ProjectStatus.inProgress,
            )
            .toList(),
        readyProjects: relevantProjects
            .where((p) => p.status == ProjectStatus.completed)
            .toList(),
        deliveredUnpaidProjects: relevantProjects
            .where(
              (p) =>
                  p.status == ProjectStatus.delivered && p.remainingAmount > 0,
            )
            .toList(),
      );
    } catch (e, stackTrace) {
      AppLogger.e('Erreur chargement commandes', e, stackTrace);
      ref
          .read(feedbackServiceProvider.notifier)
          .showError('Erreur lors du chargement des commandes');
    }
  }

  /// Load daily cash on initial dashboard load
  /// FIX #2: Use shared calculation method (no duplication)
  /// FIX #4: Proper error handling with user feedback
  Future<void> loadDailyCash() async {
    if (kDebugMode) {
      debugPrint('📥 [INITIAL LOAD] loadDailyCash called');
    }

    try {
      final orderRepo = await ref.read(orderRepositoryProvider.future);
      final clientService = await ref.read(clientServiceProvider.future);
      final orders = await orderRepo.getAllOrders();

      if (kDebugMode) {
        debugPrint('📦 Loaded ${orders.length} orders from repository');
      }

      final result = await _calculateDailyCash(orders, clientService);

      state = state.copyWith(
        dailyCash: result.total,
        dailyTransactions: result.transactions,
      );

      if (kDebugMode) {
        debugPrint('✅ Initial load complete! dailyCash: ${state.dailyCash}F');
      }
    } catch (e, stackTrace) {
      AppLogger.e('Erreur chargement caisse du jour', e, stackTrace);
      if (kDebugMode) {
        debugPrint('❌ ERROR in loadDailyCash: $e');
      }
      state = state.copyWith(dailyCash: 0.0, dailyTransactions: []);
      ref
          .read(feedbackServiceProvider.notifier)
          .showError('Erreur lors du chargement de la caisse du jour');
    }
  }

  Future<void> loadBusinessProfile() async {
    try {
      final profileService = await ref.read(businessProfileProvider.future);
      final profile = await profileService.getProfile();
      state = state.copyWith(businessProfile: profile);
    } catch (e) {
      ref
          .read(feedbackServiceProvider.notifier)
          .showError('Error loading business profile: $e');
    }
  }

  void navigateToOrderDetails(OrderModel order) {
    AppNavigator.to('${AppRoutes.orderDetail}/${order.id}');
  }

  void navigateToEditOrder(OrderModel order) async {
    final result = await AppNavigator.to(
      AppRoutes.addEditOrder,
      arguments: order,
    );
    if (result != null) {
      loadDashboardData();
    }
  }

  Future<void> updateOrderStatus(int orderId, OrderStatus newStatus) async {
    try {
      final orderService = await ref.read(orderServiceProvider.future);
      await orderService.updateOrderAndProjectsStatus(orderId, newStatus);
      await loadQueueData();

      ref
          .read(feedbackServiceProvider.notifier)
          .showSuccess(
            'Commande mise à jour',
            'Le statut de production a été changé.',
          );
    } catch (e) {
      ref
          .read(feedbackServiceProvider.notifier)
          .showError('Erreur lors de la mise à jour: $e');
    }
  }

  void handleOrderInvoice(OrderModel order) {
    AppNavigator.to('${AppRoutes.orderDetail}/${order.id}');
  }

  void navigateToProjectDetails(ProjectModel project) {
    AppNavigator.to('${AppRoutes.projectDetail}/${project.id}');
  }

  void navigateToAddProject() async {
    final result = await AppNavigator.to(AppRoutes.newOrder);
    if (result != null) {
      loadDashboardData();
    }
  }

  void navigateToEditProject(ProjectModel project) async {
    final result = await AppNavigator.to(
      AppRoutes.addEditProject,
      arguments: project,
    );
    if (result != null) {
      loadDashboardData();
    }
  }

  Future<void> deleteOrder(int id) async {
    try {
      final orderService = await ref.read(orderServiceProvider.future);
      await orderService.deleteOrder(id);
      await loadQueueData();
      ref
          .read(feedbackServiceProvider.notifier)
          .showSuccess(
            'Commande supprimée',
            'La commande et ses articles ont été supprimés',
          );
    } catch (e) {
      ref
          .read(feedbackServiceProvider.notifier)
          .showError('Erreur lors de la suppression');
    }
  }

  Future<void> deleteProject(int id) async {
    final project =
        state.waitingProjects.where((p) => p.id == id).firstOrNull ??
        state.readyProjects.where((p) => p.id == id).firstOrNull;

    if (project?.status == ProjectStatus.delivered) {
      ref
          .read(feedbackServiceProvider.notifier)
          .showWarning('Impossible de supprimer une commande livrée');
      return;
    }

    final projectName = project?.name ?? 'cette commande';

    AppDialogs.showConfirmDialog(
      title: 'Supprimer la commande',
      message:
          'Êtes-vous sûr de vouloir supprimer "$projectName" ? Cette action est irréversible.',
      confirmText: 'Supprimer',
      cancelText: 'Annuler',
      isDangerous: true,
      onConfirm: () async {
        try {
          final projectService = await ref.read(projectServiceProvider.future);
          await projectService.deleteProject(id);
          await loadQueueData();
          ref
              .read(feedbackServiceProvider.notifier)
              .showSuccess(
                'Commande supprimée',
                'La commande a été supprimée avec succès',
              );
        } catch (e) {
          ref
              .read(feedbackServiceProvider.notifier)
              .showError('Erreur lors de la suppression: $e');
        }
      },
    );
  }

  Future<void> updateProjectStatus(int id, ProjectStatus newStatus) async {
    try {
      final projectService = await ref.read(projectServiceProvider.future);
      await projectService.updateStatus(id, newStatus);

      // CRITICAL FIX: Sync order status when project status changes
      final orderService = await ref.read(orderServiceProvider.future);
      await orderService.syncOrderStatusFromProject(id);

      await loadQueueData();

      // TRIGGER BUBBLE SUCCESS
      ref
          .read(feedbackServiceProvider.notifier)
          .showSuccess(newStatus.label, 'Le statut a été mis à jour.');
    } catch (e) {
      ref
          .read(feedbackServiceProvider.notifier)
          .showError('Erreur lors de la mise à jour du statut: $e');
    }
  }

  void handleInvoice(ProjectModel project) {
    AppNavigator.to('${AppRoutes.projectDetail}/${project.id}');
  }
}

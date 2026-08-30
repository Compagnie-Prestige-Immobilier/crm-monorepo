import '../../../shared/utils/app_numbers.dart';
import 'package:flutter/material.dart';
import 'package:riverpod_annotation/riverpod_annotation.dart';
import '../../../data/models/order_model.dart';
import '../../../data/models/client_model.dart';
import '../../../data/models/project_model.dart';
import '../../../data/repositories/order_repository.dart';
import '../../../data/repositories/client_repository.dart';
import '../../../data/repositories/project_repository.dart';
import '../../../data/services/order_service.dart';
import '../../../shared/services/feedback_service.dart';
import 'add_edit_order_state.dart';

part 'add_edit_order_provider.g.dart';

@riverpod
class AddEditOrder extends _$AddEditOrder {
  late final TextEditingController orderNumberController;
  late final TextEditingController totalAmountController;
  late final TextEditingController depositPaidController;
  late final TextEditingController notesController;
  final formKey = GlobalKey<FormState>();
  @override
  int? orderId;

  @override
  AddEditOrderState build({OrderModel? existingOrder, int? orderId}) {
    orderNumberController = TextEditingController();
    totalAmountController = TextEditingController();
    depositPaidController = TextEditingController();
    notesController = TextEditingController();

    ref.onDispose(() {
      orderNumberController.dispose();
      totalAmountController.dispose();
      depositPaidController.dispose();
      notesController.dispose();
    });

    Future.microtask(() => _loadAvailableData());

    // Check if editing existing order
    if (existingOrder != null) {
      this.orderId = existingOrder.id;
      _populateFormWithExistingData(existingOrder);
      return AddEditOrderState(
        isEditMode: true,
        existingOrder: existingOrder,
        orderDate: existingOrder.orderDate,
        expectedDeliveryDate: existingOrder.expectedDeliveryDate,
      );
    } else if (orderId != null) {
      this.orderId = orderId;
      Future.microtask(() => _loadOrder(orderId));
      return const AddEditOrderState(isEditMode: true);
    }

    _generateOrderNumber();
    return AddEditOrderState(orderDate: DateTime.now());
  }

  Future<void> _loadOrder(int orderId) async {
    state = state.copyWith(isLoading: true);
    try {
      final repository = await ref.read(orderRepositoryProvider.future);
      final order = await repository.getOrderById(orderId);
      if (order != null) {
        _populateFormWithExistingData(order);
        state = state.copyWith(
          existingOrder: order,
          isLoading: false,
          orderDate: order.orderDate,
          expectedDeliveryDate: order.expectedDeliveryDate,
        );
      }
    } finally {
      state = state.copyWith(isLoading: false);
    }
  }

  void _populateFormWithExistingData(OrderModel order) {
    orderNumberController.text = order.orderNumber;
    totalAmountController.text = order.totalAmount.toString();
    depositPaidController.text = order.depositPaid.toString();
    notesController.text = order.notes ?? '';

    // Load client
    if (order.clientId != null) {
      _loadClientById(order.clientId!);
    }

    // Load associated projects
    _loadOrderProjects(order.id);
  }

  Future<void> _loadClientById(int clientId) async {
    try {
      final repo = await ref.read(clientRepositoryProvider.future);
      final client = await repo.getClientById(clientId);
      state = state.copyWith(selectedClient: client);
    } catch (e) {
      ref
          .read(feedbackServiceProvider.notifier)
          .showError('Impossible de charger le client');
    }
  }

  Future<void> _loadOrderProjects(int orderId) async {
    try {
      final orderRepo = await ref.read(orderRepositoryProvider.future);
      final projectRepo = await ref.read(projectRepositoryProvider.future);

      final order = await orderRepo.getOrderById(orderId);
      if (order != null && order.projectIds.isNotEmpty) {
        final allProjects = await projectRepo.getAllProjects();
        final selectedProjects = allProjects
            .where((p) => order.projectIds.contains(p.id))
            .toList();
        state = state.copyWith(selectedProjects: selectedProjects);
      }
    } catch (e) {
      ref
          .read(feedbackServiceProvider.notifier)
          .showError('Impossible de charger les projets');
    }
  }

  Future<void> _loadAvailableData() async {
    try {
      final clientRepo = await ref.read(clientRepositoryProvider.future);
      final projectRepo = await ref.read(projectRepositoryProvider.future);

      final clients = await clientRepo.getAllClients();
      final projects = await projectRepo.getAllProjects();

      state = state.copyWith(
        availableClients: clients,
        availableProjects: projects,
      );
    } catch (e) {
      ref
          .read(feedbackServiceProvider.notifier)
          .showError('Erreur chargement des données');
    }
  }

  void _generateOrderNumber() {
    final now = DateTime.now();
    final orderNumber =
        'CMD-${now.year}${now.month.toString().padLeft(2, '0')}${now.day.toString().padLeft(2, '0')}-${now.millisecondsSinceEpoch % 10000}';
    orderNumberController.text = orderNumber;
  }

  void selectClient(ClientModel? client) {
    state = state.copyWith(selectedClient: client);
  }

  void toggleProjectSelection(ProjectModel project) {
    final selected = [...state.selectedProjects];
    if (selected.contains(project)) {
      selected.remove(project);
    } else {
      selected.add(project);
    }
    state = state.copyWith(selectedProjects: selected);
  }

  void setOrderDate(DateTime date) {
    state = state.copyWith(orderDate: date);
  }

  void setExpectedDeliveryDate(DateTime date) {
    state = state.copyWith(expectedDeliveryDate: date);
  }

  Future<bool> saveOrder() async {
    if (!formKey.currentState!.validate()) {
      ref
          .read(feedbackServiceProvider.notifier)
          .showError('Veuillez corriger les erreurs');
      return false;
    }

    if (state.selectedClient == null) {
      ref
          .read(feedbackServiceProvider.notifier)
          .showError('Veuillez sélectionner un client');
      return false;
    }

    state = state.copyWith(isSaving: true);
    try {
      final totalAmount = AppNumbers.tryParse(totalAmountController.text) ?? 0;
      final depositPaid = AppNumbers.tryParse(depositPaidController.text) ?? 0;

      final order = OrderModel()
        ..id = orderId ?? 0
        ..orderNumber = orderNumberController.text
        ..clientId = state.selectedClient!.id
        ..totalAmount = totalAmount
        ..depositPaid = depositPaid
        ..remainingBalance = totalAmount - depositPaid
        ..status = state.existingOrder?.status ?? OrderStatus.pending
        ..orderDate = state.orderDate ?? DateTime.now()
        ..expectedDeliveryDate = state.expectedDeliveryDate
        ..projectIds = state.selectedProjects.map((p) => p.id).toList()
        ..notes = notesController.text.isEmpty ? null : notesController.text
        ..createdAt = state.existingOrder?.createdAt ?? DateTime.now()
        ..updatedAt = DateTime.now();

      // Update payment status based on amounts
      order.updatePaymentStatus();

      final orderService = await ref.read(orderServiceProvider.future);

      if (state.isEditMode && orderId != null) {
        await orderService.updateOrder(order);
        ref
            .read(feedbackServiceProvider.notifier)
            .showSuccess('Succès', 'Commande mise à jour avec succès');
      } else {
        await orderService.createOrder(order);
        ref
            .read(feedbackServiceProvider.notifier)
            .showSuccess('Succès', 'Commande créée avec succès');
      }
      return true;
    } catch (e) {
      ref
          .read(feedbackServiceProvider.notifier)
          .showError('Erreur lors de l\'enregistrement: $e');
      return false;
    } finally {
      state = state.copyWith(isSaving: false);
    }
  }

  String? validateRequired(String? value) {
    if (value == null || value.isEmpty) {
      return 'Ce champ est requis';
    }
    return null;
  }

  String? validateAmount(String? value) {
    if (value == null || value.isEmpty) {
      return 'Ce champ est requis';
    }
    if (AppNumbers.tryParse(value) == null) {
      return 'Montant invalide';
    }
    if (double.parse(value) < 0) {
      return 'Le montant doit être positif';
    }
    return null;
  }

  String? validateDeposit(String? value) {
    final amount = validateAmount(value);
    if (amount != null) return amount;

    final total = AppNumbers.tryParse(totalAmountController.text) ?? 0;
    final deposit = double.parse(value!);

    if (deposit > total) {
      return 'L\'acompte ne peut pas dépasser le montant total';
    }
    return null;
  }
}

import 'dart:async';
import 'dart:convert';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:image_picker/image_picker.dart';
import 'package:riverpod_annotation/riverpod_annotation.dart';
import '../../../data/models/client_model.dart';
import '../../../data/models/project_model.dart';
import '../../../data/models/order_model.dart';
import '../../../data/models/beneficiary_model.dart';
import '../../../data/repositories/client_repository.dart';
import '../../../data/repositories/order_repository.dart';
import '../../../data/repositories/project_repository.dart';
import '../../../data/repositories/beneficiary_repository.dart';
import '../../../data/services/image_service.dart';
import '../../../data/services/notification_service.dart';
import '../../../data/services/order_service.dart';
import '../../../shared/constants/unified_measurements.dart';
import '../../../shared/services/feedback_service.dart';
import '../../../shared/utils/app_logger.dart';
import '../../../shared/utils/app_dialogs.dart';
import '../../operations/controllers/operations_providers.dart';
import '../../../core/sync/sync_providers.dart';
import '../../preferences/controllers/preferences_provider.dart';
import 'new_order_state.dart';

part 'new_order_provider.g.dart';

@riverpod
class NewOrder extends _$NewOrder {
  final ImagePicker _picker = ImagePicker();
  late final TextEditingController garmentTypeController;
  late final TextEditingController priceController;
  late final TextEditingController measurementNotesController;

  @override
  NewOrderState build() {
    garmentTypeController = TextEditingController();
    priceController = TextEditingController();
    measurementNotesController = TextEditingController();

    ref.onDispose(() {
      garmentTypeController.dispose();
      priceController.dispose();
      measurementNotesController.dispose();
    });

    Future.microtask(_loadRecentClients);
    return const NewOrderState();
  }

  void init(ClientModel? initialClient) {
    if (initialClient != null) {
      selectClient(initialClient);
      // Skip to articles step if client is pre-selected
      state = state.copyWith(currentStep: 1);
    }
  }

  void reset() {
    _resetItemBuilder();
    state = const NewOrderState();
  }

  Future<void> _loadRecentClients() async {
    try {
      final repo = await ref.read(clientRepositoryProvider.future);
      final clients = await repo.getClientsSortedByLastOrder();
      state = state.copyWith(recentClients: clients);
    } catch (e) {
      AppLogger.e('Error loading recent clients', e);
    }
  }

  // ===== Step 1: Client Logic =====
  void onSearchQueryChanged(String query) async {
    state = state.copyWith(searchQuery: query);
    if (query.isEmpty) {
      state = state.copyWith(isSearching: false, searchResults: []);
      return;
    }

    state = state.copyWith(isSearching: true);
    try {
      final repo = await ref.read(clientRepositoryProvider.future);
      final results = await repo.searchClients(query);
      state = state.copyWith(searchResults: results, isSearching: false);
    } catch (e) {
      AppLogger.e('Error searching clients', e);
      state = state.copyWith(isSearching: false);
    }
  }

  Future<void> selectClient(ClientModel client) async {
    state = state.copyWith(selectedClient: client);
    try {
      final repo = await ref.read(beneficiaryRepositoryProvider.future);
      final beneficiaries = await repo.getBeneficiariesForClient(client.id);
      state = state.copyWith(clientBeneficiaries: beneficiaries);
    } catch (e) {
      AppLogger.e('Error loading beneficiaries', e);
    }
  }

  Future<void> quickCreateClient(ClientModel client) async {
    try {
      // Client is already created in QuickAddClientSheet, just select it
      await selectClient(client);
      nextStep();
    } catch (e) {
      AppLogger.e('Error selecting quick client', e);
      ref
          .read(feedbackServiceProvider.notifier)
          .showError('Erreur lors de la sélection du client');
    }
  }

  void setForWhom(String label, BeneficiaryModel? beneficiary) {
    state = state.copyWith(
      selectedForWhom: label,
      selectedBeneficiary: beneficiary,
    );

    // Load measurements if available
    if (beneficiary != null && beneficiary.hasMeasurements) {
      state = state.copyWith(itemMeasurements: beneficiary.measurementsMap);
    } else {
      final client = state.selectedClient;
      final latestMeasurement = client?.latestMeasurement;
      if (latestMeasurement != null) {
        state = state.copyWith(
          itemMeasurements: latestMeasurement.standardMeasurements,
        );
      } else {
        // Explicitly reset to empty map to avoid 'stale' measurements from previous beneficiary
        state = state.copyWith(itemMeasurements: {});
      }
    }
  }

  // ===== Step 2: Item Logic =====
  void setGarmentType(String type) {
    state = state.copyWith(garmentType: type);
    garmentTypeController.text = type;
  }

  void setItemPrice(double price) {
    state = state.copyWith(itemPrice: price);
    priceController.text = price.toStringAsFixed(0);
  }

  void setFabricNote(String note) {
    state = state.copyWith(fabricNote: note);
  }

  void setAudioNotePath(String? path) {
    state = state.copyWith(audioNotePath: path);
  }

  void addMeasurement(String key, double value) {
    state = state.copyWith(
      itemMeasurements: {...state.itemMeasurements, key: value},
    );
  }

  void setMeasurementNotes(String notes) {
    state = state.copyWith(measurementNotes: notes);
  }

  Future<void> pickFabricPhoto(ImageSource source) async {
    try {
      final XFile? image = await _picker.pickImage(
        source: source,
        maxWidth: 1024,
        maxHeight: 1024,
        imageQuality: 70,
      );
      if (image != null) {
        final savedPath = await ImageService().saveImage(image.path);
        state = state.copyWith(fabricPhoto: savedPath);
      }
    } catch (e) {
      ref
          .read(feedbackServiceProvider.notifier)
          .showError('Impossible de sélectionner l\'image');
    }
  }

  Future<void> pickModelPhoto(ImageSource source) async {
    try {
      final XFile? image = await _picker.pickImage(
        source: source,
        maxWidth: 1024,
        maxHeight: 1024,
        imageQuality: 70,
      );
      if (image != null) {
        final savedPath = await ImageService().saveImage(image.path);
        state = state.copyWith(itemPhotos: [...state.itemPhotos, savedPath]);
      }
    } catch (e) {
      ref
          .read(feedbackServiceProvider.notifier)
          .showError('Impossible de sélectionner l\'image');
    }
  }

  void removeModelPhoto(int index) {
    final photos = [...state.itemPhotos]..removeAt(index);
    state = state.copyWith(itemPhotos: photos);
  }

  void removeFabricPhoto() {
    state = state.copyWith(fabricPhoto: null);
  }

  void addItemToCart() {
    // INLINE VALIDATION
    final errors = <String, String?>{};
    if (state.garmentType.isEmpty) {
      errors['garmentType'] = 'Type de vêtement requis';
    }
    if (state.itemPrice <= 0) {
      errors['itemPrice'] = 'Prix requis';
    }
    if (errors.isNotEmpty) {
      state = state.copyWith(itemErrors: errors);
      HapticFeedback.heavyImpact();
      return;
    }

    // --- MEASUREMENT RANGE VALIDATION ---
    for (final field in UnifiedMeasurements.fields) {
      final val = state.itemMeasurements[field.key];
      if (val != null && val > 0 && (val < field.min || val > field.max)) {
        ref
            .read(feedbackServiceProvider.notifier)
            .showError(
              '${field.labelFr} hors limite [${field.min}-${field.max}]',
            );
        return;
      }
    }

    // Reset errors if valid
    state = state.copyWith(itemErrors: {});

    final client = state.selectedClient;
    if (client == null) return;

    final project = ProjectModel()
      ..clientId = client.id
      ..beneficiaryId = state.selectedBeneficiary?.id
      ..forWhom = state.selectedForWhom
      ..name = state.garmentType
      ..garmentType = state.garmentType
      ..photoUrls = List.from(state.itemPhotos)
      ..fabricPhotoUrl = state.fabricPhoto
      ..description = state.fabricNote
      ..audioNotePath = state.audioNotePath
      ..estimatedPrice = state.itemPrice
      ..status = ProjectStatus.todo
      ..createdAt = DateTime.now()
      ..measurementsSnapshot = jsonEncode(state.itemMeasurements)
      ..measurementNotes = state.measurementNotes.trim().isEmpty
          ? null
          : state.measurementNotes.trim();

    state = state.copyWith(cartItems: [...state.cartItems, project]);

    // TRIGGER BUBBLE SUCCESS
    ref
        .read(feedbackServiceProvider.notifier)
        .showSuccess('Ajouté !', '${state.garmentType} mis au panier.');

    HapticFeedback.mediumImpact();
    _resetItemBuilder();
  }

  void _resetItemBuilder() {
    state = state.copyWith(
      garmentType: '',
      itemMeasurements: {},
      measurementNotes: '',
      itemPrice: 0.0,
      itemPhotos: [],
      fabricPhoto: null,
      fabricNote: '',
      audioNotePath: null,
      itemErrors: {}, // Reset errors
    );
    garmentTypeController.clear();
    priceController.clear();
    measurementNotesController.clear();
  }

  void removeItem(int index) {
    final items = [...state.cartItems]..removeAt(index);
    state = state.copyWith(cartItems: items);
  }

  void loadItemForEdit(int index) {
    final item = state.cartItems[index];

    // Find beneficiary if applicable
    BeneficiaryModel? beneficiary;
    if (item.beneficiaryId != null) {
      beneficiary = state.clientBeneficiaries.firstWhere(
        (b) => b.id == item.beneficiaryId,
        orElse: () => BeneficiaryModel(),
      );
    }

    // Restore measurements from snapshot
    Map<String, double> measurements = {};
    final snapshot = item.measurementsSnapshot;
    if (snapshot != null && snapshot.isNotEmpty) {
      try {
        final decoded = jsonDecode(snapshot);
        if (decoded is Map) {
          measurements = Map<String, double>.from(
            decoded.map(
              (key, value) =>
                  MapEntry(key.toString(), (value as num).toDouble()),
            ),
          );
        }
      } catch (e) {
        AppLogger.e('Error decoding measurements', e);
      }
    }

    // Populate form with item data
    final selfLabel = state.selectedClient?.firstName ?? 'Cliente';

    // REFRESH: If beneficiary has new measurements, prioritize those
    Map<String, double> finalMeasurements = measurements;
    if (beneficiary != null && beneficiary.hasMeasurements) {
      finalMeasurements = beneficiary.measurementsMap;
    } else if (item.beneficiaryId == null &&
        state.selectedClient?.latestMeasurement != null) {
      finalMeasurements =
          state.selectedClient!.latestMeasurement!.standardMeasurements;
    }

    state = state.copyWith(
      selectedForWhom: item.forWhom ?? selfLabel,
      selectedBeneficiary: beneficiary,
      garmentType: item.garmentType,
      fabricPhoto: item.fabricPhotoUrl,
      fabricNote: item.description ?? '',
      itemMeasurements: finalMeasurements,
      measurementNotes: item.measurementNotes ?? '',
      itemPrice: item.estimatedPrice ?? 0.0,
      itemPhotos: List<String>.from(item.photoUrls),
      audioNotePath: item.audioNotePath,
    );

    // Update controllers
    measurementNotesController.text = item.measurementNotes ?? '';
    garmentTypeController.text = item.garmentType;
    priceController.text = (item.estimatedPrice ?? 0.0).toStringAsFixed(0);

    // Remove item from cart (will be re-added when user clicks "Ajouter")
    removeItem(index);

    // Go back to item builder step
    goToStep(1);
  }

  void goToStep(int step) {
    if (step >= 0 && step < state.steps.length) {
      state = state.copyWith(currentStep: step);
    }
  }

  Future<int> createBeneficiary(BeneficiaryModel beneficiary) async {
    final repo = await ref.read(beneficiaryRepositoryProvider.future);
    final id = await repo.createBeneficiary(beneficiary);

    // Add to state list immediately (optimistic update)
    beneficiary.id = id;
    state = state.copyWith(
      clientBeneficiaries: [...state.clientBeneficiaries, beneficiary],
    );

    return id;
  }

  // ===== Step 3: Payment =====
  double get totalAmount =>
      state.cartItems.fold(0, (sum, item) => sum + (item.estimatedPrice ?? 0));
  double get remainingAmount => totalAmount - state.depositAmount;

  void setDepositAmount(double amount) {
    state = state.copyWith(depositAmount: amount);
  }

  Future<void> pickDeliveryDate(BuildContext context) async {
    final picked = await AppDialogs.pickDate(
      context: context,
      initialDate:
          state.deliveryDate ?? DateTime.now().add(const Duration(days: 7)),
      firstDate: DateTime.now(),
      lastDate: DateTime(2030),
    );
    if (picked != null) {
      // Normalize to midnight to ensure consistent date comparisons
      final normalizedDate = DateTime(picked.year, picked.month, picked.day);
      state = state.copyWith(deliveryDate: normalizedDate);
    }
  }

  /// Returns the id of the created order, or null on failure, so the caller
  /// can land the user on the thing they just made rather than on a dashboard.
  Future<int?> createOrder() async {
    if (state.orderCreationAttempted || state.isCreatingOrder) {
      return null;
    }

    // Silent validation - UI shows inline errors
    if (state.cartItems.isEmpty) {
      HapticFeedback.heavyImpact();
      return null;
    }

    if (state.deliveryDate == null) {
      HapticFeedback.heavyImpact();
      return null;
    }

    final client = state.selectedClient;
    if (client == null) {
      HapticFeedback.heavyImpact();
      return null;
    }

    state = state.copyWith(isCreatingOrder: true, orderCreationAttempted: true);

    try {
      // --- CAPACITY CHECK ---
      final prefs = ref.read(preferencesProvider).value;
      if (prefs != null && state.deliveryDate != null) {
        final date = state.deliveryDate!;
        final startOfWeek = DateTime(
          date.year,
          date.month,
          date.day,
        ).subtract(Duration(days: date.weekday - 1));
        final endOfWeek = startOfWeek.add(
          const Duration(days: 6, hours: 23, minutes: 59, seconds: 59),
        );

        final projectRepo = await ref.read(projectRepositoryProvider.future);
        final currentCount = await projectRepo.getProjectCountInDateRange(
          startOfWeek,
          endOfWeek,
        );
        final newArticlesCount = state.cartItems.length;

        if (currentCount + newArticlesCount > prefs.maxProjectsPerWeek) {
          final proceed = await AppDialogs.showConfirmation(
            title: 'Capacité dépassée',
            message:
                '$newArticlesCount articles à ajouter aux $currentCount déjà prévus : au-delà de votre capacité de ${prefs.maxProjectsPerWeek} par semaine.',
            confirmLabel: 'Confirmer quand même',
            cancelLabel: 'Revoir la livraison',
            isDangerous: true,
          );
          if (proceed != true) {
            state = state.copyWith(
              isCreatingOrder: false,
              orderCreationAttempted: false,
            );
            return null;
          }
        }
      }

      // 1. Prepare the order model
      final orderService = await ref.read(orderServiceProvider.future);
      final finalDeposit = state.depositAmount.clamp(0.0, totalAmount);

      final order = OrderModel()
        ..clientId = client.id
        ..orderNumber =
            '' // Let service generate proper order number
        ..orderDate = DateTime.now()
        ..expectedDeliveryDate = state.deliveryDate
        ..totalAmount = totalAmount
        ..depositPaid = finalDeposit
        ..remainingBalance = (totalAmount - finalDeposit).clamp(
          0.0,
          double.infinity,
        )
        ..paymentStatus = finalDeposit >= totalAmount
            ? PaymentStatus.paid
            : (finalDeposit > 0 ? PaymentStatus.partial : PaymentStatus.unpaid)
        ..status = OrderStatus.pending
        ..createdAt = DateTime.now();

      // 2. Create order and projects atomically via service
      final orderId = await orderService.createOrderWithArticles(
        order,
        state.cartItems,
      );

      // 3. Recopie sur le serveur, au mieux (fil partagé entre ateliers)
      unawaited(_mirrorOrder(orderId, client.id));

      // 4. Schedule Notification (NON-BLOCKING)
      if (state.deliveryDate != null) {
        final notifService = await ref.read(notificationProvider.future);
        await notifService.scheduleOrderDueDate(
          id: orderId,
          clientName: '${client.firstName} ${client.lastName}',
          dueDate: state.deliveryDate!,
        );
      }

      // TRIGGER SUCCESS BUBBLE
      ref
          .read(feedbackServiceProvider.notifier)
          .showSuccess('Commande Créée', 'Numéro : ${order.orderNumber}');

      // Success - navigation will confirm
      HapticFeedback.mediumImpact();
      return orderId;
    } catch (e) {
      state = state.copyWith(orderCreationAttempted: false);
      HapticFeedback.heavyImpact();
      AppLogger.e('Error creating order', e);
      ref
          .read(feedbackServiceProvider.notifier)
          .showError('Erreur lors de la création de la commande');
      return null;
    } finally {
      state = state.copyWith(isCreatingOrder: false);
    }
  }

  /// Recopie une commande locale sur le serveur, pour le fil partagé.
  ///
  /// Hors ligne, ou si le client n'a pas encore été synchronisé, la commande
  /// reste purement locale : elle fait autorité sur l'appareil, et la copie
  /// n'existe que pour que les autres ateliers voient l'activité. Un échec est
  /// journalisé, jamais montré — l'utilisateur vient de créer sa commande, et
  /// elle est bien créée.
  Future<void> _mirrorOrder(int orderId, int clientLocalId) async {
    try {
      final atelier = await ref.read(primaryRemoteAtelierProvider.future);
      if (atelier == null) return;

      final coordinator = await ref.read(syncCoordinatorProvider.future);
      // Le client doit exister sur le serveur avant la commande qui le
      // référence : sa fiche part d'abord.
      await coordinator.synchronize(atelier.id);
      final remoteClientId = await coordinator.remoteClientId(
        atelierId: atelier.id,
        localId: clientLocalId.toString(),
      );
      if (remoteClientId == null) return;

      final orderRepo = await ref.read(orderRepositoryProvider.future);
      final saved = await orderRepo.getOrderById(orderId);
      if (saved == null || saved.remoteId != null) return;

      final projectRepo = await ref.read(projectRepositoryProvider.future);
      final articles = <({String garmentType, int unitPriceCfa})>[];
      for (final projectId in saved.projectIds) {
        final project = await projectRepo.getProjectById(projectId);
        if (project == null) continue;
        articles.add((
          garmentType: project.garmentType.trim().isEmpty
              ? 'Article'
              : project.garmentType.trim(),
          unitPriceCfa: (project.estimatedPrice ?? 0).round(),
        ));
      }
      if (articles.isEmpty) return;

      final remoteId = await ref
          .read(operationsRepositoryProvider)
          .createOrder(
            atelierId: atelier.id,
            clientId: remoteClientId,
            reference: saved.orderNumber,
            totalCfa: saved.totalAmount.round(),
            dueAt: saved.expectedDeliveryDate,
            items: articles,
          );
      saved.remoteId = remoteId;
      await orderRepo.updateOrder(saved);
    } catch (error, stackTrace) {
      AppLogger.e(
        'Commande créée localement mais non recopiée sur le serveur',
        error,
        stackTrace,
      );
    }
  }

  // ===== Navigation =====
  void nextStep() {
    if (state.currentStep < state.steps.length - 1) {
      state = state.copyWith(currentStep: state.currentStep + 1);
    }
  }

  void prevStep() {
    if (state.currentStep > 0) {
      state = state.copyWith(currentStep: state.currentStep - 1);
    }
  }

  void toggleHistory() {
    state = state.copyWith(showHistory: !state.showHistory);
  }

  Future<void> confirmAndNext() async {
    // 1. Check if current form is valid and should be added
    final hasFormContent = state.garmentType.isNotEmpty || state.itemPrice > 0;

    if (hasFormContent) {
      // Try to add. addItemToCart has its own validation and HapticFeedback
      addItemToCart();

      // If errors were found, addItemToCart will set state.itemErrors and return.
      // We check if item was added by seeing if builder was reset.
      if (state.garmentType.isNotEmpty) {
        return; // Validation failed, stay on this page
      }
    }

    // 2. Move to next step if cart is not empty
    if (state.cartItems.isNotEmpty) {
      nextStep();
    } else {
      ref
          .read(feedbackServiceProvider.notifier)
          .showWarning('Veuillez ajouter au moins un article.');
    }
  }
}

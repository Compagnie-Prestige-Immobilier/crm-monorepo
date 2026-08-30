import '../../../shared/utils/app_numbers.dart';
import 'package:gnawalma/app/shared/utils/app_dialogs.dart';
import 'package:gnawalma/app/shared/utils/async_action_mixin.dart';
import 'dart:convert';
import 'package:flutter/material.dart';
import 'package:riverpod_annotation/riverpod_annotation.dart';
import 'package:image_picker/image_picker.dart';
import '../../../data/models/project_model.dart';
import '../../../data/models/client_model.dart';
import '../../../data/repositories/client_repository.dart';
import '../../../data/repositories/pattern_repository.dart';
import '../../../data/repositories/project_repository.dart';
import '../../../data/services/project_service.dart';
import '../../../data/services/image_service.dart';
import '../../../data/services/notification_service.dart';
import '../../../data/services/template_service.dart';
import '../../../core/navigation/app_navigator.dart';
import '../../../shared/services/feedback_service.dart';
import '../../../shared/utils/app_logger.dart';
import '../../preferences/controllers/preferences_provider.dart';
import 'add_edit_project_state.dart';

part 'add_edit_project_provider.g.dart';

@riverpod
class AddEditProject extends _$AddEditProject with AsyncActionMixin {
  late final TextEditingController nameController;
  late final TextEditingController garmentTypeController;
  late final TextEditingController descriptionController;
  late final TextEditingController priceController;
  late final TextEditingController advancePaymentController;
  late final TextEditingController clientNameController;
  late final TextEditingController clientFabricDescription;
  final formKey = GlobalKey<FormState>();
  final _picker = ImagePicker();

  @override
  AddEditProjectState build({ProjectModel? project}) {
    _initControllers();

    if (project != null) {
      // Schedule async loading without blocking build
      Future.microtask(() => _loadProjectData(project));
      return AddEditProjectState(
        isEditMode: true,
        existingProject: project,
        startDate: project.startDate ?? DateTime.now(),
        expectedDeliveryDate:
            project.expectedDeliveryDate ??
            DateTime.now().add(const Duration(days: 7)),
        selectedStatus: project.status,
        photoUrls: project.photoUrls,
        audioNotePath: project.audioNotePath,
      );
    }

    Future.microtask(() => _loadInitialData());
    return AddEditProjectState(
      startDate: DateTime.now(),
      expectedDeliveryDate: DateTime.now().add(const Duration(days: 7)),
    );
  }

  void _initControllers() {
    nameController = TextEditingController();
    garmentTypeController = TextEditingController();
    descriptionController = TextEditingController();
    priceController = TextEditingController();
    advancePaymentController = TextEditingController();
    clientNameController = TextEditingController();
    clientFabricDescription = TextEditingController();

    ref.onDispose(() {
      nameController.dispose();
      garmentTypeController.dispose();
      descriptionController.dispose();
      priceController.dispose();
      advancePaymentController.dispose();
      clientNameController.dispose();
      clientFabricDescription.dispose();
    });
  }

  void _loadInitialData() {
    _loadClients();
    _loadPatterns();
  }

  Future<void> _loadClients() async {
    state = state.copyWith(isLoadingClients: true);
    await handleAsyncAction(() async {
      final repo = await ref.read(clientRepositoryProvider.future);
      final clients = await repo.getAllClients();
      state = state.copyWith(clients: clients, isLoadingClients: false);
    }, errorMessage: 'Erreur lors du chargement des clients');
    state = state.copyWith(isLoadingClients: false);
  }

  Future<void> _loadPatterns() async {
    state = state.copyWith(isLoadingPatterns: true);
    await handleAsyncAction(() async {
      final repo = await ref.read(patternRepositoryProvider.future);
      final patterns = await repo.getAllPatterns();
      state = state.copyWith(patterns: patterns, isLoadingPatterns: false);
    }, errorMessage: 'Erreur lors du chargement des patrons');
    state = state.copyWith(isLoadingPatterns: false);
  }

  Future<void> _loadProjectData(ProjectModel project) async {
    nameController.text = project.name;
    garmentTypeController.text = project.garmentType;
    descriptionController.text = project.description ?? '';
    priceController.text = project.estimatedPrice?.toString() ?? '0';
    advancePaymentController.text = project.advancePayment?.toString() ?? '0';
    if (project.measurementsSnapshot != null) {
      try {
        final Map<String, dynamic> decoded = jsonDecode(
          project.measurementsSnapshot!,
        );
        final Map<String, double> measurements = {};
        decoded.forEach((key, value) {
          if (value is num) measurements[key] = value.toDouble();
        });
        state = state.copyWith(currentMeasurements: measurements);
      } catch (e) {
        AppLogger.e('Error decoding measurements', e);
      }
    }

    _loadInitialData();

    // NEW: Load related objects asynchronously
    await _loadRelatedData(project);
  }

  /// Load related objects (client, pattern) for edit mode
  Future<void> _loadRelatedData(ProjectModel project) async {
    try {
      // Use Future.wait for parallel loading (better performance)
      final futures = <Future<void>>[];

      // Load client if clientId exists
      if (project.clientId != null) {
        futures.add(_loadClient(project.clientId!));
      }

      // Load pattern if patternId exists
      if (project.patternId != null) {
        futures.add(_loadPattern(project.patternId!));
      }

      // Wait for all loads to complete
      await Future.wait(futures);
    } catch (e) {
      AppLogger.e('Error loading related data for edit mode', e);
      // Don't block the edit flow - user can still edit text fields
    }
  }

  Future<void> _loadClient(int clientId) async {
    try {
      final repo = await ref.read(clientRepositoryProvider.future);
      final client = await repo.getClientById(clientId);
      if (client != null) {
        state = state.copyWith(selectedClient: client);
      }
    } catch (e) {
      AppLogger.e('Error loading client $clientId', e);
      rethrow;
    }
  }

  Future<void> _loadPattern(int patternId) async {
    try {
      final repo = await ref.read(patternRepositoryProvider.future);
      final pattern = await repo.getPatternById(patternId);
      if (pattern != null) {
        state = state.copyWith(selectedPattern: pattern);
      }
    } catch (e) {
      AppLogger.e('Error loading pattern $patternId', e);
      rethrow;
    }
  }

  void setStep(int step) {
    state = state.copyWith(currentStep: step);
  }

  void nextStep() {
    if (state.currentStep < state.steps.length - 1) {
      state = state.copyWith(currentStep: state.currentStep + 1);
    } else {
      saveProject();
    }
  }

  void previousStep() {
    if (state.currentStep > 0) {
      state = state.copyWith(currentStep: state.currentStep - 1);
    }
  }

  Future<void> pickClientFabricPhoto() async {
    try {
      final XFile? image = await _picker.pickImage(
        source: ImageSource.camera,
        maxWidth: 1024,
        maxHeight: 1024,
        imageQuality: 70,
      );
      if (image != null) {
        final savedPath = await ImageService().saveImage(image.path);
        state = state.copyWith(clientFabricPhotoUrl: savedPath);
      }
    } catch (e) {
      AppLogger.e('Error picking client fabric photo', e);
      // Provide specific error message based on error type
      String message = 'Impossible de prendre la photo';
      if (e.toString().contains('permission')) {
        message = 'Autorisation de caméra requise';
      } else if (e.toString().contains('camera')) {
        message = 'Caméra non disponible';
      }
      ref.read(feedbackServiceProvider.notifier).showError(message);
    }
  }

  Future<void> pickPhoto(ImageSource source) async {
    try {
      final XFile? image = await _picker.pickImage(
        source: source,
        maxWidth: 1024,
        maxHeight: 1024,
        imageQuality: 70,
      );
      if (image != null) {
        final savedPath = await ImageService().saveImage(image.path);
        state = state.copyWith(photoUrls: [...state.photoUrls, savedPath]);
      }
    } catch (e) {
      AppLogger.e('Error picking photo', e);
      // Provide specific error message based on error type
      String message = 'Impossible de sélectionner la photo';
      if (e.toString().contains('permission')) {
        message = 'Autorisation requise pour accéder aux photos';
      } else if (e.toString().contains('storage')) {
        message = 'Espace de stockage insuffisant';
      }
      ref.read(feedbackServiceProvider.notifier).showError(message);
    }
  }

  void applyTemplate(OutfitTemplate template) {
    garmentTypeController.text = template.name;
    priceController.text = template.defaultPrice.toStringAsFixed(0);

    final Map<String, double> measurements = {};
    for (var key in template.requiredMeasurements) {
      measurements[key] = 0.0;
    }
    state = state.copyWith(currentMeasurements: measurements);
  }

  Future<void> saveProject() async {
    await handleAsyncAction(
      () async {
        state = state.copyWith(isSaving: true);
        final projectService = await ref.read(projectServiceProvider.future);
        final clientRepo = await ref.read(clientRepositoryProvider.future);
        final patternRepo = await ref.read(patternRepositoryProvider.future);

        int clientId;
        if (state.selectedClient != null) {
          clientId = state.selectedClient!.id;
        } else {
          final nameParts = clientNameController.text.trim().split(' ');
          final firstName = nameParts.isNotEmpty ? nameParts.first : 'Client';
          final lastName = nameParts.length > 1
              ? nameParts.sublist(1).join(' ')
              : '';
          final newClient = ClientModel()
            ..firstName = firstName
            ..lastName = lastName
            ..gender = state.selectedGender
            ..createdAt = DateTime.now();
          clientId = await clientRepo.createClient(newClient);
        }

        final price = AppNumbers.tryParse(priceController.text) ?? 0.0;
        final advance =
            AppNumbers.tryParse(advancePaymentController.text) ?? 0.0;

        // --- CAPACITY CHECK ---
        if (state.expectedDeliveryDate != null) {
          final prefs = ref.read(preferencesProvider).value;
          if (prefs != null) {
            final date = state.expectedDeliveryDate!;
            // Calculate start and end of week (Monday to Sunday)
            final startOfWeek = DateTime(
              date.year,
              date.month,
              date.day,
            ).subtract(Duration(days: date.weekday - 1));
            final endOfWeek = startOfWeek.add(
              const Duration(days: 6, hours: 23, minutes: 59, seconds: 59),
            );

            final projectRepo = await ref.read(
              projectRepositoryProvider.future,
            );
            final currentCount = await projectRepo.getProjectCountInDateRange(
              startOfWeek,
              endOfWeek,
            );

            if (currentCount >= prefs.maxProjectsPerWeek && !state.isEditMode) {
              final proceed = await AppDialogs.showConfirmation(
                title: 'Capacité atteinte',
                message:
                    '$currentCount projets déjà prévus cette semaine, pour une capacité de ${prefs.maxProjectsPerWeek}.',
                confirmLabel: 'Enregistrer quand même',
                cancelLabel: 'Revoir la date',
                isDangerous: true,
              );
              if (proceed != true) {
                state = state.copyWith(isSaving: false);
                return;
              }
            }
          }
        }

        final project = state.existingProject ?? ProjectModel();
        project
          ..name = nameController.text
          ..clientId = clientId
          ..patternId = state.selectedPattern?.id
          ..garmentType = garmentTypeController.text
          ..description = descriptionController.text.isEmpty
              ? null
              : descriptionController.text
          ..status = state.selectedStatus
          ..startDate = state.startDate
          ..expectedDeliveryDate = state.expectedDeliveryDate
          ..estimatedPrice = price
          ..advancePayment = advance
          ..measurementsSnapshot = state.currentMeasurements.isNotEmpty
              ? jsonEncode(state.currentMeasurements)
              : null
          ..audioNotePath = state.audioNotePath
          ..photoUrls = state.photoUrls;

        if (state.isEditMode) {
          await projectService.updateProject(project);
        } else {
          project.createdAt = DateTime.now();
          await projectService.createProject(project);
          if (state.selectedPattern != null) {
            await patternRepo.incrementTimesUsed(state.selectedPattern!.id);
          }

          // Schedule notification
          try {
            final notifService = await ref.read(notificationProvider.future);
            await notifService.scheduleOrderDueDate(
              id: project.id,
              clientName: project.name,
              dueDate: project.expectedDeliveryDate!,
            );
          } catch (e) {
            AppLogger.e('Error scheduling notification', e);
            // Don't fail the save if notification fails
          }
        }

        AppNavigator.back(true);
      },
      successMessage: 'Article enregistré',
      errorMessage: 'Erreur lors de la sauvegarde',
      showToastOnSuccess: true,
    );
    state = state.copyWith(isSaving: false);
  }

  void removePhoto(int index) {
    final urls = [...state.photoUrls]..removeAt(index);
    state = state.copyWith(photoUrls: urls);
  }

  void setAudioNotePath(String? path) {
    state = state.copyWith(audioNotePath: path);
  }

  void removeClientFabricPhoto() {
    state = state.copyWith(clientFabricPhotoUrl: null);
  }

  void setStatus(ProjectStatus status) {
    state = state.copyWith(selectedStatus: status);
  }

  void setGender(Gender gender) {
    state = state.copyWith(selectedGender: gender);
  }

  void updateMeasurement(String key, double value) {
    final measurements = {...state.currentMeasurements, key: value};
    state = state.copyWith(currentMeasurements: measurements);
  }

  Future<void> selectStartDate(BuildContext context) async {
    final picked = await AppDialogs.pickDate(
      context: context,
      initialDate: state.startDate,
    );
    if (picked != null) {
      state = state.copyWith(startDate: picked);
    }
  }

  Future<void> selectDeliveryDate(BuildContext context) async {
    final picked = await AppDialogs.pickDate(
      context: context,
      initialDate: state.expectedDeliveryDate,
      firstDate: DateTime.now(),
    );
    if (picked != null) {
      // Normalize to midnight to ensure consistent date comparisons
      final normalizedDate = DateTime(picked.year, picked.month, picked.day);
      state = state.copyWith(expectedDeliveryDate: normalizedDate);
    }
  }

  void selectClient(ClientModel client) {
    state = state.copyWith(selectedClient: client);
    clientNameController.text = '${client.firstName} ${client.lastName}';
  }
}

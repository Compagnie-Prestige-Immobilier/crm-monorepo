import 'dart:async';

import 'package:gnawalma/app/shared/utils/async_action_mixin.dart';
import 'package:flutter/material.dart';
import 'package:riverpod_annotation/riverpod_annotation.dart';
import '../../../data/models/client_model.dart';
import '../../../data/repositories/client_repository.dart';
import '../../../shared/services/feedback_service.dart';
import '../data/client_sync.dart';
import 'add_edit_client_state.dart';

import 'package:gnawalma/app/core/navigation/app_navigator.dart';

part 'add_edit_client_provider.g.dart';

@riverpod
class AddEditClient extends _$AddEditClient with AsyncActionMixin {
  late final TextEditingController firstNameController;
  late final TextEditingController lastNameController;
  late final TextEditingController phoneController;
  late final TextEditingController emailController;
  late final TextEditingController addressController;
  final formKey = GlobalKey<FormState>();
  bool _saveAttempted = false;
  Timer? _phoneCheckTimer;

  @override
  AddEditClientState build({ClientModel? client}) {
    // Initialize controllers
    firstNameController = TextEditingController();
    lastNameController = TextEditingController();
    phoneController = TextEditingController();
    emailController = TextEditingController();
    addressController = TextEditingController();

    // Add phone listener for duplicate checking
    phoneController.addListener(_onPhoneChanged);

    // Dispose controllers when provider is disposed
    ref.onDispose(() {
      _phoneCheckTimer?.cancel();
      phoneController.removeListener(_onPhoneChanged);
      firstNameController.dispose();
      lastNameController.dispose();
      phoneController.dispose();
      emailController.dispose();
      addressController.dispose();
    });

    // Load client data if editing
    if (client != null) {
      _loadClientData(client);
      return AddEditClientState(isEditMode: true, existingClient: client);
    }

    return const AddEditClientState();
  }

  void _onPhoneChanged() {
    // Cancel any pending check
    _phoneCheckTimer?.cancel();

    final phone = phoneController.text.trim();

    // Clear error if phone is empty
    if (phone.isEmpty) {
      state = state.copyWith(
        phoneExists: false,
        existingPhoneClient: null,
        phoneError: null,
        isCheckingPhone: false,
      );
      return;
    }

    // Debounce phone check (wait 500ms after user stops typing)
    state = state.copyWith(isCheckingPhone: true);
    _phoneCheckTimer = Timer(const Duration(milliseconds: 500), () {
      _checkPhoneExists(phone);
    });
  }

  Future<void> _checkPhoneExists(String phone) async {
    // Normalize phone number
    final normalizedPhone = phone.replaceAll(RegExp(r'[\s\-\(\)]'), '');

    // Skip if phone is too short
    if (normalizedPhone.length < 8) {
      state = state.copyWith(
        isCheckingPhone: false,
        phoneExists: false,
        existingPhoneClient: null,
        phoneError: null,
      );
      return;
    }

    try {
      final repository = await ref.read(clientRepositoryProvider.future);
      final existingClient = await repository.findClientByPhone(phone);

      // Check if it's the same client being edited
      if (existingClient != null &&
          state.isEditMode &&
          state.existingClient != null &&
          existingClient.id == state.existingClient!.id) {
        // Same client, no error
        state = state.copyWith(
          isCheckingPhone: false,
          phoneExists: false,
          existingPhoneClient: null,
          phoneError: null,
        );
        return;
      }

      if (existingClient != null) {
        state = state.copyWith(
          isCheckingPhone: false,
          phoneExists: true,
          existingPhoneClient: existingClient,
          phoneError:
              'Ce numéro existe déjà (${existingClient.firstName} ${existingClient.lastName})',
        );
      } else {
        state = state.copyWith(
          isCheckingPhone: false,
          phoneExists: false,
          existingPhoneClient: null,
          phoneError: null,
        );
      }
    } catch (e) {
      state = state.copyWith(isCheckingPhone: false);
    }
  }

  void _loadClientData(ClientModel client) {
    firstNameController.text = client.firstName;
    lastNameController.text = client.lastName;
    phoneController.text = client.phone ?? '';
    emailController.text = client.email ?? '';
    addressController.text = client.address ?? '';
  }

  bool get isStep1Valid =>
      firstNameController.text.isNotEmpty && lastNameController.text.isNotEmpty;

  /// Returns true if the form can be submitted (no duplicate phone)
  bool get canSubmit => !state.phoneExists && !state.isCheckingPhone;

  void nextStep() {
    if (state.currentStep == 0) {
      if (!isStep1Valid) {
        ref
            .read(feedbackServiceProvider.notifier)
            .showError('Veuillez entrer le nom et le prénom');
        return;
      }
    }

    if (state.currentStep < 1) {
      state = state.copyWith(currentStep: state.currentStep + 1);
    }
  }

  void previousStep() {
    if (state.currentStep > 0) {
      state = state.copyWith(currentStep: state.currentStep - 1);
    }
  }

  Future<void> saveClient() async {
    if (_saveAttempted || state.isSaving) return;

    // Check for duplicate phone before saving
    if (state.phoneExists) {
      ref
          .read(feedbackServiceProvider.notifier)
          .showError(state.phoneError ?? 'Ce numéro de téléphone existe déjà');
      return;
    }

    final currentForm = formKey.currentState;
    if (currentForm == null || !currentForm.validate()) return;

    await handleAsyncAction(
      () async {
        _saveAttempted = true;
        state = state.copyWith(isSaving: true);

        final repository = await ref.read(clientRepositoryProvider.future);
        ClientModel resultClient;

        if (state.isEditMode && state.existingClient != null) {
          final client = state.existingClient!;
          client
            ..firstName = firstNameController.text
            ..lastName = lastNameController.text
            ..phone = phoneController.text
            ..email = emailController.text.isEmpty ? null : emailController.text
            ..address = addressController.text.isEmpty
                ? null
                : addressController.text;

          await repository.updateClient(client);
          resultClient = client;
        } else {
          final client = ClientModel()
            ..firstName = firstNameController.text
            ..lastName = lastNameController.text
            ..phone = phoneController.text
            ..email = emailController.text.isEmpty ? null : emailController.text
            ..address = addressController.text.isEmpty
                ? null
                : addressController.text
            ..totalOrders = 0
            ..totalSpent = 0.0;

          final id = await repository.createClient(client);
          client.id = id;
          resultClient = client;
        }

        await _queueRemoteSync(resultClient);
        AppNavigator.back(resultClient);
      },
      successMessage: state.isEditMode ? 'Client mis à jour' : 'Client ajouté',
      errorMessage: 'Impossible de sauvegarder le client',
      showToastOnSuccess: true,
      feedbackNotifier: ref.read(feedbackServiceProvider.notifier),
    );

    _saveAttempted = false;
    state = state.copyWith(isSaving: false);
  }

  Future<void> _queueRemoteSync(ClientModel client) =>
      ref.read(clientSyncProvider).queue(client);
}

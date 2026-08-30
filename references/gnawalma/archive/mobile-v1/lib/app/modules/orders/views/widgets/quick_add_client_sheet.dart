import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../../data/models/client_model.dart';
import '../../../../data/repositories/client_repository.dart';
import '../../../../shared/services/feedback_service.dart';
import '../../../../shared/theme/app_colors.dart';
import '../../../../shared/theme/app_colors_extensions.dart';
import '../../../../shared/theme/app_spacing.dart';
import '../../../../shared/theme/app_text_styles.dart';
import '../../../../shared/utils/validators.dart';
import '../../../../shared/widgets/buttons/animated_primary_button.dart';
import '../../../../shared/widgets/forms/validated_text_form_field.dart';
import '../../../../shared/widgets/interaction/pressable_surface.dart';
import '../../../../shared/widgets/layouts/polished_page.dart';
import '../../../../shared/widgets/sheets/contact_picker_sheet.dart';
import '../../../clients/data/client_sync.dart';

class QuickAddClientSheet extends ConsumerStatefulWidget {
  const QuickAddClientSheet({super.key, required this.onClientCreated});

  final ValueChanged<ClientModel> onClientCreated;

  @override
  ConsumerState<QuickAddClientSheet> createState() =>
      _QuickAddClientSheetState();
}

class _QuickAddClientSheetState extends ConsumerState<QuickAddClientSheet> {
  final _formKey = GlobalKey<FormState>();
  final _firstNameController = TextEditingController();
  final _lastNameController = TextEditingController();
  final _phoneController = TextEditingController();
  final _lastNameFocus = FocusNode();
  final _phoneFocus = FocusNode();

  Gender _selectedGender = Gender.female;
  Timer? _debounce;
  bool _isCheckingPhone = false;
  bool _phoneExists = false;
  bool _isSubmitting = false;
  bool _phoneTouched = false;
  String? _phoneError;

  @override
  void initState() {
    super.initState();
    for (final controller in [
      _firstNameController,
      _lastNameController,
      _phoneController,
    ]) {
      controller.addListener(_refresh);
    }
    _phoneController.addListener(_schedulePhoneCheck);
  }

  @override
  void dispose() {
    _phoneController.removeListener(_schedulePhoneCheck);
    for (final controller in [
      _firstNameController,
      _lastNameController,
      _phoneController,
    ]) {
      controller.removeListener(_refresh);
      controller.dispose();
    }
    _lastNameFocus.dispose();
    _phoneFocus.dispose();
    _debounce?.cancel();
    super.dispose();
  }

  void _refresh() {
    if (mounted) setState(() {});
  }

  void _schedulePhoneCheck() {
    _debounce?.cancel();
    final phone = _normalizedPhone;
    if (phone.length < 8) {
      setState(() {
        _phoneExists = false;
        _phoneError = null;
        _isCheckingPhone = false;
      });
      return;
    }
    _debounce = Timer(
      const Duration(milliseconds: 450),
      () => _checkPhoneExists(phone),
    );
  }

  String get _normalizedPhone =>
      _phoneController.text.replaceAll(RegExp(r'\s+'), '').trim();

  bool get _firstNameValid => _firstNameController.text.trim().length >= 2;
  bool get _lastNameValid => _lastNameController.text.trim().length >= 2;
  bool get _phoneFormatValid => Validators.phone(_phoneController.text) == null;
  bool get _phoneValid =>
      _phoneFormatValid && !_phoneExists && !_isCheckingPhone;
  bool get _canSubmit =>
      _firstNameValid && _lastNameValid && _phoneValid && !_isSubmitting;

  Future<void> _checkPhoneExists(String phone) async {
    if (mounted) setState(() => _isCheckingPhone = true);
    try {
      final repository = await ref.read(clientRepositoryProvider.future);
      final existing = await repository.searchClients(phone);
      final duplicate = existing.any(
        (client) =>
            (client.phone ?? '').replaceAll(RegExp(r'\s+'), '') == phone,
      );
      if (!mounted || phone != _normalizedPhone) return;
      setState(() {
        _phoneExists = duplicate;
        _phoneError = duplicate
            ? 'Ce numéro appartient déjà à un client.'
            : null;
        _isCheckingPhone = false;
      });
    } catch (_) {
      if (mounted) setState(() => _isCheckingPhone = false);
    }
  }

  Future<void> _importFromContacts() async {
    final picked = await pickContact(context);
    if (picked == null || !mounted) return;
    setState(() {
      _firstNameController.text = picked.firstName;
      _lastNameController.text = picked.lastName;
      _phoneController.text = picked.phone;
      _phoneTouched = true;
    });
  }

  Future<void> _submit() async {
    setState(() => _phoneTouched = true);
    final formValid = _formKey.currentState?.validate() ?? false;
    if (!formValid || !_canSubmit) {
      HapticFeedback.heavyImpact();
      return;
    }

    setState(() => _isSubmitting = true);
    final feedback = ref.read(feedbackServiceProvider.notifier);
    try {
      final repository = await ref.read(clientRepositoryProvider.future);
      final phone = _normalizedPhone;
      final existing = await repository.searchClients(phone);
      final duplicate = existing.any(
        (client) =>
            (client.phone ?? '').replaceAll(RegExp(r'\s+'), '') == phone,
      );
      if (duplicate) {
        if (!mounted) return;
        setState(() {
          _phoneExists = true;
          _phoneError = 'Ce numéro appartient déjà à un client.';
          _isSubmitting = false;
        });
        HapticFeedback.heavyImpact();
        feedback.showWarning('Ce numéro est déjà associé à un client.');
        return;
      }

      final client = ClientModel()
        ..firstName = _firstNameController.text.trim()
        ..lastName = _lastNameController.text.trim()
        ..phone = phone
        ..gender = _selectedGender
        ..createdAt = DateTime.now()
        ..totalOrders = 0
        ..totalSpent = 0
        ..trustScore = 3;
      client.updateFullName();
      client.id = await repository.createClient(client);
      // Meme mise en file que le formulaire complet : sans elle, un client
      // cree pendant une commande n'existait que sur l'appareil, et la
      // commande qui le designe ne pouvait pas etre recopiee non plus.
      await ref.read(clientSyncProvider).queue(client);

      HapticFeedback.mediumImpact();
      widget.onClientCreated(client);
      feedback.showSuccess(
        'Client créé',
        '${client.displayName} a été ajouté à la commande.',
      );
      if (mounted) Navigator.of(context).pop();
    } catch (_) {
      if (mounted) setState(() => _isSubmitting = false);
      feedback.showError('Impossible de créer le client pour le moment.');
    }
  }

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: EdgeInsets.only(bottom: MediaQuery.viewInsetsOf(context).bottom),
      child: SafeArea(
        top: false,
        child: SingleChildScrollView(
          padding: const EdgeInsets.fromLTRB(
            AppSpacing.md,
            AppSpacing.sm,
            AppSpacing.md,
            AppSpacing.lg,
          ),
          child: Form(
            key: _formKey,
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Center(
                  child: Container(
                    width: 44,
                    height: 4,
                    decoration: BoxDecoration(
                      color: context.dividerColor,
                      borderRadius: BorderRadius.circular(
                        AppSpacing.radiusSheetTop,
                      ),
                    ),
                  ),
                ),
                const SizedBox(height: AppSpacing.lg),
                Row(
                  children: [
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(
                            'Nouveau client',
                            style: AppTextStyles.h3.copyWith(
                              color: context.textPrimaryColor,
                            ),
                          ),
                          const SizedBox(height: 3),
                          Text(
                            'Les informations essentielles, sans interrompre la commande.',
                            style: AppTextStyles.bodySmall.copyWith(
                              color: context.textSecondaryColor,
                            ),
                          ),
                        ],
                      ),
                    ),
                    // Même geste que dans le formulaire complet : le client
                    // est le plus souvent déjà dans le répertoire.
                    IconButton(
                      tooltip: 'Importer depuis mes contacts',
                      onPressed: _importFromContacts,
                      icon: const Icon(Icons.contacts_outlined),
                    ),
                    IconButton.filledTonal(
                      tooltip: 'Fermer',
                      onPressed: () => Navigator.of(context).pop(),
                      icon: const Icon(Icons.close_rounded),
                    ),
                  ],
                ),
                const SizedBox(height: AppSpacing.lg),
                AppSectionHeader(
                  title: 'Profil',
                  subtitle:
                      'Cette information aide à adapter les mesures proposées',
                  icon: Icons.person_outline_rounded,
                  accentColor: Theme.of(context).colorScheme.primary,
                ),
                const SizedBox(height: AppSpacing.sm),
                Row(
                  children: [
                    Expanded(
                      child: _GenderOption(
                        label: 'Femme',
                        icon: Icons.female_rounded,
                        selected: _selectedGender == Gender.female,
                        onTap: () =>
                            setState(() => _selectedGender = Gender.female),
                      ),
                    ),
                    const SizedBox(width: AppSpacing.sm),
                    Expanded(
                      child: _GenderOption(
                        label: 'Homme',
                        icon: Icons.male_rounded,
                        selected: _selectedGender == Gender.male,
                        onTap: () =>
                            setState(() => _selectedGender = Gender.male),
                      ),
                    ),
                  ],
                ),
                const SizedBox(height: AppSpacing.lg),
                ValidatedTextFormField(
                  controller: _firstNameController,
                  labelText: 'Prénom',
                  hintText: 'Ex. Awa',
                  prefixIcon: Icons.badge_outlined,
                  isValid: _firstNameValid,
                  textInputAction: TextInputAction.next,
                  autofillHints: const [AutofillHints.givenName],
                  validator: (value) =>
                      Validators.required(value, fieldName: 'Prénom'),
                  onFieldSubmitted: (_) => _lastNameFocus.requestFocus(),
                ),
                const SizedBox(height: AppSpacing.md),
                ValidatedTextFormField(
                  controller: _lastNameController,
                  focusNode: _lastNameFocus,
                  labelText: 'Nom',
                  hintText: 'Ex. Diop',
                  prefixIcon: Icons.badge_outlined,
                  isValid: _lastNameValid,
                  textInputAction: TextInputAction.next,
                  autofillHints: const [AutofillHints.familyName],
                  validator: (value) =>
                      Validators.required(value, fieldName: 'Nom'),
                  onFieldSubmitted: (_) => _phoneFocus.requestFocus(),
                ),
                const SizedBox(height: AppSpacing.md),
                ValidatedTextFormField(
                  controller: _phoneController,
                  focusNode: _phoneFocus,
                  labelText: 'Téléphone',
                  hintText: '77 000 00 00',
                  prefixIcon: Icons.phone_outlined,
                  isValid: _phoneTouched && _phoneValid,
                  keyboardType: TextInputType.phone,
                  textInputAction: TextInputAction.done,
                  autofillHints: const [AutofillHints.telephoneNumber],
                  inputFormatters: [
                    FilteringTextInputFormatter.allow(RegExp(r'[0-9+ ]')),
                  ],
                  validator: (value) => _phoneError ?? Validators.phone(value),
                  onChanged: (_) {
                    if (!_phoneTouched) setState(() => _phoneTouched = true);
                  },
                  onFieldSubmitted: (_) => _submit(),
                  trailing: _isCheckingPhone
                      ? const SizedBox(
                          width: 20,
                          height: 20,
                          child: CircularProgressIndicator.adaptive(),
                        )
                      : _phoneExists
                      ? Icon(
                          Icons.error_outline_rounded,
                          color: context.statusForeground(AppColors.error),
                        )
                      : null,
                ),
                if (_phoneError != null) ...[
                  const SizedBox(height: AppSpacing.xs),
                  Text(
                    _phoneError!,
                    style: AppTextStyles.bodySmall.copyWith(
                      color: context.statusForeground(AppColors.error),
                    ),
                  ),
                ],
                const SizedBox(height: AppSpacing.lg),
                AnimatedPrimaryButton(
                  label: 'Créer et sélectionner',
                  icon: Icons.person_add_alt_1_rounded,
                  enabled: _canSubmit,
                  loading: _isSubmitting,
                  onPressed: _submit,
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}

class _GenderOption extends StatelessWidget {
  const _GenderOption({
    required this.label,
    required this.icon,
    required this.selected,
    required this.onTap,
  });

  final String label;
  final IconData icon;
  final bool selected;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return PressableSurface(
      onTap: onTap,
      selected: selected,
      accentColor: Theme.of(context).colorScheme.primary,
      semanticLabel: '$label${selected ? ', sélectionné' : ''}',
      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 14),
      child: Row(
        children: [
          Icon(
            icon,
            color: selected
                ? Theme.of(context).colorScheme.primary
                : context.textSecondaryColor,
          ),
          const SizedBox(width: 9),
          Expanded(
            child: Text(
              label,
              style: AppTextStyles.label.copyWith(
                color: context.textPrimaryColor,
              ),
            ),
          ),
          SelectionIndicator(
            selected: selected,
            accent: Theme.of(context).colorScheme.primary,
            size: 24,
          ),
        ],
      ),
    );
  }
}

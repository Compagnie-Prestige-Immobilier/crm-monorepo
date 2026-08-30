import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/navigation/app_navigator.dart';
import '../../../data/models/client_model.dart';
import '../../../shared/theme/app_spacing.dart';
import '../../../shared/utils/app_dialogs.dart';
import '../../../shared/utils/validators.dart';
import '../../../shared/widgets/forms/validated_text_form_field.dart';
import '../../../shared/widgets/layouts/polished_page.dart';
import '../../../shared/widgets/navigation/custom_app_bar.dart';
import '../../../shared/widgets/sheets/contact_picker_sheet.dart';
import '../../../shared/widgets/navigation/step_indicator_widget.dart';
import '../controllers/add_edit_client_provider.dart';
import '../controllers/add_edit_client_state.dart';

class AddEditClientView extends ConsumerStatefulWidget {
  const AddEditClientView({super.key, this.client});

  final ClientModel? client;

  @override
  ConsumerState<AddEditClientView> createState() => _AddEditClientViewState();
}

class _AddEditClientViewState extends ConsumerState<AddEditClientView> {
  late final PageController _pageController;

  @override
  void initState() {
    super.initState();
    _pageController = PageController();
  }

  @override
  void dispose() {
    _pageController.dispose();
    super.dispose();
  }

  bool _isFormTouched(AddEditClient notifier) {
    return [
      notifier.firstNameController,
      notifier.lastNameController,
      notifier.phoneController,
      notifier.emailController,
      notifier.addressController,
    ].any((controller) => controller.text.trim().isNotEmpty);
  }

  Future<void> _importFromContacts(
    BuildContext context,
    AddEditClient notifier,
  ) async {
    final picked = await pickContact(context);
    if (picked == null) return;
    notifier.firstNameController.text = picked.firstName;
    notifier.lastNameController.text = picked.lastName;
    notifier.phoneController.text = picked.phone;
  }

  Future<void> _handlePop(
    AddEditClient notifier,
    AddEditClientState state,
  ) async {
    if (state.isSaving) return;

    if (state.currentStep > 0) {
      notifier.previousStep();
      return;
    }

    if (!_isFormTouched(notifier)) {
      AppNavigator.back();
      return;
    }

    final discard = await AppDialogs.showConfirmation(
      title: 'Abandonner la saisie ?',
      message:
          'Les informations saisies pour ce client ne seront pas enregistrées.',
      confirmLabel: 'Abandonner',
      cancelLabel: 'Continuer la saisie',
      isDangerous: true,
    );
    if (discard == true) AppNavigator.back();
  }

  @override
  Widget build(BuildContext context) {
    final state = ref.watch(addEditClientProvider(client: widget.client));
    final notifier = ref.read(
      addEditClientProvider(client: widget.client).notifier,
    );

    ref.listen(
      addEditClientProvider(
        client: widget.client,
      ).select((value) => value.currentStep),
      (previous, next) {
        if (!_pageController.hasClients) return;
        _pageController.animateToPage(
          next,
          duration: Duration(
            milliseconds: MediaQuery.disableAnimationsOf(context) ? 0 : 220,
          ),
          curve: Curves.easeOutCubic,
        );
      },
    );

    final formListenable = Listenable.merge([
      notifier.firstNameController,
      notifier.lastNameController,
      notifier.phoneController,
      notifier.emailController,
    ]);

    return AnimatedBuilder(
      animation: formListenable,
      builder: (context, _) {
        final firstValid = notifier.firstNameController.text.trim().isNotEmpty;
        final lastValid = notifier.lastNameController.text.trim().isNotEmpty;
        final cleanPhone = notifier.phoneController.text.replaceAll(
          RegExp(r'[\s\-\(\)]'),
          '',
        );
        final phoneValid =
            cleanPhone.length >= 8 &&
            Validators.phone(notifier.phoneController.text) == null &&
            !state.phoneExists;
        final email = notifier.emailController.text.trim();
        final emailValid = email.isEmpty || Validators.email(email) == null;
        final stepValid = state.currentStep == 0
            ? firstValid && lastValid
            : phoneValid && emailValid && !state.isCheckingPhone;

        final canPopFreely =
            state.currentStep == 0 &&
            !state.isSaving &&
            !_isFormTouched(notifier);

        return PopScope(
          canPop: canPopFreely,
          onPopInvokedWithResult: (didPop, _) {
            if (didPop) return;
            _handlePop(notifier, state);
          },
          child: Scaffold(
            appBar: CustomAppBar(
              title: state.isEditMode ? 'Modifier le client' : 'Nouveau client',
              subtitle: state.currentStep == 0
                  ? 'Identité du client'
                  : 'Coordonnées et contact',
              showBackButton: true,
              // Le gérant retapait un nom et un numéro qu'il a déjà dans son
              // téléphone. Le répertoire n'est lu que sur ce geste.
              actions: state.isEditMode
                  ? null
                  : [
                      IconButton(
                        tooltip: 'Importer depuis mes contacts',
                        onPressed: () => _importFromContacts(context, notifier),
                        icon: const Icon(Icons.contacts_outlined),
                      ),
                    ],
            ),
            body: SafeArea(
              top: false,
              child: Column(
                children: [
                  StepIndicator(
                    currentStep: state.currentStep,
                    totalSteps: 2,
                    stepLabels: const ['Identité', 'Coordonnées'],
                  ),
                  Expanded(
                    child: Form(
                      key: notifier.formKey,
                      child: PageView(
                        controller: _pageController,
                        physics: const NeverScrollableScrollPhysics(),
                        children: [
                          _IdentityStep(
                            notifier: notifier,
                            firstValid: firstValid,
                            lastValid: lastValid,
                          ),
                          _ContactStep(
                            notifier: notifier,
                            state: state,
                            phoneValid: phoneValid,
                            emailValid: emailValid,
                          ),
                        ],
                      ),
                    ),
                  ),
                ],
              ),
            ),
            bottomNavigationBar: AppStickyActionBar(
              secondary: state.currentStep == 0
                  ? OutlinedButton(
                      onPressed: state.isSaving ? null : AppNavigator.back,
                      child: const Text('Annuler'),
                    )
                  : OutlinedButton.icon(
                      onPressed: state.isSaving ? null : notifier.previousStep,
                      icon: const Icon(Icons.arrow_back_rounded),
                      label: const Text('Retour'),
                    ),
              primary: FilledButton.icon(
                onPressed: !stepValid || state.isSaving
                    ? null
                    : () {
                        HapticFeedback.mediumImpact();
                        if (state.currentStep == 0) {
                          notifier.nextStep();
                        } else {
                          FocusScope.of(context).unfocus();
                          notifier.saveClient();
                        }
                      },
                icon: state.isSaving
                    ? SizedBox(
                        width: 18,
                        height: 18,
                        child: CircularProgressIndicator.adaptive(
                          strokeWidth: 2,
                          valueColor: AlwaysStoppedAnimation(
                            Theme.of(context).colorScheme.onPrimary,
                          ),
                        ),
                      )
                    : Icon(
                        state.currentStep == 0
                            ? Icons.arrow_forward_rounded
                            : Icons.check_rounded,
                      ),
                label: Text(
                  state.isSaving
                      ? 'Enregistrement…'
                      : state.currentStep == 0
                      ? 'Continuer'
                      : state.isEditMode
                      ? 'Enregistrer'
                      : 'Ajouter le client',
                ),
              ),
            ),
          ),
        );
      },
    );
  }
}

class _IdentityStep extends StatelessWidget {
  const _IdentityStep({
    required this.notifier,
    required this.firstValid,
    required this.lastValid,
  });

  final AddEditClient notifier;
  final bool firstValid;
  final bool lastValid;

  @override
  Widget build(BuildContext context) {
    final colorScheme = Theme.of(context).colorScheme;
    return SingleChildScrollView(
      keyboardDismissBehavior: ScrollViewKeyboardDismissBehavior.onDrag,
      padding: const EdgeInsets.fromLTRB(
        AppSpacing.gutter,
        AppSpacing.sm,
        AppSpacing.gutter,
        AppSpacing.xl,
      ),
      child: Center(
        child: ConstrainedBox(
          constraints: const BoxConstraints(maxWidth: 560),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              AppPageHeader(
                eyebrow: 'ÉTAPE 1',
                title: 'Qui est le client ?',
                subtitle:
                    'Ces informations permettent d’identifier la personne dans les commandes et reçus.',
                accentColor: colorScheme.primary,
                compact: true,
                padding: const EdgeInsets.only(bottom: AppSpacing.md),
              ),
              AppSectionSurface(
                showAccent: true,
                accentColor: colorScheme.primary,
                child: Column(
                  children: [
                    Row(
                      children: [
                        // Bare glyph, no tinted tile — consistent with the
                        // rest of the app's leading icons.
                        Icon(
                          Icons.person_outline_rounded,
                          color: colorScheme.primary,
                          size: 32,
                        ),
                        const SizedBox(width: AppSpacing.md),
                        const Expanded(
                          child: Text(
                            'Renseignez le nom tel qu’il doit apparaître dans votre répertoire.',
                          ),
                        ),
                      ],
                    ),
                    const SizedBox(height: AppSpacing.lg),
                    ValidatedTextFormField(
                      controller: notifier.firstNameController,
                      labelText: 'Prénom',
                      hintText: 'Ex. Awa',
                      prefixIcon: Icons.badge_outlined,
                      isValid: firstValid,
                      textInputAction: TextInputAction.next,
                      autofillHints: const [AutofillHints.givenName],
                      validator: (value) =>
                          Validators.required(value, fieldName: 'prénom'),
                    ),
                    const SizedBox(height: AppSpacing.md),
                    ValidatedTextFormField(
                      controller: notifier.lastNameController,
                      labelText: 'Nom',
                      hintText: 'Ex. Diop',
                      prefixIcon: Icons.badge_outlined,
                      isValid: lastValid,
                      textInputAction: TextInputAction.done,
                      autofillHints: const [AutofillHints.familyName],
                      validator: (value) =>
                          Validators.required(value, fieldName: 'nom'),
                    ),
                  ],
                ),
              ),
              const SizedBox(height: AppSpacing.md),
              const AppStatusBanner(
                title: 'Information visible sur les documents',
                message:
                    'Le prénom et le nom seront repris dans les commandes et reçus créés pour ce client.',
                icon: Icons.description_outlined,
              ),
            ],
          ),
        ),
      ),
    );
  }
}

class _ContactStep extends StatelessWidget {
  const _ContactStep({
    required this.notifier,
    required this.state,
    required this.phoneValid,
    required this.emailValid,
  });

  final AddEditClient notifier;
  final AddEditClientState state;
  final bool phoneValid;
  final bool emailValid;

  @override
  Widget build(BuildContext context) {
    final colorScheme = Theme.of(context).colorScheme;
    return SingleChildScrollView(
      keyboardDismissBehavior: ScrollViewKeyboardDismissBehavior.onDrag,
      padding: const EdgeInsets.fromLTRB(
        AppSpacing.gutter,
        AppSpacing.sm,
        AppSpacing.gutter,
        AppSpacing.xl,
      ),
      child: Center(
        child: ConstrainedBox(
          constraints: const BoxConstraints(maxWidth: 560),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              AppPageHeader(
                eyebrow: 'ÉTAPE 2',
                title: 'Comment le contacter ?',
                subtitle:
                    'Le téléphone est requis pour éviter les doublons et retrouver rapidement le client.',
                accentColor: colorScheme.primary,
                compact: true,
                padding: const EdgeInsets.only(bottom: AppSpacing.md),
              ),
              AppSectionSurface(
                showAccent: true,
                accentColor: colorScheme.primary,
                child: Column(
                  children: [
                    ValidatedTextFormField(
                      controller: notifier.phoneController,
                      labelText: 'Téléphone',
                      hintText: 'Ex. 77 123 45 67',
                      prefixIcon: Icons.phone_outlined,
                      isValid: phoneValid,
                      keyboardType: TextInputType.phone,
                      textInputAction: TextInputAction.next,
                      autofillHints: const [AutofillHints.telephoneNumber],
                      validator: (value) {
                        final required = Validators.required(
                          value,
                          fieldName: 'téléphone',
                        );
                        return required ?? Validators.phone(value);
                      },
                      trailing: state.isCheckingPhone
                          ? const SizedBox(
                              width: 18,
                              height: 18,
                              child: CircularProgressIndicator.adaptive(
                                strokeWidth: 2,
                              ),
                            )
                          : state.phoneExists
                          ? Icon(
                              Icons.error_outline_rounded,
                              color: colorScheme.error,
                            )
                          : null,
                    ),
                    if (state.phoneError != null) ...[
                      const SizedBox(height: AppSpacing.sm),
                      AppStatusBanner(
                        title: 'Numéro déjà utilisé',
                        message: state.phoneError!,
                        icon: Icons.person_search_rounded,
                        tone: AppStatusTone.error,
                      ),
                    ],
                    const SizedBox(height: AppSpacing.md),
                    ValidatedTextFormField(
                      controller: notifier.emailController,
                      labelText: 'Email facultatif',
                      hintText: 'Ex. awa@email.com',
                      prefixIcon: Icons.mail_outline_rounded,
                      isValid:
                          emailValid &&
                          notifier.emailController.text.trim().isNotEmpty,
                      keyboardType: TextInputType.emailAddress,
                      textInputAction: TextInputAction.next,
                      autofillHints: const [AutofillHints.email],
                      validator: Validators.email,
                    ),
                    const SizedBox(height: AppSpacing.md),
                    TextFormField(
                      controller: notifier.addressController,
                      maxLines: 2,
                      textInputAction: TextInputAction.done,
                      textCapitalization: TextCapitalization.sentences,
                      scrollPadding: const EdgeInsets.only(
                        bottom: AppSpacing.keyboardScrollPadding,
                      ),
                      decoration: const InputDecoration(
                        labelText: 'Adresse facultative',
                        hintText: 'Quartier, ville ou repère utile',
                        prefixIcon: Icon(Icons.location_on_outlined),
                        alignLabelWithHint: true,
                      ),
                    ),
                  ],
                ),
              ),
              const SizedBox(height: AppSpacing.md),
              const AppStatusBanner(
                title: 'Données privées de l’atelier',
                message:
                    'Ces coordonnées servent uniquement à votre gestion et ne sont jamais publiées dans la marketplace.',
                icon: Icons.lock_outline_rounded,
                tone: AppStatusTone.info,
              ),
            ],
          ),
        ),
      ),
    );
  }
}

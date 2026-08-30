import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter/services.dart';

import '../../../core/navigation/app_navigator.dart';
import '../../../data/models/beneficiary_model.dart';
import '../../theme/app_colors_extensions.dart';
import '../../theme/app_spacing.dart';
import '../../theme/app_text_styles.dart';
import '../buttons/animated_primary_button.dart';
import '../forms/app_text_field.dart';
import '../interaction/pressable_surface.dart';
import '../layouts/polished_page.dart';

class AddBeneficiarySheet extends StatefulWidget {
  const AddBeneficiarySheet({
    super.key,
    required this.clientId,
    required this.onSave,
  });

  final int clientId;
  final FutureOr<void> Function(BeneficiaryModel beneficiary, bool saveForLater)
  onSave;

  @override
  State<AddBeneficiarySheet> createState() => _AddBeneficiarySheetState();
}

class _AddBeneficiarySheetState extends State<AddBeneficiarySheet> {
  final _labelController = TextEditingController();
  BeneficiaryGender _selectedGender = BeneficiaryGender.male;
  bool _saveForLater = true;
  bool _submitting = false;

  static const _suggestions = [
    'Époux',
    'Épouse',
    'Enfant 1',
    'Enfant 2',
    'Mère',
    'Père',
    'Sœur',
    'Frère',
  ];

  bool get _isValid => _labelController.text.trim().length >= 2;

  @override
  Widget build(BuildContext context) {
    return SafeArea(
      top: false,
      child: Padding(
        padding: EdgeInsets.fromLTRB(
          AppSpacing.lg,
          AppSpacing.sm,
          AppSpacing.lg,
          MediaQuery.viewInsetsOf(context).bottom + AppSpacing.lg,
        ),
        child: SingleChildScrollView(
          child: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              const AppSectionHeader(
                title: 'Ajouter un destinataire',
                subtitle:
                    'Enregistrez la personne qui portera l’article, sans créer un nouveau client payeur.',
                icon: Icons.person_add_alt_1_rounded,
              ),
              const SizedBox(height: AppSpacing.md),
              const AppStatusBanner(
                title: 'Dossier familial',
                message:
                    'Les mesures pourront être sauvegardées et réutilisées lors des prochaines commandes.',
                icon: Icons.people_outline_rounded,
                tone: AppStatusTone.info,
              ),
              const SizedBox(height: AppSpacing.lg),
              Text(
                'Suggestions rapides',
                style: AppTextStyles.label.copyWith(
                  color: context.textPrimaryColor,
                ),
              ),
              const SizedBox(height: AppSpacing.sm),
              Wrap(
                spacing: AppSpacing.xs,
                runSpacing: AppSpacing.xs,
                children: _suggestions
                    .map(
                      (label) => ChoiceChip(
                        label: Text(label),
                        selected: _labelController.text == label,
                        onSelected: (_) {
                          HapticFeedback.selectionClick();
                          setState(() {
                            _labelController.text = label;
                            _labelController.selection =
                                TextSelection.collapsed(offset: label.length);
                          });
                        },
                      ),
                    )
                    .toList(growable: false),
              ),
              const SizedBox(height: AppSpacing.lg),
              AppTextField(
                controller: _labelController,
                label: 'Nom ou relation',
                hint: 'Ex. Mariama, mon frère, enfant 3',
                icon: Icons.badge_outlined,
                isValid: _isValid,
                enabled: !_submitting,
                textInputAction: TextInputAction.done,
                onChanged: (_) => setState(() {}),
                onFieldSubmitted: (_) {
                  if (_isValid && !_submitting) _onConfirm();
                },
              ),
              const SizedBox(height: AppSpacing.lg),
              Text(
                'Profil de mesures',
                style: AppTextStyles.label.copyWith(
                  color: context.textPrimaryColor,
                ),
              ),
              const SizedBox(height: AppSpacing.sm),
              Row(
                children: [
                  Expanded(
                    child: _GenderOption(
                      selected: _selectedGender == BeneficiaryGender.female,
                      label: 'Femme',
                      icon: Icons.female_rounded,
                      onTap: () => _selectGender(BeneficiaryGender.female),
                    ),
                  ),
                  const SizedBox(width: AppSpacing.xs),
                  Expanded(
                    child: _GenderOption(
                      selected: _selectedGender == BeneficiaryGender.male,
                      label: 'Homme',
                      icon: Icons.male_rounded,
                      onTap: () => _selectGender(BeneficiaryGender.male),
                    ),
                  ),
                  const SizedBox(width: AppSpacing.xs),
                  Expanded(
                    child: _GenderOption(
                      selected: _selectedGender == BeneficiaryGender.child,
                      label: 'Enfant',
                      icon: Icons.child_care_rounded,
                      onTap: () => _selectGender(BeneficiaryGender.child),
                    ),
                  ),
                ],
              ),
              const SizedBox(height: AppSpacing.md),
              PressableSurface(
                selected: _saveForLater,
                accentColor: Theme.of(context).colorScheme.primary,
                semanticLabel:
                    'Sauvegarder ce destinataire pour les prochaines commandes',
                onTap: _submitting
                    ? null
                    : () => setState(() => _saveForLater = !_saveForLater),
                child: Row(
                  children: [
                    SelectionIndicator(
                      selected: _saveForLater,
                      accent: Theme.of(context).colorScheme.primary,
                      size: 26,
                    ),
                    const SizedBox(width: AppSpacing.sm),
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(
                            'Conserver dans le dossier client',
                            style: AppTextStyles.label.copyWith(
                              color: context.textPrimaryColor,
                            ),
                          ),
                          const SizedBox(height: 2),
                          Text(
                            'Le nom et les futures mesures seront proposés automatiquement.',
                            style: AppTextStyles.bodySmall.copyWith(
                              color: context.textSecondaryColor,
                            ),
                          ),
                        ],
                      ),
                    ),
                  ],
                ),
              ),
              const SizedBox(height: AppSpacing.lg),
              AnimatedPrimaryButton(
                label: 'Ajouter à la commande',
                icon: Icons.person_add_alt_1_rounded,
                enabled: _isValid,
                loading: _submitting,
                onPressed: _onConfirm,
              ),
            ],
          ),
        ),
      ),
    );
  }

  void _selectGender(BeneficiaryGender gender) {
    HapticFeedback.selectionClick();
    setState(() => _selectedGender = gender);
  }

  Future<void> _onConfirm() async {
    if (!_isValid || _submitting) return;
    setState(() => _submitting = true);
    final beneficiary = BeneficiaryModel()
      ..clientId = widget.clientId
      ..label = _labelController.text.trim()
      ..gender = _selectedGender
      ..createdAt = DateTime.now();
    try {
      await widget.onSave(beneficiary, _saveForLater);
      if (mounted) AppNavigator.back();
    } finally {
      if (mounted) setState(() => _submitting = false);
    }
  }

  @override
  void dispose() {
    _labelController.dispose();
    super.dispose();
  }
}

class _GenderOption extends StatelessWidget {
  const _GenderOption({
    required this.selected,
    required this.label,
    required this.icon,
    required this.onTap,
  });

  final bool selected;
  final String label;
  final IconData icon;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return PressableSurface(
      selected: selected,
      accentColor: Theme.of(context).colorScheme.primary,
      onTap: onTap,
      semanticLabel: label,
      padding: const EdgeInsets.symmetric(vertical: 13, horizontal: 8),
      child: Column(
        children: [
          Icon(
            icon,
            color: selected
                ? Theme.of(context).colorScheme.primary
                : context.textSecondaryColor,
          ),
          const SizedBox(height: 5),
          Text(
            label,
            style: AppTextStyles.caption.copyWith(
              color: selected
                  ? Theme.of(context).colorScheme.primary
                  : context.textPrimaryColor,
              fontWeight: FontWeight.w700,
            ),
          ),
        ],
      ),
    );
  }
}

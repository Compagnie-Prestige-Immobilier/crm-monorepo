import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/navigation/app_navigator.dart';
import '../../../data/services/active_space_provider.dart';
import '../../../data/services/app_space.dart';
import '../../../data/services/storage_service.dart';
import '../../../routes/app_routes.dart';
import '../../../shared/theme/app_colors_extensions.dart';
import '../../../shared/theme/app_motion.dart';
import '../../../shared/theme/app_spacing.dart';
import '../../../shared/theme/app_text_styles.dart';

/// Selects the active product workspace before authentication.
///
/// Rebuilt to do one job. The previous version stacked a marketing hero, a
/// question, two option cards carrying icon tiles and feature chips, a status
/// hint and a CTA into a single scroll — five competing focal points, with the
/// hero's body copy clipping mid-sentence on a 360dp screen.
///
/// The layout now follows the pattern the reference filter sheets use: a plain
/// left-aligned question, wide gaps between groups, tight spacing inside them,
/// and a persistent action bar pinned to the bottom instead of floating at the
/// end of the scroll.
class SpaceSelectorView extends ConsumerStatefulWidget {
  const SpaceSelectorView({super.key});

  @override
  ConsumerState<SpaceSelectorView> createState() => _SpaceSelectorViewState();
}

class _SpaceSelectorViewState extends ConsumerState<SpaceSelectorView> {
  AppSpace? _selectedSpace;
  bool _isSaving = false;

  @override
  void initState() {
    super.initState();
    _restoreCurrentSpace();
  }

  Future<void> _restoreCurrentSpace() async {
    final activeSpace = await StorageService().activeSpace;
    if (!mounted || activeSpace == null) return;
    setState(() => _selectedSpace = activeSpace);
  }

  @override
  Widget build(BuildContext context) {
    final selectedIsAtelier = _selectedSpace == AppSpace.atelier;

    return Scaffold(
      backgroundColor: context.backgroundColor,
      body: SafeArea(
        child: Column(
          children: [
            _TopBar(
              onBack: _isSaving
                  ? null
                  : () => AppNavigator.offAll(AppRoutes.onboarding),
            ),
            Expanded(
              child: SingleChildScrollView(
                padding: const EdgeInsets.fromLTRB(
                  AppSpacing.gutter,
                  AppSpacing.lg,
                  AppSpacing.gutter,
                  AppSpacing.lg,
                ),
                child: ConstrainedBox(
                  constraints: const BoxConstraints(maxWidth: 560),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.stretch,
                    children: [
                      // Left-aligned, and the only display-face element on the
                      // screen. The old layout ran two Fraunces headlines
                      // against each other, so neither one read as the subject.
                      Text(
                        'Comment utiliserez-vous Gnawalma ?',
                        style: AppTextStyles.h2.copyWith(
                          color: context.textPrimaryColor,
                        ),
                      ),
                      const SizedBox(height: 12),
                      Text(
                        'Le même compte passe de l’un à l’autre à tout moment.',
                        style: AppTextStyles.bodyLarge.copyWith(
                          color: context.textSecondaryColor,
                        ),
                      ),
                      const SizedBox(height: AppSpacing.sectionSpacing),
                      _SpaceOption(
                        selected: _selectedSpace == AppSpace.client,
                        title: 'Je cherche un atelier',
                        description:
                            'Trouvez des couturiers proches et comparez leurs réalisations.',
                        onTap: _isSaving
                            ? null
                            : () => _selectSpace(AppSpace.client),
                      ),
                      const SizedBox(height: AppSpacing.sm),
                      _SpaceOption(
                        selected: _selectedSpace == AppSpace.atelier,
                        title: 'Je gère un atelier',
                        description:
                            'Clients, mesures, commandes et paiements au même endroit.',
                        onTap: _isSaving
                            ? null
                            : () => _selectSpace(AppSpace.atelier),
                      ),
                      // An illustration used to react to the selection here.
                      // Illustrations are scoped to empty states
                      // (`knowledge-base/DESIGN.md`) and a choice screen is not
                      // one — the selected card already confirms the answer,
                      // and a drawing that changes underneath it competes with
                      // the confirmation rather than reinforcing it.
                    ],
                  ),
                ),
              ),
            ),
            _ActionBar(
              label: selectedIsAtelier
                  ? 'Continuer vers l’Atelier'
                  : 'Continuer comme client',
              enabled: _selectedSpace != null,
              loading: _isSaving,
              onPressed: _continue,
            ),
          ],
        ),
      ),
    );
  }

  void _selectSpace(AppSpace space) {
    HapticFeedback.selectionClick();
    setState(() => _selectedSpace = space);
  }

  Future<void> _continue() async {
    final selected = _selectedSpace;
    if (selected == null || _isSaving) return;
    HapticFeedback.mediumImpact();
    setState(() => _isSaving = true);
    await ref.read(activeSpaceProvider.notifier).select(selected);
    if (!mounted) return;
    AppNavigator.offAll(AppRoutes.auth);
  }
}

class _TopBar extends StatelessWidget {
  const _TopBar({required this.onBack});

  final VoidCallback? onBack;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.fromLTRB(
        AppSpacing.gutter,
        AppSpacing.xs,
        AppSpacing.gutter,
        0,
      ),
      child: Row(
        children: [
          // Nudged back by the icon's own inset so the glyph optically lines up
          // with the gutter the content below uses.
          Transform.translate(
            offset: const Offset(-AppSpacing.sm, 0),
            child: IconButton(
              tooltip: 'Retour',
              onPressed: onBack,
              icon: const Icon(Icons.arrow_back_rounded),
            ),
          ),
          const Spacer(),
          // Progress as plain mono text rather than a pill. A chip here reads
          // as something tappable; this is a read-only position indicator.
          Text(
            'ÉTAPE 1 / 2',
            style: AppTextStyles.tag.copyWith(
              color: context.textSecondaryColor,
            ),
          ),
        ],
      ),
    );
  }
}

/// A full-width choice.
///
/// No icon tile, no feature chips. Both were decoration standing between the
/// user and a binary decision, and the chips in particular invited taps that
/// did nothing.
class _SpaceOption extends StatelessWidget {
  const _SpaceOption({
    required this.selected,
    required this.title,
    required this.description,
    required this.onTap,
  });

  final bool selected;
  final String title;
  final String description;
  final VoidCallback? onTap;

  @override
  Widget build(BuildContext context) {
    final ink = context.textPrimaryColor;

    return Semantics(
      inMutuallyExclusiveGroup: true,
      checked: selected,
      label: '$title. $description',
      child: Material(
        color: Colors.transparent,
        child: InkWell(
          onTap: onTap,
          borderRadius: BorderRadius.circular(AppSpacing.radiusCard),
          child: AnimatedContainer(
            duration: AppMotion.duration(context, AppMotion.quick),
            curve: AppMotion.curve(context, AppMotion.enter),
            padding: const EdgeInsets.all(AppSpacing.cardPadding),
            decoration: BoxDecoration(
              color: context.surfaceColor,
              borderRadius: BorderRadius.circular(AppSpacing.radiusCard),
              // Selection is carried by border weight and colour only. A tinted
              // fill would collide with the accent, which is reserved for status.
              border: Border.all(
                color: selected ? ink : context.borderColor,
                width: selected ? 2 : 1.3,
              ),
            ),
            child: Row(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(title, style: AppTextStyles.h5.copyWith(color: ink)),
                      const SizedBox(height: AppSpacing.xxs + 2),
                      Text(
                        description,
                        style: AppTextStyles.bodyMedium.copyWith(
                          color: context.textSecondaryColor,
                        ),
                      ),
                    ],
                  ),
                ),
                const SizedBox(width: AppSpacing.md),
                _Radio(selected: selected, ink: ink),
              ],
            ),
          ),
        ),
      ),
    );
  }
}

class _Radio extends StatelessWidget {
  const _Radio({required this.selected, required this.ink});

  final bool selected;
  final Color ink;

  @override
  Widget build(BuildContext context) {
    return AnimatedContainer(
      duration: AppMotion.duration(context, AppMotion.quick),
      curve: AppMotion.curve(context, AppMotion.enter),
      width: 22,
      height: 22,
      decoration: BoxDecoration(
        shape: BoxShape.circle,
        color: selected ? ink : Colors.transparent,
        border: Border.all(
          color: selected ? ink : context.borderColor,
          width: 1.6,
        ),
      ),
      child: selected
          ? Icon(Icons.check_rounded, size: 14, color: context.backgroundColor)
          : null,
    );
  }
}

/// Pinned action bar.
///
/// Keeping the CTA on screen rather than at the end of the scroll means the
/// user can commit the moment they decide, instead of scrolling to find out
/// what happens next.
class _ActionBar extends StatelessWidget {
  const _ActionBar({
    required this.label,
    required this.enabled,
    required this.loading,
    required this.onPressed,
  });

  final String label;
  final bool enabled;
  final bool loading;
  final VoidCallback onPressed;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.fromLTRB(
        AppSpacing.gutter,
        AppSpacing.md,
        AppSpacing.gutter,
        AppSpacing.md,
      ),
      decoration: BoxDecoration(
        color: context.backgroundColor,
        border: Border(top: BorderSide(color: context.borderColor)),
      ),
      child: SizedBox(
        height: AppSpacing.buttonHeightLG,
        child: FilledButton(
          onPressed: enabled && !loading ? onPressed : null,
          child: loading
              ? SizedBox(
                  width: 20,
                  height: 20,
                  child: CircularProgressIndicator.adaptive(
                    valueColor: AlwaysStoppedAnimation(context.backgroundColor),
                  ),
                )
              : Text(enabled ? label : 'Choisissez un espace'),
        ),
      ),
    );
  }
}

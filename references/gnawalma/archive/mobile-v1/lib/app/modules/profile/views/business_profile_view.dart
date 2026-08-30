import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_animate/flutter_animate.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/navigation/app_navigator.dart';
import '../../../core/network/api_exception.dart';
import '../../../shared/theme/app_colors_extensions.dart';
import '../../../shared/theme/app_motion.dart';
import '../../../shared/theme/app_spacing.dart';
import '../../../shared/theme/app_text_styles.dart';
import '../../../shared/utils/app_dialogs.dart';
import '../../../shared/widgets/buttons/animated_primary_button.dart';
import '../../../shared/widgets/feedback/app_toast.dart';
import '../../../shared/constants/atelier_specialties.dart';
import '../../../shared/widgets/forms/app_text_field.dart';
import '../../../shared/widgets/forms/custom_dropdown.dart';
import '../../../shared/widgets/layouts/polished_page.dart';
import '../../../shared/widgets/navigation/custom_app_bar.dart';
import '../../../shared/widgets/visuals/social_icon.dart';
import '../../operations/controllers/operations_providers.dart';
import '../../operations/domain/operations_models.dart';
import '../../operations/widgets/social_links_editor.dart';
import '../../setup_wizard/domain/atelier_regions.dart';
import '../controllers/business_profile_provider.dart';
import 'package:image_picker/image_picker.dart';
import '../../../shared/widgets/inputs/logo_picker.dart';

/// Gap between two fields of the same group. Deliberately much smaller than
/// [AppSpacing.sectionSpacing]: tight within a group, generous between groups.
const double _fieldGap = 18.0;

class BusinessProfileView extends ConsumerWidget {
  const BusinessProfileView({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final state = ref.watch(businessProfileProvider);
    final notifier = ref.read(businessProfileProvider.notifier);
    final controllers = <Listenable>[
      notifier.businessNameController,
      notifier.addressController,
      notifier.phoneController,
      notifier.emailController,
      notifier.taxIdController,
      notifier.footerNoteController,
    ];
    final isInitialLoading =
        state.isLoading &&
        notifier.businessNameController.text.trim().isEmpty &&
        state.logoPath == null;

    return PopScope(
      canPop: !notifier.hasUnsavedChanges,
      onPopInvokedWithResult: (didPop, result) async {
        if (didPop) return;
        final discard = await AppDialogs.showConfirmation(
          title: 'Abandonner les modifications ?',
          message:
              'Les changements apportés au profil de l’atelier ne seront pas enregistrés.',
          confirmLabel: 'Abandonner',
          isDangerous: true,
        );
        if (discard == true) AppNavigator.back();
      },
      child: Scaffold(
        backgroundColor: context.backgroundColor,
        appBar: const CustomAppBar(
          title: 'Profil Atelier',
          showBackButton: true,
        ),
        body: SafeArea(
          top: false,
          child: isInitialLoading
              ? const _ProfileLoadingState()
              : AnimatedBuilder(
                  animation: Listenable.merge(controllers),
                  builder: (context, _) {
                    final businessName = notifier.businessNameController.text
                        .trim();
                    final businessNameValid = businessName.length >= 3;
                    final phone = notifier.phoneController.text.trim();
                    final phoneValid =
                        phone.isEmpty ||
                        phone.replaceAll(RegExp(r'\D'), '').length >= 9;
                    final email = notifier.emailController.text.trim();
                    final emailValid =
                        email.isEmpty ||
                        RegExp(
                          r'^[^\s@]+@[^\s@]+\.[^\s@]{2,}$',
                        ).hasMatch(email);
                    final canSave =
                        businessNameValid && phoneValid && emailValid;

                    return SingleChildScrollView(
                      keyboardDismissBehavior:
                          ScrollViewKeyboardDismissBehavior.onDrag,
                      padding: const EdgeInsets.fromLTRB(
                        AppSpacing.gutter,
                        AppSpacing.md,
                        AppSpacing.gutter,
                        AppSpacing.xl,
                      ),
                      child: Form(
                        key: notifier.formKey,
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.stretch,
                          children: [
                            // The identity block, not a placeholder box: the
                            // logo, the name as it will be read, and the one
                            // affordance that changes the logo.
                            _entrance(
                              context,
                              0,
                              _IdentityHero(
                                businessName: businessName,
                                logoPath: state.logoPath,
                                busy: state.isPickingLogo,
                                error: state.logoError,
                                onPick: notifier.pickLogo,
                                onRemove: notifier.removeLogo,
                              ),
                            ),
                            const SizedBox(height: AppSpacing.sectionSpacing),
                            _entrance(
                              context,
                              1,
                              _FormGroup(
                                title: 'Coordonnées',
                                subtitle:
                                    'Comment vos clientes vous trouvent et vous joignent.',
                                children: [
                                  AppTextField(
                                    controller: notifier.businessNameController,
                                    label: 'Nom de l’atelier',
                                    hint: 'Ex. Maison Awa Couture',
                                    icon: Icons.storefront_outlined,
                                    isValid: businessNameValid,
                                    enabled: !state.isLoading,
                                    textInputAction: TextInputAction.next,
                                    autofillHints: const [
                                      AutofillHints.organizationName,
                                    ],
                                    validator: (value) {
                                      if ((value ?? '').trim().length < 3) {
                                        return 'Saisissez au moins trois caractères.';
                                      }
                                      return null;
                                    },
                                  ),
                                  // La région est la valeur sur laquelle la
                                  // recherche cliente filtre ; l'adresse libre
                                  // ne sert qu'à se faire trouver sur place.
                                  CustomDropdown<AtelierRegion>(
                                    label: 'Région',
                                    hint: 'Choisissez votre région',
                                    value: AtelierRegions.byId(state.regionId),
                                    items: AtelierRegions.all,
                                    itemLabelBuilder: (region) => region.label,
                                    prefixIcon: const Icon(Icons.map_outlined),
                                    onChanged: (region) =>
                                        notifier.setRegion(region.id),
                                  ),
                                  AppTextField(
                                    controller: notifier.addressController,
                                    label: 'Adresse',
                                    hint: 'Quartier, ville et repère utile',
                                    icon: Icons.location_on_outlined,
                                    maxLines: 2,
                                    enabled: !state.isLoading,
                                    textInputAction: TextInputAction.next,
                                    autofillHints: const [
                                      AutofillHints.fullStreetAddress,
                                    ],
                                  ),
                                  AppTextField(
                                    controller: notifier.phoneController,
                                    label: 'Téléphone professionnel',
                                    hint: '77 000 00 00',
                                    icon: Icons.phone_outlined,
                                    keyboardType: TextInputType.phone,
                                    isValid: phone.isNotEmpty && phoneValid,
                                    enabled: !state.isLoading,
                                    textInputAction: TextInputAction.next,
                                    autofillHints: const [
                                      AutofillHints.telephoneNumber,
                                    ],
                                    validator: (value) {
                                      final raw = (value ?? '').trim();
                                      if (raw.isEmpty) return null;
                                      if (raw
                                              .replaceAll(RegExp(r'\D'), '')
                                              .length <
                                          9) {
                                        return 'Saisissez un numéro valide.';
                                      }
                                      return null;
                                    },
                                  ),
                                  AppTextField(
                                    controller: notifier.emailController,
                                    label: 'Email professionnel',
                                    hint: 'contact@atelier.sn',
                                    icon: Icons.email_outlined,
                                    keyboardType: TextInputType.emailAddress,
                                    isValid: email.isNotEmpty && emailValid,
                                    enabled: !state.isLoading,
                                    textInputAction: TextInputAction.next,
                                    autofillHints: const [AutofillHints.email],
                                    validator: (value) {
                                      final raw = (value ?? '').trim();
                                      if (raw.isEmpty) return null;
                                      if (!RegExp(
                                        r'^[^\s@]+@[^\s@]+\.[^\s@]{2,}$',
                                      ).hasMatch(raw)) {
                                        return 'Saisissez une adresse email valide.';
                                      }
                                      return null;
                                    },
                                  ),
                                ],
                              ),
                            ),
                            const SizedBox(height: AppSpacing.sectionSpacing),
                            _entrance(
                              context,
                              2,
                              _SpecialtiesSection(
                                selected: state.specialties,
                                enabled: !state.isLoading,
                                onToggle: notifier.toggleSpecialty,
                              ),
                            ),
                            const SizedBox(height: AppSpacing.sectionSpacing),
                            _entrance(
                              context,
                              3,
                              _FormGroup(
                                title: 'Mentions sur vos documents',
                                subtitle:
                                    'Facultatif. Ajoutez seulement ce qui doit figurer sur vos reçus.',
                                // Both fields can stay empty, so the group ends
                                // on a preview instead of on a blank space.
                                footer: _DocumentPreview(
                                  businessName: businessName,
                                  taxId: notifier.taxIdController.text.trim(),
                                  footerNote: notifier.footerNoteController.text
                                      .trim(),
                                ),
                                children: [
                                  AppTextField(
                                    controller: notifier.taxIdController,
                                    label: 'NINEA ou identifiant fiscal',
                                    hint: 'Facultatif',
                                    icon: Icons.badge_outlined,
                                    enabled: !state.isLoading,
                                    textInputAction: TextInputAction.next,
                                  ),
                                  AppTextField(
                                    controller: notifier.footerNoteController,
                                    label: 'Note de pied de page',
                                    hint: 'Ex. Merci de votre confiance.',
                                    icon: Icons.notes_outlined,
                                    maxLines: 3,
                                    enabled: !state.isLoading,
                                    textInputAction: TextInputAction.done,
                                    scrollPadding: const EdgeInsets.only(
                                      bottom: 200,
                                    ),
                                  ),
                                ],
                              ),
                            ),
                            const SizedBox(height: AppSpacing.sectionSpacing),
                            _entrance(context, 4, const _SocialLinksSection()),
                            const SizedBox(height: AppSpacing.sectionSpacing),
                            _entrance(
                              context,
                              5,
                              _SaveBlock(
                                canSave: canSave,
                                isDirty: notifier.hasUnsavedChanges,
                                isSaving: state.isLoading,
                                onSave: () async {
                                  HapticFeedback.mediumImpact();
                                  final success = await notifier.saveProfile();
                                  if (success && context.mounted) {
                                    AppNavigator.back();
                                  }
                                },
                              ),
                            ),
                          ],
                        ),
                      ),
                    );
                  },
                ),
        ),
      ),
    );
  }

  /// Decorative arrival only — the form is fully usable before it finishes and
  /// collapses to nothing when the OS asks for reduced motion.
  Widget _entrance(BuildContext context, int index, Widget child) {
    if (AppMotion.reduced(context)) return child;
    return child
        .animate()
        .fadeIn(
          duration: AppMotion.standard,
          delay: AppMotion.staggerFor(index),
          curve: AppMotion.enter,
        )
        .slideY(
          begin: 0.045,
          end: 0,
          duration: AppMotion.standard,
          delay: AppMotion.staggerFor(index),
          curve: AppMotion.enter,
        );
  }
}

/// Who this atelier is, at the top of the form that defines it.
///
/// The previous version was a tinted wash around a 76pt "add a photo" square,
/// which read as an upload widget rather than as identity. Here the name the
/// user is typing is the headline, the logo well is a real 96pt piece of the
/// composition, and the line drawing stands in for the logo until one is set —
/// so the empty state is composed instead of blank.
class _IdentityHero extends StatelessWidget {
  const _IdentityHero({
    required this.businessName,
    required this.logoPath,
    required this.busy,
    required this.error,
    required this.onPick,
    required this.onRemove,
  });

  final String businessName;
  final String? logoPath;
  final bool busy;
  final String? error;
  final ValueChanged<ImageSource> onPick;
  final VoidCallback onRemove;

  @override
  Widget build(BuildContext context) {
    final hasLogo = logoPath != null;
    return Row(
      crossAxisAlignment: CrossAxisAlignment.center,
      children: [
        LogoPicker(
          logoPath: logoPath,
          busy: busy,
          error: error,
          onPick: onPick,
          onRemove: onRemove,
        ),
        const SizedBox(width: AppSpacing.md),
        Expanded(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            mainAxisSize: MainAxisSize.min,
            children: [
              Text(
                'IDENTITÉ DE L’ATELIER',
                maxLines: 1,
                overflow: TextOverflow.ellipsis,
                style: AppTextStyles.overline.copyWith(
                  color: context.textSecondaryColor,
                ),
              ),
              const SizedBox(height: 6),
              // The name is echoed at title weight: the user sees what the
              // field below actually produces.
              Text(
                businessName.isEmpty ? 'Votre atelier' : businessName,
                maxLines: 2,
                overflow: TextOverflow.ellipsis,
                style: AppTextStyles.h3.copyWith(
                  color: businessName.isEmpty
                      ? context.textSecondaryColor
                      : context.textPrimaryColor,
                ),
              ),
              const SizedBox(height: 6),
              Text(
                hasLogo
                    ? 'Touchez le logo pour le remplacer.'
                    : 'Touchez le carré pour ajouter un logo carré.',
                maxLines: 2,
                overflow: TextOverflow.ellipsis,
                style: AppTextStyles.bodySmall.copyWith(
                  color: context.textSecondaryColor,
                ),
              ),
            ],
          ),
        ),
      ],
    );
  }
}

/// One group of the form. Same chrome as the Réglages and Préférences screens:
/// a real header, a rule that brackets the group, then tight content — with an
/// optional footer so a group whose fields are all optional still lands.
class _FormGroup extends StatelessWidget {
  const _FormGroup({
    required this.title,
    required this.subtitle,
    required this.children,
    this.footer,
  });

  final String title;
  final String subtitle;
  final List<Widget> children;
  final Widget? footer;

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        AppSectionHeader(title: title, subtitle: subtitle),
        const SizedBox(height: AppSpacing.sm),
        Divider(height: 1, color: context.dividerColor),
        const SizedBox(height: AppSpacing.md),
        for (var index = 0; index < children.length; index++) ...[
          children[index],
          if (index < children.length - 1) const SizedBox(height: _fieldGap),
        ],
        if (footer != null) ...[const SizedBox(height: AppSpacing.lg), footer!],
      ],
    );
  }
}

/// Where an atelier owner actually looks to change their TikTok/Instagram/
/// Facebook links. They used to only be editable from a card buried in the
/// operations dashboard — findable only by someone who already knew it was
/// there. This is the profile edit screen, so this is where they belong.
class _SocialLinksSection extends ConsumerStatefulWidget {
  const _SocialLinksSection();

  @override
  ConsumerState<_SocialLinksSection> createState() =>
      _SocialLinksSectionState();
}

class _SocialLinksSectionState extends ConsumerState<_SocialLinksSection> {
  bool _busy = false;

  Future<void> _edit(RemoteAtelier atelier) async {
    final result = await showModalBottomSheet<SocialLinksResult>(
      context: context,
      isScrollControlled: true,
      showDragHandle: true,
      useSafeArea: true,
      builder: (_) => SocialLinksEditorSheet(
        initialTiktokUrl: atelier.tiktokUrl,
        initialInstagramUrl: atelier.instagramUrl,
        initialFacebookUrl: atelier.facebookUrl,
      ),
    );
    if (result == null || !mounted) return;

    setState(() => _busy = true);
    try {
      await ref
          .read(operationsRepositoryProvider)
          .updateAtelier(
            atelier.id,
            tiktokUrl: result.tiktokUrl,
            instagramUrl: result.instagramUrl,
            facebookUrl: result.facebookUrl,
          );
      ref.invalidate(remoteAteliersProvider);
      ref.invalidate(primaryRemoteAtelierProvider);
      AppToast.show(
        title: 'Réseaux mis à jour',
        message: 'Vos clients les voient sur votre fiche.',
        type: ToastType.success,
      );
    } catch (error) {
      AppToast.show(
        title: 'Modification impossible',
        message: error is ApiException
            ? error.message
            : 'Vérifiez votre connexion puis réessayez.',
        type: ToastType.error,
      );
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final atelierAsync = ref.watch(primaryRemoteAtelierProvider);
    final atelier = atelierAsync.asData?.value;

    final present = <SocialNetwork>[
      if ((atelier?.tiktokUrl ?? '').trim().isNotEmpty) SocialNetwork.tiktok,
      if ((atelier?.instagramUrl ?? '').trim().isNotEmpty)
        SocialNetwork.instagram,
      if ((atelier?.facebookUrl ?? '').trim().isNotEmpty)
        SocialNetwork.facebook,
    ];

    // Same chrome as the groups above — `_FormGroup` rather than a second
    // header+divider construction — so this reads as one more field group in
    // the same form, not a card bolted on after it.
    return _FormGroup(
      title: 'Réseaux sociaux',
      subtitle: 'Vos clients y voient vos réalisations avant d’appeler.',
      children: [
        Row(
          children: [
            Expanded(
              child: present.isEmpty
                  ? Text(
                      'Aucun réseau publié',
                      style: AppTextStyles.bodyMedium.copyWith(
                        color: context.textSecondaryColor,
                      ),
                    )
                  : Row(
                      children: [
                        for (final network in present) ...[
                          SocialIcon(network: network, size: 20),
                          const SizedBox(width: AppSpacing.xs),
                        ],
                        Flexible(
                          child: Text(
                            present.length == 1
                                ? '1 réseau publié'
                                : '${present.length} réseaux publiés',
                            maxLines: 1,
                            overflow: TextOverflow.ellipsis,
                            style: AppTextStyles.bodyMedium.copyWith(
                              color: context.textSecondaryColor,
                            ),
                          ),
                        ),
                      ],
                    ),
            ),
            OutlinedButton.icon(
              onPressed: atelier == null || _busy ? null : () => _edit(atelier),
              icon: _busy
                  ? const SizedBox.square(
                      dimension: 16,
                      child: CircularProgressIndicator.adaptive(
                        strokeWidth: 2,
                      ),
                    )
                  : const Icon(Icons.edit_outlined, size: 18),
              label: Text(present.isEmpty ? 'Ajouter' : 'Modifier'),
            ),
          ],
        ),
      ],
    );
  }
}

/// What the optional mentions actually produce, in the shape they will be
/// printed. Flat: a hairline frame, no fill.
class _DocumentPreview extends StatelessWidget {
  const _DocumentPreview({
    required this.businessName,
    required this.taxId,
    required this.footerNote,
  });

  final String businessName;
  final String taxId;
  final String footerNote;

  @override
  Widget build(BuildContext context) {
    final hasMentions = taxId.isNotEmpty || footerNote.isNotEmpty;
    return Container(
      padding: const EdgeInsets.all(AppSpacing.cardPadding),
      decoration: BoxDecoration(
        borderRadius: BorderRadius.circular(AppSpacing.radiusLG),
        border: Border.all(color: context.borderColor.withValues(alpha: .72)),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Text(
            'PIED DE PAGE DES REÇUS',
            maxLines: 1,
            overflow: TextOverflow.ellipsis,
            textAlign: TextAlign.center,
            style: AppTextStyles.overline.copyWith(
              color: context.textSecondaryColor,
            ),
          ),
          const SizedBox(height: AppSpacing.sm),
          Divider(height: 1, color: context.dividerColor),
          const SizedBox(height: AppSpacing.sm),
          Text(
            businessName.isEmpty ? 'Votre atelier' : businessName,
            maxLines: 1,
            overflow: TextOverflow.ellipsis,
            textAlign: TextAlign.center,
            style: AppTextStyles.label.copyWith(
              color: businessName.isEmpty
                  ? context.textSecondaryColor
                  : context.textPrimaryColor,
            ),
          ),
          if (taxId.isNotEmpty) ...[
            const SizedBox(height: 4),
            Text(
              'NINEA $taxId',
              maxLines: 1,
              overflow: TextOverflow.ellipsis,
              textAlign: TextAlign.center,
              style: AppTextStyles.caption.copyWith(
                color: context.textSecondaryColor,
              ),
            ),
          ],
          if (footerNote.isNotEmpty) ...[
            const SizedBox(height: 6),
            Text(
              footerNote,
              maxLines: 3,
              overflow: TextOverflow.ellipsis,
              textAlign: TextAlign.center,
              style: AppTextStyles.bodySmall.copyWith(
                color: context.textPrimaryColor,
              ),
            ),
          ],
          if (!hasMentions) ...[
            const SizedBox(height: 6),
            Text(
              'Aucune mention supplémentaire ne sera imprimée.',
              maxLines: 2,
              overflow: TextOverflow.ellipsis,
              textAlign: TextAlign.center,
              style: AppTextStyles.bodySmall.copyWith(
                color: context.textSecondaryColor,
              ),
            ),
          ],
        ],
      ),
    );
  }
}

/// The commit point. A rule closes the form, one line states exactly why the
/// button is or is not live, then the near-black primary action.
class _SaveBlock extends StatelessWidget {
  const _SaveBlock({
    required this.canSave,
    required this.isDirty,
    required this.isSaving,
    required this.onSave,
  });

  final bool canSave;
  final bool isDirty;
  final bool isSaving;
  final Future<void> Function() onSave;

  @override
  Widget build(BuildContext context) {
    // The single accent on this screen, and only ever as status: work that
    // exists on screen but not yet on disk.
    final accent = Theme.of(context).colorScheme.secondary;
    final (IconData icon, String message, Color color) = !canSave
        ? (
            Icons.error_outline_rounded,
            'Complétez le nom de l’atelier et corrigez les champs signalés.',
            context.textSecondaryColor,
          )
        : isDirty
        ? (Icons.edit_outlined, 'Modifications non enregistrées.', accent)
        : (
            Icons.check_circle_outline_rounded,
            'Profil à jour.',
            context.textSecondaryColor,
          );

    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        Divider(height: 1, color: context.dividerColor),
        const SizedBox(height: AppSpacing.lg),
        Semantics(
          liveRegion: true,
          child: Row(
            children: [
              Icon(icon, size: 17, color: color),
              const SizedBox(width: 7),
              Expanded(
                child: Text(
                  message,
                  maxLines: 2,
                  overflow: TextOverflow.ellipsis,
                  style: AppTextStyles.bodySmall.copyWith(color: color),
                ),
              ),
            ],
          ),
        ),
        const SizedBox(height: AppSpacing.sm),
        AnimatedPrimaryButton(
          label: 'Enregistrer les modifications',
          enabled: canSave,
          loading: isSaving,
          backgroundColor: Theme.of(context).colorScheme.primary,
          icon: Icons.check_rounded,
          onPressed: onSave,
        ),
        const SizedBox(height: AppSpacing.sm),
        Text(
          'Les changements sont conservés localement et synchronisés selon la disponibilité du réseau.',
          textAlign: TextAlign.center,
          maxLines: 2,
          overflow: TextOverflow.ellipsis,
          style: AppTextStyles.caption.copyWith(
            color: context.textSecondaryColor.withValues(alpha: .72),
          ),
        ),
      ],
    );
  }
}

class _ProfileLoadingState extends StatelessWidget {
  const _ProfileLoadingState();

  @override
  Widget build(BuildContext context) {
    return Center(
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          const CircularProgressIndicator.adaptive(),
          const SizedBox(height: AppSpacing.md),
          Text(
            'Chargement du profil…',
            style: AppTextStyles.bodyMedium.copyWith(
              color: context.textSecondaryColor,
            ),
          ),
        ],
      ),
    );
  }
}

/// Pour qui l'atelier coud. Demandé ici et nulle part ailleurs : l'assistant
/// d'inscription posait la question sous forme de matières, pré-cochées, que
/// personne ne relisait.
class _SpecialtiesSection extends StatelessWidget {
  const _SpecialtiesSection({
    required this.selected,
    required this.enabled,
    required this.onToggle,
  });

  final List<String> selected;
  final bool enabled;
  final void Function(String) onToggle;

  @override
  Widget build(BuildContext context) {
    return _FormGroup(
      title: 'Vos spécialités',
      subtitle:
          'Ce que vos clients peuvent filtrer dans la recherche. Facultatif.',
      children: [
        Wrap(
          spacing: AppSpacing.sm,
          runSpacing: AppSpacing.sm,
          children: AtelierSpecialties.all
              .map(
                (specialty) => FilterChip(
                  label: Text(specialty),
                  selected: selected.contains(specialty),
                  onSelected: enabled
                      ? (_) {
                          HapticFeedback.selectionClick();
                          onToggle(specialty);
                        }
                      : null,
                ),
              )
              .toList(growable: false),
        ),
      ],
    );
  }
}

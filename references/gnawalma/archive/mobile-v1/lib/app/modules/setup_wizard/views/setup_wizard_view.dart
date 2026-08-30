import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../shared/theme/app_colors_extensions.dart';
import '../../../shared/theme/app_motion.dart';
import '../../../shared/theme/app_spacing.dart';
import '../../../shared/theme/app_text_styles.dart';
import '../../../shared/widgets/buttons/animated_primary_button.dart';
import '../../../shared/widgets/forms/app_text_field.dart';
import '../../../shared/widgets/forms/custom_dropdown.dart';
import '../../../shared/widgets/layouts/polished_page.dart';
import '../../auth/domain/auth_input_validation.dart';
import '../controllers/setup_wizard_provider.dart';
import '../domain/atelier_regions.dart';
import '../../../shared/widgets/feedback/app_toast.dart';
import '../../../shared/widgets/inputs/logo_picker.dart';
import '../../../shared/widgets/visuals/social_icon.dart';
import '../../../shared/utils/social_link_utils.dart';

class SetupWizardView extends ConsumerStatefulWidget {
  const SetupWizardView({super.key});

  @override
  ConsumerState<SetupWizardView> createState() => _SetupWizardViewState();
}

class _SetupWizardViewState extends ConsumerState<SetupWizardView> {
  final PageController _pageController = PageController();
  bool _isAnimatingPage = false;

  @override
  void dispose() {
    _pageController.dispose();
    super.dispose();
  }

  Future<void> _animateTo(int index) async {
    _isAnimatingPage = true;
    try {
      await _pageController.animateToPage(
        index,
        duration: AppMotion.standard,
        curve: AppMotion.enter,
      );
    } finally {
      _isAnimatingPage = false;
    }
  }

  Future<void> _onNext(SetupWizardState state, SetupWizard notifier) async {
    if (_isAnimatingPage) return;
    HapticFeedback.mediumImpact();
    if (state.pageIndex < SetupWizard.lastPageIndex) {
      final targetIndex = state.pageIndex + 1;
      notifier.next();
      await _animateTo(targetIndex);
      return;
    }
    final outcome = await notifier.finish();
    if (outcome == null) return;
    // Publication is the part the owner cannot check for themselves, so it is
    // stated rather than assumed. Previously the wizard simply closed, and an
    // atelier that had never been submitted looked exactly like one that had.
    AppToast.show(
      title: outcome == AtelierPublicationOutcome.submitted
          ? 'Atelier publié'
          : 'Atelier créé, publication à relancer',
      message: outcome == AtelierPublicationOutcome.submitted
          ? 'Vous apparaissez dès maintenant dans la recherche des clients. La plateforme vérifiera votre dossier ensuite.'
          : 'Votre espace est prêt, mais la demande de publication n’est pas partie. Relancez-la depuis le tableau de bord.',
      type: outcome == AtelierPublicationOutcome.submitted
          ? ToastType.success
          : ToastType.warning,
    );
  }

  Future<void> _onPrevious(SetupWizardState state, SetupWizard notifier) async {
    if (_isAnimatingPage || state.pageIndex == 0 || state.isLoading) return;
    HapticFeedback.selectionClick();
    final targetIndex = state.pageIndex - 1;
    notifier.previous();
    await _animateTo(targetIndex);
  }

  @override
  Widget build(BuildContext context) {
    final state = ref.watch(setupWizardProvider);
    final notifier = ref.read(setupWizardProvider.notifier);
    final canContinue = _canContinue(state);

    return PopScope(
      canPop: state.pageIndex == 0 && !state.isLoading,
      onPopInvokedWithResult: (didPop, _) {
        if (!didPop && state.pageIndex > 0) {
          _onPrevious(state, notifier);
        }
      },
      child: Scaffold(
        backgroundColor: context.backgroundColor,
        body: SafeArea(
          child: Column(
            children: [
              _WizardHeader(
                currentStep: state.pageIndex,
                onBack: state.pageIndex == 0 || state.isLoading
                    ? null
                    : () => _onPrevious(state, notifier),
              ),
              Expanded(
                child: PageView(
                  controller: _pageController,
                  physics: const NeverScrollableScrollPhysics(),
                  children: [
                    _IdentityStep(state: state, notifier: notifier),
                    _PublicationStep(state: state, notifier: notifier),
                    _LogoStep(state: state, notifier: notifier),
                  ],
                ),
              ),
              _WizardBottomBar(
                state: state,
                enabled: canContinue,
                onPressed: () => _onNext(state, notifier),
              ),
            ],
          ),
        ),
      ),
    );
  }

  bool _canContinue(SetupWizardState state) =>
      state.canContinueFrom(state.pageIndex);
}

/// Progress lives in a single hairline track, not three fat segments with a
/// logo lockup above it. The step count reads as "N sur 3" in mono — a
/// position, not a decoration.
class _WizardHeader extends StatelessWidget {
  const _WizardHeader({required this.currentStep, required this.onBack});

  final int currentStep;
  final VoidCallback? onBack;

  @override
  Widget build(BuildContext context) {
    const stepCount = SetupWizard.lastPageIndex + 1;
    final progress = (currentStep + 1) / stepCount;

    return Padding(
      padding: const EdgeInsets.fromLTRB(
        AppSpacing.xs,
        AppSpacing.xs,
        AppSpacing.gutter,
        AppSpacing.sm,
      ),
      child: Column(
        children: [
          Row(
            children: [
              Expanded(
                child: Align(
                  alignment: Alignment.centerLeft,
                  child: onBack == null
                      ? const SizedBox(height: 48)
                      : IconButton(
                          tooltip: 'Étape précédente',
                          onPressed: onBack,
                          icon: const Icon(Icons.arrow_back_rounded),
                        ),
                ),
              ),
              Text(
                'CONFIGURATION',
                style: AppTextStyles.tag.copyWith(
                  color: context.textSecondaryColor,
                ),
              ),
              Expanded(
                child: Align(
                  alignment: Alignment.centerRight,
                  child: Text(
                    '${currentStep + 1} / $stepCount',
                    textAlign: TextAlign.right,
                    // "2 / 4" is read out as "two slash four". The bar below
                    // carries no name at all, so the position is spoken once,
                    // here, as a sentence.
                    semanticsLabel: 'Étape ${currentStep + 1} sur $stepCount',
                    style: AppTextStyles.numeric.copyWith(
                      color: context.textPrimaryColor,
                    ),
                  ),
                ),
              ),
            ],
          ),
          const SizedBox(height: AppSpacing.sm),
          Padding(
            padding: const EdgeInsets.only(
              left: AppSpacing.gutter - AppSpacing.xs,
            ),
            child: ExcludeSemantics(
              child: ClipRRect(
                borderRadius: BorderRadius.circular(AppSpacing.radiusCircular),
                child: TweenAnimationBuilder<double>(
                  tween: Tween(begin: 0, end: progress),
                  duration: AppMotion.duration(context, AppMotion.standard),
                  curve: AppMotion.enter,
                  builder: (context, value, _) => LinearProgressIndicator(
                    value: value,
                    minHeight: 3,
                    backgroundColor: context.borderColor,
                    color: context.textPrimaryColor,
                  ),
                ),
              ),
            ),
          ),
        ],
      ),
    );
  }
}

/// A plain left-aligned step header.
///
/// This replaces `_StepIntro`, which packed an icon tile, a title, a
/// description and an illustration into a fixed 190dp card — and overflowed it
/// by 8px on a standard phone. Type carries the hierarchy now; nothing is
/// boxed, so nothing can clip.
class _StepHeader extends StatelessWidget {
  const _StepHeader({required this.title, required this.description});

  final String title;
  final String description;

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(
          title,
          style: AppTextStyles.h2.copyWith(color: context.textPrimaryColor),
        ),
        const SizedBox(height: AppSpacing.sm),
        Text(
          description,
          style: AppTextStyles.bodyLarge.copyWith(
            color: context.textSecondaryColor,
          ),
        ),
      ],
    );
  }
}

class _IdentityStep extends StatefulWidget {
  const _IdentityStep({required this.state, required this.notifier});

  final SetupWizardState state;
  final SetupWizard notifier;

  @override
  State<_IdentityStep> createState() => _IdentityStepState();
}

class _IdentityStepState extends State<_IdentityStep> {
  late final TextEditingController _phoneController = TextEditingController(
    text: widget.state.phone,
  );

  @override
  void didUpdateWidget(_IdentityStep oldWidget) {
    super.didUpdateWidget(oldWidget);
    // The session may still have been loading on the first frame, so the
    // account's number can arrive after the field is built. Only adopted while
    // the value is still the account's — the first keystroke clears that flag,
    // and from then on the field is the user's.
    if (widget.state.phoneFromAccount &&
        _phoneController.text != widget.state.phone) {
      _phoneController.text = widget.state.phone;
    }
  }

  @override
  void dispose() {
    _phoneController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final state = widget.state;
    final notifier = widget.notifier;

    return SingleChildScrollView(
      keyboardDismissBehavior: ScrollViewKeyboardDismissBehavior.onDrag,
      padding: const EdgeInsets.fromLTRB(
        AppSpacing.gutter,
        AppSpacing.md,
        AppSpacing.gutter,
        AppSpacing.xl,
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const _StepHeader(
            title: 'Présentez votre atelier',
            description: 'Ces informations créent votre espace professionnel.',
          ),
          const SizedBox(height: AppSpacing.sectionSpacing),
          // Fields sit directly on the page. The wrapping card added a second
          // border around inputs that already carry their own fill.
          AppTextField(
            label: 'Nom de l’atelier',
            hint: 'Ex. Maison Awa Couture',
            onChanged: notifier.setWorkshopName,
            icon: Icons.store_outlined,
            isValid: state.isWorkshopNameValid,
            textInputAction: TextInputAction.next,
            autofillHints: const [AutofillHints.organizationName],
            validator: (value) {
              if ((value ?? '').trim().length < 3) {
                return 'Saisissez au moins trois caractères.';
              }
              return null;
            },
          ),
          const SizedBox(height: AppSpacing.lg),
          // Carried over from the account rather than asked a second time. The
          // sign-up screen already took a phone number; an empty field here read
          // as the app having forgotten it.
          AppTextField(
            label: 'Téléphone de l’atelier',
            hint: '77 000 00 00',
            controller: _phoneController,
            helper: state.phoneFromAccount
                ? 'Repris de votre compte. Modifiez-le si l’atelier utilise une autre ligne.'
                : 'Visible par vos clients uniquement si vous publiez votre profil.',
            keyboardType: TextInputType.phone,
            onChanged: notifier.setPhone,
            icon: Icons.phone_android_outlined,
            isValid: state.isPhoneValid,
            textInputAction: TextInputAction.done,
            autofillHints: const [AutofillHints.telephoneNumber],
            validator: (value) {
              if (!AuthInputValidation.isPhoneValid(value ?? '')) {
                return 'Saisissez un numéro valide, par exemple 77 000 00 00.';
              }
              return null;
            },
          ),
        ],
      ),
    );
  }
}

/// Where the atelier works, and the document the platform will check.
///
/// Only the region gates this step. Without it the atelier is created with a
/// null `location`, which the marketplace's distance search excludes outright.
/// The address and the document are useful but not preconditions to existing —
/// the file can be sent later from the dashboard.
class _PublicationStep extends StatefulWidget {
  const _PublicationStep({required this.state, required this.notifier});

  final SetupWizardState state;
  final SetupWizard notifier;

  @override
  State<_PublicationStep> createState() => _PublicationStepState();
}

class _PublicationStepState extends State<_PublicationStep> {
  @override
  Widget build(BuildContext context) {
    final state = widget.state;
    final notifier = widget.notifier;

    return SingleChildScrollView(
      keyboardDismissBehavior: ScrollViewKeyboardDismissBehavior.onDrag,
      padding: const EdgeInsets.fromLTRB(
        AppSpacing.gutter,
        AppSpacing.md,
        AppSpacing.gutter,
        AppSpacing.xl,
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const _StepHeader(
            title: 'Où vous trouver',
            description:
                'Les clients cherchent par région et par distance. Sans région, votre atelier n’apparaît dans aucune recherche.',
          ),
          const SizedBox(height: AppSpacing.sectionSpacing),
          CustomDropdown<AtelierRegion>(
            label: 'Région',
            hint: 'Choisissez votre région',
            value: state.region,
            items: AtelierRegions.all,
            itemLabelBuilder: (region) => region.label,
            prefixIcon: const Icon(Icons.map_outlined),
            onChanged: (region) {
              HapticFeedback.selectionClick();
              notifier.setRegion(region.id);
            },
          ),
          const SizedBox(height: AppSpacing.lg),
          AppTextField(
            label: 'Quartier ou adresse (facultatif)',
            hint: 'Médina, rue 10 x Avenue Blaise Diagne',
            onChanged: notifier.setAddressDetail,
            icon: Icons.location_on_outlined,
            isValid: true,
            textInputAction: TextInputAction.next,
            helper: state.region == null
                ? 'Choisissez d’abord une région.'
                : 'Affichée sous « ${state.resolvedAddress} ».',
          ),
          const SizedBox(height: AppSpacing.lg),
          AppTextField(
            label: 'Pièce d’identité ou registre de commerce (facultatif)',
            hint: 'Ex. CNI-1975-2024-000731',
            onChanged: notifier.setIdDocumentRef,
            icon: Icons.badge_outlined,
            isValid: state.isDocumentValid,
            textInputAction: TextInputAction.done,
            helper:
                'Sans ce numéro votre atelier fonctionne, mais reste invisible dans la recherche. Vous pourrez l’envoyer depuis le tableau de bord.',
            validator: (value) {
              final trimmed = (value ?? '').trim();
              if (trimmed.isNotEmpty && trimmed.length < 4) {
                return 'Numéro trop court.';
              }
              return null;
            },
          ),
          const SizedBox(height: AppSpacing.sectionSpacing),
          // §2.2 : les réalisations d'un couturier vivent sur ses réseaux.
          // Facultatifs — un artisan sans compte ne doit pas être bloqué — mais
          // demandés ici parce que c'est ce qu'un client regarde avant d'appeler.
          Text(
            'Vos réseaux (facultatif)',
            style: AppTextStyles.label.copyWith(
              color: context.textPrimaryColor,
            ),
          ),
          const SizedBox(height: AppSpacing.xs),
          Text(
            'Vos clients y voient vos réalisations. Juste votre identifiant, pas le lien complet.',
            style: AppTextStyles.bodySmall.copyWith(
              color: context.textSecondaryColor,
            ),
          ),
          const SizedBox(height: AppSpacing.md),
          AppTextField(
            label: 'TikTok',
            hint: 'votreatelier',
            onChanged: (value) => notifier.setTiktokUrl(
              SocialLinkUtils.canonicalUrl(SocialNetwork.tiktok, value),
            ),
            iconWidget: const SocialIcon(
              network: SocialNetwork.tiktok,
              size: 20,
            ),
            prefixText: SocialLinkUtils.prefix(SocialNetwork.tiktok),
            textInputAction: TextInputAction.next,
          ),
          const SizedBox(height: AppSpacing.md),
          AppTextField(
            label: 'Instagram',
            hint: 'votreatelier',
            onChanged: (value) => notifier.setInstagramUrl(
              SocialLinkUtils.canonicalUrl(SocialNetwork.instagram, value),
            ),
            iconWidget: const SocialIcon(
              network: SocialNetwork.instagram,
              size: 20,
            ),
            prefixText: SocialLinkUtils.prefix(SocialNetwork.instagram),
            textInputAction: TextInputAction.next,
          ),
          const SizedBox(height: AppSpacing.md),
          AppTextField(
            label: 'Facebook',
            hint: 'votreatelier',
            onChanged: (value) => notifier.setFacebookUrl(
              SocialLinkUtils.canonicalUrl(SocialNetwork.facebook, value),
            ),
            iconWidget: const SocialIcon(
              network: SocialNetwork.facebook,
              size: 20,
            ),
            prefixText: SocialLinkUtils.prefix(SocialNetwork.facebook),
            textInputAction: TextInputAction.done,
          ),
          const SizedBox(height: AppSpacing.md),
          AppStatusBanner(
            message: state.hasDocument
                ? 'Votre dossier part à la vérification dès la fin de la configuration. La plateforme peut vous contacter.'
                : 'Votre espace sera prêt immédiatement. La publication dans la recherche attend votre pièce justificative.',
            icon: Icons.verified_user_outlined,
            tone: AppStatusTone.neutral,
          ),
        ],
      ),
    );
  }
}

class _LogoStep extends StatelessWidget {
  const _LogoStep({required this.state, required this.notifier});

  final SetupWizardState state;
  final SetupWizard notifier;

  @override
  Widget build(BuildContext context) {
    return SingleChildScrollView(
      keyboardDismissBehavior: ScrollViewKeyboardDismissBehavior.onDrag,
      padding: const EdgeInsets.fromLTRB(
        AppSpacing.gutter,
        AppSpacing.md,
        AppSpacing.gutter,
        AppSpacing.xl,
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const _StepHeader(
            title: 'Votre signature visuelle',
            // The two lines that used to sit under the well — "Choisir une
            // image" and "Carrée, 1024 × 1024 max." — plus a banner saying it
            // could be done later, made three separate explanations of one
            // optional tap. The header says it once.
            description:
                'Le logo apparaît sur vos documents. Facultatif, modifiable plus tard.',
          ),
          const SizedBox(height: AppSpacing.sectionSpacing),
          // Same component as the Atelier profile screen. These were two
          // different wells — 168px at radius 28 here, 96px at radius 18 there
          // — for the same job, with different copy and different affordances.
          Center(
            child: LogoPicker(
              size: 160,
              logoPath: state.selectedLogoPath,
              busy: state.isPickingLogo,
              error: state.logoError,
              onPick: notifier.pickLogo,
              onRemove: notifier.removeLogo,
            ),
          ),
        ],
      ),
    );
  }
}

class _WizardBottomBar extends StatelessWidget {
  const _WizardBottomBar({
    required this.state,
    required this.enabled,
    required this.onPressed,
  });

  final SetupWizardState state;
  final bool enabled;
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
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          AnimatedSwitcher(
            duration: AppMotion.quick,
            // The shared banner already announces itself as a live region on the
            // error tone, so a screen-reader user hears the failure instead of
            // tapping "Créer mon atelier" into silence.
            child: state.errorMessage == null
                ? const SizedBox.shrink(key: ValueKey('no-error'))
                : Padding(
                    key: ValueKey(state.errorMessage),
                    padding: const EdgeInsets.only(bottom: AppSpacing.sm),
                    child: AppStatusBanner(
                      message: state.errorMessage!,
                      icon: Icons.error_outline_rounded,
                      tone: AppStatusTone.error,
                    ),
                  ),
          ),
          AnimatedPrimaryButton(
            label: state.pageIndex == SetupWizard.lastPageIndex
                ? 'Créer et publier mon atelier'
                : 'Continuer',
            enabled: enabled,
            loading: state.isLoading,
            icon: state.pageIndex == SetupWizard.lastPageIndex
                ? Icons.check_rounded
                : Icons.arrow_forward_rounded,
            onPressed: onPressed,
          ),
        ],
      ),
    );
  }
}

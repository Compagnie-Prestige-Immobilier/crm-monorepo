import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:url_launcher/url_launcher.dart';

import '../../../../core/config/app_environment.dart';
import '../../../../core/network/api_exception.dart';
import '../../../../core/voice/voice_providers.dart';
import '../../../../data/services/storage_service.dart';
import '../../../../shared/theme/app_colors.dart';
import '../../../../shared/theme/app_colors_extensions.dart';
import '../../../../shared/theme/app_spacing.dart';
import '../../../../shared/theme/app_text_styles.dart';
import '../../../../shared/utils/social_link_utils.dart';
import '../../../../shared/widgets/interaction/pressable_surface.dart';
import '../../../../shared/widgets/layouts/polished_page.dart';
import '../../../../shared/widgets/visuals/atelier_illustration.dart';
import '../../../../shared/widgets/visuals/social_icon.dart';
import '../controllers/favorite_workshops_controller.dart';
import '../controllers/marketplace_providers.dart';
import '../domain/marketplace_atelier.dart';
import '../widgets/review_sheet.dart';
import '../../shared/widgets/client_ui.dart';
import '../../../../shared/widgets/feedback/app_toast.dart';

class WorkshopDetailView extends ConsumerStatefulWidget {
  const WorkshopDetailView({super.key, required this.atelierId});

  final String atelierId;

  @override
  ConsumerState<WorkshopDetailView> createState() => _WorkshopDetailViewState();
}

class _WorkshopDetailViewState extends ConsumerState<WorkshopDetailView> {
  String? _activeContactChannel;

  /// null while loading from storage; then whether this atelier's "Connaissez-
  /// vous cet atelier ?" prompt has already been answered on this device — a
  /// visit-based review has no confirmed-service gate to rely on for
  /// "already asked", so this is tracked locally instead.
  static const _reviewPromptStorageKey = 'visit_review_prompted_ateliers';
  bool? _reviewPromptAnswered;

  @override
  void initState() {
    super.initState();
    _loadReviewPromptState();
  }

  Future<void> _loadReviewPromptState() async {
    final raw = await StorageService().read(_reviewPromptStorageKey);
    final answered = (raw ?? '').split(',').where((e) => e.isNotEmpty).toSet();
    if (mounted) {
      setState(
        () => _reviewPromptAnswered = answered.contains(widget.atelierId),
      );
    }
  }

  Future<void> _dismissReviewPrompt() async {
    final raw = await StorageService().read(_reviewPromptStorageKey);
    final answered = (raw ?? '').split(',').where((e) => e.isNotEmpty).toSet()
      ..add(widget.atelierId);
    await StorageService().write(_reviewPromptStorageKey, answered.join(','));
    if (mounted) setState(() => _reviewPromptAnswered = true);
  }

  Future<void> _answerKnowsAtelier(MarketplaceAtelier atelier) async {
    final result = await showModalBottomSheet<({int rating, String? body})>(
      context: context,
      isScrollControlled: true,
      showDragHandle: true,
      builder: (_) => ReviewSheet(atelierName: atelier.name),
    );
    await _dismissReviewPrompt();
    if (result == null || !mounted) return;

    try {
      await ref
          .read(marketplaceRepositoryProvider)
          .createReview(
            atelierId: atelier.id,
            rating: result.rating,
            body: result.body,
          );
      ref.invalidate(marketplaceAtelierProvider(widget.atelierId));
      _showMessage(
        'Merci',
        'Votre avis sera publié après vérification.',
        type: ToastType.success,
      );
    } catch (error) {
      _showMessage(
        'Avis non envoyé',
        error is ApiException
            ? error.message
            : 'Vérifiez votre connexion puis réessayez.',
        type: ToastType.error,
      );
    }
  }

  @override
  Widget build(BuildContext context) {
    final atelierAsync = ref.watch(
      marketplaceAtelierProvider(widget.atelierId),
    );
    final atelier = atelierAsync.asData?.value;

    return Scaffold(
      backgroundColor: context.backgroundColor,
      body: atelierAsync.when(
        loading: () => const _WorkshopDetailSkeleton(),
        error: (error, _) => SafeArea(
          child: ClientStatePanel(
            motif: AtelierMotif.cloth,
            icon: Icons.storefront_outlined,
            title: 'Atelier indisponible',
            message:
                'Le profil n’a pas pu être chargé. Vérifiez la connexion puis réessayez.',
            actionLabel: 'Réessayer',
            onAction: () =>
                ref.invalidate(marketplaceAtelierProvider(widget.atelierId)),
            secondaryActionLabel: 'Revenir aux résultats',
            onSecondaryAction: () => Navigator.maybePop(context),
          ),
        ),
        data: (value) => _buildContent(context, value),
      ),
      bottomNavigationBar: atelier == null
          ? null
          : _ContactBar(
              atelier: atelier,
              activeChannel: _activeContactChannel,
              onContact: (channel, destination) =>
                  _contact(atelier, channel, destination),
            ),
    );
  }

  Widget _buildContent(BuildContext context, MarketplaceAtelier atelier) {
    final favorites = ref.watch(favoriteWorkshopsProvider);
    final isFavorite =
        favorites.asData?.value.any(
          (favorite) => favorite.workshopId == atelier.id,
        ) ??
        false;
    // Même repli que la carte de résultat (`MarketplaceAtelierCard`) : la fiche
    // s'arrêtait à la couverture et au portfolio, donc un atelier n'ayant
    // téléversé que son logo ouvrait sur un cadre gris juste après une carte
    // qui, elle, montrait ce logo.
    final imageUrl = AppEnvironment.resolveMediaUrl(
      atelier.coverUrl ??
          (atelier.portfolio.isNotEmpty
              ? atelier.portfolio.first.imageUrl
              : atelier.logoUrl),
    );
    final logoUrl = AppEnvironment.resolveMediaUrl(atelier.logoUrl);

    return CustomScrollView(
      physics: const AlwaysScrollableScrollPhysics(),
      slivers: [
        SliverAppBar(
          expandedHeight: 300,
          pinned: true,
          stretch: true,
          surfaceTintColor: context.surfaceColor,
          leading: Padding(
            padding: const EdgeInsets.all(6),
            child: IconButton.filledTonal(
              tooltip: 'Retour',
              onPressed: () => Navigator.maybePop(context),
              icon: const Icon(Icons.arrow_back_rounded),
            ),
          ),
          actions: [
            // Guidage vocal (§2.5) : lit la fiche a voix haute pour qui ne lit
            // pas bien. Place dans la barre, donc visible sans avoir active un
            // service d'accessibilite dont beaucoup ignorent l'existence.
            Padding(
              padding: const EdgeInsets.all(6),
              child: IconButton.filledTonal(
                tooltip: 'Écouter la fiche',
                onPressed: () => _speakProfile(atelier),
                icon: const Icon(Icons.volume_up_rounded),
              ),
            ),
            Padding(
              padding: const EdgeInsets.all(6),
              child: IconButton.filledTonal(
                tooltip: isFavorite
                    ? 'Retirer des favoris'
                    : 'Ajouter aux favoris',
                onPressed: () => ref
                    .read(favoriteWorkshopsProvider.notifier)
                    .toggle(atelier),
                icon: AnimatedSwitcher(
                  duration: MediaQuery.disableAnimationsOf(context)
                      ? Duration.zero
                      : const Duration(milliseconds: 180),
                  child: Icon(
                    isFavorite
                        ? Icons.favorite_rounded
                        : Icons.favorite_border_rounded,
                    key: ValueKey(isFavorite),
                    color: isFavorite
                        ? Theme.of(context).colorScheme.secondary
                        : null,
                  ),
                ),
              ),
            ),
          ],
          flexibleSpace: FlexibleSpaceBar(
            background: Stack(
              fit: StackFit.expand,
              children: [
                // Receiving end of the card's shared element.
                Hero(
                  tag: 'atelier-cover-${atelier.id}',
                  child: imageUrl.isNotEmpty
                      ? Image.network(
                          imageUrl,
                          fit: BoxFit.cover,
                          errorBuilder: (_, _, _) =>
                              const _DetailImageFallback(),
                        )
                      : const _DetailImageFallback(),
                ),
                // The one gradient the language allows: a scrim, and only
                // because the logo plate and the availability tag have to stay
                // legible over an arbitrary photograph.
                const DecoratedBox(
                  decoration: BoxDecoration(
                    gradient: LinearGradient(
                      begin: Alignment.center,
                      end: Alignment.bottomCenter,
                      colors: [
                        AppColors.photoScrimTransparent,
                        AppColors.photoScrim,
                      ],
                    ),
                  ),
                ),
                Positioned(
                  left: AppSpacing.gutter,
                  right: AppSpacing.gutter,
                  bottom: AppSpacing.md,
                  child: Row(
                    crossAxisAlignment: CrossAxisAlignment.end,
                    children: [
                      // Flat plate, hairline edge. The drop shadow that used to
                      // float this logo was the only elevated object in the
                      // whole client space.
                      Container(
                        width: 72,
                        height: 72,
                        padding: const EdgeInsets.all(4),
                        decoration: BoxDecoration(
                          color: context.surfaceColor,
                          borderRadius: BorderRadius.circular(
                            AppSpacing.radiusLG,
                          ),
                        ),
                        child: ClipRRect(
                          borderRadius: BorderRadius.circular(
                            AppSpacing.radiusMD,
                          ),
                          child: logoUrl.isEmpty
                              ? const _LogoFallback()
                              : Image.network(
                                  logoUrl,
                                  fit: BoxFit.cover,
                                  errorBuilder: (_, _, _) =>
                                      const _LogoFallback(),
                                ),
                        ),
                      ),
                      const SizedBox(width: AppSpacing.sm),
                      Flexible(
                        child: _HeroTag(
                          label:
                              atelier.availabilityLabel ??
                              'Disponibilité à confirmer',
                        ),
                      ),
                    ],
                  ),
                ),
              ],
            ),
          ),
        ),
        SliverPadding(
          padding: const EdgeInsets.fromLTRB(
            AppSpacing.gutter,
            AppSpacing.lg,
            AppSpacing.gutter,
            132,
          ),
          sliver: SliverList(
            delegate: SliverChildListDelegate.fixed([
              Text(
                atelier.name,
                maxLines: 3,
                overflow: TextOverflow.ellipsis,
                style: AppTextStyles.h2.copyWith(
                  color: context.textPrimaryColor,
                ),
              ),
              // L'adresse et la région : la fiche donnait la rue sans jamais
              // dire dans quelle région on se trouve.
              if ((atelier.address ?? '').trim().isNotEmpty ||
                  (atelier.region ?? '').trim().isNotEmpty) ...[
                const SizedBox(height: 8),
                Row(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Icon(
                      Icons.location_on_outlined,
                      size: 18,
                      color: context.textSecondaryColor,
                    ),
                    const SizedBox(width: 6),
                    Expanded(
                      child: Text(
                        [
                          if ((atelier.address ?? '').trim().isNotEmpty)
                            atelier.address!.trim(),
                          if ((atelier.region ?? '').trim().isNotEmpty &&
                              !(atelier.address ?? '').toLowerCase().contains(
                                atelier.region!.trim().toLowerCase(),
                              ))
                            atelier.region!.trim(),
                        ].join(' · '),
                        maxLines: 2,
                        overflow: TextOverflow.ellipsis,
                        style: AppTextStyles.bodyMedium.copyWith(
                          color: context.textSecondaryColor,
                        ),
                      ),
                    ),
                  ],
                ),
              ],
              const SizedBox(height: AppSpacing.lg),
              // The three numbers a reader actually weighs before calling,
              // set in the tabular face and separated by rules rather than
              // scattered across three tinted pills.
              _FactStrip(atelier: atelier),
              if (atelier.acceptsNewClients == false) ...[
                const SizedBox(height: AppSpacing.md),
                const AppStatusBanner(
                  title: 'Atelier complet actuellement',
                  message:
                      'Vous pouvez enregistrer le profil et revenir lorsque l’atelier sera de nouveau disponible.',
                  icon: Icons.event_busy_rounded,
                  tone: AppStatusTone.warning,
                ),
              ],
              if (atelier.specialties.isNotEmpty) ...[
                const SizedBox(height: AppSpacing.sectionSpacing),
                const ClientSectionHeader(
                  title: 'Spécialités',
                  icon: Icons.auto_awesome_outlined,
                ),
                const SizedBox(height: AppSpacing.sm),
                Wrap(
                  spacing: AppSpacing.xs,
                  runSpacing: AppSpacing.xs,
                  children: atelier.specialties
                      .map(
                        (specialty) => Chip(
                          avatar: Icon(
                            Icons.check_rounded,
                            size: 16,
                            color: context.textPrimaryColor,
                          ),
                          label: Text(
                            specialty,
                            maxLines: 1,
                            overflow: TextOverflow.ellipsis,
                          ),
                        ),
                      )
                      .toList(growable: false),
                ),
              ],
              if ((atelier.description ?? '').trim().isNotEmpty) ...[
                const SizedBox(height: AppSpacing.sectionSpacing),
                const ClientSectionHeader(
                  title: 'À propos',
                  icon: Icons.storefront_outlined,
                ),
                const SizedBox(height: AppSpacing.sm),
                _ExpandableText(text: atelier.description!),
              ],
              // Les réseaux du couturier, exigés par §2.2 : c'est là qu'un
              // client voit vraiment ce que l'artisan sait faire, bien plus que
              // dans la galerie interne.
              if (atelier.socialLinks.isNotEmpty) ...[
                const SizedBox(height: AppSpacing.sectionSpacing),
                const ClientSectionHeader(
                  title: 'Ses réseaux',
                  icon: Icons.public_outlined,
                ),
                const SizedBox(height: AppSpacing.sm),
                Wrap(
                  spacing: AppSpacing.sm,
                  runSpacing: AppSpacing.sm,
                  children: atelier.socialLinks
                      .map(
                        (link) => _SocialLinkButton(
                          label: link.label,
                          url: link.url,
                          onOpenFailed: () => _showMessage(
                            'Lien indisponible',
                            'Ce profil n’a pas pu être ouvert sur cet appareil.',
                          ),
                        ),
                      )
                      .toList(growable: false),
                ),
              ],
              if (atelier.portfolio.isNotEmpty) ...[
                const SizedBox(height: AppSpacing.sectionSpacing),
                const ClientSectionHeader(
                  title: 'Réalisations',
                  icon: Icons.photo_library_outlined,
                ),
                const SizedBox(height: AppSpacing.md),
                SizedBox(
                  height: 206,
                  child: ListView.separated(
                    scrollDirection: Axis.horizontal,
                    itemCount: atelier.portfolio.length,
                    separatorBuilder: (_, _) =>
                        const SizedBox(width: AppSpacing.sm),
                    itemBuilder: (_, index) => _PortfolioCard(
                      item: atelier.portfolio[index],
                      position: index + 1,
                      total: atelier.portfolio.length,
                    ),
                  ),
                ),
              ],
              const SizedBox(height: AppSpacing.sectionSpacing),
              // « Avis » seul ne disait pas de quoi on parle : la moyenne ne
              // compte que les avis publiés, et un avis déposé reste invisible
              // jusqu'à la modération. Le titre et le sous-titre le disent.
              ClientSectionHeader(
                title: 'Avis vérifiés',
                subtitle: (atelier.reviewCount ?? 0) > 0
                    ? 'Notes laissées par des clients, publiées après vérification par la plateforme.'
                    : 'Les notes des clients apparaissent ici une fois vérifiées par la plateforme.',
                icon: Icons.rate_review_outlined,
              ),
              const SizedBox(height: AppSpacing.md),
              // Shown even at zero: a profile that simply stops after the
              // trust card reads as unfinished, and "pas encore d'avis" is
              // itself information a buyer wants.
              if ((atelier.reviewCount ?? 0) > 0)
                AppSectionSurface(
                  bordered: true,
                  child: Row(
                    children: [
                      Text(
                        atelier.rating.toStringAsFixed(1),
                        style: AppTextStyles.statValue.copyWith(
                          color: context.textPrimaryColor,
                        ),
                      ),
                      const SizedBox(width: AppSpacing.md),
                      Expanded(
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Row(
                              children: List.generate(
                                5,
                                (index) => Icon(
                                  index < atelier.rating.round()
                                      ? Icons.star_rounded
                                      : Icons.star_border_rounded,
                                  size: 18,
                                  color: index < atelier.rating.round()
                                      ? context.textPrimaryColor
                                      : context.textSecondaryColor,
                                ),
                              ),
                            ),
                            const SizedBox(height: 6),
                            Text(
                              '${atelier.reviewCount} avis publié${(atelier.reviewCount ?? 0) > 1 ? 's' : ''}',
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
                  ),
                )
              else
                AppSectionSurface(
                  bordered: true,
                  child: Row(
                    children: [
                      Icon(
                        Icons.reviews_outlined,
                        size: 22,
                        color: context.textSecondaryColor,
                      ),
                      const SizedBox(width: AppSpacing.md),
                      Expanded(
                        child: Text(
                          'Aucun avis publié pour l’instant.',
                          style: AppTextStyles.bodySmall.copyWith(
                            color: context.textSecondaryColor,
                          ),
                        ),
                      ),
                    ],
                  ),
                ),
              if (_reviewPromptAnswered == false) ...[
                const SizedBox(height: AppSpacing.sm),
                _KnowsAtelierPrompt(
                  onYes: () => _answerKnowsAtelier(atelier),
                  onNo: _dismissReviewPrompt,
                ),
              ],
            ]),
          ),
        ),
      ],
    );
  }

  /// Lit la fiche a voix haute : ce que le lecteur a besoin de savoir avant
  /// d'appeler, dans l'ordre ou il le demanderait.
  Future<void> _speakProfile(MarketplaceAtelier atelier) async {
    final parts = <String>[
      atelier.name,
      if ((atelier.address ?? '').trim().isNotEmpty)
        'Situé à ${atelier.address}',
      if (atelier.distanceMeters != null) 'À ${atelier.distanceLabel} de vous',
      if ((atelier.reviewCount ?? 0) > 0)
        'Noté ${atelier.rating.toStringAsFixed(1)} sur 5, sur ${atelier.reviewCount} avis'
      else
        'Pas encore d’avis',
      if (atelier.specialties.isNotEmpty)
        'Spécialités : ${atelier.specialties.join(", ")}',
      if (atelier.acceptsNewClients == false)
        'Cet atelier n’accepte pas de nouvelle demande actuellement'
      else
        'Vous pouvez le contacter avec le bouton en bas de l’écran',
    ];
    await ref.read(voiceGuideServiceProvider).speak(parts.join('. '));
  }

  Future<void> _contact(
    MarketplaceAtelier atelier,
    String channel,
    String? destination,
  ) async {
    if (_activeContactChannel != null) return;
    final target = destination?.trim() ?? '';
    if (target.isEmpty) {
      _showMessage(
        'Contact indisponible',
        'Cet atelier n’a pas publié ce numéro. Essayez un autre moyen.',
      );
      return;
    }

    final uri = channel == 'whatsapp'
        ? Uri.parse('https://wa.me/${_digitsOnly(target)}')
        : Uri(scheme: 'tel', path: target);
    if (!await canLaunchUrl(uri)) {
      _showMessage(
        'Application manquante',
        'Aucune application ne peut ouvrir ce contact sur cet appareil.',
      );
      return;
    }

    setState(() => _activeContactChannel = channel);
    try {
      await ref
          .read(marketplaceRepositoryProvider)
          .createContact(atelierId: atelier.id, channel: channel);
      ref.invalidate(marketplaceContactsProvider);
      await launchUrl(uri, mode: LaunchMode.externalApplication);
    } catch (_) {
      // Per docs/CONTENT.md an error says what happened, whether anything was
      // lost, and what to do next. The call itself still went through — only
      // the history entry failed — and saying so avoids the reader redialling.
      _showMessage(
        'Contact non enregistré',
        'L’appel a bien été lancé, mais il n’apparaîtra pas dans votre activité. Réessayez une fois connecté.',
        type: ToastType.error,
      );
    } finally {
      if (mounted) setState(() => _activeContactChannel = null);
    }
  }

  void _showMessage(
    String title,
    String message, {
    ToastType type = ToastType.warning,
  }) {
    if (!mounted) return;
    AppToast.show(title: title, message: message, type: type);
  }

  static String _digitsOnly(String value) =>
      value.replaceAll(RegExp(r'[^0-9]'), '');
}

/// The reason this screen exists, so it is allowed to be the loudest thing on
/// it.
///
/// The bar used to ship two buttons of identical width — an outlined "Appeler"
/// and an accent "WhatsApp" — which asked the reader to arbitrate between
/// two equally-sized controls and spent the one accent hue on an action rather
/// than on status. Now a single near-black filled control carries the whole
/// width, and the second channel is a subordinate square beside it.
class _ContactBar extends StatelessWidget {
  const _ContactBar({
    required this.atelier,
    required this.activeChannel,
    required this.onContact,
  });

  final MarketplaceAtelier atelier;
  final String? activeChannel;
  final void Function(String channel, String? destination) onContact;

  @override
  Widget build(BuildContext context) {
    final scheme = Theme.of(context).colorScheme;
    final phone = (atelier.phone ?? '').trim();
    final whatsapp = (atelier.whatsapp ?? atelier.phone ?? '').trim();
    final busy = activeChannel != null;
    // Unknown availability must not block contacting the atelier: the client
    // can still call and ask. Only a positive "full" blocks.
    final canContact = atelier.acceptsNewClients != false && !busy;

    // WhatsApp is the channel this market actually answers on, so it takes the
    // filled control whenever the atelier publishes one; the call takes over
    // when it does not, rather than the primary slot sitting empty.
    final whatsAppLeads = whatsapp.isNotEmpty;
    final primaryChannel = whatsAppLeads ? 'whatsapp' : 'phone';
    final primaryTarget = whatsAppLeads
        ? (atelier.whatsapp ?? atelier.phone)
        : atelier.phone;
    final hasPrimary = whatsAppLeads || phone.isNotEmpty;
    final showCallAside = whatsAppLeads && phone.isNotEmpty;

    return SafeArea(
      top: false,
      child: DecoratedBox(
        decoration: BoxDecoration(
          color: scheme.surface,
          // Hairline only. A drop shadow here was the single elevated object
          // left in the client space.
          border: Border(top: BorderSide(color: scheme.outlineVariant)),
        ),
        child: Padding(
          padding: const EdgeInsets.fromLTRB(
            AppSpacing.gutter,
            AppSpacing.sm,
            AppSpacing.gutter,
            AppSpacing.md,
          ),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              if (atelier.acceptsNewClients == false) ...[
                const AppStatusBanner(
                  title: 'Contact temporairement fermé',
                  message:
                      'L’atelier n’accepte pas de nouvelle demande actuellement.',
                  icon: Icons.event_busy_rounded,
                  tone: AppStatusTone.warning,
                ),
                const SizedBox(height: AppSpacing.sm),
              ] else if (!hasPrimary) ...[
                Text(
                  'Cet atelier n’a pas encore publié de numéro. Enregistrez-le en favori pour être prêt dès qu’il le fera.',
                  maxLines: 3,
                  overflow: TextOverflow.ellipsis,
                  style: Theme.of(context).textTheme.bodySmall,
                ),
                const SizedBox(height: AppSpacing.sm),
              ],
              Row(
                children: [
                  Expanded(
                    child: FilledButton.icon(
                      onPressed: canContact && hasPrimary
                          ? () => onContact(primaryChannel, primaryTarget)
                          : null,
                      icon: activeChannel == primaryChannel
                          ? SizedBox.square(
                              dimension: 18,
                              child: CircularProgressIndicator.adaptive(
                                valueColor: AlwaysStoppedAnimation(
                                  scheme.onPrimary,
                                ),
                              ),
                            )
                          : Icon(
                              whatsAppLeads
                                  ? Icons.chat_rounded
                                  : Icons.call_rounded,
                              size: 20,
                            ),
                      label: Text(
                        whatsAppLeads
                            ? 'Écrire sur WhatsApp'
                            : 'Appeler l’atelier',
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis,
                      ),
                    ),
                  ),
                  if (showCallAside) ...[
                    const SizedBox(width: AppSpacing.sm),
                    _SecondaryChannelButton(
                      label: 'Appeler',
                      icon: Icons.call_outlined,
                      busy: activeChannel == 'phone',
                      onPressed: canContact
                          ? () => onContact('phone', atelier.phone)
                          : null,
                    ),
                  ],
                ],
              ),
            ],
          ),
        ),
      ),
    );
  }
}

/// Un lien vers un réseau du couturier.
///
/// Ouvert dans l'application native quand elle est installée — c'est là que le
/// client verra le compte tel que le couturier l'anime — et à défaut dans le
/// navigateur. L'échec est dit plutôt que silencieux : un bouton qui ne fait
/// rien se lit comme une application cassée.
class _SocialLinkButton extends StatelessWidget {
  const _SocialLinkButton({
    required this.label,
    required this.url,
    required this.onOpenFailed,
  });

  final String label;
  final String url;
  final VoidCallback onOpenFailed;

  @override
  Widget build(BuildContext context) {
    final network = SocialNetwork.fromLabel(label);
    return OutlinedButton.icon(
      onPressed: _open,
      icon: network == null
          ? const Icon(Icons.public_outlined, size: 18)
          : SocialIcon(network: network, size: 18),
      label: Text(label),
    );
  }

  Future<void> _open() async {
    final network = SocialNetwork.fromLabel(label);
    // Passe par le même bâtisseur canonique que le champ d'édition, pour que
    // l'affichage et la saisie s'accordent — y compris pour d'anciens liens
    // enregistrés en URL complète avant que le champ ne devienne un simple
    // identifiant.
    final normalised = network != null
        ? SocialLinkUtils.canonicalUrl(network, url)
        : (url.startsWith(RegExp(r'https?://')) ? url : 'https://$url');
    final uri = normalised.isEmpty ? null : Uri.tryParse(normalised);
    if (uri == null) {
      onOpenFailed();
      return;
    }
    final opened = await launchUrl(uri, mode: LaunchMode.externalApplication);
    if (!opened) onOpenFailed();
  }
}

/// The visit-based review path: no confirmed service required, just whether
/// the client recognises the place. Inline and dismissible rather than a
/// modal — it should never interrupt the visit, only offer to.
class _KnowsAtelierPrompt extends StatelessWidget {
  const _KnowsAtelierPrompt({required this.onYes, required this.onNo});

  final VoidCallback onYes;
  final VoidCallback onNo;

  @override
  Widget build(BuildContext context) {
    return AppSectionSurface(
      bordered: true,
      child: Row(
        children: [
          Icon(
            Icons.help_outline_rounded,
            size: 22,
            color: context.textSecondaryColor,
          ),
          const SizedBox(width: AppSpacing.md),
          Expanded(
            child: Text(
              'Connaissez-vous cet atelier ?',
              style: AppTextStyles.bodyMedium.copyWith(
                color: context.textPrimaryColor,
              ),
            ),
          ),
          const SizedBox(width: AppSpacing.sm),
          TextButton(onPressed: onNo, child: const Text('Non')),
          FilledButton.tonal(onPressed: onYes, child: const Text('Oui')),
        ],
      ),
    );
  }
}

/// The second channel, deliberately reduced to a square: same height as the
/// primary so the row reads as one control group, a fraction of its width so it
/// can never compete with it.
class _SecondaryChannelButton extends StatelessWidget {
  const _SecondaryChannelButton({
    required this.label,
    required this.icon,
    required this.busy,
    required this.onPressed,
  });

  final String label;
  final IconData icon;
  final bool busy;
  final VoidCallback? onPressed;

  @override
  Widget build(BuildContext context) {
    return Tooltip(
      message: label,
      child: OutlinedButton(
        onPressed: onPressed,
        style: OutlinedButton.styleFrom(
          padding: EdgeInsets.zero,
          fixedSize: const Size.square(AppSpacing.buttonHeightLG),
          minimumSize: const Size.square(AppSpacing.buttonHeightLG),
        ),
        child: busy
            ? const SizedBox.square(
                dimension: 18,
                child: CircularProgressIndicator.adaptive(),
              )
            : Semantics(label: label, child: Icon(icon, size: 21)),
      ),
    );
  }
}

/// The one status line in the hero: whether this atelier can take you on.
///
/// Sits on the photo scrim, so it carries its own solid surface rather than an
/// alpha wash — a translucent tint over an unknown photo is unreadable.
class _HeroTag extends StatelessWidget {
  const _HeroTag({required this.label});

  final String label;

  @override
  Widget build(BuildContext context) {
    final scheme = Theme.of(context).colorScheme;
    return Container(
      padding: const EdgeInsets.symmetric(
        horizontal: AppSpacing.sm,
        vertical: AppSpacing.xs,
      ),
      decoration: BoxDecoration(
        color: scheme.surface,
        borderRadius: BorderRadius.circular(AppSpacing.radiusCircular),
        border: Border.all(color: scheme.outlineVariant),
      ),
      child: Text(
        label,
        maxLines: 1,
        overflow: TextOverflow.ellipsis,
        style: AppTextStyles.bodySmall.copyWith(
          color: scheme.onSurface,
          fontWeight: FontWeight.w700,
        ),
      ),
    );
  }
}

/// The three numbers a reader weighs before calling, set as one row separated
/// by hairlines.
///
/// This replaces a scatter of tinted pills: pills gave every fact the same
/// visual weight and spent colour on all three, while a rule-separated strip
/// lets the values themselves carry the emphasis.
class _FactStrip extends StatelessWidget {
  const _FactStrip({required this.atelier});

  final MarketplaceAtelier atelier;

  @override
  Widget build(BuildContext context) {
    final responseMinutes = atelier.responseTimeMinutes;
    final facts = <(String, String)>[
      (
        (atelier.reviewCount ?? 0) > 0
            ? atelier.rating.toStringAsFixed(1)
            : 'Nouveau',
        (atelier.reviewCount ?? 0) > 0
            ? '${atelier.reviewCount} avis'
            : 'Aucun avis publié',
      ),
      // « Distance indisponible » sous l'étiquette « Distance » se lisait deux
      // fois. Sans position partagée, la case est vide et l'étiquette le dit.
      (
        atelier.distanceMeters == null ? '—' : atelier.distanceLabel,
        atelier.distanceMeters == null ? 'Distance inconnue' : 'Distance',
      ),
      (
        responseMinutes == null
            ? '—'
            : responseMinutes < 60
            ? '$responseMinutes min'
            : '${(responseMinutes / 60).round()} h',
        'Réponse',
      ),
    ];

    return IntrinsicHeight(
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          for (var i = 0; i < facts.length; i++) ...[
            if (i > 0)
              VerticalDivider(
                width: 1,
                thickness: 1,
                color: Theme.of(context).colorScheme.outlineVariant,
              ),
            Expanded(
              child: _Fact(value: facts[i].$1, label: facts[i].$2),
            ),
          ],
        ],
      ),
    );
  }
}

class _Fact extends StatelessWidget {
  const _Fact({required this.value, required this.label});

  final String value;
  final String label;

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.center,
      children: [
        Text(
          value,
          maxLines: 1,
          overflow: TextOverflow.ellipsis,
          style: AppTextStyles.h4.copyWith(color: context.textPrimaryColor),
        ),
        const SizedBox(height: AppSpacing.xxs),
        Text(
          label,
          maxLines: 1,
          overflow: TextOverflow.ellipsis,
          textAlign: TextAlign.center,
          style: AppTextStyles.caption.copyWith(
            color: context.textSecondaryColor,
          ),
        ),
      ],
    );
  }
}

class _PortfolioCard extends StatelessWidget {
  const _PortfolioCard({
    required this.item,
    required this.position,
    required this.total,
  });

  final AtelierPortfolioItem item;
  final int position;
  final int total;

  @override
  Widget build(BuildContext context) {
    final url = AppEnvironment.resolveMediaUrl(item.imageUrl);
    final title = item.title ?? item.garmentType ?? 'Réalisation';
    return SizedBox(
      width: 164,
      child: PressableSurface(
        onTap: () => _open(context, url, title),
        padding: EdgeInsets.zero,
        semanticLabel: 'Ouvrir $title, photo $position sur $total',
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            Expanded(
              child: ClipRRect(
                borderRadius: const BorderRadius.vertical(
                  top: Radius.circular(AppSpacing.radiusLG - 1),
                ),
                child: url.isEmpty
                    ? const _DetailImageFallback()
                    : Image.network(
                        url,
                        fit: BoxFit.cover,
                        errorBuilder: (_, _, _) => const _DetailImageFallback(),
                      ),
              ),
            ),
            Padding(
              padding: const EdgeInsets.all(10),
              child: Row(
                children: [
                  Expanded(
                    child: Text(
                      title,
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                      style: AppTextStyles.bodySmall.copyWith(
                        color: context.textPrimaryColor,
                        fontWeight: FontWeight.w700,
                      ),
                    ),
                  ),
                  Text(
                    '$position/$total',
                    style: AppTextStyles.caption.copyWith(
                      color: context.textSecondaryColor,
                    ),
                  ),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }

  void _open(BuildContext context, String url, String title) {
    if (url.isEmpty) return;
    showDialog<void>(
      context: context,
      builder: (context) => Dialog.fullscreen(
        backgroundColor: Colors.black,
        child: SafeArea(
          child: Stack(
            children: [
              Center(
                child: InteractiveViewer(
                  minScale: 0.8,
                  maxScale: 4,
                  child: Image.network(url, fit: BoxFit.contain),
                ),
              ),
              Positioned(
                top: 8,
                left: 8,
                child: IconButton.filled(
                  onPressed: () => Navigator.of(context).pop(),
                  tooltip: 'Fermer',
                  icon: const Icon(Icons.close_rounded),
                ),
              ),
              Positioned(
                left: 20,
                right: 20,
                bottom: 20,
                child: Text(
                  title,
                  textAlign: TextAlign.center,
                  style: const TextStyle(
                    color: Colors.white,
                    fontWeight: FontWeight.w700,
                  ),
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

/// Neutral, not accent. A missing photograph is not a status, and a
/// tinted-accent placeholder repeated down the portfolio strip was spending the
/// one saturated hue on absence.
class _DetailImageFallback extends StatelessWidget {
  const _DetailImageFallback();

  @override
  Widget build(BuildContext context) {
    final scheme = Theme.of(context).colorScheme;
    return ColoredBox(
      color: scheme.surfaceContainerHighest,
      child: Center(
        child: Icon(
          Icons.checkroom_rounded,
          size: 64,
          color: scheme.onSurfaceVariant.withValues(alpha: 0.55),
        ),
      ),
    );
  }
}

class _LogoFallback extends StatelessWidget {
  const _LogoFallback();

  @override
  Widget build(BuildContext context) {
    final scheme = Theme.of(context).colorScheme;
    return ColoredBox(
      color: scheme.surfaceContainerHighest,
      child: Center(
        child: Icon(
          Icons.storefront_rounded,
          size: 34,
          color: scheme.onSurfaceVariant.withValues(alpha: 0.65),
        ),
      ),
    );
  }
}

class _WorkshopDetailSkeleton extends StatelessWidget {
  const _WorkshopDetailSkeleton();

  @override
  Widget build(BuildContext context) {
    return SafeArea(
      child: ListView(
        physics: const NeverScrollableScrollPhysics(),
        padding: const EdgeInsets.all(AppSpacing.cardPadding),
        children: [
          Container(
            height: 260,
            decoration: BoxDecoration(
              color: context.surfaceLightColor,
              borderRadius: BorderRadius.circular(AppSpacing.radiusLG),
            ),
          ),
          const SizedBox(height: AppSpacing.lg),
          ...List.generate(
            4,
            (index) => Container(
              height: index == 1 ? 120 : 82,
              margin: const EdgeInsets.only(bottom: AppSpacing.md),
              decoration: BoxDecoration(
                color: context.surfaceLightColor,
                borderRadius: BorderRadius.circular(AppSpacing.radiusLG),
              ),
            ),
          ),
        ],
      ),
    );
  }
}

/// Une présentation repliée à trois lignes.
///
/// §3.1 demande peu de texte à l'écran. Un couturier écrit parfois un
/// paragraphe entier ; l'afficher en entier repousse les photos — la seule
/// chose que le lecteur est venu voir — sous la ligne de flottaison. Trois
/// lignes suffisent à décider de dérouler, et « Lire la suite » n'apparaît que
/// lorsqu'il y a effectivement une suite.
class _ExpandableText extends StatefulWidget {
  const _ExpandableText({required this.text});

  final String text;

  @override
  State<_ExpandableText> createState() => _ExpandableTextState();
}

class _ExpandableTextState extends State<_ExpandableText> {
  static const _collapsedLines = 3;
  bool _expanded = false;

  @override
  Widget build(BuildContext context) {
    final style = AppTextStyles.bodyLarge.copyWith(
      color: context.textPrimaryColor,
      height: 1.55,
    );

    return LayoutBuilder(
      builder: (context, constraints) {
        final painter = TextPainter(
          text: TextSpan(text: widget.text, style: style),
          maxLines: _collapsedLines,
          textDirection: Directionality.of(context),
          textScaler: MediaQuery.textScalerOf(context),
        )..layout(maxWidth: constraints.maxWidth);
        final overflows = painter.didExceedMaxLines;

        return Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(
              widget.text,
              style: style,
              maxLines: _expanded ? null : _collapsedLines,
              overflow: _expanded ? null : TextOverflow.ellipsis,
            ),
            if (overflows)
              TextButton(
                onPressed: () => setState(() => _expanded = !_expanded),
                style: TextButton.styleFrom(
                  padding: EdgeInsets.zero,
                  minimumSize: const Size(0, 44),
                  tapTargetSize: MaterialTapTargetSize.shrinkWrap,
                ),
                child: Text(_expanded ? 'Réduire' : 'Lire la suite'),
              ),
          ],
        );
      },
    );
  }
}

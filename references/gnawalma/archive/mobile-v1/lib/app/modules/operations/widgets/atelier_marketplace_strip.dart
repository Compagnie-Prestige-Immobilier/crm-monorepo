import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:intl/intl.dart';

import '../../../core/network/api_exception.dart';
import '../../../shared/theme/app_colors.dart';
import '../../../shared/theme/app_colors_extensions.dart';
import '../../../shared/theme/app_spacing.dart';
import '../../../shared/theme/app_text_styles.dart';
import '../../../shared/widgets/feedback/app_toast.dart';
import '../../../shared/widgets/forms/app_text_field.dart';
import '../../../shared/widgets/layouts/polished_page.dart';
import '../../../shared/widgets/visuals/social_icon.dart';
// The confirmation endpoint is shared: `POST /marketplace/contacts/:id/confirm`
// accepts the client and the atelier alike and records whichever side called
// it. Reaching across for the existing repository keeps one implementation of
// one endpoint rather than a second copy that can drift.
import '../../client/discovery/controllers/marketplace_providers.dart';
import '../../setup_wizard/domain/atelier_regions.dart';
import '../controllers/operations_providers.dart';
import '../domain/atelier_publication.dart';
import '../domain/operations_models.dart';
import 'social_links_editor.dart';

/// The atelier's side of the marketplace: whether it is published, and who has
/// asked for it.
///
/// Both halves were missing. An atelier had no way to learn that it was sitting
/// at `draft` — invisible to every client search — and no way to see the
/// requests clients had sent it, because `contact_events` had a single reader
/// and it was the client's own history.
class AtelierMarketplaceStrip extends ConsumerWidget {
  const AtelierMarketplaceStrip({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final atelier = ref.watch(primaryRemoteAtelierProvider);
    final item = atelier.asData?.value;
    if (item == null) return const SizedBox.shrink();

    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        _PublicationCard(atelier: item),
        const SizedBox(height: AppSpacing.md),
        _ContactInbox(atelierId: item.id),
      ],
    );
  }
}

/// Where the atelier stands with the platform, in the words of the one status
/// that decides whether clients can find it.
class _PublicationCard extends ConsumerStatefulWidget {
  const _PublicationCard({required this.atelier});

  final RemoteAtelier atelier;

  @override
  ConsumerState<_PublicationCard> createState() => _PublicationCardState();
}

class _PublicationCardState extends ConsumerState<_PublicationCard> {
  bool _busy = false;

  @override
  Widget build(BuildContext context) {
    final atelier = widget.atelier;
    final publication = AtelierPublicationState.from(
      status: atelier.status,
      hasPosition: atelier.latitude != null && atelier.longitude != null,
    );
    final title = publication.title;
    final message = publication.message;
    final tone = switch (publication.tone) {
      AtelierPublicationTone.published => AppStatusTone.success,
      AtelierPublicationTone.waiting => AppStatusTone.neutral,
      AtelierPublicationTone.attention => AppStatusTone.warning,
      AtelierPublicationTone.blocked => AppStatusTone.error,
    };
    final canSubmit = publication.canSubmit;
    final needsPosition = publication.needsPosition;

    return AppSectionSurface(
      bordered: true,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          AppStatusBanner(
            title: title,
            message: message,
            icon: switch (tone) {
              AppStatusTone.success => Icons.verified_rounded,
              AppStatusTone.error => Icons.report_problem_outlined,
              AppStatusTone.warning => Icons.visibility_off_outlined,
              _ => Icons.hourglass_top_rounded,
            },
            tone: tone,
            compact: true,
          ),
          // Modifiable à tout moment : les liens n'étaient saisissables que dans
          // l'assistant, donc un couturier qui les avait passés, ou qui ouvrait
          // un compte TikTok ensuite, n'avait aucun moyen de les ajouter.
          const SizedBox(height: AppSpacing.sm),
          _SocialLinksRow(atelier: atelier, onEdit: _editSocialLinks),
          if (needsPosition || canSubmit) ...[
            const SizedBox(height: AppSpacing.sm),
            Row(
              children: [
                if (needsPosition)
                  Expanded(
                    child: OutlinedButton.icon(
                      onPressed: _busy ? null : _editRegion,
                      icon: const Icon(Icons.location_on_outlined, size: 18),
                      label: const Text('Indiquer ma région'),
                    ),
                  ),
                if (needsPosition && canSubmit)
                  const SizedBox(width: AppSpacing.sm),
                if (canSubmit)
                  Expanded(
                    child: FilledButton.icon(
                      onPressed: _busy || !publication.canSubmitNow
                          ? null
                          : _submit,
                      icon: _busy
                          ? const SizedBox.square(
                              dimension: 16,
                              child: CircularProgressIndicator.adaptive(
                                strokeWidth: 2,
                              ),
                            )
                          : const Icon(Icons.send_rounded, size: 18),
                      label: const Text('Envoyer pour vérification'),
                    ),
                  ),
              ],
            ),
          ],
        ],
      ),
    );
  }

  Future<void> _editRegion() async {
    final region = await showModalBottomSheet<AtelierRegion>(
      context: context,
      isScrollControlled: true,
      showDragHandle: true,
      useSafeArea: true,
      builder: (_) => const _RegionSheet(),
    );
    if (region == null || !mounted) return;

    setState(() => _busy = true);
    try {
      await ref
          .read(operationsRepositoryProvider)
          .updateAtelier(
            widget.atelier.id,
            address: widget.atelier.address ?? region.label,
            region: region.label,
            latitude: region.latitude,
            longitude: region.longitude,
          );
      ref.invalidate(remoteAteliersProvider);
      ref.invalidate(primaryRemoteAtelierProvider);
      AppToast.show(
        title: 'Région enregistrée',
        message: '${region.label} — vous pouvez maintenant être publié.',
        type: ToastType.success,
      );
    } catch (error) {
      AppToast.show(
        title: 'Région non enregistrée',
        message: error is ApiException
            ? error.message
            : 'Vérifiez votre connexion puis réessayez.',
        type: ToastType.error,
      );
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  Future<void> _editSocialLinks() async {
    final result = await showModalBottomSheet<SocialLinksResult>(
      context: context,
      isScrollControlled: true,
      showDragHandle: true,
      useSafeArea: true,
      builder: (_) => SocialLinksEditorSheet(
        initialTiktokUrl: widget.atelier.tiktokUrl,
        initialInstagramUrl: widget.atelier.instagramUrl,
        initialFacebookUrl: widget.atelier.facebookUrl,
      ),
    );
    if (result == null || !mounted) return;

    setState(() => _busy = true);
    try {
      // Les trois champs partent systématiquement : une chaîne vide retire le
      // lien, ce que le couturier attend en vidant le champ.
      await ref
          .read(operationsRepositoryProvider)
          .updateAtelier(
            widget.atelier.id,
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

  Future<void> _submit() async {
    final documentRef = await showModalBottomSheet<String>(
      context: context,
      isScrollControlled: true,
      showDragHandle: true,
      builder: (_) => const _DocumentSheet(),
    );
    if (documentRef == null || !mounted) return;

    setState(() => _busy = true);
    try {
      await ref
          .read(operationsRepositoryProvider)
          .submitVerification(
            atelierId: widget.atelier.id,
            idDocumentRef: documentRef,
          );
      ref.invalidate(remoteAteliersProvider);
      ref.invalidate(primaryRemoteAtelierProvider);
      AppToast.show(
        title: 'Atelier publié',
        message:
            'Vous apparaissez dès maintenant dans la recherche. La plateforme vérifiera votre dossier ensuite.',
        type: ToastType.success,
      );
    } catch (error) {
      AppToast.show(
        title: 'Envoi impossible',
        message: error is ApiException
            ? error.message
            : 'Vérifiez votre connexion puis réessayez.',
        type: ToastType.error,
      );
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }
}

/// Ce que les clients voient comme réseaux, et le bouton pour le changer.
///
/// Affiché même vide : un couturier qui ne sait pas que la fiche accepte ses
/// réseaux ne les ajoutera jamais, et c'est ce que les clients regardent avant
/// d'appeler.
class _SocialLinksRow extends StatelessWidget {
  const _SocialLinksRow({required this.atelier, required this.onEdit});

  final RemoteAtelier atelier;
  final VoidCallback onEdit;

  @override
  Widget build(BuildContext context) {
    final present = <SocialNetwork>[
      if ((atelier.tiktokUrl ?? '').trim().isNotEmpty) SocialNetwork.tiktok,
      if ((atelier.instagramUrl ?? '').trim().isNotEmpty)
        SocialNetwork.instagram,
      if ((atelier.facebookUrl ?? '').trim().isNotEmpty) SocialNetwork.facebook,
    ];

    return Row(
      children: [
        Expanded(
          child: present.isEmpty
              ? Text(
                  'Aucun réseau publié',
                  style: AppTextStyles.bodySmall.copyWith(
                    color: context.textSecondaryColor,
                  ),
                )
              : Row(
                  children: [
                    for (final network in present) ...[
                      SocialIcon(network: network, size: 18),
                      const SizedBox(width: AppSpacing.xs),
                    ],
                    Flexible(
                      child: Text(
                        present.length == 1
                            ? '1 réseau publié'
                            : '${present.length} réseaux publiés',
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis,
                        style: AppTextStyles.bodySmall.copyWith(
                          color: context.textSecondaryColor,
                        ),
                      ),
                    ),
                  ],
                ),
        ),
        TextButton.icon(
          onPressed: onEdit,
          icon: const Icon(Icons.edit_outlined, size: 18),
          label: Text(present.isEmpty ? 'Ajouter' : 'Modifier'),
        ),
      ],
    );
  }
}

class _RegionSheet extends StatelessWidget {
  const _RegionSheet();

  @override
  Widget build(BuildContext context) {
    return SafeArea(
      child: Padding(
        padding: const EdgeInsets.fromLTRB(
          AppSpacing.gutter,
          0,
          AppSpacing.gutter,
          AppSpacing.lg,
        ),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            const AppSectionHeader(
              title: 'Région de l’atelier',
              subtitle:
                  'Les clients cherchent par région et par distance. Sans région, votre atelier n’apparaît dans aucun résultat.',
              icon: Icons.location_on_outlined,
            ),
            const SizedBox(height: AppSpacing.md),
            Flexible(
              child: SingleChildScrollView(
                child: Wrap(
                  spacing: AppSpacing.sm,
                  runSpacing: AppSpacing.sm,
                  children: AtelierRegions.all
                      .map(
                        (region) => ActionChip(
                          label: Text(region.label),
                          onPressed: () => Navigator.pop(context, region),
                        ),
                      )
                      .toList(growable: false),
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class _DocumentSheet extends StatefulWidget {
  const _DocumentSheet();

  @override
  State<_DocumentSheet> createState() => _DocumentSheetState();
}

class _DocumentSheetState extends State<_DocumentSheet> {
  final _controller = TextEditingController();

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final valid = _controller.text.trim().length >= 4;
    return Padding(
      padding: EdgeInsets.fromLTRB(
        AppSpacing.gutter,
        0,
        AppSpacing.gutter,
        MediaQuery.viewInsetsOf(context).bottom + AppSpacing.lg,
      ),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const AppSectionHeader(
            title: 'Pièce justificative',
            subtitle:
                'Numéro de pièce d’identité ou de registre de commerce. Vérifié par la plateforme, jamais montré aux clients.',
            icon: Icons.badge_outlined,
          ),
          const SizedBox(height: AppSpacing.md),
          AppTextField(
            label: 'Numéro du document',
            hint: 'Ex. CNI-1975-2024-000731',
            controller: _controller,
            onChanged: (_) => setState(() {}),
            icon: Icons.badge_outlined,
            isValid: valid,
            textInputAction: TextInputAction.done,
          ),
          const SizedBox(height: AppSpacing.md),
          SizedBox(
            width: double.infinity,
            child: FilledButton(
              onPressed: valid
                  ? () => Navigator.pop(context, _controller.text.trim())
                  : null,
              child: const Text('Envoyer le dossier'),
            ),
          ),
        ],
      ),
    );
  }
}

/// The requests clients have sent this atelier.
class _ContactInbox extends ConsumerWidget {
  const _ContactInbox({required this.atelierId});

  final String atelierId;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final contacts = ref.watch(remoteAtelierContactsProvider(atelierId));

    return contacts.when(
      loading: () => const SizedBox.shrink(),
      error: (_, _) => AppStatusBanner(
        title: 'Demandes indisponibles',
        message: 'Les demandes clients n’ont pas pu être chargées.',
        icon: Icons.cloud_off_rounded,
        tone: AppStatusTone.warning,
        compact: true,
        actionLabel: 'Réessayer',
        onAction: () =>
            ref.invalidate(remoteAtelierContactsProvider(atelierId)),
      ),
      data: (page) {
        if (page.items.isEmpty) {
          return const AppStatusBanner(
            title: 'Aucune demande client',
            message:
                'Les appels et messages envoyés depuis la recherche apparaîtront ici.',
            icon: Icons.forum_outlined,
            tone: AppStatusTone.neutral,
            compact: true,
          );
        }
        final open = page.items.where((item) => item.canConfirm).length;
        return AppSectionSurface(
          bordered: true,
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Row(
                children: [
                  Icon(
                    Icons.forum_outlined,
                    size: 20,
                    color: context.textPrimaryColor,
                  ),
                  const SizedBox(width: AppSpacing.sm),
                  Expanded(
                    child: Text(
                      'Demandes clients',
                      style: AppTextStyles.label.copyWith(
                        color: context.textPrimaryColor,
                      ),
                    ),
                  ),
                  Text(
                    open == 0 ? '${page.items.length}' : '$open à confirmer',
                    style: AppTextStyles.caption.copyWith(
                      color: open == 0
                          ? context.textSecondaryColor
                          : context.statusForeground(AppColors.warning),
                    ),
                  ),
                ],
              ),
              for (final contact in page.items.take(5)) ...[
                const Divider(height: AppSpacing.lg),
                _ContactRow(atelierId: atelierId, contact: contact),
              ],
            ],
          ),
        );
      },
    );
  }
}

class _ContactRow extends ConsumerStatefulWidget {
  const _ContactRow({required this.atelierId, required this.contact});

  final String atelierId;
  final RemoteAtelierContact contact;

  @override
  ConsumerState<_ContactRow> createState() => _ContactRowState();
}

class _ContactRowState extends ConsumerState<_ContactRow> {
  bool _busy = false;

  @override
  Widget build(BuildContext context) {
    final contact = widget.contact;
    final date = DateFormat('d MMM · HH:mm', 'fr_FR').format(contact.createdAt);

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Row(
          children: [
            Expanded(
              child: Text(
                contact.clientName ?? 'Client',
                maxLines: 1,
                overflow: TextOverflow.ellipsis,
                style: AppTextStyles.label.copyWith(
                  color: context.textPrimaryColor,
                ),
              ),
            ),
            Text(
              contact.statusLabel,
              style: AppTextStyles.caption.copyWith(
                color: context.textSecondaryColor,
              ),
            ),
          ],
        ),
        const SizedBox(height: AppSpacing.xxs),
        Text(
          '${contact.channelLabel} · $date'
          '${contact.clientPhone == null ? '' : ' · ${contact.clientPhone}'}',
          maxLines: 1,
          overflow: TextOverflow.ellipsis,
          style: AppTextStyles.bodySmall.copyWith(
            color: context.textSecondaryColor,
          ),
        ),
        if (contact.canConfirm || contact.awaitingClientConfirmation) ...[
          const SizedBox(height: AppSpacing.xs),
          if (contact.canConfirm)
            Align(
              alignment: Alignment.centerLeft,
              child: TextButton.icon(
                onPressed: _busy ? null : _confirm,
                icon: _busy
                    ? const SizedBox.square(
                        dimension: 16,
                        child: CircularProgressIndicator.adaptive(
                          strokeWidth: 2,
                        ),
                      )
                    : const Icon(Icons.check_rounded, size: 18),
                // Not "terminer": this records the atelier's half. The exchange
                // completes, and the client's review unlocks, only once the
                // client confirms as well.
                label: const Text('J’ai servi ce client'),
              ),
            )
          else
            Text(
              'En attente de la confirmation du client.',
              style: AppTextStyles.caption.copyWith(
                color: context.textSecondaryColor,
              ),
            ),
        ],
      ],
    );
  }

  Future<void> _confirm() async {
    setState(() => _busy = true);
    try {
      await ref
          .read(marketplaceRepositoryProvider)
          .confirmContact(contactId: widget.contact.id, status: 'completed');
      ref.invalidate(remoteAtelierContactsProvider(widget.atelierId));
      AppToast.show(
        title: 'Confirmation enregistrée',
        message: 'Le client doit confirmer à son tour pour clore l’échange.',
        type: ToastType.success,
      );
    } catch (error) {
      AppToast.show(
        title: 'Confirmation impossible',
        message: error is ApiException
            ? error.message
            : 'Vérifiez votre connexion puis réessayez.',
        type: ToastType.error,
      );
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }
}

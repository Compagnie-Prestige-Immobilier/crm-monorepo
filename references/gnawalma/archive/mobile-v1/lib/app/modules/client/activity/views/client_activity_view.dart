import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:intl/intl.dart';

import '../../../../core/network/api_exception.dart';
import '../../../../routes/app_routes.dart';
import '../../../../shared/theme/app_colors.dart';
import '../../../../shared/theme/app_spacing.dart';
import '../../../../shared/theme/app_text_styles.dart';
import '../../../../shared/widgets/feedback/app_toast.dart';
import '../../../../shared/widgets/interaction/pressable_surface.dart';
import '../../../../shared/widgets/visuals/atelier_illustration.dart';
import '../../discovery/controllers/marketplace_providers.dart';
import '../../discovery/widgets/review_sheet.dart';
import '../../shared/widgets/client_ui.dart';
import '../domain/marketplace_contact.dart';

class ClientActivityView extends ConsumerWidget {
  const ClientActivityView({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final contacts = ref.watch(marketplaceContactsProvider);
    // The way out of the empty state. Without it this tab was a dead end: a
    // title, a sentence, and nothing to touch.
    void openSearch() => context.push(AppRoutes.clientSearch);

    return SafeArea(
      bottom: false,
      child: Column(
        children: [
          // Pas de pastille de comptage : la legende juste dessous dit deja le
          // total, et en dit davantage puisqu'elle distingue les echanges en
          // cours des prestations terminees. Le meme chiffre deux fois sur deux
          // lignes voisines se lit comme une erreur.
          const ClientPageHeader(title: 'Votre activité'),
          Expanded(
            child: contacts.when(
              loading: () => const ClientLoadingList(itemCount: 4),
              error: (_, _) => ClientStatePanel(
                motif: AtelierMotif.nodata,
                icon: Icons.receipt_long_outlined,
                title: 'Historique indisponible',
                message:
                    'L’activité n’a pas pu être chargée. Vérifiez la connexion puis réessayez.',
                actionLabel: 'Réessayer',
                onAction: () => ref.invalidate(marketplaceContactsProvider),
                secondaryActionLabel: 'Trouver un atelier',
                onSecondaryAction: openSearch,
              ),
              data: (items) => items.isEmpty
                  ? ClientStatePanel(
                      motif: AtelierMotif.thread,
                      icon: Icons.forum_outlined,
                      title: 'Aucun échange pour l’instant',
                      message:
                          'Vos appels et messages aux ateliers apparaîtront ici.',
                      actionLabel: 'Trouver un atelier',
                      actionIcon: Icons.search_rounded,
                      onAction: openSearch,
                    )
                  : RefreshIndicator(
                      onRefresh: () async {
                        ref.invalidate(marketplaceContactsProvider);
                        await ref.read(marketplaceContactsProvider.future);
                      },
                      child: CustomScrollView(
                        key: const PageStorageKey('client-activity-list'),
                        physics: const AlwaysScrollableScrollPhysics(),
                        slivers: [
                          SliverToBoxAdapter(
                            child: ClientListCaption(
                              label: _summaryTitle(items),
                              trailing: '${items.length} au total',
                            ),
                          ),
                          SliverPadding(
                            padding: const EdgeInsets.fromLTRB(
                              AppSpacing.gutter,
                              0,
                              AppSpacing.gutter,
                              AppSpacing.sectionSpacing,
                            ),
                            sliver: SliverList.separated(
                              itemCount: items.length,
                              separatorBuilder: (_, _) =>
                                  const SizedBox(height: AppSpacing.sm),
                              itemBuilder: (_, index) =>
                                  _ContactCard(contact: items[index]),
                            ),
                          ),
                        ],
                      ),
                    ),
            ),
          ),
        ],
      ),
    );
  }

  static String _summaryTitle(List<MarketplaceContact> items) {
    final pending = items
        .where((item) => item.status == 'created' || item.status == 'accepted')
        .length;
    final completed = items.where((item) => item.status == 'completed').length;
    if (pending > 0) {
      return '$pending échange${pending == 1 ? '' : 's'} en cours';
    }
    return '$completed prestation${completed == 1 ? '' : 's'} terminée${completed == 1 ? '' : 's'}';
  }
}

/// One exchange, read in the order it matters: who, what happened, then the
/// small print.
///
/// The row used to stack four lines of identical weight, all in the secondary
/// colour, on gaps of 3/4/10 — nothing was promoted and nothing was grouped.
/// Now the status sits directly under the name in its own colour, the channel
/// and date form a quieter second block, and the address closes the row as the
/// least important line on it.
class _ContactCard extends ConsumerWidget {
  const _ContactCard({required this.contact});

  final MarketplaceContact contact;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final theme = Theme.of(context);
    final statusColor = _statusColor(contact.status);
    final date = DateFormat(
      'd MMM y · HH:mm',
      'fr_FR',
    ).format(contact.createdAt);
    final address = (contact.atelierAddress ?? '').trim();

    return PressableSurface(
      onTap: () =>
          context.push('${AppRoutes.clientAtelierDetail}/${contact.atelierId}'),
      accentColor: theme.colorScheme.secondary,
      // The row carries "J'ai été servi" and "Donner mon avis"; without this
      // the card's own label replaced them in the accessibility tree and the
      // two actions that close an exchange could not be reached at all.
      hasNestedActions: contact.canConfirm || contact.canReview,
      // "En attente de l'atelier" is the only trace that this client's own
      // confirmation was recorded — the status stays "Demande envoyée" until
      // the atelier answers. Left out of the spoken label, a screen-reader user
      // heard nothing change after tapping "J'ai été servi" and had no way to
      // know whether it had worked.
      semanticLabel:
          '${contact.atelierName}, ${contact.channelLabel}, ${contact.statusLabel}, $date'
          '${contact.awaitingAtelierConfirmation ? ', en attente de la confirmation de l’atelier' : ''}',
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          // Hairline square, ink glyph. The accent wash behind every row's
          // icon spent the one accent on decoration; here it belongs to the
          // status mark, which is the only thing on the row that varies.
          Container(
            width: 48,
            height: 48,
            alignment: Alignment.center,
            decoration: BoxDecoration(
              border: Border.all(color: theme.colorScheme.outlineVariant),
              borderRadius: BorderRadius.circular(AppSpacing.radiusMD),
            ),
            child: Icon(
              _channelIcon(contact.channel),
              size: 21,
              color: theme.colorScheme.onSurface,
            ),
          ),
          const SizedBox(width: AppSpacing.md),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Row(
                  children: [
                    Expanded(
                      child: Text(
                        contact.atelierName,
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis,
                        style: theme.textTheme.titleMedium,
                      ),
                    ),
                    const SizedBox(width: AppSpacing.xs),
                    Icon(
                      Icons.chevron_right_rounded,
                      size: 22,
                      color: theme.colorScheme.onSurfaceVariant,
                    ),
                  ],
                ),
                const SizedBox(height: AppSpacing.xs),
                // The promoted line: what became of this exchange.
                Wrap(
                  spacing: AppSpacing.xs,
                  runSpacing: AppSpacing.xxs,
                  crossAxisAlignment: WrapCrossAlignment.center,
                  children: [
                    _StatusMark(
                      icon: _statusIcon(contact.status),
                      label: contact.statusLabel,
                      color: statusColor,
                    ),
                    if (contact.canReview)
                      const _QuietTag(
                        icon: Icons.rate_review_outlined,
                        label: 'Avis disponible',
                      ),
                  ],
                ),
                const SizedBox(height: AppSpacing.sm),
                Text(
                  '${contact.channelLabel} · $date',
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                  style: theme.textTheme.bodySmall,
                ),
                if (address.isNotEmpty) ...[
                  const SizedBox(height: AppSpacing.xxs),
                  Row(
                    children: [
                      Icon(
                        Icons.location_on_outlined,
                        size: 14,
                        color: theme.colorScheme.onSurfaceVariant.withValues(
                          alpha: 0.8,
                        ),
                      ),
                      const SizedBox(width: AppSpacing.xxs),
                      Expanded(
                        child: Text(
                          address,
                          maxLines: 1,
                          overflow: TextOverflow.ellipsis,
                          style: theme.textTheme.labelMedium,
                        ),
                      ),
                    ],
                  ),
                ],
                // The two actions that close an exchange. Both endpoints
                // existed on the server and were reachable from nothing, so a
                // contact could only ever sit at its initial status and the
                // ratings shown throughout the app could never have come from
                // a real client.
                if (contact.canConfirm ||
                    contact.canReview ||
                    contact.awaitingAtelierConfirmation) ...[
                  const SizedBox(height: AppSpacing.sm),
                  Row(
                    children: [
                      if (contact.canConfirm)
                        TextButton.icon(
                          onPressed: () => _confirm(context, ref),
                          icon: const Icon(Icons.check_rounded, size: 18),
                          // Not "prestation terminée": confirming records this
                          // client's half only. The exchange completes when the
                          // atelier confirms as well.
                          label: const Text('J’ai été servi'),
                        ),
                      if (contact.awaitingAtelierConfirmation)
                        const _QuietTag(
                          icon: Icons.hourglass_empty_rounded,
                          label: 'En attente de l’atelier',
                        ),
                      if (contact.canReview)
                        TextButton.icon(
                          onPressed: () => _review(context, ref),
                          icon: const Icon(
                            Icons.star_outline_rounded,
                            size: 18,
                          ),
                          label: const Text('Donner mon avis'),
                        ),
                    ],
                  ),
                ],
              ],
            ),
          ),
        ],
      ),
    );
  }

  Future<void> _confirm(BuildContext context, WidgetRef ref) async {
    try {
      await ref
          .read(marketplaceRepositoryProvider)
          .confirmContact(contactId: contact.id, status: 'completed');
      ref.invalidate(marketplaceContactsProvider);
      AppToast.show(
        title: 'Confirmation enregistrée',
        message: 'L’atelier doit confirmer à son tour avant votre avis.',
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
    }
  }

  Future<void> _review(BuildContext context, WidgetRef ref) async {
    final result = await showModalBottomSheet<({int rating, String? body})>(
      context: context,
      isScrollControlled: true,
      showDragHandle: true,
      builder: (sheetContext) => ReviewSheet(atelierName: contact.atelierName),
    );
    if (result == null) return;

    try {
      await ref
          .read(marketplaceRepositoryProvider)
          .createReview(
            contactId: contact.id,
            rating: result.rating,
            body: result.body,
          );
      ref.invalidate(marketplaceContactsProvider);
      AppToast.show(
        title: 'Merci',
        message: 'Votre avis sera publié après vérification.',
        type: ToastType.success,
      );
    } catch (error) {
      AppToast.show(
        title: 'Avis non envoyé',
        message: error is ApiException
            ? error.message
            : 'Vérifiez votre connexion puis réessayez.',
        type: ToastType.error,
      );
    }
  }

  static IconData _channelIcon(String channel) => switch (channel) {
    'whatsapp' => Icons.chat_rounded,
    'sms' => Icons.sms_rounded,
    'appointment' => Icons.calendar_month_rounded,
    _ => Icons.call_rounded,
  };

  static IconData _statusIcon(String status) => switch (status) {
    'accepted' => Icons.check_circle_outline_rounded,
    'completed' => Icons.verified_outlined,
    'declined' || 'cancelled' => Icons.cancel_outlined,
    'disputed' => Icons.report_problem_outlined,
    _ => Icons.schedule_rounded,
  };

  static Color _statusColor(String status) => switch (status) {
    'accepted' || 'completed' => AppColors.success,
    'declined' || 'cancelled' || 'disputed' => AppColors.error,
    _ => AppColors.warning,
  };
}

/// The status, set as coloured type rather than as a tinted capsule.
///
/// A pastel pill puts a second surface inside a flat card and mutes the very
/// word it is meant to emphasise; the label itself carrying the status colour
/// is both louder and quieter — louder as information, quieter as decoration.
class _StatusMark extends StatelessWidget {
  const _StatusMark({
    required this.icon,
    required this.label,
    required this.color,
  });

  final IconData icon;
  final String label;
  final Color color;

  @override
  Widget build(BuildContext context) {
    return Row(
      mainAxisSize: MainAxisSize.min,
      children: [
        Icon(icon, size: 16, color: color),
        const SizedBox(width: AppSpacing.xxs + 1),
        Flexible(
          child: Text(
            label,
            maxLines: 1,
            overflow: TextOverflow.ellipsis,
            style: AppTextStyles.label.copyWith(color: color),
          ),
        ),
      ],
    );
  }
}

/// A secondary signal that must stay subordinate to the status: hairline
/// outline, ink type, no fill.
class _QuietTag extends StatelessWidget {
  const _QuietTag({required this.icon, required this.label});

  final IconData icon;
  final String label;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    return Container(
      padding: const EdgeInsets.symmetric(
        horizontal: AppSpacing.xs,
        vertical: 3,
      ),
      decoration: BoxDecoration(
        borderRadius: BorderRadius.circular(AppSpacing.radiusSM),
        border: Border.all(color: theme.colorScheme.outlineVariant),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          Icon(icon, size: 13, color: theme.colorScheme.onSurfaceVariant),
          const SizedBox(width: AppSpacing.xxs),
          Text(label, style: theme.textTheme.labelMedium),
        ],
      ),
    );
  }
}


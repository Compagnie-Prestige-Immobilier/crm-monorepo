import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/navigation/app_navigator.dart';
import '../../../data/models/project_model.dart';
import '../../../routes/app_routes.dart';
import '../../../shared/theme/app_colors_extensions.dart';
import '../../../shared/theme/app_spacing.dart';
import '../../../shared/theme/app_text_styles.dart';
import '../../../shared/utils/app_dialogs.dart';
import '../../../shared/utils/app_feedback.dart';
import '../../../shared/utils/app_money.dart';
import '../../../shared/widgets/inputs/voice_note_player.dart';
import '../../../shared/widgets/layouts/polished_page.dart';
import '../../../shared/widgets/navigation/custom_app_bar.dart';
import '../../../shared/widgets/states/error_state.dart';
import '../../../shared/widgets/states/skeleton.dart';
import '../controllers/project_detail_provider.dart';
import '../controllers/project_detail_state.dart';
import 'widgets/digital_ticket.dart';
import 'widgets/photo_gallery.dart';
import 'widgets/project_action_bar.dart';
import 'widgets/project_measurements_card.dart';

class ProjectDetailView extends ConsumerStatefulWidget {
  const ProjectDetailView({
    super.key,
    required this.projectId,
    this.isPreview = false,
  });

  final int projectId;
  final bool isPreview;

  @override
  ConsumerState<ProjectDetailView> createState() => _ProjectDetailViewState();
}

class _ProjectDetailViewState extends ConsumerState<ProjectDetailView> {
  final GlobalKey _ticketKey = GlobalKey();

  @override
  Widget build(BuildContext context) {
    final provider = projectDetailProvider(
      widget.projectId,
      isPreviewMode: widget.isPreview,
    );
    final state = ref.watch(provider);
    final notifier = ref.read(provider.notifier);

    return Scaffold(
      backgroundColor: context.backgroundColor,
      appBar: CustomAppBar(
        title: 'Dossier de production',
        showBackButton: true,
        actions: state.isPreviewMode
            ? null
            : [
                IconButton(
                  icon: const Icon(Icons.ios_share_rounded),
                  tooltip: 'Partager le ticket',
                  onPressed: () => notifier.shareTicket(_ticketKey),
                ),
                PopupMenuButton<_ProjectMenuAction>(
                  tooltip: 'Plus d’actions',
                  onSelected: (action) =>
                      _handleMenuAction(context, action, state, notifier),
                  itemBuilder: (context) => [
                    const PopupMenuItem(
                      value: _ProjectMenuAction.invoice,
                      child: ListTile(
                        contentPadding: EdgeInsets.zero,
                        leading: Icon(Icons.receipt_long_outlined),
                        title: Text('Ouvrir la facture'),
                      ),
                    ),
                    const PopupMenuItem(
                      value: _ProjectMenuAction.edit,
                      child: ListTile(
                        contentPadding: EdgeInsets.zero,
                        leading: Icon(Icons.edit_outlined),
                        title: Text('Modifier'),
                      ),
                    ),
                    const PopupMenuDivider(),
                    PopupMenuItem(
                      value: _ProjectMenuAction.delete,
                      child: ListTile(
                        contentPadding: EdgeInsets.zero,
                        leading: Icon(
                          Icons.delete_outline_rounded,
                          color: Theme.of(context).colorScheme.error,
                        ),
                        title: Text(
                          'Supprimer',
                          style: Theme.of(context).textTheme.bodyLarge
                              ?.copyWith(
                                color: Theme.of(context).colorScheme.error,
                              ),
                        ),
                      ),
                    ),
                  ],
                ),
              ],
      ),
      body: Builder(
        builder: (context) {
          if (state.isLoading) return const _ProjectDetailSkeleton();

          final project = state.project;
          if (project == null) {
            return ErrorState(
              message: 'Cet article est introuvable ou a été supprimé.',
              onRetry: AppNavigator.back,
            );
          }

          final clientName = state.client?.displayName;
          final dateMessage = _deadlineMessage(project.expectedDeliveryDate);

          return CustomScrollView(
            slivers: [
              SliverToBoxAdapter(
                child: AppPageHeader(
                  eyebrow: 'ARTICLE #${project.id}',
                  title: project.name,
                  subtitle: project.garmentType,
                  accentColor: context.textSecondaryColor,
                ),
              ),
              SliverPadding(
                padding: EdgeInsets.fromLTRB(
                  AppSpacing.md,
                  0,
                  AppSpacing.md,
                  MediaQuery.paddingOf(context).bottom + AppSpacing.xl,
                ),
                sliver: SliverList(
                  delegate: SliverChildListDelegate.fixed([
                    _ProjectHeadline(
                      project: project,
                      clientName: clientName,
                      deadlineMessage: dateMessage,
                    ),
                    if (project.isOverdue) ...[
                      const SizedBox(height: AppSpacing.md),
                      AppStatusBanner(
                        title: 'Livraison en retard',
                        message: dateMessage,
                        icon: Icons.warning_amber_rounded,
                        tone: AppStatusTone.warning,
                      ),
                    ],
                    const SizedBox(height: AppSpacing.sectionSpacing),
                    const AppSectionHeader(
                      title: 'Ticket client',
                      subtitle:
                          'Résumé partageable de l’article et de la commande',
                      icon: Icons.confirmation_number_outlined,
                    ),
                    const SizedBox(height: AppSpacing.md),
                    DigitalTicket(
                      project: project,
                      orderArticles: state.orderArticles,
                      order: state.order,
                      client: state.client,
                      pattern: state.pattern,
                      getStatusColor: notifier.getStatusColor,
                      getStatusLabel: notifier.getStatusLabel,
                      onPayment: notifier.addPayment,
                      repaintBoundaryKey: _ticketKey,
                    ),
                    if (project.measurementNotes?.trim().isNotEmpty ==
                        true) ...[
                      const SizedBox(height: AppSpacing.sectionSpacing),
                      const AppSectionHeader(
                        title: 'Mesures écrites',
                        subtitle: 'Telles que le client les a données',
                        icon: Icons.notes_rounded,
                      ),
                      const SizedBox(height: AppSpacing.md),
                      AppSectionSurface(
                        bordered: true,
                        child: SelectableText(
                          project.measurementNotes!.trim(),
                          style: AppTextStyles.bodyMedium.copyWith(
                            color: context.textPrimaryColor,
                          ),
                        ),
                      ),
                    ],
                    // La note vocale était écrite au moment de la commande et
                    // n'était relue nulle part.
                    if (project.audioNotePath?.trim().isNotEmpty == true) ...[
                      const SizedBox(height: AppSpacing.sectionSpacing),
                      const AppSectionHeader(
                        title: 'Consigne vocale',
                        subtitle: 'Enregistrée à la prise de commande',
                        icon: Icons.mic_none_rounded,
                      ),
                      const SizedBox(height: AppSpacing.md),
                      AppSectionSurface(
                        bordered: true,
                        child: VoiceNotePlayer(
                          audioPath: project.audioNotePath!,
                        ),
                      ),
                    ],
                    if (project.measurementsSnapshot != null &&
                        project.measurementsSnapshot!.trim().isNotEmpty) ...[
                      const SizedBox(height: AppSpacing.sectionSpacing),
                      const AppSectionHeader(
                        title: 'Mesures utilisées',
                        subtitle: 'Instantané conservé pour cet article précis',
                        icon: Icons.straighten_rounded,
                      ),
                      const SizedBox(height: AppSpacing.md),
                      ProjectMeasurementsCard(
                        snapshot: project.measurementsSnapshot,
                      ),
                    ],
                    if (project.photoUrls.isNotEmpty) ...[
                      const SizedBox(height: AppSpacing.sectionSpacing),
                      AppSectionHeader(
                        title: 'Références visuelles',
                        subtitle:
                            '${project.photoUrls.length} photo${project.photoUrls.length == 1 ? '' : 's'}',
                        icon: Icons.photo_library_outlined,
                      ),
                      const SizedBox(height: AppSpacing.md),
                      PhotoGallery(photoUrls: project.photoUrls),
                    ],
                    if (!state.isPreviewMode) ...[
                      const SizedBox(height: AppSpacing.sectionSpacing),
                      const AppSectionHeader(
                        title: 'Étape suivante',
                        subtitle:
                            'Faites avancer l’article avec une action explicite',
                        icon: Icons.task_alt_rounded,
                      ),
                      const SizedBox(height: AppSpacing.md),
                      ProjectActionBar(
                        project: project,
                        isPreviewMode: state.isPreviewMode,
                        onUpdateStatus: (status) => _advanceStatus(
                          notifier,
                          project,
                          clientName,
                          status,
                        ),
                        onArchive: () => _archiveProject(notifier, project),
                      ),
                    ],
                  ]),
                ),
              ),
            ],
          );
        },
      ),
    );
  }

  /// Advances the article, with an explicit close on the two terminal steps.
  ///
  /// Finishing and delivering are the moments the tailor remembers: they used to
  /// flip the chip and nothing else, so the most meaningful action of the screen
  /// was also its quietest. They now ask once, then close on a confirmation the
  /// user has to acknowledge.
  Future<void> _advanceStatus(
    ProjectDetail notifier,
    ProjectModel project,
    String? clientName,
    ProjectStatus next,
  ) async {
    final isTerminal =
        next == ProjectStatus.completed || next == ProjectStatus.delivered;

    if (isTerminal) {
      final confirmed = await AppDialogs.showConfirmation(
        title: next == ProjectStatus.delivered
            ? 'Confirmer la livraison ?'
            : 'Marquer l’article comme terminé ?',
        message: next == ProjectStatus.delivered
            ? '${project.name} sera enregistré comme livré et le suivi de la commande sera mis à jour.'
            : '${project.name} passera en « Terminé » : la production est finie, il reste à le livrer.',
        confirmLabel: next == ProjectStatus.delivered
            ? 'Confirmer la livraison'
            : 'Marquer terminé',
        cancelLabel: 'Pas encore',
        icon: next.icon,
      );
      if (confirmed != true) return;
    }

    await notifier.updateStatus(next);
    if (!mounted || !isTerminal) return;
    _showCompletionSheet(next, project, clientName);
  }

  void _showCompletionSheet(
    ProjectStatus status,
    ProjectModel project,
    String? clientName,
  ) {
    showModalBottomSheet<void>(
      context: context,
      useSafeArea: true,
      showDragHandle: true,
      builder: (sheetContext) => Padding(
        padding: const EdgeInsets.fromLTRB(
          AppSpacing.gutter,
          0,
          AppSpacing.gutter,
          AppSpacing.lg,
        ),
        child: _CompletionSheet(
          status: status,
          project: project,
          clientName: clientName,
          onClose: () => Navigator.pop(sheetContext),
        ),
      ),
    );
  }

  Future<void> _archiveProject(
    ProjectDetail notifier,
    ProjectModel project,
  ) async {
    final confirmed = await AppDialogs.showConfirmation(
      title: 'Archiver ce dossier ?',
      message:
          '${project.name} quittera la liste des articles en cours. Vous le retrouverez dans les archives.',
      confirmLabel: 'Archiver',
      cancelLabel: 'Conserver',
      icon: Icons.archive_outlined,
    );
    if (confirmed != true) return;
    await notifier.archiveProject();
  }

  Future<void> _handleMenuAction(
    BuildContext context,
    _ProjectMenuAction action,
    ProjectDetailState state,
    ProjectDetail notifier,
  ) async {
    switch (action) {
      case _ProjectMenuAction.invoice:
        final orderId = state.project?.orderId;
        if (orderId == null) {
          AppFeedback.showWarning(
            'Cet article n’est rattaché à aucune commande.',
          );
          return;
        }
        AppNavigator.to(AppRoutes.invoiceLive, arguments: orderId);
        return;
      case _ProjectMenuAction.edit:
        if (state.order != null) {
          _showEditOptions(context, notifier);
        } else {
          notifier.navigateToEdit();
        }
        return;
      case _ProjectMenuAction.delete:
        final confirmed = await AppDialogs.showConfirmation(
          title: 'Supprimer cet article ?',
          message:
              'Son dossier de production sera supprimé. Cette action est irréversible.',
          confirmLabel: 'Supprimer',
          cancelLabel: 'Conserver',
          isDangerous: true,
          icon: Icons.delete_forever_rounded,
        );
        if (confirmed != true) return;
        final deleted = await notifier.deleteProject();
        if (deleted && mounted) AppNavigator.back();
        return;
    }
  }

  void _showEditOptions(BuildContext context, ProjectDetail notifier) {
    showModalBottomSheet<void>(
      context: context,
      showDragHandle: true,
      useSafeArea: true,
      builder: (context) => Padding(
        padding: EdgeInsets.fromLTRB(
          AppSpacing.gutter,
          0,
          AppSpacing.gutter,
          MediaQuery.viewInsetsOf(context).bottom + AppSpacing.lg,
        ),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            const AppSectionHeader(
              title: 'Que voulez-vous modifier ?',
              subtitle:
                  'Choisissez le niveau concerné pour éviter les changements involontaires.',
              icon: Icons.edit_note_rounded,
            ),
            const SizedBox(height: AppSpacing.md),
            AppActionTile(
              title: 'Cet article uniquement',
              subtitle: 'Mesures, tissu, modèle ou planning de cet article',
              icon: Icons.checkroom_outlined,
              onTap: () {
                Navigator.pop(context);
                notifier.navigateToEdit();
              },
            ),
            const SizedBox(height: AppSpacing.xs),
            AppActionTile(
              title: 'La commande complète',
              subtitle: 'Acompte, date globale et ensemble des articles',
              icon: Icons.receipt_long_outlined,
              onTap: () {
                Navigator.pop(context);
                notifier.navigateToEditOrder();
              },
            ),
          ],
        ),
      ),
    );
  }

  String _deadlineMessage(DateTime? date) {
    if (date == null) return 'Aucune date de livraison n’a encore été définie.';
    final now = DateTime.now();
    final normalizedNow = DateTime(now.year, now.month, now.day);
    final normalizedDate = DateTime(date.year, date.month, date.day);
    final days = normalizedDate.difference(normalizedNow).inDays;
    final formatted =
        '${date.day.toString().padLeft(2, '0')}/${date.month.toString().padLeft(2, '0')}/${date.year}';
    if (days < 0) {
      return 'Prévue le $formatted, avec ${days.abs()} jour${days.abs() == 1 ? '' : 's'} de retard.';
    }
    if (days == 0) return 'Livraison prévue aujourd’hui.';
    return 'Livraison prévue le $formatted, dans $days jour${days == 1 ? '' : 's'}.';
  }
}

/// The one number the tailor came for.
///
/// The screen used to print a price and an advance side by side and leave the
/// subtraction to the reader. What is still owed is stated in words, as the
/// largest thing on the page, with the two amounts it was derived from underneath.
class _ProjectHeadline extends ConsumerWidget {
  const _ProjectHeadline({
    required this.project,
    required this.deadlineMessage,
    this.clientName,
  });

  final ProjectModel project;
  final String deadlineMessage;
  final String? clientName;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final scheme = Theme.of(context).colorScheme;
    final money = ref.watch(moneyFormatterProvider);
    final total = project.actualPrice ?? project.estimatedPrice ?? 0;
    final paid = project.advancePayment ?? 0;
    final remaining = project.remainingAmount.clamp(0, double.infinity);
    final settled = remaining <= 0;
    final statusInk = context.statusForeground(project.status.color);

    return AppSectionSurface(
      bordered: true,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Icon(project.status.icon, size: 17, color: statusInk),
              const SizedBox(width: AppSpacing.xs),
              Expanded(
                child: Text(
                  '${project.status.label} · ${project.progressPercentage.round()} % DU SUIVI',
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                  style: AppTextStyles.overline.copyWith(color: statusInk),
                ),
              ),
            ],
          ),
          const SizedBox(height: AppSpacing.sm),
          Text(
            clientName ?? 'Client non renseigné',
            maxLines: 2,
            overflow: TextOverflow.ellipsis,
            style: AppTextStyles.h3.copyWith(color: context.textPrimaryColor),
          ),
          const SizedBox(height: AppSpacing.xxs),
          Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Icon(
                Icons.event_outlined,
                size: 15,
                color: context.textSecondaryColor,
              ),
              const SizedBox(width: AppSpacing.xxs),
              Expanded(
                child: Text(
                  deadlineMessage,
                  maxLines: 2,
                  overflow: TextOverflow.ellipsis,
                  style: AppTextStyles.bodySmall.copyWith(
                    color: context.textSecondaryColor,
                  ),
                ),
              ),
            ],
          ),
          const SizedBox(height: AppSpacing.lg),
          Divider(height: 1, color: scheme.outlineVariant),
          const SizedBox(height: AppSpacing.lg),
          Text(
            settled ? 'TOTAL ENCAISSÉ' : 'RESTE À ENCAISSER',
            style: AppTextStyles.overline.copyWith(
              color: context.textSecondaryColor,
            ),
          ),
          const SizedBox(height: AppSpacing.xs),
          FittedBox(
            fit: BoxFit.scaleDown,
            alignment: Alignment.centerLeft,
            child: Text(
              money.format(settled ? total : remaining, compactSymbol: true),
              style: AppTextStyles.statValue.copyWith(
                color: context.textPrimaryColor,
              ),
            ),
          ),
          const SizedBox(height: AppSpacing.xs),
          Text(
            settled
                ? 'Article soldé · total ${money.format(total, compactSymbol: true)}'
                : '${money.format(paid, compactSymbol: true)} réglés sur ${money.format(total, compactSymbol: true)}',
            maxLines: 2,
            overflow: TextOverflow.ellipsis,
            style: AppTextStyles.bodySmall.copyWith(
              color: context.textSecondaryColor,
            ),
          ),
        ],
      ),
    );
  }
}

/// The close of the production flow: what changed, and what is still owed.
class _CompletionSheet extends ConsumerWidget {
  const _CompletionSheet({
    required this.status,
    required this.project,
    required this.onClose,
    this.clientName,
  });

  final ProjectStatus status;
  final ProjectModel project;
  final VoidCallback onClose;
  final String? clientName;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final money = ref.watch(moneyFormatterProvider);
    final remaining = project.remainingAmount.clamp(0, double.infinity);
    final settled = remaining <= 0;
    final delivered = status == ProjectStatus.delivered;

    return Column(
      mainAxisSize: MainAxisSize.min,
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        Icon(
          delivered
              ? Icons.verified_outlined
              : Icons.check_circle_outline_rounded,
          size: 44,
          color: context.statusForeground(status.color),
        ),
        const SizedBox(height: AppSpacing.sm),
        Text(
          delivered ? 'Article livré' : 'Article terminé',
          textAlign: TextAlign.center,
          style: AppTextStyles.h3.copyWith(color: context.textPrimaryColor),
        ),
        const SizedBox(height: AppSpacing.xxs),
        Text(
          '${project.name} · ${clientName ?? 'Client non renseigné'}',
          textAlign: TextAlign.center,
          maxLines: 2,
          overflow: TextOverflow.ellipsis,
          style: AppTextStyles.bodySmall.copyWith(
            color: context.textSecondaryColor,
          ),
        ),
        const SizedBox(height: AppSpacing.lg),
        AppSectionSurface(
          bordered: true,
          padding: const EdgeInsets.all(AppSpacing.md),
          child: Row(
            children: [
              Icon(
                settled
                    ? Icons.check_circle_outline_rounded
                    : Icons.account_balance_wallet_outlined,
                size: 19,
                color: context.textPrimaryColor,
              ),
              const SizedBox(width: AppSpacing.sm),
              Expanded(
                child: Text(
                  settled
                      ? 'Paiement soldé, rien à encaisser.'
                      : 'Reste à encaisser ${money.format(remaining)}.',
                  style: AppTextStyles.label.copyWith(
                    color: context.textPrimaryColor,
                  ),
                ),
              ),
            ],
          ),
        ),
        const SizedBox(height: AppSpacing.lg),
        FilledButton(
          onPressed: onClose,
          child: Text(delivered ? 'Parfait' : 'Continuer'),
        ),
      ],
    );
  }
}

class _ProjectDetailSkeleton extends StatelessWidget {
  const _ProjectDetailSkeleton();

  @override
  Widget build(BuildContext context) {
    return Skeleton(
      child: ListView(
        physics: const NeverScrollableScrollPhysics(),
        padding: EdgeInsets.fromLTRB(
          AppSpacing.md,
          18,
          AppSpacing.md,
          MediaQuery.paddingOf(context).bottom + AppSpacing.xl,
        ),
        children: const [
          SkeletonBox(width: 96, height: 10, radius: AppSpacing.pillRadius),
          SizedBox(height: AppSpacing.xs),
          SkeletonBox(width: 214, height: 22, radius: AppSpacing.radiusSM),
          SizedBox(height: AppSpacing.xs),
          SkeletonBox(width: 148, height: 13, radius: AppSpacing.pillRadius),
          SizedBox(height: AppSpacing.lg),
          SkeletonBox(height: 232, radius: AppSpacing.radiusLG),
          SizedBox(height: AppSpacing.sectionSpacing),
          SkeletonBox(width: 176, height: 16, radius: AppSpacing.radiusSM),
          SizedBox(height: AppSpacing.md),
          SkeletonBox(height: 322, radius: AppSpacing.radiusLG),
          SizedBox(height: AppSpacing.sectionSpacing),
          SkeletonBox(width: 140, height: 16, radius: AppSpacing.radiusSM),
          SizedBox(height: AppSpacing.md),
          SkeletonBox(height: 158, radius: AppSpacing.radiusLG),
        ],
      ),
    );
  }
}

enum _ProjectMenuAction { invoice, edit, delete }

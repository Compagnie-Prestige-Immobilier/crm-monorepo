import 'package:flutter/material.dart';
import '../../../shared/utils/app_feedback.dart';
import 'package:get_it/get_it.dart';
import 'package:gnawalma/app/domain/repositories/i_project_repository.dart';
import 'package:gnawalma/app/routes/app_routes.dart';

import '../../../../app/data/models/project_model.dart';
import '../../../../app/data/services/invoice_service.dart';
import '../../../core/navigation/app_navigator.dart';
import '../../../shared/theme/app_colors.dart';
import '../../../shared/theme/app_spacing.dart';
import '../../../shared/utils/app_dialogs.dart';
import '../../../shared/utils/app_logger.dart';
import 'playful_card.dart';
import 'project_card/project_card_content.dart';
import 'project_card/project_card_image_stack.dart';

class ProjectCard extends StatelessWidget {
  final ProjectModel project;
  final VoidCallback onTap;

  const ProjectCard({super.key, required this.project, required this.onTap});

  void _handleDelete(BuildContext context) {
    AppLogger.i('QuickAction: Delete requested for project ${project.id}');
    AppDialogs.showConfirmDialog(
      title: 'Supprimer la commande',
      message: 'Êtes-vous sûr de vouloir supprimer "${project.name}" ?',
      confirmText: 'Supprimer',
      isDangerous: true,
      onConfirm: () async {
        try {
          final repo = GetIt.I<IProjectRepository>();
          await repo.deleteProject(project.id);
          AppFeedback.showSuccess(
            title: 'Succès',
            message: 'Commande supprimée',
          );
        } catch (e) {
          AppLogger.e('QuickAction: Delete failed', e);
          AppFeedback.showError('Impossible de supprimer la commande');
        }
      },
    );
  }

  void _handleRetouch(BuildContext context) {
    AppLogger.i('QuickAction: Retouch requested for project ${project.id}');
    AppDialogs.showConfirmDialog(
      title: 'Marquer comme Retouche ?',
      message:
          'Cette commande nécessite-t-elle des ajustements ?\nCela la marquera avec un badge "Retouche".',
      confirmText: 'Oui, à retoucher',
      onConfirm: () async {
        try {
          final repo = GetIt.I<IProjectRepository>();
          project.isRetouch = !project.isRetouch;
          await repo.updateProject(project);
          AppFeedback.showSuccess(
            title: 'Succès',
            message: project.isRetouch
                ? 'Marqué comme Retouche'
                : 'Retouche retirée',
          );
        } catch (e) {
          AppLogger.e('QuickAction: Retouch update failed', e);
          AppFeedback.showError('Impossible de mettre à jour');
        }
      },
    );
  }

  void _handleStatusChange(BuildContext context) async {
    AppLogger.i(
      'QuickAction: Status change requested for project ${project.id}',
    );
    final newStatus = await AppDialogs.showStatusPicker<ProjectStatus>(
      title: 'Changer le statut',
      currentValue: project.status,
      options: ProjectStatus.values,
      getLabel: (s) => s.label,
    );
    if (newStatus != null && newStatus != project.status) {
      try {
        final repo = GetIt.I<IProjectRepository>();
        await repo.updateProjectStatus(project.id, newStatus);
        AppFeedback.showSuccess(title: 'Succès', message: 'Statut mis à jour');
      } catch (e) {
        AppLogger.e('QuickAction: Status update failed', e);
        AppFeedback.showError('Impossible de mettre à jour le statut');
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    final bool isOverdue = project.isOverdue;
    return PlayfulCard(
      onTap: onTap,
      onLongPress: () => _showQuickActions(context),
      hasBorder: isOverdue,
      borderColor: AppColors.error,
      padding: EdgeInsets.zero,
      margin: const EdgeInsets.all(4),
      child: Column(
        children: [
          Expanded(
            flex: 4,
            child: ProjectCardImageStack(
              project: project,
              isOverdue: isOverdue,
            ),
          ),
          Expanded(
            flex: 5,
            child: ProjectCardContent(project: project, isOverdue: isOverdue),
          ),
        ],
      ),
    );
  }

  void _showQuickActions(BuildContext context) {
    final scheme = Theme.of(context).colorScheme;
    showModalBottomSheet(
      context: context,
      useSafeArea: true,
      builder: (sheetContext) => SafeArea(
        top: false,
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            // Monochrome glyphs: a different hue per row turned this sheet
            // into a colour chart. Only the destructive row carries colour.
            ListTile(
              leading: const Icon(Icons.edit_outlined),
              title: const Text('Modifier'),
              onTap: () {
                Navigator.pop(sheetContext);
                AppNavigator.to(AppRoutes.addEditProject, arguments: project);
              },
            ),
            ListTile(
              leading: const Icon(Icons.sync_rounded),
              title: const Text('Changer le statut'),
              onTap: () {
                Navigator.pop(sheetContext);
                _handleStatusChange(context);
              },
            ),
            ListTile(
              leading: const Icon(Icons.build_circle_outlined),
              title: Text(
                project.isRetouch
                    ? 'Retirer la retouche'
                    : 'Marquer en retouche',
              ),
              onTap: () {
                Navigator.pop(sheetContext);
                _handleRetouch(context);
              },
            ),
            ListTile(
              leading: const Icon(Icons.receipt_long_outlined),
              title: const Text('Facture'),
              onTap: () {
                Navigator.pop(sheetContext);
                final invoiceService = GetIt.I<InvoiceService>();
                invoiceService.handleInvoiceAction(project);
              },
            ),
            ListTile(
              leading: Icon(Icons.delete_outline, color: scheme.error),
              title: Text('Supprimer', style: TextStyle(color: scheme.error)),
              onTap: () {
                Navigator.pop(sheetContext);
                _handleDelete(context);
              },
            ),
            const SizedBox(height: AppSpacing.md),
          ],
        ),
      ),
    );
  }
}

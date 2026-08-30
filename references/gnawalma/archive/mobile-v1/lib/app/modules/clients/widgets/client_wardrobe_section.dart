import 'package:flutter/material.dart';

import '../../../data/models/project_model.dart';
import '../../../shared/theme/app_spacing.dart';
import '../../../shared/widgets/layouts/polished_page.dart';
import '../../../shared/widgets/states/inline_empty_state.dart';
import 'client_lookbook_card.dart';

class ClientWardrobeSection extends StatelessWidget {
  const ClientWardrobeSection({
    super.key,
    required this.isLoading,
    required this.projects,
    required this.onProjectTap,
  });

  final bool isLoading;
  final List<ProjectModel> projects;
  final ValueChanged<ProjectModel> onProjectTap;

  @override
  Widget build(BuildContext context) {
    return Semantics(
      container: true,
      label: 'Garde-robe du client',
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          AppSectionHeader(
            title: 'Garde-robe',
            subtitle: isLoading
                ? 'Chargement des réalisations'
                : projects.isEmpty
                ? 'Les vêtements terminés apparaîtront ici'
                : '${projects.length} ${projects.length > 1 ? 'réalisations' : 'réalisation'}',
            icon: Icons.checkroom_rounded,
          ),
          const SizedBox(height: AppSpacing.sm),
          if (isLoading)
            const AppSectionSurface(
              child: Padding(
                padding: EdgeInsets.symmetric(vertical: AppSpacing.lg),
                child: Center(
                  child: CircularProgressIndicator.adaptive(strokeWidth: 2),
                ),
              ),
            )
          else if (projects.isEmpty)
            const AppSectionSurface(
              child: Padding(
                padding: EdgeInsets.symmetric(vertical: AppSpacing.sm),
                child: InlineEmptyState(
                  icon: Icons.checkroom_outlined,
                  message: 'Aucune réalisation enregistrée',
                  description:
                      'La garde-robe se construit automatiquement avec les projets.',
                ),
              ),
            )
          else
            SizedBox(
              height: 218,
              child: ListView.separated(
                scrollDirection: Axis.horizontal,
                padding: const EdgeInsets.symmetric(horizontal: 1, vertical: 2),
                itemCount: projects.length,
                separatorBuilder: (_, _) =>
                    const SizedBox(width: AppSpacing.sm),
                itemBuilder: (context, index) => ClientLookbookCard(
                  project: projects[index],
                  onTap: () => onProjectTap(projects[index]),
                ),
              ),
            ),
        ],
      ),
    );
  }
}

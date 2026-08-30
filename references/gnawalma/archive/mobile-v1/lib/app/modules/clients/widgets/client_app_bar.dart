import 'package:flutter/material.dart';

import '../../../core/navigation/app_navigator.dart';
import '../../../data/models/client_model.dart';
import '../../../shared/theme/app_colors_extensions.dart';
import '../../../shared/theme/app_spacing.dart';
import '../../../shared/theme/app_text_styles.dart';

class ClientAppBar extends StatelessWidget {
  const ClientAppBar({
    super.key,
    required this.client,
    required this.onEdit,
    this.isPreviewMode = false,
  });

  final ClientModel client;
  final VoidCallback onEdit;
  final bool isPreviewMode;

  @override
  Widget build(BuildContext context) {
    return SliverAppBar(
      expandedHeight: 232,
      pinned: true,
      stretch: true,
      backgroundColor: context.backgroundColor,
      surfaceTintColor: Colors.transparent,
      leading: IconButton(
        tooltip: 'Retour',
        onPressed: AppNavigator.back,
        icon: const Icon(Icons.arrow_back_rounded),
      ),
      actions: isPreviewMode
          ? null
          : [
              IconButton(
                tooltip: 'Modifier le client',
                onPressed: onEdit,
                icon: const Icon(Icons.edit_outlined),
              ),
              const SizedBox(width: AppSpacing.xs),
            ],
      flexibleSpace: FlexibleSpaceBar(
        collapseMode: CollapseMode.pin,
        background: Container(
          color: context.backgroundColor,
          padding: EdgeInsets.fromLTRB(
            AppSpacing.md,
            MediaQuery.paddingOf(context).top + kToolbarHeight,
            AppSpacing.md,
            50,
          ),
          child: Row(
            children: [
              Hero(
                tag: 'client-avatar-${client.id}',
                child: Container(
                  width: 82,
                  height: 82,
                  alignment: Alignment.center,
                  // Neutral circle, matching the list card so the Hero morph
                  // between them stays a circle the whole way.
                  decoration: BoxDecoration(
                    color: context.surfaceLightColor,
                    shape: BoxShape.circle,
                  ),
                  child: Text(
                    client.initials,
                    style: AppTextStyles.h3.copyWith(
                      color: context.textPrimaryColor,
                    ),
                  ),
                ),
              ),
              const SizedBox(width: AppSpacing.md),
              Expanded(
                child: Column(
                  mainAxisAlignment: MainAxisAlignment.center,
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      client.displayName,
                      maxLines: 2,
                      overflow: TextOverflow.ellipsis,
                      style: AppTextStyles.h3.copyWith(
                        color: context.textPrimaryColor,
                      ),
                    ),
                    const SizedBox(height: 6),
                    Row(
                      children: [
                        Icon(
                          client.phone?.trim().isNotEmpty == true
                              ? Icons.phone_outlined
                              : Icons.phone_disabled_outlined,
                          size: 17,
                          color: context.textSecondaryColor,
                        ),
                        const SizedBox(width: 6),
                        Expanded(
                          child: Text(
                            client.phone?.trim().isNotEmpty == true
                                ? client.phone!
                                : 'Téléphone non renseigné',
                            maxLines: 1,
                            overflow: TextOverflow.ellipsis,
                            style: AppTextStyles.bodyMedium.copyWith(
                              color: context.textSecondaryColor,
                            ),
                          ),
                        ),
                      ],
                    ),
                    const SizedBox(height: 8),
                    Text(
                      '${client.totalOrders} commande${client.totalOrders == 1 ? '' : 's'} au total',
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
      ),
    );
  }
}

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:package_info_plus/package_info_plus.dart';

import '../../../../core/network/network_providers.dart';
import '../../../../core/network/session_controller.dart';
import '../../../../data/services/active_space_provider.dart';
import '../../../../data/services/app_space.dart';
import '../../../../routes/app_routes.dart';
import '../../../auth/views/logout_confirmation.dart';
import '../../../../shared/theme/app_colors.dart';
import '../../../../shared/theme/app_colors_extensions.dart';
import '../../../../shared/theme/app_spacing.dart';
import '../../../../shared/theme/app_text_styles.dart';
import '../../../../shared/widgets/layouts/polished_page.dart';
import '../../../auth/controllers/auth_controller.dart';
import '../../../auth/domain/auth_session.dart';
import '../../shared/widgets/client_ui.dart';

class ClientProfileView extends ConsumerWidget {
  const ClientProfileView({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final session = ref.watch(sessionControllerProvider).asData?.value;
    final action = ref.watch(authActionControllerProvider);
    final online = ref.watch(networkAvailabilityProvider).asData?.value ?? true;
    final displayName = session?.displayName?.trim();
    final accountLabel = session?.phone ?? session?.email ?? 'Compte Gnawalma';
    final initial = (displayName?.isNotEmpty ?? false)
        ? displayName!.substring(0, 1).toUpperCase()
        : 'G';

    return SafeArea(
      bottom: false,
      child: CustomScrollView(
        key: const PageStorageKey('client-profile-scroll'),
        physics: const AlwaysScrollableScrollPhysics(),
        slivers: [
          const SliverToBoxAdapter(
            child: ClientPageHeader(title: 'Votre profil'),
          ),
          if (!online) const SliverToBoxAdapter(child: ClientOfflineBanner()),
          SliverPadding(
            padding: const EdgeInsets.fromLTRB(
              AppSpacing.md,
              0,
              AppSpacing.md,
              AppSpacing.xl,
            ),
            sliver: SliverList(
              delegate: SliverChildListDelegate.fixed([
                AppSectionSurface(
                  showAccent: true,
                  accentColor: Theme.of(context).colorScheme.secondary,
                  bordered: true,
                  child: Row(
                    children: [
                      Container(
                        width: 64,
                        height: 64,
                        alignment: Alignment.center,
                        decoration: BoxDecoration(
                          color: Theme.of(context).colorScheme.primaryContainer,
                          borderRadius: BorderRadius.circular(
                            AppSpacing.radiusContainer,
                          ),
                        ),
                        child: Text(
                          initial,
                          style: AppTextStyles.h3.copyWith(
                            color: Theme.of(
                              context,
                            ).colorScheme.onPrimaryContainer,
                            fontWeight: FontWeight.w900,
                          ),
                        ),
                      ),
                      const SizedBox(width: AppSpacing.md),
                      Expanded(
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Text(
                              displayName?.isNotEmpty == true
                                  ? displayName!
                                  : 'Client Gnawalma',
                              maxLines: 1,
                              overflow: TextOverflow.ellipsis,
                              style: AppTextStyles.h4.copyWith(
                                color: context.textPrimaryColor,
                              ),
                            ),
                            const SizedBox(height: 3),
                            Text(
                              accountLabel,
                              maxLines: 1,
                              overflow: TextOverflow.ellipsis,
                              style: AppTextStyles.bodySmall.copyWith(
                                color: context.textSecondaryColor,
                              ),
                            ),
                            const SizedBox(height: 9),
                            _ConnectionBadge(online: online),
                          ],
                        ),
                      ),
                      IconButton.filledTonal(
                        style: IconButton.styleFrom(
                          minimumSize: const Size(48, 48),
                        ),
                        onPressed: () => _showAccountInfo(context, session),
                        tooltip: 'Voir les informations du compte',
                        icon: const Icon(Icons.edit_outlined),
                      ),
                    ],
                  ),
                ),
                const SizedBox(height: AppSpacing.lg),
                // Une seule liste, sans en-tetes de rubrique.
                //
                // Deux sections de trois lignes, chacune coiffee d'un titre et
                // d'un sous-titre, faisaient six intitules pour quatre reglages
                // reels. §3.1 demande peu de texte a l'ecran, et ces lignes se
                // lisent d'elles-memes.
                //
                // « Notifications » et « Aide et assistance » sont retirees :
                // elles n'ouvraient qu'une boite disant qu'elles n'etaient pas
                // connectees. Une ligne qui coute un appui pour n'apprendre
                // rien vaut moins que son absence. Les deux fonctions restent a
                // faire ; elles ne sont simplement plus annoncees comme
                // presentes.
                AppSectionSurface(
                  padding: const EdgeInsets.all(AppSpacing.xs),
                  child: Column(
                    children: [
                      AppActionTile(
                        icon: Icons.person_outline_rounded,
                        title: 'Informations personnelles',
                        onTap: () => _showAccountInfo(context, session),
                      ),
                      const Divider(height: 1, indent: 64),
                      AppActionTile(
                        icon: Icons.lock_outline_rounded,
                        title: 'Sécurité et code PIN',
                        onTap: () => context.push(AppRoutes.pinCode),
                      ),
                      const Divider(height: 1, indent: 64),
                      AppActionTile(
                        icon: Icons.accessibility_new_rounded,
                        title: 'Apparence et accessibilité',
                        onTap: () => context.push(AppRoutes.clientPreferences),
                      ),
                      const Divider(height: 1, indent: 64),
                      AppActionTile(
                        icon: Icons.storefront_outlined,
                        title: 'Passer à l’espace Atelier',
                        // Le seul sous-titre conserve : il dit un fait que le
                        // titre ne porte pas.
                        subtitle: session?.ateliers.isNotEmpty == true
                            ? '${session!.ateliers.length} atelier${session.ateliers.length > 1 ? 's' : ''} associé${session.ateliers.length > 1 ? 's' : ''}'
                            : null,
                        // Seul accent de la liste : c'est la seule ligne qui
                        // change d'espace plutôt que d'ouvrir un réglage.
                        accentColor: Theme.of(context).colorScheme.primary,
                        onTap: () => _confirmSpaceSwitch(context, ref),
                      ),
                    ],
                  ),
                ),
                const SizedBox(height: AppSpacing.lg),
                AppSectionSurface(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.stretch,
                    children: [
                      OutlinedButton.icon(
                        onPressed: action.isLoading
                            ? null
                            : () => _confirmLogout(context, ref),
                        icon: action.isLoading
                            ? const SizedBox.square(
                                dimension: 18,
                                child: CircularProgressIndicator.adaptive(),
                              )
                            : const Icon(Icons.logout_rounded),
                        label: Text(
                          action.isLoading ? 'Déconnexion…' : 'Se déconnecter',
                        ),
                        style: OutlinedButton.styleFrom(
                          foregroundColor: Theme.of(context).colorScheme.error,
                          side: BorderSide(
                            color: Theme.of(context).colorScheme.error,
                          ),
                          minimumSize: const Size.fromHeight(50),
                        ),
                      ),
                    ],
                  ),
                ),
                const SizedBox(height: AppSpacing.md),
                FutureBuilder<PackageInfo>(
                  future: PackageInfo.fromPlatform(),
                  builder: (context, snapshot) => Text(
                    snapshot.hasData
                        ? 'Gnawalma · Version ${snapshot.data!.version}'
                        : 'Gnawalma',
                    textAlign: TextAlign.center,
                    style: AppTextStyles.caption.copyWith(
                      color: context.textSecondaryColor,
                    ),
                  ),
                ),
              ]),
            ),
          ),
        ],
      ),
    );
  }

  Future<void> _confirmSpaceSwitch(BuildContext context, WidgetRef ref) async {
    final session = ref.read(sessionControllerProvider).asData?.value;
    final hasAtelier = session?.ateliers.isNotEmpty == true;
    final confirmed = await showModalBottomSheet<bool>(
      context: context,
      showDragHandle: true,
      useSafeArea: true,
      builder: (sheetContext) => Padding(
        padding: const EdgeInsets.fromLTRB(
          AppSpacing.md,
          0,
          AppSpacing.md,
          AppSpacing.lg,
        ),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            AppSectionHeader(
              title: 'Passer à l’espace Atelier ?',
              subtitle:
                  'La navigation et les outils deviendront ceux de la gestion professionnelle.',
              icon: Icons.storefront_outlined,
              accentColor: Theme.of(context).colorScheme.primary,
            ),
            const SizedBox(height: AppSpacing.md),
            AppStatusBanner(
              title: hasAtelier
                  ? 'Atelier déjà associé'
                  : 'Aucun atelier associé',
              message: hasAtelier
                  ? 'Vous retrouverez directement le tableau de bord professionnel.'
                  : 'Vous serez redirigé vers la connexion professionnelle afin de créer ou relier un atelier.',
              icon: hasAtelier
                  ? Icons.check_circle_outline_rounded
                  : Icons.info_outline_rounded,
              tone: hasAtelier ? AppStatusTone.success : AppStatusTone.info,
            ),
            const SizedBox(height: AppSpacing.md),
            Row(
              children: [
                Expanded(
                  child: OutlinedButton(
                    onPressed: () => Navigator.pop(sheetContext, false),
                    child: const Text('Rester ici'),
                  ),
                ),
                const SizedBox(width: AppSpacing.sm),
                Expanded(
                  flex: 2,
                  child: FilledButton.icon(
                    onPressed: () => Navigator.pop(sheetContext, true),
                    icon: const Icon(Icons.swap_horiz_rounded),
                    label: const Text('Passer à Atelier'),
                  ),
                ),
              ],
            ),
          ],
        ),
      ),
    );
    if (confirmed != true || !context.mounted) return;
    await _switchToAtelier(context, ref);
  }

  Future<void> _switchToAtelier(BuildContext context, WidgetRef ref) async {
    final session = ref.read(sessionControllerProvider).asData?.value;
    await ref.read(activeSpaceProvider.notifier).select(AppSpace.atelier);
    if (!context.mounted) return;

    if (session?.ateliers.isNotEmpty == true) {
      context.go(AppRoutes.shell);
      return;
    }

    await ref.read(authActionControllerProvider.notifier).logout();
    if (context.mounted) context.go(AppRoutes.auth);
  }

  Future<void> _confirmLogout(BuildContext context, WidgetRef ref) =>
      confirmLogout(
        context,
        ref,
        retainedTitle: 'Ce qui reste sur l’appareil',
        retainedMessage:
            'Les favoris locaux sont conservés. Les données distantes nécessiteront une nouvelle connexion.',
      );

  void _showAccountInfo(BuildContext context, AuthSession? session) {
    showModalBottomSheet<void>(
      context: context,
      showDragHandle: true,
      useSafeArea: true,
      builder: (sheetContext) => Padding(
        padding: const EdgeInsets.fromLTRB(
          AppSpacing.md,
          0,
          AppSpacing.md,
          AppSpacing.lg,
        ),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            AppSectionHeader(
              title: 'Informations du compte',
              subtitle: 'Ces données proviennent de la session authentifiée.',
              icon: Icons.person_outline_rounded,
              accentColor: Theme.of(context).colorScheme.secondary,
            ),
            const SizedBox(height: AppSpacing.md),
            AppSectionSurface(
              child: Column(
                children: [
                  _InfoRow(
                    icon: Icons.badge_outlined,
                    label: 'Nom',
                    value: session?.displayName ?? 'Non renseigné',
                  ),
                  const SizedBox(height: AppSpacing.sm),
                  const Divider(height: 1),
                  const SizedBox(height: AppSpacing.sm),
                  _InfoRow(
                    icon: Icons.phone_outlined,
                    label: 'Téléphone',
                    value: session?.phone ?? 'Non renseigné',
                  ),
                  const SizedBox(height: AppSpacing.sm),
                  const Divider(height: 1),
                  const SizedBox(height: AppSpacing.sm),
                  _InfoRow(
                    icon: Icons.email_outlined,
                    label: 'Email',
                    value: session?.email ?? 'Non renseigné',
                  ),
                ],
              ),
            ),
            const SizedBox(height: AppSpacing.md),
            FilledButton(
              onPressed: () => Navigator.pop(sheetContext),
              child: const Text('Fermer'),
            ),
          ],
        ),
      ),
    );
  }
}

class _ConnectionBadge extends StatelessWidget {
  const _ConnectionBadge({required this.online});

  final bool online;

  @override
  Widget build(BuildContext context) {
    final color = online ? AppColors.success : AppColors.warning;
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 9, vertical: 5),
      decoration: BoxDecoration(
        color: color.withValues(alpha: 0.1),
        borderRadius: BorderRadius.circular(AppSpacing.radiusSheetTop),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          Icon(
            online ? Icons.cloud_done_outlined : Icons.cloud_off_outlined,
            size: 15,
            color: color,
          ),
          const SizedBox(width: 5),
          Text(
            online ? 'Connecté' : 'Mode hors ligne',
            style: AppTextStyles.caption.copyWith(
              color: color,
              fontWeight: FontWeight.w700,
            ),
          ),
        ],
      ),
    );
  }
}

class _InfoRow extends StatelessWidget {
  const _InfoRow({
    required this.icon,
    required this.label,
    required this.value,
  });

  final IconData icon;
  final String label;
  final String value;

  @override
  Widget build(BuildContext context) {
    // Label above value rather than a fixed-width column: at large text scales
    // a 82pt label column truncates the field name.
    return Row(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Icon(icon, size: 20, color: Theme.of(context).colorScheme.secondary),
        const SizedBox(width: AppSpacing.sm),
        Expanded(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(
                label,
                style: AppTextStyles.bodySmall.copyWith(
                  color: context.textSecondaryColor,
                ),
              ),
              const SizedBox(height: AppSpacing.xxs),
              Text(
                value,
                style: AppTextStyles.bodyMedium.copyWith(
                  color: context.textPrimaryColor,
                  fontWeight: FontWeight.w700,
                ),
              ),
            ],
          ),
        ),
      ],
    );
  }
}

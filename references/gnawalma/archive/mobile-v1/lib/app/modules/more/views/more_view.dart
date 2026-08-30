import 'package:flutter/material.dart';
import 'package:flutter_animate/flutter_animate.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/navigation/app_navigator.dart';
import '../../../data/services/active_space_provider.dart';
import '../../../data/services/app_space.dart';
import '../../../data/services/security_service.dart';
import '../../../routes/app_routes.dart';
import '../../../shared/theme/app_colors.dart';
import '../../../shared/theme/app_colors_extensions.dart';
import '../../../shared/theme/app_motion.dart';
import '../../../shared/theme/app_spacing.dart';
import '../../../shared/theme/app_text_styles.dart';
import '../../../shared/utils/app_assets.dart';
import '../../../shared/utils/app_dialogs.dart';
import '../../../shared/widgets/layouts/polished_page.dart';
import '../../auth/views/logout_confirmation.dart';
import '../../preferences/controllers/preferences_provider.dart';
import '../controllers/more_provider.dart';

class MoreView extends ConsumerWidget {
  const MoreView({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final state = ref.watch(moreProvider);
    final businessName = state.businessName?.trim().isNotEmpty == true
        ? state.businessName!
        : 'Votre atelier';

    return Scaffold(
      backgroundColor: context.backgroundColor,
      body: SafeArea(
        bottom: false,
        child: RefreshIndicator(
          onRefresh: ref.read(moreProvider.notifier).refresh,
          child: ListView(
            physics: const AlwaysScrollableScrollPhysics(),
            padding: EdgeInsets.fromLTRB(
              AppSpacing.gutter,
              AppSpacing.sm,
              AppSpacing.gutter,
              MediaQuery.paddingOf(context).bottom + AppSpacing.md,
            ),
            children: [
              _entrance(
                context,
                0,
                _AccountHeader(
                  businessName: businessName,
                  hasPin: state.hasPin,
                  isLoading: state.isLoading,
                  onEdit: () => AppNavigator.toBusinessProfile(context),
                ),
              ),
              const SizedBox(height: AppSpacing.sectionSpacing),
              // Two working sections instead of three near-identical lists. The
              // profile row is gone from here on purpose — the header CTA is
              // the one place that action should live.
              _entrance(
                context,
                1,
                _SettingsGroup(
                  title: 'L’atelier',
                  children: [
                    AppActionTile(
                      icon: Icons.receipt_long_outlined,
                      title: 'Toutes les commandes',
                      onTap: () => AppNavigator.toOrders(context),
                    ),
                    AppActionTile(
                      icon: Icons.tune_rounded,
                      title: 'Préférences',
                      subtitle: 'Langue, devise, alertes et apparence',
                      onTap: () => AppNavigator.to(AppRoutes.preferences),
                    ),
                  ],
                ),
              ),
              const SizedBox(height: AppSpacing.sectionSpacing),
              _entrance(
                context,
                2,
                _SettingsGroup(
                  title: 'Données et sécurité',
                  subtitle: state.hasPin
                      ? 'Cet appareil est protégé par un code PIN'
                      : 'Aucun code PIN sur cet appareil',
                  // A single row carries the destructive treatment, set apart
                  // by a rule and a caption rather than by colouring the list.
                  dangerCaption: 'Actions sensibles',
                  dangerChildren: [
                    AppActionTile(
                      icon: Icons.restore_rounded,
                      title: 'Restaurer une sauvegarde',
                      subtitle:
                          'Remplace définitivement les données locales actuelles',
                      danger: true,
                      onTap: () => _confirmRestore(context, ref),
                    ),
                    // L'espace Atelier n'avait aucune sortie de session : la
                    // seule déconnexion accessible était derrière « code PIN
                    // oublié », que la plupart des propriétaires ne voient
                    // jamais.
                    AppActionTile(
                      icon: Icons.logout_rounded,
                      title: 'Se déconnecter',
                      subtitle: 'Quitter le compte sur cet appareil',
                      danger: true,
                      onTap: () => confirmLogout(
                        context,
                        ref,
                        retainedTitle: 'Ce qui reste sur l’appareil',
                        retainedMessage:
                            'Vos clients, commandes et mesures restent enregistrés localement. La synchronisation reprendra à la prochaine connexion.',
                      ),
                    ),
                  ],
                  children: [
                    AppActionTile(
                      icon: state.hasPin
                          ? Icons.lock_outline_rounded
                          : Icons.password_rounded,
                      title: state.hasPin
                          ? 'Verrouiller maintenant'
                          : 'Configurer un code PIN',
                      subtitle: state.hasPin
                          ? 'Masquer l’espace Atelier sur cet appareil'
                          : 'Protéger l’accès local à votre atelier',
                      onTap: state.hasPin
                          ? () => _confirmLock(context, ref)
                          : () => AppNavigator.to(
                              AppRoutes.pinCode,
                              arguments: {'mode': 'create'},
                            ),
                    ),
                    AppActionTile(
                      icon: Icons.cloud_upload_outlined,
                      title: 'Créer une sauvegarde',
                      subtitle: 'Exporter une copie locale de vos données',
                      onTap: () =>
                          ref.read(preferencesProvider.notifier).backupData(),
                    ),
                  ],
                ),
              ),
              const SizedBox(height: AppSpacing.sectionSpacing),
              _entrance(
                context,
                3,
                _AppFooter(
                  version: state.appVersion ?? '1.0.0',
                  onSwitchSpace: () => _switchToClient(context, ref),
                  onAbout: () =>
                      _showAboutSheet(context, state.appVersion ?? '1.0.0'),
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }

  /// Decorative arrival only — the list is fully usable before it finishes and
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

  Future<void> _switchToClient(BuildContext context, WidgetRef ref) async {
    // Through the controller, not StorageService: the accent is derived from
    // this value, so a direct write would persist the new space while the app
    // kept painting the old one until the next cold start.
    await ref.read(activeSpaceProvider.notifier).select(AppSpace.client);
    if (context.mounted) AppNavigator.offAll(AppRoutes.clientShell);
  }

  Future<void> _confirmRestore(BuildContext context, WidgetRef ref) async {
    final confirmed = await AppDialogs.showConfirmation(
      title: 'Restaurer une sauvegarde ?',
      message:
          'Les données locales actuelles peuvent être remplacées. Créez une sauvegarde avant de continuer si nécessaire.',
      confirmLabel: 'Choisir une sauvegarde',
      isDangerous: true,
    );
    if (confirmed == true) {
      await ref.read(preferencesProvider.notifier).restoreData();
    }
  }

  Future<void> _confirmLock(BuildContext context, WidgetRef ref) async {
    final confirmed = await AppDialogs.showConfirmation(
      title: 'Verrouiller l’application ?',
      message: 'Le code PIN sera demandé pour revenir à l’espace Atelier.',
      confirmLabel: 'Verrouiller',
    );
    if (confirmed == true) {
      ref.read(securityProvider.notifier).lockApp();
    }
  }

  Future<void> _showAboutSheet(BuildContext context, String version) async {
    await showModalBottomSheet<void>(
      context: context,
      useSafeArea: true,
      showDragHandle: true,
      builder: (sheetContext) => Padding(
        padding: const EdgeInsets.fromLTRB(
          AppSpacing.lg,
          0,
          AppSpacing.lg,
          AppSpacing.lg,
        ),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            Center(
              child: Container(
                width: 72,
                height: 72,
                padding: const EdgeInsets.all(13),
                decoration: BoxDecoration(
                  color: context.surfaceLightColor,
                  borderRadius: BorderRadius.circular(
                    AppSpacing.radiusContainer,
                  ),
                ),
                child: Image.asset(AppAssets.logo, fit: BoxFit.contain),
              ),
            ),
            const SizedBox(height: AppSpacing.md),
            Text(
              'Gnawalma',
              textAlign: TextAlign.center,
              style: AppTextStyles.h3.copyWith(color: context.textPrimaryColor),
            ),
            const SizedBox(height: 4),
            Text(
              'Gestion d’atelier et découverte de couturiers',
              textAlign: TextAlign.center,
              style: AppTextStyles.bodyMedium.copyWith(
                color: context.textSecondaryColor,
              ),
            ),
            const SizedBox(height: AppSpacing.sectionSpacing),
            AppSectionSurface(
              padding: const EdgeInsets.all(AppSpacing.cardPadding),
              bordered: true,
              child: Column(
                children: [
                  _InfoRow(label: 'Version', value: version),
                  const Divider(height: 24),
                  const _InfoRow(label: 'Plateformes', value: 'Android · iOS'),
                  const Divider(height: 24),
                  const _InfoRow(label: 'Données', value: 'Local + API'),
                ],
              ),
            ),
            const SizedBox(height: AppSpacing.sectionSpacing),
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

/// The one block on the page that is allowed visual weight: who you are, which
/// space you are in, and the single action that belongs at the top.
class _AccountHeader extends StatelessWidget {
  const _AccountHeader({
    required this.businessName,
    required this.hasPin,
    required this.isLoading,
    required this.onEdit,
  });

  final String businessName;
  final bool hasPin;
  final bool isLoading;
  final VoidCallback onEdit;

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Padding(
          padding: const EdgeInsets.only(top: AppSpacing.xs, bottom: 20),
          child: Text(
            'Réglages',
            style: AppTextStyles.h1.copyWith(color: context.textPrimaryColor),
          ),
        ),
        Row(
          crossAxisAlignment: CrossAxisAlignment.center,
          children: [
            Container(
              width: 64,
              height: 64,
              clipBehavior: Clip.antiAlias,
              decoration: BoxDecoration(
                color: context.surfaceLightColor,
                shape: BoxShape.circle,
              ),
              alignment: Alignment.center,
              child: isLoading
                  ? const SizedBox(
                      width: 20,
                      height: 20,
                      child: CircularProgressIndicator.adaptive(),
                    )
                  : Padding(
                      padding: const EdgeInsets.all(12),
                      child: Image.asset(
                        AppAssets.logo,
                        fit: BoxFit.contain,
                        errorBuilder: (_, _, _) => Icon(
                          Icons.storefront_rounded,
                          color: context.textPrimaryColor,
                        ),
                      ),
                    ),
            ),
            const SizedBox(width: AppSpacing.md),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                mainAxisSize: MainAxisSize.min,
                children: [
                  Text(
                    'ESPACE ATELIER',
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                    style: AppTextStyles.overline.copyWith(
                      color: context.textSecondaryColor,
                    ),
                  ),
                  const SizedBox(height: 6),
                  // Identity at title weight: on a settings page the atelier
                  // name is the subject, not a caption above a list.
                  Text(
                    businessName,
                    maxLines: 2,
                    overflow: TextOverflow.ellipsis,
                    style: AppTextStyles.h3.copyWith(
                      color: context.textPrimaryColor,
                    ),
                  ),
                ],
              ),
            ),
          ],
        ),
        const SizedBox(height: AppSpacing.md),
        Wrap(
          spacing: AppSpacing.xs,
          runSpacing: AppSpacing.xs,
          children: [
            const AppMetricPill(
              label: 'Espace actif',
              value: 'Espace Atelier',
              icon: Icons.storefront_rounded,
            ),
            AppMetricPill(
              label: 'Accès local',
              value: hasPin ? 'Code PIN actif' : 'Sans code PIN',
              icon: hasPin
                  ? Icons.lock_outline_rounded
                  : Icons.lock_open_rounded,
            ),
          ],
        ),
        const SizedBox(height: 18),
        SizedBox(
          width: double.infinity,
          child: FilledButton.icon(
            onPressed: onEdit,
            icon: const Icon(Icons.storefront_outlined, size: 19),
            label: const Text('Modifier le profil de l’atelier'),
          ),
        ),
      ],
    );
  }
}

/// One settings group: a real header, a rule that brackets it, then full-bleed
/// rows separated by hairlines aligned to [AppActionTile]'s glyph.
class _SettingsGroup extends StatelessWidget {
  const _SettingsGroup({
    required this.title,
    required this.children,
    this.subtitle,
    this.dangerCaption,
    this.dangerChildren = const <Widget>[],
  });

  final String title;
  final String? subtitle;
  final List<Widget> children;
  final String? dangerCaption;
  final List<Widget> dangerChildren;

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        AppSectionHeader(
          title: title,
          subtitle: subtitle,
          padding: const EdgeInsets.symmetric(
            horizontal: AppSpacing.listRowInset,
          ),
        ),
        const SizedBox(height: AppSpacing.sm),
        Divider(height: 1, color: context.dividerColor),
        const SizedBox(height: 2),
        ..._rows(context, children),
        if (dangerChildren.isNotEmpty) ...[
          const SizedBox(height: AppSpacing.sm),
          Divider(height: 1, color: context.dividerColor),
          const SizedBox(height: AppSpacing.sm),
          if (dangerCaption != null)
            Padding(
              padding: const EdgeInsets.only(
                left: AppSpacing.listRowInset,
                bottom: 2,
              ),
              child: Text(
                dangerCaption!.toUpperCase(),
                maxLines: 1,
                overflow: TextOverflow.ellipsis,
                style: AppTextStyles.overline.copyWith(
                  color: context.statusForeground(AppColors.error),
                ),
              ),
            ),
          ..._rows(context, dangerChildren),
        ],
      ],
    );
  }

  List<Widget> _rows(BuildContext context, List<Widget> rows) => [
    for (var index = 0; index < rows.length; index++) ...[
      rows[index],
      if (index < rows.length - 1)
        Divider(
          height: 1,
          indent: AppSpacing.listDividerIndent,
          color: context.dividerColor,
        ),
    ],
  ];
}

/// Everything that is about the app rather than about the atelier. Kept out of
/// the settings lists so the page reads as two groups plus a colophon.
class _AppFooter extends StatelessWidget {
  const _AppFooter({
    required this.version,
    required this.onSwitchSpace,
    required this.onAbout,
  });

  final String version;
  final VoidCallback onSwitchSpace;
  final VoidCallback onAbout;

  @override
  Widget build(BuildContext context) {
    // The single accent on this page: leaving the Atelier space is the one
    // thing here that changes what the whole app is.
    final accent = Theme.of(context).colorScheme.secondary;
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        Divider(height: 1, color: context.dividerColor),
        const SizedBox(height: AppSpacing.lg),
        OutlinedButton.icon(
          onPressed: onSwitchSpace,
          style: OutlinedButton.styleFrom(
            foregroundColor: accent,
            side: BorderSide(color: accent.withValues(alpha: .45), width: 1.3),
          ),
          icon: const Icon(Icons.person_search_outlined, size: 19),
          label: const Text('Passer à l’espace Client'),
        ),
        const SizedBox(height: AppSpacing.xs),
        Text(
          'Découvrir et contacter des ateliers, sans quitter votre compte.',
          textAlign: TextAlign.center,
          maxLines: 2,
          overflow: TextOverflow.ellipsis,
          style: AppTextStyles.bodySmall.copyWith(
            color: context.textSecondaryColor,
          ),
        ),
        const SizedBox(height: AppSpacing.lg),
        Center(
          child: TextButton.icon(
            onPressed: onAbout,
            icon: const Icon(Icons.info_outline_rounded, size: 18),
            label: const Text('À propos de Gnawalma'),
          ),
        ),
        const SizedBox(height: AppSpacing.xs),
        Text(
          'Version $version',
          textAlign: TextAlign.center,
          style: AppTextStyles.caption.copyWith(
            color: context.textSecondaryColor.withValues(alpha: .72),
          ),
        ),
      ],
    );
  }
}

class _InfoRow extends StatelessWidget {
  const _InfoRow({required this.label, required this.value});

  final String label;
  final String value;

  @override
  Widget build(BuildContext context) {
    return Row(
      children: [
        Expanded(
          child: Text(
            label,
            style: AppTextStyles.bodySmall.copyWith(
              color: context.textSecondaryColor,
            ),
          ),
        ),
        Text(
          value,
          maxLines: 1,
          overflow: TextOverflow.ellipsis,
          style: AppTextStyles.bodySmall.copyWith(
            color: context.textPrimaryColor,
            fontWeight: FontWeight.w700,
          ),
        ),
      ],
    );
  }
}

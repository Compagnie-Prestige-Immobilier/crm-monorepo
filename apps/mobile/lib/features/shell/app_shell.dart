import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:phosphor_flutter/phosphor_flutter.dart';

import '../../core/providers/app_providers.dart';
import '../../core/theme/cpi_colors.dart';
import '../../core/theme/cpi_tokens.dart';

/// Coque de navigation : quatre destinations, un état par branche.
///
/// `StatefulShellRoute.indexedStack` et non quatre routes indépendantes : la
/// position de défilement et le texte de recherche de l'Historique doivent
/// survivre à un aller-retour vers Réglages. Avec des routes indépendantes,
/// chaque retour reconstruit l'écran depuis le haut, ce qui, sur une liste de
/// 400 lignes, ramène l'utilisateur au début à chaque fois.
class AppShell extends ConsumerWidget {
  const AppShell({super.key, required this.shell});

  final StatefulNavigationShell shell;

  /// Dernier onglet visité, lu par la mémoire de route.
  ///
  /// Statique et non passé par provider : la mémorisation se fait depuis un
  /// écouteur du `routerDelegate`, hors de tout `BuildContext`, où aucun
  /// conteneur Riverpod n'est accessible.
  static int lastBranchIndex = 0;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    lastBranchIndex = shell.currentIndex;
    final CpiColors cpi = context.cpi;
    final int needsAttention = ref.watch(needsAttentionCountProvider).value ?? 0;

    return Scaffold(
      body: shell,
      bottomNavigationBar: NavigationBar(
        selectedIndex: shell.currentIndex,
        onDestinationSelected: (int index) => shell.goBranch(
          index,
          // Retaper l'onglet courant ramène à sa racine — le geste attendu
          // partout ailleurs sur Android.
          initialLocation: index == shell.currentIndex,
        ),
        destinations: <Widget>[
          const NavigationDestination(
            icon: Icon(PhosphorIconsRegular.house),
            selectedIcon: Icon(PhosphorIconsFill.house),
            label: 'Accueil',
          ),
          const NavigationDestination(
            icon: Icon(PhosphorIconsRegular.clockCounterClockwise),
            selectedIcon: Icon(PhosphorIconsFill.clockCounterClockwise),
            label: 'Historique',
          ),
          NavigationDestination(
            icon: Badge(
              isLabelVisible: needsAttention > 0,
              backgroundColor: cpi.syncFailed,
              label: Text('$needsAttention'),
              child: const Icon(PhosphorIconsRegular.warningCircle),
            ),
            selectedIcon: Badge(
              isLabelVisible: needsAttention > 0,
              backgroundColor: cpi.syncFailed,
              label: Text('$needsAttention'),
              child: const Icon(PhosphorIconsFill.warningCircle),
            ),
            label: 'À corriger',
          ),
          const NavigationDestination(
            icon: Icon(PhosphorIconsRegular.gear),
            selectedIcon: Icon(PhosphorIconsFill.gear),
            label: 'Réglages',
          ),
        ],
      ),
    );
  }
}

/// Bandeau d'attente affiché en tête des écrans de liste.
///
/// **On ne promet jamais de délai.** WorkManager ne garantit pas les 15 minutes
/// sur AOSP, et les garantit encore moins sur Transsion ou Xiaomi. « Sera envoyé
/// dès que possible » est vrai ; « synchronisé sous 15 minutes » ne l'est pas, et
/// une promesse non tenue au sujet de données saisies détruit la confiance dans
/// l'app entière.
class PendingBanner extends ConsumerWidget {
  const PendingBanner({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final int pending = ref.watch(pendingSyncCountProvider).value ?? 0;
    if (pending == 0) return const SizedBox.shrink();
    final ThemeData theme = Theme.of(context);
    final CpiColors cpi = context.cpi;

    return Container(
      width: double.infinity,
      margin: const EdgeInsets.fromLTRB(CpiSpacing.md, CpiSpacing.xs, CpiSpacing.md, 0),
      padding: const EdgeInsets.symmetric(
        horizontal: CpiSpacing.sm,
        vertical: CpiSpacing.xs,
      ),
      decoration: BoxDecoration(
        color: cpi.accentSurface,
        borderRadius: CpiRadius.brMd,
        border: Border.all(color: cpi.accentBorder.withValues(alpha: 0.4)),
      ),
      child: Row(
        children: <Widget>[
          Icon(PhosphorIconsRegular.cloudArrowUp, size: 18, color: cpi.accentText),
          const SizedBox(width: CpiSpacing.xs),
          Expanded(
            child: Text(
              '$pending élément${pending > 1 ? 's' : ''} en attente d\'envoi',
              style: theme.textTheme.bodySmall?.copyWith(color: cpi.accentText),
            ),
          ),
        ],
      ),
    );
  }
}

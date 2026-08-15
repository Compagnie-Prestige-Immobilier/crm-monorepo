import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:phosphor_flutter/phosphor_flutter.dart';

import '../../core/providers/app_providers.dart';
import '../../core/providers/connectivity.dart';
import '../../core/providers/sync_coordinator.dart';
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

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final CpiColors cpi = context.cpi;
    final int needsAttention = ref.watch(needsAttentionCountProvider).value ?? 0;

    return Scaffold(
      body: shell,
      // La bannière est montée DANS LA COQUE, et au-dessus de la barre de
      // navigation. Elle ne vivait que dans Historique : un commercial qui
      // saisissait depuis l'accueil, puis passait à Réglages, n'avait aucun
      // retour sur ce qui restait à envoyer. Ici, elle est vue depuis les
      // quatre branches.
      //
      // En bas et non en haut : posée au-dessus des `AppBar` de chaque écran,
      // elle décalerait le bandeau de l'écran vers le bas ; posée ici, elle est
      // en zone de pouce, au contact de la barre que l'utilisateur regarde
      // déjà.
      bottomNavigationBar: Column(
        mainAxisSize: MainAxisSize.min,
        children: <Widget>[
          const PendingBanner(),
          NavigationBar(
            selectedIndex: shell.currentIndex,
            onDestinationSelected: (int index) => shell.goBranch(
              index,
              // Retaper l'onglet courant ramène à sa racine : le geste attendu
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
        ],
      ),
    );
  }
}

/// Bandeau d'attente de la coque.
///
/// ═══ CE QU'IL RÉPARE ═══
///
/// L'envoi automatique au retour du réseau EXISTAIT déjà : le coordinateur
/// écoute la connectivité et relance un cycle 2 s après un changement
/// (`sync_coordinator.dart`). Ce qui manquait, c'est le retour visuel : le
/// commercial rebranchait son réseau et n'avait aucun moyen de savoir que
/// quelque chose se passait, sinon tirer pour rafraîchir. Il en concluait que
/// l'application ne l'avait pas fait.
///
/// Le compteur vient de [pendingSyncCountProvider], un flux drift : il retombe
/// **de lui-même**, sans geste ni rechargement, dès que l'outbox se vide.
///
/// Quatre états, trois messages :
///
///  · file vide, rien ne vient de partir → invisible ;
///  · file pleine, aucune interface réseau → « Hors ligne » ;
///  · file pleine, cycle en cours         → « Envoi en cours » ;
///  · file pleine, à l'arrêt              → « N en attente d'envoi » ;
///  · file passée à zéro                  → « Tout est envoyé », qui s'efface.
///
/// **On ne promet jamais de délai.** WorkManager ne garantit pas les 15 minutes
/// sur AOSP, et les garantit encore moins sur Transsion ou Xiaomi. « Sera envoyé
/// dès que possible » est vrai ; « synchronisé sous 15 minutes » ne l'est pas, et
/// une promesse non tenue au sujet de données saisies détruit la confiance dans
/// l'app entière.
class PendingBanner extends ConsumerStatefulWidget {
  const PendingBanner({super.key});

  /// Durée d'affichage de « Tout est envoyé ».
  ///
  /// Assez pour être lu debout, au soleil ; assez court pour ne pas devenir un
  /// meuble. Un bandeau de succès permanent ne dit plus rien au bout d'un jour.
  static const Duration successLinger = Duration(seconds: 4);

  @override
  ConsumerState<PendingBanner> createState() => _PendingBannerState();
}

class _PendingBannerState extends ConsumerState<PendingBanner> {
  Timer? _successTimer;
  bool _showSuccess = false;

  @override
  void dispose() {
    _successTimer?.cancel();
    super.dispose();
  }

  /// Le passage de « il reste des choses » à « plus rien » est le seul événement
  /// que ce bandeau a à raconter. Il se détecte sur la TRANSITION et non sur la
  /// valeur : à zéro permanent, il n'y a rien à annoncer.
  void _onPendingChanged(int before, int after) {
    if (before <= 0 || after != 0) return;
    _successTimer?.cancel();
    setState(() => _showSuccess = true);
    _successTimer = Timer(PendingBanner.successLinger, () {
      if (mounted) setState(() => _showSuccess = false);
    });
  }

  @override
  Widget build(BuildContext context) {
    ref.listen<AsyncValue<int>>(pendingSyncCountProvider, (
      AsyncValue<int>? previous,
      AsyncValue<int> next,
    ) {
      _onPendingChanged(previous?.value ?? 0, next.value ?? 0);
    });

    final int pending = ref.watch(pendingSyncCountProvider).value ?? 0;
    final SyncUiState sync = ref.watch(syncCoordinatorProvider);
    final bool running = sync.running;
    final CpiConnectivity network = ref.watch(connectivityProvider);
    final bool offline = network != CpiConnectivity.online;

    final CpiColors cpi = context.cpi;

    final ({IconData icon, String label, Color color, Color surface, Color border})? tone;
    if (pending > 0) {
      final String count = '$pending élément${pending > 1 ? 's' : ''}';
      tone = switch ((offline, running)) {
        (true, _) => (
          icon: network == CpiConnectivity.unreachable
              ? PhosphorIconsRegular.plugsConnected
              : PhosphorIconsRegular.cloudSlash,
          // « Serveur injoignable » et « hors ligne » ne se réparent pas de la
          // même façon : l'un demande d'ouvrir le portail Wi-Fi ou de recharger
          // le forfait, l'autre de retrouver du réseau.
          label: network == CpiConnectivity.unreachable
              ? 'Serveur injoignable : $count attend. '
                    'Vérifiez le portail Wi-Fi ou votre crédit data'
              : 'Hors ligne : $count sera envoyé au retour du réseau',
          color: cpi.accentText,
          surface: cpi.accentSurface,
          border: cpi.accentBorder,
        ),
        (false, true) => (
          icon: PhosphorIconsRegular.arrowsClockwise,
          label: 'Envoi en cours : $count',
          color: cpi.info,
          surface: cpi.infoSurface,
          border: cpi.info,
        ),
        // ═══ POURQUOI LA FILE NE DESCEND PAS ═══
        //
        // Le coordinateur classait déjà l'échec (lien mort, 500, 429, refus) et
        // le rangeait dans `lastError`, que RIEN ne lisait. À l'écran, les
        // quatre cas produisaient la même phrase : « N en attente d'envoi ».
        // Le commercial ne pouvait pas distinguer « ça va repartir tout seul »
        // de « il faut ouvrir le portail Wi-Fi » de « allez dans À corriger ».
        (false, false) when sync.failureLabel != null => (
          icon: PhosphorIconsRegular.warningCircle,
          label: '$count en attente : ${sync.failureLabel}',
          color: cpi.syncFailed,
          surface: cpi.accentSurface,
          border: cpi.syncFailed,
        ),
        (false, false) => (
          icon: PhosphorIconsRegular.cloudArrowUp,
          label: '$count en attente d\'envoi',
          color: cpi.accentText,
          surface: cpi.accentSurface,
          border: cpi.accentBorder,
        ),
      };
    } else if (_showSuccess) {
      tone = (
        icon: PhosphorIconsRegular.checkCircle,
        label: 'Tout est envoyé',
        color: cpi.success,
        surface: cpi.successSurface,
        border: cpi.success,
      );
    } else {
      tone = null;
    }

    final CpiMotion motion = CpiMotion.of(context);
    // `AnimatedSize` par-dessus `AnimatedSwitcher` : sans lui, l'apparition
    // décale la barre de navigation d'un coup sec sous le pouce, au moment
    // exact où l'utilisateur vise un onglet.
    return AnimatedSize(
      duration: motion.component,
      curve: motion.easeOut,
      alignment: Alignment.bottomCenter,
      child: AnimatedSwitcher(
        duration: motion.micro,
        child: tone == null
            ? const SizedBox(width: double.infinity)
            : _BannerBody(
                key: ValueKey<String>(tone.label),
                icon: tone.icon,
                label: tone.label,
                color: tone.color,
                surface: tone.surface,
                border: tone.border,
              ),
      ),
    );
  }
}

class _BannerBody extends StatelessWidget {
  const _BannerBody({
    super.key,
    required this.icon,
    required this.label,
    required this.color,
    required this.surface,
    required this.border,
  });

  final IconData icon;
  final String label;
  final Color color;
  final Color surface;
  final Color border;

  @override
  Widget build(BuildContext context) {
    final ThemeData theme = Theme.of(context);
    return Container(
      width: double.infinity,
      margin: const EdgeInsets.fromLTRB(
        CpiSpacing.md,
        CpiSpacing.xxs,
        CpiSpacing.md,
        CpiSpacing.xxs,
      ),
      padding: const EdgeInsets.symmetric(
        horizontal: CpiSpacing.sm,
        vertical: CpiSpacing.xs,
      ),
      decoration: BoxDecoration(
        color: surface,
        borderRadius: CpiRadius.brMd,
        border: Border.all(color: border.withValues(alpha: 0.4)),
      ),
      child: Row(
        children: <Widget>[
          Icon(icon, size: 18, color: color),
          const SizedBox(width: CpiSpacing.xs),
          Expanded(
            child: Text(
              label,
              style: theme.textTheme.bodySmall?.copyWith(color: color),
            ),
          ),
        ],
      ),
    );
  }
}

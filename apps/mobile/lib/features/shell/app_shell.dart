import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:forui/forui.dart';
import 'package:go_router/go_router.dart';
import 'package:phosphor_flutter/phosphor_flutter.dart';

import '../../core/providers/app_providers.dart';
import '../../core/providers/connectivity.dart';
import '../../core/providers/sync_coordinator.dart';
import '../../core/router/route_guard.dart';
import '../../ui/widgets/cpi_forui.dart';
import '../../ui/widgets/cpi_kit.dart';
import 'projects.dart';

/// La coque à onglets d'un projet : sa palette, et ses quatre destinations.
///
/// Les deux dernières sont les mêmes partout : « À corriger » et « Réglages »
/// sont globaux, et c'est là que vit la déconnexion. Sans elles dans chaque
/// coque, un compte d'accueil devait passer par un autre projet pour se
/// déconnecter.
class AppShell extends ConsumerWidget {
  const AppShell({super.key, required this.shell, required this.project});

  final StatefulNavigationShell shell;

  final CpiProject project;

  /// Les deux premiers onglets nomment le travail du projet ; les deux derniers
  /// sont posés par [build].
  List<CpiNavItem> get _propres => switch (project) {
    CpiProject.accueil => const <CpiNavItem>[
      CpiNavItem(
        label: 'Registre',
        icon: PhosphorIconsRegular.notebook,
        activeIcon: PhosphorIconsFill.notebook,
      ),
      CpiNavItem(
        label: 'Chiffres',
        icon: PhosphorIconsRegular.chartBar,
        activeIcon: PhosphorIconsFill.chartBar,
      ),
    ],
    CpiProject.chues || CpiProject.grandPublic => const <CpiNavItem>[
      CpiNavItem(
        label: 'Accueil',
        icon: PhosphorIconsRegular.house,
        activeIcon: PhosphorIconsFill.house,
      ),
      CpiNavItem(
        label: 'Fiches',
        icon: PhosphorIconsRegular.clockCounterClockwise,
        activeIcon: PhosphorIconsFill.clockCounterClockwise,
      ),
    ],
  };

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final int needsAttention =
        ref.watch(needsAttentionCountProvider).value ?? 0;

    return ProjectScope(
      project: project,
      child: CpiForui(
        builder: (BuildContext context) => FToaster(
          child: Builder(
            builder: (BuildContext context) =>
                _coque(context, ref, needsAttention),
          ),
        ),
      ),
    );
  }

  /// Le `FToaster` est celui de la coque : le refus d'entrer dans un projet
  /// s'annonce sur la coque d'arrivée, avant même que l'écran qu'elle contient
  /// ait posé le sien.
  Widget _coque(BuildContext context, WidgetRef ref, int needsAttention) {
    final String? refus = ref.watch(accesRefuseProvider);
    if (refus != null) {
      WidgetsBinding.instance.addPostFrameCallback((_) {
        if (!context.mounted) return;
        ref.read(accesRefuseProvider.notifier).consommer();
        cpiToast(context, refus);
      });
    }

    return FScaffold(
      childPad: false,
      // La pastille flotte : le filet que `FScaffold` pose au-dessus de son
      // pied la barrerait en deux.
      scaffoldStyle: const FScaffoldStyleDelta.delta(
        footerDecoration: DecorationDelta.value(BoxDecoration()),
      ),
      // Le pied ne porte que la navigation : l'état de la file est une bande
      // en haut du corps (`PendingBanner` dans `CpiScaffold.banner`).
      footer: CpiBottomNav(
        index: shell.currentIndex,
        onSelected: (int index) =>
            shell.goBranch(index, initialLocation: index == shell.currentIndex),
        items: <CpiNavItem>[
          ..._propres,
          CpiNavItem(
            label: 'À corriger',
            icon: PhosphorIconsRegular.warningCircle,
            activeIcon: PhosphorIconsFill.warningCircle,
            badge: needsAttention,
            badgeSemanticsLabel:
                '$needsAttention saisie${needsAttention > 1 ? 's' : ''} '
                'à corriger',
          ),
          const CpiNavItem(
            label: 'Réglages',
            icon: PhosphorIconsRegular.gear,
            activeIcon: PhosphorIconsFill.gear,
          ),
        ],
      ),
      // Comme le `Scaffold` Material le faisait pour son
      // `bottomNavigationBar` : l'encoche du bas appartient à la nav, pas à
      // l'écran qu'elle surmonte.
      child: MediaQuery.removePadding(
        context: context,
        removeBottom: true,
        child: shell,
      ),
    );
  }
}

/// Le projet de la coque où l'on se trouve.
///
/// Il vient du [ProjectScope] posé par [AppShell] — pas de l'adresse courante :
/// une page poussée par-dessus la coque (la fiche d'un prospect, les
/// notifications) a une adresse qui ne dit rien du projet d'où l'on vient, et
/// le préfixe renvoyait alors tout le monde au CHUES.
///
/// Total par construction : un écran monté hors routeur (une capture d'écran de
/// test, une galerie de composants) répond CHUES au lieu de lever.
CpiProject projetDeLaCoque(BuildContext context) {
  final CpiProject? pose = ProjectScope.maybeOf(context);
  if (pose != null) return pose;
  final GoRouter? router = GoRouter.maybeOf(context);
  if (router == null) return CpiProject.chues;
  final RouteMatchList config = router.routerDelegate.currentConfiguration;
  return CpiProject.duChemin(config.uri.path) ?? CpiProject.chues;
}

/// L'onglet « À corriger » de la coque où l'on se trouve : chaque projet a le
/// sien, et sauter dans celui d'un autre changerait de projet au milieu d'un
/// geste.
String correctionsDeLaCoque(BuildContext context) =>
    projetDeLaCoque(context).corrections;

/// L'onglet « Réglages » de la coque où l'on se trouve. Sert de repli aux pages
/// d'aide poussées par-dessus : sans lui, un retour non dépilable déposait dans
/// les réglages du CHUES.
String reglagesDeLaCoque(BuildContext context) =>
    projetDeLaCoque(context).reglages;

/// La bande d'état de la file d'envoi : un seul point de vérité pour « où en
/// sont mes saisies ». Se pose dans `CpiScaffold.banner`, jamais dans un pied.
class PendingBanner extends ConsumerStatefulWidget {
  const PendingBanner({super.key});

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
    final int blocked = ref.watch(blockedSyncCountProvider).value ?? 0;
    final SyncUiState sync = ref.watch(syncCoordinatorProvider);
    final CpiConnectivity network = ref.watch(connectivityProvider);
    final bool offline = network != CpiConnectivity.online;

    final String fiches = '$pending fiche${pending > 1 ? 's' : ''}';
    final String pasEncore =
        '$fiches pas encore envoyée${pending > 1 ? 's' : ''}';

    final ({String text, CpiTone tone, String? action, VoidCallback? onAction})?
    band;
    if (pending > 0 && offline) {
      band = (
        text: network == CpiConnectivity.unreachable
            ? 'Serveur injoignable. $pasEncore. '
                  'Vérifiez le portail Wi-Fi ou votre crédit data.'
            : 'Hors ligne. $pasEncore, gardées sur le téléphone.',
        tone: CpiTone.warning,
        action: null,
        onAction: null,
      );
    } else if (pending > 0 && sync.running) {
      band = (
        text: 'Envoi en cours : $fiches.',
        tone: CpiTone.neutral,
        action: null,
        onAction: null,
      );
    } else if (pending > 0 && sync.failureLabel != null) {
      band = (
        text: '$pasEncore. ${sync.failureLabel}',
        tone: CpiTone.danger,
        action: 'Réessayer',
        onAction: () =>
            unawaited(ref.read(syncCoordinatorProvider.notifier).run()),
      );
    } else if (pending > 0) {
      band = (
        text: '$pasEncore.',
        tone: CpiTone.warning,
        action: null,
        onAction: null,
      );
    } else if (blocked > 0) {
      // Rien ne part plus tout seul : le dire, plutôt que d'afficher « Tout est
      // envoyé » sur une file qui contient des refus.
      band = (
        text:
            '$blocked saisie${blocked > 1 ? 's' : ''} à corriger. '
            'Aucun envoi ne les débloquera.',
        tone: CpiTone.danger,
        action: 'Corriger',
        onAction: () => context.go(correctionsDeLaCoque(context)),
      );
    } else if (_showSuccess) {
      band = (
        text: 'Tout est envoyé.',
        tone: CpiTone.success,
        action: null,
        onAction: null,
      );
    } else if (offline) {
      band = (
        text: 'Hors ligne. Vos fiches sont gardées.',
        tone: CpiTone.warning,
        action: null,
        onAction: null,
      );
    } else {
      band = null;
    }

    // Clé nulle quand il n'y a rien à dire : `CpiScaffold.banner` referme sa
    // hauteur en douceur au lieu de la couper. La marge est celle de
    // `CpiStatusBand` — la doubler ici décalait la bande du corps qu'elle coiffe.
    if (band == null) {
      return const SizedBox.shrink(key: ValueKey<String>('aucune-bande'));
    }
    return CpiStatusBand(
      key: ValueKey<String>('${band.tone}|${band.text}'),
      text: band.text,
      tone: band.tone,
      actionLabel: band.action,
      onAction: band.onAction,
    );
  }
}

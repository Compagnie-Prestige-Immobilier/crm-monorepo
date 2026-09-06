import 'dart:async';

import 'package:drift/drift.dart' show Value;
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:intl/intl.dart';
import 'package:phosphor_flutter/phosphor_flutter.dart';

import '../../core/providers/app_providers.dart';
import '../../core/providers/sync_coordinator.dart';
import '../../core/router/app_router.dart';
import '../../core/router/route_paths.dart';
import '../../core/router/single_push.dart';
import '../../core/telephonie/appels_crm.dart';
import '../../core/telephonie/preuve_appel.dart';
import '../../core/theme/cpi_tokens.dart';
import '../../core/utils/relative_time.dart';
import '../../data/local/database.dart';
import '../../ui/widgets/cpi_kit.dart';
import '../notifications/notifications_controller.dart';
import '../representant/presentation/representant_detail_screen.dart'
    show StatutTag;

/// Combien d'appels la feuille montre avant de compter le reste.
const int kAppelsMontres = 5;

/// Les appels retrouvés dans le journal du téléphone et pas encore consignés.
final StreamProvider<List<AppelsAConsignerResult>> appelsAConsignerProvider =
    StreamProvider<List<AppelsAConsignerResult>>(
      (Ref ref) => ref.watch(appDatabaseProvider).appelsAConsigner().watch(),
    );

/// Ouvre la feuille et marque comme montrés tous les appels qu'elle porte : ils
/// restent dans la liste, mais ne s'imposeront plus d'eux-mêmes.
Future<void> ouvrirAppelsAConsigner(
  BuildContext context,
  WidgetRef ref,
  List<AppelsAConsignerResult> appels,
) async {
  if (appels.isEmpty) return;
  final AppDatabase db = ref.read(appDatabaseProvider);
  await (db.update(db.preuvesAppel)..where(
        (PreuvesAppel row) =>
            row.id.isIn(appels.map((AppelsAConsignerResult a) => a.id)),
      ))
      .write(
        PreuvesAppelCompanion(
          signaleAt: Value<DateTime?>(ref.read(clockProvider).now()),
        ),
      );
  if (!context.mounted) return;
  await showCpiSheet<void>(
    context,
    title: 'Appels à consigner',
    builder: (BuildContext sheet) => _FeuilleAppels(
      appels: appels,
      onConsigner: (AppelsAConsignerResult appel) {
        Navigator.of(sheet).pop();
        ref
            .read(pendingPushRouteProvider.notifier)
            .offerRoute(routeDeConsignation(appel));
      },
      onIgnorer: (AppelsAConsignerResult appel) =>
          unawaited(ignorerAppelDetecte(ref, appel.id)),
    ),
  );
}

Future<void> ignorerAppelDetecte(WidgetRef ref, String preuveId) async {
  final AppDatabase db = ref.read(appDatabaseProvider);
  await (db.update(
    db.preuvesAppel,
  )..where((PreuvesAppel row) => row.id.equals(preuveId))).write(
    PreuvesAppelCompanion(
      ignoreAt: Value<DateTime?>(ref.read(clockProvider).now()),
    ),
  );
}

/// L'écran qui consigne cet appel : le script pour un représentant, la saisie
/// de phase 2 du projet du prospect sinon.
String routeDeConsignation(AppelsAConsignerResult appel) {
  if (appel.kind == 'representant') {
    return Routes.representantQualificationFor(appel.entityId);
  }
  return Uri(
    path: appel.prosProjet == 'CHUES' ? Routes.phase2 : '/grand-public/phase2',
    queryParameters: <String, String>{
      Routes.prefillPhoneParam: appel.phoneE164,
    },
  ).toString();
}

String nomDeLaFiche(AppelsAConsignerResult appel) {
  if (appel.kind == 'representant') return appel.repNom ?? 'Fiche';
  final String nom = '${appel.prosPrenom ?? ''} ${appel.prosNom ?? ''}'.trim();
  return nom.isEmpty ? 'Fiche' : nom;
}

/// « Vous avez appelé Awa Diop », « Awa Diop vous a appelé », « Appel manqué de
/// Awa Diop » : le journal dit qui a composé, la phrase le redit en clair.
String phraseAppel(AppelsAConsignerResult appel) {
  final String nom = nomDeLaFiche(appel);
  return switch (appel.journalType) {
    'sortant' => 'Vous avez appelé $nom',
    'entrant' => '$nom vous a appelé',
    'manque' || 'rejete' || 'bloque' => 'Appel manqué de $nom',
    _ => 'Appel avec $nom',
  };
}

IconData iconeAppel(String? type) => switch (type) {
  'sortant' => PhosphorIconsRegular.phoneOutgoing,
  'entrant' => PhosphorIconsRegular.phoneIncoming,
  _ => PhosphorIconsRegular.phoneX,
};

/// « le 3 sept. à 14:02 », tel que la fiche l'annonce sous le numéro.
String dateAppel(DateTime at) =>
    DateFormat('d MMM à HH:mm', 'fr').format(at.toLocal());

/// La ligne posée sous le numéro d'une fiche quand un appel du journal la
/// concerne et que personne ne l'a consigné. Nulle le reste du temps.
CpiRow? ligneAppelNonConsigne(
  BuildContext context,
  WidgetRef ref, {
  required String kind,
  required String entityId,
}) {
  final AppelsAConsignerResult? appel =
      (ref.watch(appelsAConsignerProvider).value ??
              const <AppelsAConsignerResult>[])
          .where(
            (AppelsAConsignerResult a) =>
                a.kind == kind && a.entityId == entityId,
          )
          .firstOrNull;
  final DateTime? at = appel?.journalAt;
  if (appel == null || at == null) return null;
  return CpiRow(
    leading: Icon(iconeAppel(appel.journalType), size: CpiIconSize.md),
    title: 'Appel du ${dateAppel(at)} non consigné',
    subtitle: 'Consigner',
    onTap: () => context.pushOnce(routeDeConsignation(appel)),
  );
}

/// Fait tomber la feuille dès qu'un balayage retrouve un appel que personne n'a
/// encore vu, et relance le balayage aux moments où le journal a pu bouger :
/// retour au premier plan, fin d'une synchronisation.
class AppelsDetectesListener extends ConsumerStatefulWidget {
  const AppelsDetectesListener({super.key, required this.child});

  final Widget child;

  @override
  ConsumerState<AppelsDetectesListener> createState() =>
      _AppelsDetectesListenerState();
}

class _AppelsDetectesListenerState
    extends ConsumerState<AppelsDetectesListener> {
  AppLifecycleListener? _cycle;
  DateTime? _dernierCycleSynchro;
  bool _feuilleOuverte = false;

  @override
  void initState() {
    super.initState();
    _cycle = AppLifecycleListener(onResume: () => unawaited(_balayer()));
    unawaited(Future<void>.microtask(_balayer));
  }

  @override
  void dispose() {
    _cycle?.dispose();
    super.dispose();
  }

  /// Le rapprochement d'abord : un appel lancé depuis une fiche doit trouver
  /// SON entrée de journal avant que le balayage ne la prenne pour un appel
  /// passé hors de l'application.
  Future<void> _balayer() async {
    if (!mounted) return;
    if (!ref.read(authControllerProvider).isAuthenticated) return;
    final AppelsCrm appels = ref.read(appelsCrmProvider.notifier);
    await appels.rapprocherEnAttente();
    await appels.balayerJournal();
  }

  @override
  Widget build(BuildContext context) {
    ref.watch(appelsCrmProvider.notifier);
    ref.listen<SyncUiState>(syncCoordinatorProvider, (
      SyncUiState? _,
      SyncUiState next,
    ) {
      final DateTime? fini = next.lastRunAt;
      if (fini == null || fini == _dernierCycleSynchro) return;
      if (next.lastError != null) return;
      _dernierCycleSynchro = fini;
      unawaited(_balayer());
    });
    ref.listen<AsyncValue<List<AppelsAConsignerResult>>>(
      appelsAConsignerProvider,
      (
        AsyncValue<List<AppelsAConsignerResult>>? _,
        AsyncValue<List<AppelsAConsignerResult>> next,
      ) => _peutTomber(next.value ?? const <AppelsAConsignerResult>[]),
    );
    return widget.child;
  }

  void _peutTomber(List<AppelsAConsignerResult> appels) {
    if (_feuilleOuverte || !mounted) return;
    if (!appels.any((AppelsAConsignerResult a) => a.signaleAt == null)) return;
    // Clavier ouvert : une saisie est en cours, et la feuille la couperait.
    // Le prochain balayage la reproposera.
    if (MediaQuery.viewInsetsOf(context).bottom > 0) return;
    _feuilleOuverte = true;
    // Le navigateur des routes, pas ce contexte : le listener coiffe le
    // `Router` et n'a aucun `Navigator` au-dessus de lui.
    unawaited(
      ouvrirAppelsAConsigner(
        rootNavigatorKey.currentContext ?? context,
        ref,
        appels,
      ).whenComplete(() => _feuilleOuverte = false),
    );
  }
}

class _FeuilleAppels extends StatelessWidget {
  const _FeuilleAppels({
    required this.appels,
    required this.onConsigner,
    required this.onIgnorer,
  });

  final List<AppelsAConsignerResult> appels;
  final ValueChanged<AppelsAConsignerResult> onConsigner;
  final ValueChanged<AppelsAConsignerResult> onIgnorer;

  @override
  Widget build(BuildContext context) {
    final ThemeData theme = Theme.of(context);
    final List<AppelsAConsignerResult> montres = appels
        .take(kAppelsMontres)
        .toList(growable: false);
    final int reste = appels.length - montres.length;

    return Column(
      mainAxisSize: MainAxisSize.min,
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: <Widget>[
        Text(
          'Retrouvés dans le journal du téléphone.',
          style: theme.textTheme.bodyMedium?.copyWith(
            color: theme.colorScheme.onSurfaceVariant,
          ),
        ),
        const SizedBox(height: CpiSpacing.md),
        for (final (int index, AppelsAConsignerResult appel)
            in montres.indexed) ...<Widget>[
          _EntreeAnimee(
            index: index,
            child: _Entree(
              appel: appel,
              onConsigner: () => onConsigner(appel),
              onIgnorer: () => onIgnorer(appel),
            ),
          ),
          const SizedBox(height: CpiSpacing.xs),
        ],
        if (reste > 0)
          Padding(
            padding: const EdgeInsets.only(top: CpiSpacing.xxs),
            child: Text(
              reste == 1 ? 'et 1 autre' : 'et $reste autres',
              style: theme.textTheme.bodySmall?.copyWith(
                color: theme.colorScheme.onSurfaceVariant,
              ),
            ),
          ),
        const SizedBox(height: CpiSpacing.sm),
        CpiButton(
          'Plus tard',
          variant: CpiButtonVariant.ghost,
          onPressed: () => Navigator.of(context).pop(),
        ),
      ],
    );
  }
}

class _Entree extends StatelessWidget {
  const _Entree({
    required this.appel,
    required this.onConsigner,
    required this.onIgnorer,
  });

  final AppelsAConsignerResult appel;
  final VoidCallback onConsigner;
  final VoidCallback onIgnorer;

  @override
  Widget build(BuildContext context) {
    final ThemeData theme = Theme.of(context);
    final DateTime? at = appel.journalAt;
    final String quand = at == null ? '' : relativeTime(at);
    final String duree = dureeAppel(appel.journalDureeS ?? 0);

    return CpiCard(
      child: Column(
        mainAxisSize: MainAxisSize.min,
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: <Widget>[
          Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: <Widget>[
              Icon(iconeAppel(appel.journalType), size: CpiIconSize.lg),
              const SizedBox(width: CpiSpacing.sm),
              Expanded(
                child: Column(
                  mainAxisSize: MainAxisSize.min,
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: <Widget>[
                    Text(phraseAppel(appel), style: theme.textTheme.titleSmall),
                    const SizedBox(height: CpiSpacing.xxs),
                    Text(
                      '$quand · $duree',
                      style: theme.textTheme.bodySmall?.copyWith(
                        color: theme.colorScheme.onSurfaceVariant,
                      ),
                    ),
                    if (appel.kind == 'representant') ...<Widget>[
                      const SizedBox(height: CpiSpacing.xxs),
                      StatutTag(
                        relationStatus: appel.repRelation ?? 'INCONNU',
                        statutLabel: appel.repStatutLabel,
                        statutEffect: appel.repStatutEffect,
                        lastCallOutcome: appel.repIssue,
                      ),
                    ],
                  ],
                ),
              ),
            ],
          ),
          const SizedBox(height: CpiSpacing.sm),
          Row(
            children: <Widget>[
              Expanded(
                child: CpiButton(
                  'Consigner',
                  icon: PhosphorIconsRegular.notePencil,
                  onPressed: onConsigner,
                ),
              ),
              const SizedBox(width: CpiSpacing.xs),
              CpiButton(
                'Ignorer',
                variant: CpiButtonVariant.ghost,
                expand: false,
                onPressed: onIgnorer,
              ),
            ],
          ),
        ],
      ),
    );
  }
}

/// Entrée décalée : les lignes se posent l'une après l'autre plutôt que de
/// paraître d'un bloc. Sous « Réduire les animations », les durées du thème
/// tombent à zéro et il ne reste rien à jouer.
class _EntreeAnimee extends StatelessWidget {
  const _EntreeAnimee({required this.index, required this.child});

  final int index;
  final Widget child;

  @override
  Widget build(BuildContext context) {
    final CpiMotion motion = CpiMotion.of(context);
    final Duration decalage = motion.stagger * index;
    final Duration totale = motion.component + decalage;
    if (totale == Duration.zero) return child;
    return TweenAnimationBuilder<double>(
      tween: Tween<double>(begin: 0, end: 1),
      duration: totale,
      curve: Interval(
        decalage.inMicroseconds / totale.inMicroseconds,
        1,
        curve: motion.easeOut,
      ),
      child: child,
      builder: (BuildContext context, double t, Widget? enfant) => Opacity(
        opacity: t,
        child: Transform.translate(
          offset: Offset(0, (1 - t) * CpiSpacing.sm),
          child: enfant,
        ),
      ),
    );
  }
}

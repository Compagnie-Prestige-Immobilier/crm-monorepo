import 'dart:async';

import 'package:drift/drift.dart' show OrderingMode, OrderingTerm;
import 'package:flutter/foundation.dart' show defaultTargetPlatform;
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:phosphor_flutter/phosphor_flutter.dart';

import '../../../core/providers/app_providers.dart';
import '../../../core/providers/connectivity.dart';
import '../../../core/providers/sync_coordinator.dart';
import '../../../core/router/back_navigation.dart';
import '../../../core/telephonie/appels_crm.dart';
import '../../../core/telephonie/telephonie_port.dart';
import '../../../core/theme/cpi_tokens.dart';
import '../../../core/utils/relative_time.dart';
import '../../../data/local/database.dart';
import '../../../ui/widgets/cpi_kit.dart';
import '../../permissions/alarme_permission.dart';
import '../../shell/app_shell.dart';

/// Ce que le téléphone accorde réellement à CPI GO, sur l'appareil et à
/// l'instant où on regarde : autorisations, batterie, réseau, services, preuves
/// d'appel. Écran d'essai, réservé aux appareils de test.
class DiagnosticAndroidScreen extends ConsumerStatefulWidget {
  const DiagnosticAndroidScreen({super.key});

  @override
  ConsumerState<DiagnosticAndroidScreen> createState() =>
      _DiagnosticAndroidScreenState();
}

class _DiagnosticAndroidScreenState
    extends ConsumerState<DiagnosticAndroidScreen> {
  AppLifecycleListener? _cycle;
  StreamSubscription<EvenementTelephonie>? _evenements;
  EtatTelephonie _etat = const EtatTelephonie();
  PreuvesAppelData? _preuve;
  DateTime? _dernierBalayage;
  bool _enService = false;
  bool _balayage = false;

  @override
  void initState() {
    super.initState();
    _cycle = AppLifecycleListener(onResume: () => unawaited(_recharger()));
    _evenements = ref
        .read(telephonieProvider)
        .evenements
        .listen((EvenementTelephonie _) => unawaited(_recharger()));
    unawaited(_recharger());
  }

  @override
  void dispose() {
    unawaited(_evenements?.cancel());
    _cycle?.dispose();
    super.dispose();
  }

  Future<void> _recharger() async {
    final AppDatabase db = ref.read(appDatabaseProvider);
    final int? balaye = ref
        .read(sharedPreferencesProvider)
        .getInt(kClePrefsDernierBalayage);
    final EtatTelephonie etat = await ref.read(telephonieProvider).etat();
    final PreuvesAppelData? preuve =
        await (db.select(db.preuvesAppel)
              ..where((PreuvesAppel row) => row.rapprocheAt.isNotNull())
              ..orderBy(<OrderingTerm Function(PreuvesAppel)>[
                (PreuvesAppel row) => OrderingTerm(
                  expression: row.lanceAt,
                  mode: OrderingMode.desc,
                ),
              ])
              ..limit(1))
            .getSingleOrNull();
    if (!mounted) return;
    setState(() {
      _etat = etat;
      _preuve = preuve;
      _dernierBalayage = balaye == null
          ? null
          : DateTime.fromMillisecondsSinceEpoch(balaye, isUtc: true);
    });
  }

  Future<void> _balayerJournal() async {
    setState(() => _balayage = true);
    try {
      await ref.read(appelsCrmProvider.notifier).balayerJournal();
    } finally {
      if (mounted) setState(() => _balayage = false);
      await _recharger();
    }
  }

  Future<void> _demander(String nom) async {
    await ref.read(telephonieProvider).demanderPermission(nom);
    await _recharger();
  }

  Future<void> _synchroniserEnService() async {
    final Telephonie telephonie = ref.read(telephonieProvider);
    final SyncCoordinator synchro = ref.read(syncCoordinatorProvider.notifier);
    setState(() => _enService = true);
    await telephonie.synchroService(
      actif: true,
      titre: 'Synchronisation en cours',
    );
    await _recharger();
    try {
      await synchro.run();
    } finally {
      await telephonie.synchroService(actif: false, titre: '');
      if (mounted) setState(() => _enService = false);
      await _recharger();
    }
  }

  @override
  Widget build(BuildContext context) {
    final String retour = reglagesDeLaCoque(context);
    final List<_Bloc> blocs = _blocs();

    return CpiPopScope(
      fallback: retour,
      child: CpiScaffold(
        title: 'Diagnostic Android',
        leading: CpiBackButton(fallback: retour),
        body: Builder(
          builder: (BuildContext context) => ListView(
            padding: const EdgeInsets.fromLTRB(
              CpiSpacing.md,
              0,
              CpiSpacing.md,
              CpiSpacing.xxl,
            ),
            children: <Widget>[
              if (defaultTargetPlatform != TargetPlatform.android)
                Padding(
                  padding: const EdgeInsets.only(top: CpiSpacing.md),
                  child: Text(
                    'Ces réglages n\'existent que sur Android.',
                    style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                      color: Theme.of(context).colorScheme.onSurfaceVariant,
                    ),
                  ),
                )
              else ...<Widget>[
                for (final _Bloc bloc in blocs) ...<Widget>[
                  CpiSectionHeader(bloc.titre),
                  CpiCard.rows(<CpiRow>[
                    for (final _Ligne ligne in bloc.lignes)
                      CpiRow(
                        title: ligne.label,
                        subtitle: ligne.valeur,
                        trailing: ligne.action,
                      ),
                  ]),
                  if (bloc.bouton != null) ...<Widget>[
                    const SizedBox(height: CpiSpacing.xs),
                    bloc.bouton!,
                  ],
                ],
                const SizedBox(height: CpiSpacing.lg),
                CpiButton(
                  'Copier le rapport',
                  variant: CpiButtonVariant.secondary,
                  icon: PhosphorIconsRegular.copy,
                  onPressed: () => unawaited(_copierLeRapport(context, blocs)),
                ),
              ],
            ],
          ),
        ),
      ),
    );
  }

  Future<void> _copierLeRapport(BuildContext context, List<_Bloc> blocs) async {
    final StringBuffer texte = StringBuffer('Diagnostic Android CPI GO');
    for (final _Bloc bloc in blocs) {
      texte.writeln();
      texte.writeln(bloc.titre);
      for (final _Ligne ligne in bloc.lignes) {
        texte.writeln('  ${ligne.label} : ${ligne.valeur}');
      }
    }
    await Clipboard.setData(ClipboardData(text: texte.toString()));
    if (!context.mounted) return;
    cpiToast(context, 'Rapport copié');
  }

  List<_Bloc> _blocs() => <_Bloc>[
    (
      titre: 'Autorisations',
      lignes: <_Ligne>[
        for (final String nom in PermissionsTelephonie.toutes)
          (
            label: _libellesPermissions[nom] ?? nom,
            valeur: _libelleEtatPermission(_etat.permission(nom)),
            action: _actionPermission(nom),
          ),
      ],
      bouton: null,
    ),
    (
      titre: 'Batterie',
      lignes: <_Ligne>[
        (
          label: 'Optimisation de la batterie',
          valeur: _etat.batterieExemptee ? 'Exemptée' : 'Optimisée',
          action: null,
        ),
      ],
      bouton: _etat.batterieExemptee
          ? null
          : CpiButton(
              'Demander l\'exemption',
              variant: CpiButtonVariant.secondary,
              onPressed: () => unawaited(
                ref
                    .read(telephonieProvider)
                    .demanderExemptionBatterie()
                    .then((_) => _recharger()),
              ),
            ),
    ),
    (
      titre: 'Réseau',
      lignes: <_Ligne>[(label: 'État', valeur: _libelleReseau(), action: null)],
      bouton: null,
    ),
    (
      titre: 'Téléphone',
      lignes: <_Ligne>[
        (
          label: 'Appel en cours',
          valeur: _libelleEtatAppel(_etat.etatAppel),
          action: null,
        ),
        (label: 'Carte SIM', valeur: _libelleSim(_etat.sim), action: null),
        (label: 'Réseau mobile', valeur: _etat.reseau, action: null),
      ],
      bouton: null,
    ),
    (
      titre: 'Filtrage d\'appels',
      lignes: <_Ligne>[
        (
          label: 'Rôle de filtrage',
          valeur: switch ((
            _etat.roleScreeningDisponible,
            _etat.roleScreeningTenu,
          )) {
            (false, _) => 'Indisponible sur cet appareil',
            (true, true) => 'Tenu par CPI GO',
            (true, false) => 'Tenu par une autre application',
          },
          action: null,
        ),
      ],
      bouton: !_etat.roleScreeningDisponible || _etat.roleScreeningTenu
          ? null
          : CpiButton(
              'Demander le rôle',
              variant: CpiButtonVariant.secondary,
              onPressed: () => unawaited(
                ref
                    .read(telephonieProvider)
                    .demanderRoleScreening()
                    .then((_) => _recharger()),
              ),
            ),
    ),
    (
      titre: 'Services',
      lignes: <_Ligne>[
        (
          label: 'Service de synchronisation',
          valeur: _etat.serviceSynchro ? 'Actif' : 'Arrêté',
          action: null,
        ),
        (
          label: 'Service d\'appel',
          valeur: _etat.serviceAppel
              ? 'Actif · type ${_etat.typeServiceAppel ?? 'inconnu'}'
              : 'Arrêté',
          action: null,
        ),
      ],
      bouton: CpiButton(
        'Synchroniser en service',
        variant: CpiButtonVariant.secondary,
        loading: _enService,
        onPressed: _enService
            ? null
            : () => unawaited(_synchroniserEnService()),
      ),
    ),
    (
      titre: 'Appels',
      lignes: <_Ligne>[
        (
          label: 'Dernier appel CRM confirmé',
          valeur: _preuve == null
              ? 'Aucun'
              : '${_preuve!.kind} ${_preuve!.entityId}\n${_preuve!.libelle}',
          action: null,
        ),
        (
          label: 'Appels hors CRM ignorés',
          valeur: _libelleHorsCrm(),
          action: null,
        ),
        (
          label: 'Dernier appel entrant reconnu',
          valeur: _etat.dernierEntrantCrm == null
              ? 'Aucun'
              : '${_etat.dernierEntrantCrm!.kind} ${_etat.dernierEntrantCrm!.id} · '
                    '${relativeTime(_etat.dernierEntrantCrm!.at)}',
          action: null,
        ),
        (
          label: 'Dernier balayage du journal',
          valeur: _dernierBalayage == null
              ? 'Jamais'
              : relativeTime(_dernierBalayage!),
          action: null,
        ),
      ],
      bouton: CpiButton(
        'Balayer maintenant',
        variant: CpiButtonVariant.secondary,
        loading: _balayage,
        onPressed: _balayage ? null : () => unawaited(_balayerJournal()),
      ),
    ),
    (
      titre: 'Redémarrage',
      lignes: <_Ligne>[
        (
          label: 'Dernier redémarrage',
          valeur: _etat.dernierBoot == null
              ? 'Inconnu'
              : relativeTime(_etat.dernierBoot!),
          action: null,
        ),
        (
          label: 'Redémarrage traité',
          valeur: _etat.dernierBootTraite == null
              ? 'Jamais'
              : relativeTime(_etat.dernierBootTraite!),
          action: null,
        ),
      ],
      bouton: null,
    ),
  ];

  Widget? _actionPermission(String nom) => switch (_etat.permission(nom)) {
    EtatPermission.accordee => null,
    EtatPermission.refusee => CpiButton(
      'Demander',
      variant: CpiButtonVariant.ghost,
      expand: false,
      onPressed: () => unawaited(_demander(nom)),
    ),
    EtatPermission.definitive => CpiButton(
      'Ouvrir les réglages',
      variant: CpiButtonVariant.ghost,
      expand: false,
      onPressed: () => unawaited(ouvrirLaFicheApplication(context)),
    ),
  };

  String _libelleReseau() {
    if (ref.watch(connectivityProvider) == CpiConnectivity.offline) {
      return 'Réseau indisponible';
    }
    return ref.watch(networkValidatedProvider).value == false
        ? 'Connecté sans Internet'
        : 'Connecté';
  }

  String _libelleHorsCrm() {
    final ({DateTime at, String numeroMasque})? dernier = _etat.dernierHorsCrm;
    if (dernier == null) return '${_etat.appelsHorsCrmIgnores}';
    return '${_etat.appelsHorsCrmIgnores} · ${dernier.numeroMasque} · '
        '${relativeTime(dernier.at)}';
  }
}

typedef _Ligne = ({String label, String valeur, Widget? action});

typedef _Bloc = ({String titre, List<_Ligne> lignes, Widget? bouton});

const Map<String, String> _libellesPermissions = <String, String>{
  PermissionsTelephonie.appeler: 'Passer un appel',
  PermissionsTelephonie.etatTelephone: 'État du téléphone',
  PermissionsTelephonie.journalAppels: 'Journal d\'appels',
};

String _libelleEtatPermission(EtatPermission etat) => switch (etat) {
  EtatPermission.accordee => 'Accordée',
  EtatPermission.refusee => 'Refusée',
  EtatPermission.definitive => 'Refusée définitivement',
};

String _libelleEtatAppel(String etat) => switch (etat) {
  'sonne' => 'Sonne',
  'decroche' => 'En cours',
  _ => 'Aucun',
};

String _libelleSim(String sim) => switch (sim) {
  'prete' => 'Prête',
  'absente' => 'Absente',
  'verrouillee' => 'Verrouillée',
  _ => 'Inconnue',
};

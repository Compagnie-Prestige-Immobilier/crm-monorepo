import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:forui/forui.dart';
import 'package:phosphor_flutter/phosphor_flutter.dart';

import '../../../core/providers/app_providers.dart';
import '../../../core/providers/connectivity.dart';
import '../../../core/providers/sync_coordinator.dart';
import '../../../core/router/route_paths.dart';
import '../../../core/router/single_push.dart';
import '../../../core/sync/phase2_directory_sync.dart';
import '../../../core/theme/cpi_tokens.dart';
import '../../../core/utils/phone.dart';
import '../../../data/local/database.dart';
import '../../../ui/widgets/cpi_action_bar.dart';
import '../../../ui/widgets/cpi_choice_group.dart';
import '../../../ui/widgets/cpi_forui.dart';
import '../../../ui/widgets/cpi_kit.dart';
import '../../../ui/widgets/cpi_pressable.dart';
import '../../../ui/widgets/empty_state.dart';
import '../../../ui/widgets/error_state.dart';
import '../../../ui/widgets/search_field.dart';
import '../../../ui/widgets/sync_status_icon.dart';
import '../../../ui/async_value_x.dart';
import '../../representant/presentation/representant_detail_screen.dart'
    show StatutTag, libelleIssueRepresentant, relationLabel;
import '../../shell/grand_public_fiches_screen.dart' show ProspectTile;

/// La base des représentants vient du web : on ne les crée pas ici, on en
/// choisit un pour l'appeler et le qualifier.
void ouvrirAppelRepresentant(BuildContext context) {
  unawaited(HapticFeedback.selectionClick());
  context.pushOnce(Routes.representants);
}

/// Les fiches du CHUES, représentants et prospects chacun sous son onglet,
/// avec une recherche et des filtres qui ne demandent aucun réseau.
class HistoriqueScreen extends ConsumerStatefulWidget {
  const HistoriqueScreen({super.key});

  @override
  ConsumerState<HistoriqueScreen> createState() => _HistoriqueScreenState();
}

class _HistoriqueScreenState extends ConsumerState<HistoriqueScreen> {
  late String _fieldText = ref.read(historiqueSearchProvider);

  /// Le champ garde son texte tout seul : il faut le reconstruire pour qu'une
  /// recherche posée d'ailleurs (« Effacer la recherche », « Voir la fiche »)
  /// se voie dans la boîte.
  int _fieldSeed = 0;

  /// L'onglet ouvert décide de ce que le bouton du pied appelle.
  int _onglet = 0;

  void _search(String value) {
    _fieldText = value;
    ref.read(historiqueSearchProvider.notifier).set(value);
  }

  /// Effacer depuis l'état vide : le champ garde son texte tout seul, il faut
  /// le reconstruire pour que la boîte se vide aussi.
  void _clearSearch() {
    setState(() => _fieldSeed += 1);
    _search('');
  }

  @override
  Widget build(BuildContext context) {
    final String search = ref.watch(historiqueSearchProvider);
    if (search != _fieldText) {
      _fieldText = search;
      _fieldSeed += 1;
    }
    final CpiConnectivity network = ref.watch(connectivityProvider);

    Widget recherche(VoidCallback ouvrirFiltres, int actifs) => Padding(
      padding: const EdgeInsets.fromLTRB(
        CpiSpacing.md,
        0,
        CpiSpacing.md,
        CpiSpacing.sm,
      ),
      child: Row(
        children: <Widget>[
          Expanded(
            child: CpiSearchField(
              key: ValueKey<int>(_fieldSeed),
              initial: _fieldText,
              onChanged: _search,
            ),
          ),
          const SizedBox(width: CpiSpacing.xs),
          // Icône seule : à 320 dp et 1,76× le texte, un libellé à côté du
          // champ débordait.
          Semantics(
            button: true,
            label: actifs == 0 ? 'Filtrer' : 'Filtrer, $actifs actifs',
            onTap: ouvrirFiltres,
            child: ExcludeSemantics(
              child: FButton.icon(
                variant: FButtonVariant.outline,
                onPress: ouvrirFiltres,
                child: Icon(
                  actifs == 0
                      ? PhosphorIconsRegular.funnel
                      : PhosphorIconsFill.funnel,
                ),
              ),
            ),
          ),
        ],
      ),
    );

    return CpiScaffold(
      title: 'Fiches',
      banner: network == CpiConnectivity.online
          ? null
          : const Padding(
              padding: EdgeInsets.fromLTRB(
                CpiSpacing.md,
                0,
                CpiSpacing.md,
                CpiSpacing.sm,
              ),
              child: CpiStatusBand(
                text: 'Hors ligne. Les fiches restent consultables.',
                tone: CpiTone.warning,
              ),
            ),
      footer: CpiActionBar(
        child: _onglet == 0
            ? CpiButton(
                'Appeler un représentant',
                icon: PhosphorIconsRegular.phoneCall,
                onPressed: () => ouvrirAppelRepresentant(context),
              )
            : CpiButton(
                'Appeler un prospect',
                icon: PhosphorIconsRegular.phoneCall,
                onPressed: () {
                  unawaited(HapticFeedback.selectionClick());
                  context.pushOnce(Routes.phase2);
                },
              ),
      ),
      body: FTabs(
        expands: true,
        control: FTabControl.managed(
          onChange: (int index) => setState(() => _onglet = index),
        ),
        children: <FTabEntry>[
          FTabEntry(
            label: const Text('Représentants'),
            child: _OngletRepresentants(
              recherche: recherche,
              searching: search.trim().isNotEmpty,
              onClearSearch: _clearSearch,
            ),
          ),
          FTabEntry(
            label: const Text('Prospects'),
            child: _OngletProspects(
              recherche: recherche,
              searching: search.trim().isNotEmpty,
              onClearSearch: _clearSearch,
            ),
          ),
        ],
      ),
    );
  }
}

typedef _Recherche = Widget Function(VoidCallback ouvrirFiltres, int actifs);

class _OngletRepresentants extends ConsumerWidget {
  const _OngletRepresentants({
    required this.recherche,
    required this.searching,
    required this.onClearSearch,
  });

  final _Recherche recherche;
  final bool searching;
  final VoidCallback onClearSearch;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final AsyncValue<List<RepresentantSyncViewData>> rows = ref.watch(
      representantListProvider,
    );
    final FiltresRepresentants filtres = ref.watch(
      filtresRepresentantsProvider,
    );
    final List<StatutQualificationRow> statuts =
        ref.watch(statutsQualificationProvider).value ??
        const <StatutQualificationRow>[];
    String? statutLabel(String id) => switch (id) {
      '' => null,
      filtreJamais => 'Jamais qualifié',
      _ =>
        statuts
            .where((StatutQualificationRow s) => s.id == id)
            .map((StatutQualificationRow s) => s.label)
            .firstOrNull ??
            id,
    };
    final List<String> actifs = <String>[
      ?statutLabel(filtres.statutId),
      if (filtres.relation.isNotEmpty) relationLabel(filtres.relation),
      if (filtres.dernierAppel == filtreJamais)
        'Jamais appelé'
      else if (filtres.dernierAppel.isNotEmpty)
        'Dernier appel : ${libelleIssueRepresentant(filtres.dernierAppel)}',
    ];

    return Column(
      children: <Widget>[
        recherche(
          () => unawaited(
            ouvrirFiltres(context, const _FiltresRepresentants()),
          ),
          filtres.actifs,
        ),
        if (actifs.isNotEmpty)
          _FiltresActifs(
            libelles: actifs,
            onClear: () => ref
                .read(filtresRepresentantsProvider.notifier)
                .set(const FiltresRepresentants()),
          ),
        Expanded(
          child: rows.whenEchecDAbord(
            loading: () => const Center(child: FCircularProgress()),
            error: (Object e, StackTrace _) => CpiErrorState(
              message:
                  'La liste des représentants n\'a pas pu être lue. '
                  '${messageErreur(e)}',
              onRetry: () => ref.invalidate(representantListProvider),
            ),
            data: (List<RepresentantSyncViewData> list) {
              if (list.isEmpty) {
                return _EmptyHistorique(
                  searching: searching || actifs.isNotEmpty,
                  onClearSearch: () {
                    onClearSearch();
                    ref
                        .read(filtresRepresentantsProvider.notifier)
                        .set(const FiltresRepresentants());
                  },
                );
              }
              return _Liste(list: list);
            },
          ),
        ),
      ],
    );
  }
}

class _OngletProspects extends ConsumerWidget {
  const _OngletProspects({
    required this.recherche,
    required this.searching,
    required this.onClearSearch,
  });

  final _Recherche recherche;
  final bool searching;
  final VoidCallback onClearSearch;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final AsyncValue<List<ProspectSyncViewData>> rows = ref.watch(
      chuesProspectListProvider,
    );
    final FiltresProspects filtres = ref.watch(filtresProspectsProvider);
    final List<String> actifs = <String>[
      if (filtres.statut.isNotEmpty) libelleStatutProspect(filtres.statut),
      if (filtres.dernierAppel == filtreJamais)
        'Jamais appelé'
      else if (filtres.dernierAppel.isNotEmpty)
        'Dernier appel : ${libelleMotifProspect(filtres.dernierAppel)}',
    ];

    return Column(
      children: <Widget>[
        recherche(
          () => unawaited(ouvrirFiltres(context, const _FiltresProspects())),
          filtres.actifs,
        ),
        if (actifs.isNotEmpty)
          _FiltresActifs(
            libelles: actifs,
            onClear: () => ref
                .read(filtresProspectsProvider.notifier)
                .set(const FiltresProspects()),
          ),
        Expanded(
          child: rows.whenEchecDAbord(
            loading: () => const Center(child: FCircularProgress()),
            error: (Object e, StackTrace _) => CpiErrorState(
              message:
                  'La liste des prospects n\'a pas pu être lue. '
                  '${messageErreur(e)}',
              onRetry: () => ref.invalidate(chuesProspectListProvider),
            ),
            data: (List<ProspectSyncViewData> list) {
              if (list.isEmpty) {
                return _EmptyHistorique(
                  searching: searching || actifs.isNotEmpty,
                  prospects: true,
                  onClearSearch: () {
                    onClearSearch();
                    ref
                        .read(filtresProspectsProvider.notifier)
                        .set(const FiltresProspects());
                  },
                );
              }
              return ListView.separated(
                padding: const EdgeInsets.fromLTRB(
                  CpiSpacing.md,
                  0,
                  CpiSpacing.md,
                  CpiSpacing.xxl,
                ),
                itemCount: list.length + 1,
                separatorBuilder: (BuildContext context, int index) =>
                    const SizedBox(height: CpiSpacing.xs),
                itemBuilder: (BuildContext context, int index) {
                  if (index == 0) {
                    return Text(
                      '${list.length} prospect${list.length > 1 ? 's' : ''}',
                      style: Theme.of(context).textTheme.titleSmall,
                    );
                  }
                  return ProspectTile(
                    key: ValueKey<String>(list[index - 1].id),
                    prospect: list[index - 1],
                  );
                },
              );
            },
          ),
        ),
      ],
    );
  }
}

String libelleMotifProspect(String code) =>
    SystemCallReasons.byCode[code]?.label ?? code;

String libelleStatutProspect(String code) => switch (code) {
  'NOUVEAU' => 'Nouveau',
  'CONTACTE' => 'Contacté',
  'CONVERTI' => 'Converti',
  'PERDU' => 'Perdu',
  _ => code,
};

/// Les filtres posés, en clair sous la recherche, avec de quoi tout enlever.
class _FiltresActifs extends StatelessWidget {
  const _FiltresActifs({required this.libelles, required this.onClear});

  final List<String> libelles;
  final VoidCallback onClear;

  @override
  Widget build(BuildContext context) => Padding(
    padding: const EdgeInsets.fromLTRB(
      CpiSpacing.md,
      0,
      CpiSpacing.md,
      CpiSpacing.sm,
    ),
    child: Row(
      children: <Widget>[
        Expanded(
          child: Wrap(
            spacing: CpiSpacing.xs,
            runSpacing: CpiSpacing.xxs,
            children: <Widget>[
              for (final String l in libelles) CpiTag(l),
            ],
          ),
        ),
        CpiButton(
          'Effacer les filtres',
          variant: CpiButtonVariant.ghost,
          expand: false,
          onPressed: onClear,
        ),
      ],
    ),
  );
}

/// Chaque groupe s'applique dès la tuile touchée : la liste derrière la
/// feuille bouge, et l'on ferme quand on voit ce qu'on cherchait.
class _FiltresRepresentants extends ConsumerWidget {
  const _FiltresRepresentants();

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final FiltresRepresentants filtres = ref.watch(
      filtresRepresentantsProvider,
    );
    final FiltresRepresentantsNotifier notifier = ref.read(
      filtresRepresentantsProvider.notifier,
    );
    final List<StatutQualificationRow> statuts =
        ref.watch(statutsQualificationProvider).value ??
        const <StatutQualificationRow>[];
    return _EcranFiltres(
      title: 'Filtrer les représentants',
      onClear: () => notifier.set(const FiltresRepresentants()),
      children: <Widget>[
        CpiChoiceGroup<String>(
          label: 'Statut de qualification',
          value: filtres.statutId,
          onChanged: (String v) => notifier.set(filtres.copyWith(statutId: v)),
          options: <CpiChoice<String>>[
            const CpiChoice<String>(value: '', label: 'Tous'),
            const CpiChoice<String>(
              value: filtreJamais,
              label: 'Jamais qualifié',
            ),
            for (final StatutQualificationRow s in statuts)
              CpiChoice<String>(value: s.id, label: s.label),
          ],
        ),
        const SizedBox(height: CpiSpacing.lg),
        CpiChoiceGroup<String>(
          label: 'Relation',
          value: filtres.relation,
          onChanged: (String v) => notifier.set(filtres.copyWith(relation: v)),
          options: <CpiChoice<String>>[
            const CpiChoice<String>(value: '', label: 'Toutes'),
            for (final String r in <String>['AMBASSADEUR', 'REFUS', 'INCONNU'])
              CpiChoice<String>(value: r, label: relationLabel(r)),
          ],
        ),
        const SizedBox(height: CpiSpacing.lg),
        CpiChoiceGroup<String>(
          label: 'Dernier appel',
          value: filtres.dernierAppel,
          onChanged: (String v) =>
              notifier.set(filtres.copyWith(dernierAppel: v)),
          options: <CpiChoice<String>>[
            const CpiChoice<String>(value: '', label: 'Tous'),
            const CpiChoice<String>(value: filtreJamais, label: 'Jamais appelé'),
            for (final String issue in <String>[
              'REACHED',
              'PROSPECTS_PROMISED',
              'UNREACHABLE',
              'CALLBACK',
              'REFUSED',
              'WRONG_NUMBER',
            ])
              CpiChoice<String>(
                value: issue,
                label: libelleIssueRepresentant(issue),
              ),
          ],
        ),
      ],
    );
  }
}

class _FiltresProspects extends ConsumerWidget {
  const _FiltresProspects();

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final FiltresProspects filtres = ref.watch(filtresProspectsProvider);
    final FiltresProspectsNotifier notifier = ref.read(
      filtresProspectsProvider.notifier,
    );
    final List<CallReason> motifs =
        ref.watch(callReasonsProvider).value ?? SystemCallReasons.all;
    return _EcranFiltres(
      title: 'Filtrer les prospects',
      onClear: () => notifier.set(const FiltresProspects()),
      children: <Widget>[
        CpiChoiceGroup<String>(
          label: 'Statut',
          value: filtres.statut,
          onChanged: (String v) => notifier.set(filtres.copyWith(statut: v)),
          options: <CpiChoice<String>>[
            const CpiChoice<String>(value: '', label: 'Tous'),
            for (final String s in <String>[
              'NOUVEAU',
              'CONTACTE',
              'CONVERTI',
              'PERDU',
            ])
              CpiChoice<String>(value: s, label: libelleStatutProspect(s)),
          ],
        ),
        const SizedBox(height: CpiSpacing.lg),
        CpiChoiceGroup<String>(
          label: 'Dernier appel',
          value: filtres.dernierAppel,
          onChanged: (String v) =>
              notifier.set(filtres.copyWith(dernierAppel: v)),
          options: <CpiChoice<String>>[
            const CpiChoice<String>(value: '', label: 'Tous'),
            const CpiChoice<String>(value: filtreJamais, label: 'Jamais appelé'),
            for (final CallReason m in motifs)
              CpiChoice<String>(value: m.code, label: m.label),
          ],
        ),
      ],
    );
  }
}

/// Plein écran plutôt qu'une feuille : treize statuts ne tiennent pas dans
/// une feuille, et ses boutons partaient sous le bord.
Future<void> ouvrirFiltres(BuildContext context, Widget ecran) =>
    Navigator.of(context, rootNavigator: true).push<void>(
      MaterialPageRoute<void>(fullscreenDialog: true, builder: (_) => ecran),
    );

class _EcranFiltres extends StatelessWidget {
  const _EcranFiltres({
    required this.title,
    required this.children,
    required this.onClear,
  });

  final String title;
  final List<Widget> children;
  final VoidCallback onClear;

  @override
  Widget build(BuildContext context) => CpiForui(
    builder: (BuildContext context) => CpiScaffold(
      title: title,
      leading: CpiHeaderAction(
        icon: PhosphorIconsRegular.arrowLeft,
        label: 'Retour',
        onPressed: () => Navigator.of(context).pop(),
      ),
      footer: CpiActionBar(
        child: Row(
          children: <Widget>[
            Expanded(
              child: CpiButton(
                'Tout effacer',
                variant: CpiButtonVariant.secondary,
                onPressed: onClear,
              ),
            ),
            const SizedBox(width: CpiSpacing.sm),
            Expanded(
              child: CpiButton(
                'Voir la liste',
                onPressed: () => Navigator.of(context).pop(),
              ),
            ),
          ],
        ),
      ),
      body: ListView(
        padding: const EdgeInsets.fromLTRB(
          CpiSpacing.md,
          0,
          CpiSpacing.md,
          CpiSpacing.xxl,
        ),
        children: children,
      ),
    ),
  );
}

class _Liste extends ConsumerWidget {
  const _Liste({required this.list});

  final List<RepresentantSyncViewData> list;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final ThemeData theme = Theme.of(context);
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: <Widget>[
        Padding(
          padding: const EdgeInsets.fromLTRB(
            CpiSpacing.md,
            0,
            CpiSpacing.md,
            CpiSpacing.xs,
          ),
          child: Text(
            '${list.length} représentant${list.length > 1 ? 's' : ''}',
            style: theme.textTheme.titleSmall,
          ),
        ),
        Expanded(
          child: RefreshIndicator(
            onRefresh: () async {
              final SyncCoordinator sync = ref.read(
                syncCoordinatorProvider.notifier,
              );
              await HapticFeedback.selectionClick();
              await sync.run();
            },
            child: ListView.separated(
              padding: const EdgeInsets.fromLTRB(
                CpiSpacing.md,
                0,
                CpiSpacing.md,
                CpiSpacing.xxl,
              ),
              physics: const AlwaysScrollableScrollPhysics(),
              itemCount: list.length,
              separatorBuilder: (BuildContext context, int index) =>
                  const SizedBox(height: CpiSpacing.xs),
              itemBuilder: (BuildContext context, int index) => CpiListEntrance(
                index: index,
                child: _RepresentantTile(
                  key: ValueKey<String>(list[index].id),
                  data: list[index],
                ),
              ),
            ),
          ),
        ),
      ],
    );
  }
}

/// Une ligne, un tap, la fiche. Modifier, qualifier et supprimer vivent dans la
/// fiche ouverte : ici rien ne se cache derrière un panneau ni un balayage.
class _RepresentantTile extends StatelessWidget {
  const _RepresentantTile({super.key, required this.data});

  final RepresentantSyncViewData data;

  @override
  Widget build(BuildContext context) {
    final SyncStatus status = SyncStatus.parse(data.syncStatus ?? 'draft');
    final String? signal = status.aSignaler;
    return CpiCard.rows(<CpiRow>[
      CpiRow(
        title: data.fullName,
        subtitle: Phone.format(data.phoneE164),
        leading: signal == null
            ? null
            : SyncStatusIcon(
                status: status,
                size: CpiIconSize.xl,
                labelled: false,
              ),
        trailing: signal == null
            ? StatutTag(
                relationStatus: data.relationStatus,
                statutLabel: data.statutQualificationLabel,
                statutEffect: data.statutQualificationEffect,
                lastCallOutcome: data.lastCallOutcome,
              )
            : CpiTag(signal, tone: status.tone),
        onTap: () => context.pushOnce(Routes.representantDetailFor(data.id)),
      ),
    ]);
  }
}

class _EmptyHistorique extends StatelessWidget {
  const _EmptyHistorique({
    required this.searching,
    required this.onClearSearch,
    this.prospects = false,
  });

  final bool searching;
  final VoidCallback onClearSearch;
  final bool prospects;

  @override
  Widget build(BuildContext context) {
    if (searching) {
      return CpiEmptyState(
        icon: PhosphorIconsDuotone.magnifyingGlass,
        title: 'Aucun résultat.',
        message: 'Vérifiez le nom ou le numéro, ou retirez un filtre.',
        action: CpiButton(
          'Effacer la recherche',
          expand: false,
          onPressed: onClearSearch,
        ),
      );
    }
    return CpiEmptyState(
      icon: PhosphorIconsDuotone.usersThree,
      title: prospects
          ? 'Aucun prospect dans vos campagnes.'
          : 'Aucune fiche dans vos campagnes.',
      message: 'La liste se remplit quand une campagne vous attribue des numéros.',
    );
  }
}

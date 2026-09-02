import 'dart:async';

import 'package:drift/drift.dart' show QueryRow, ResultSetImplementation;
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:phosphor_flutter/phosphor_flutter.dart';

import '../../../core/providers/app_providers.dart';
import '../../../core/providers/sync_coordinator.dart';
import '../../../data/local/database.dart';
import '../../../core/router/route_paths.dart';
import '../../../core/router/single_push.dart';
import '../../../core/theme/cpi_tokens.dart';
import '../../../ui/widgets/activity_chart.dart';
import '../../../ui/widgets/cpi_action_bar.dart';
import '../../../ui/widgets/cpi_kit.dart';
import '../../../ui/widgets/cpi_pressable.dart';
import '../../auth/auth_state.dart';
import '../../notifications/notifications_controller.dart';
import '../../rappels/presentation/rappels_en_retard_banner.dart';
import '../../shell/app_shell.dart';
import '../../shell/projects.dart';
import '../../shell/workspace_switch.dart';

/// Les représentants qui ont dit oui et chez qui personne n'a encore été saisi :
/// c'est exactement le travail de l'étape 2.
final StreamProvider<int>
representantsSansProspectProvider = StreamProvider<int>((Ref ref) {
  final AppDatabase db = ref.watch(appDatabaseProvider);
  return db
      .customSelect(
        'SELECT COUNT(*) AS c FROM representants r '
        'WHERE r.deleted_at IS NULL AND r.relation_status = \'AMBASSADEUR\' '
        'AND NOT EXISTS (SELECT 1 FROM prospects p '
        '  WHERE p.representant_id = r.id AND p.deleted_at IS NULL)',
        readsFrom: <ResultSetImplementation<dynamic, dynamic>>{
          db.representants,
          db.prospects,
        },
      )
      .watchSingle()
      .map((QueryRow row) => row.read<int>('c'));
});

/// Le travail du jour, dans l'ordre des trois phases CHUES. Rien d'autre en
/// haut de l'écran : ce sont les trois seules choses à faire.
class HomeScreen extends ConsumerWidget {
  const HomeScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final ThemeData theme = Theme.of(context);
    final AuthState auth = ref.watch(authControllerProvider);
    final AsyncValue<int> representants = ref.watch(representantCountProvider);
    final AsyncValue<int> prospects = ref.watch(prospectCountProvider);
    final AsyncValue<int> sansProspect = ref.watch(
      representantsSansProspectProvider,
    );
    final List<ActivityDay> activity =
        ref.watch(activityLast7DaysProvider).value ?? const <ActivityDay>[];
    final bool chiffresIllisibles = representants.hasError || prospects.hasError || sansProspect.hasError;
    final AsyncValue<int> aQualifier = representants;
    final AsyncValue<int> aConvertir = prospects;

    // Sans liste confiée, la qualification passe par l'annuaire : le
    // téléconseiller a souvent le fichier des représentants de son côté et
    // cherche la personne au nom ou au numéro.
    void ouvrirQualification() => context.pushOnce(
      Routes.representantsPourQualifier(),
    );

    void ouvrirConversion() => context.pushOnce(
      Routes.phase2,
    );

    final List<Widget> corps = <Widget>[
      const RappelsEnRetardBanner(padded: false),
      if (chiffresIllisibles)
        Padding(
          padding: const EdgeInsets.only(bottom: CpiSpacing.sm),
          child: CpiStatusBand(
            text: 'Les chiffres n\'ont pas pu être lus.',
            tone: CpiTone.danger,
            actionLabel: 'Réessayer',
            onAction: () {
              ref.invalidate(representantCountProvider);
              ref.invalidate(prospectCountProvider);
              ref.invalidate(representantsSansProspectProvider);
            },
          ),
        ),
      _EtapeCard(
        rang: 1,
        titre: 'Qualifier les représentants',
        phrase: 'Appelez chaque représentant et notez sa réponse.',
        compte: aQualifier,
        libelle: (int n) =>
            n == 1 ? 'représentant à appeler' : 'représentants à appeler',
        onTap: ouvrirQualification,
      ),
      _EtapeCard(
        rang: 2,
        titre: 'Ajouter des prospects',
        phrase: 'Notez les collègues que vos représentants vous donnent.',
        compte: sansProspect,
        libelle: (int n) => n == 1
            ? 'représentant sans prospect'
            : 'représentants sans prospect',
        onTap: () => context.pushOnce(Routes.representants),
      ),
      _EtapeCard(
        rang: 3,
        titre: 'Convertir les prospects',
        phrase: 'Appelez les prospects pour obtenir leur adhésion.',
        compte: aConvertir,
        libelle: (int n) =>
            n == 1 ? 'prospect à appeler' : 'prospects à appeler',
        onTap: ouvrirConversion,
      ),
      const Padding(
        padding: EdgeInsets.only(bottom: CpiSpacing.sm),
        child: _Raccourcis(),
      ),
      _ActivityCard(days: activity),
      const SizedBox(height: CpiSpacing.xs),
    ];

    return CpiScaffold(
      title: 'Aujourd\'hui',
      // Le prénom sous le titre plutôt qu'une seconde ligne dans le corps :
      // sur un téléphone partagé, savoir qui est connecté vaut mieux qu'un
      // bonjour répété.
      subtitle: _bonjour(auth.fullName),
      leading: const CpiWorkspaceSwitch(
        key: Key('Projets'),
        current: CpiProject.chues,
      ),
      banner: const PendingBanner(),
      footer: _PrimaryAction(onQualifier: ouvrirQualification),
      body: RefreshIndicator(
        color: theme.colorScheme.primary,
        onRefresh: () async {
          final SyncCoordinator sync = ref.read(
            syncCoordinatorProvider.notifier,
          );
          await HapticFeedback.selectionClick();
          await sync.run();
        },
        child: ListView.builder(
          padding: const EdgeInsets.fromLTRB(
            CpiSpacing.md,
            0,
            CpiSpacing.md,
            CpiSpacing.xs,
          ),
          physics: const AlwaysScrollableScrollPhysics(),
          itemCount: corps.length,
          itemBuilder: (BuildContext context, int index) =>
              CpiListEntrance(index: index, child: corps[index]),
        ),
      ),
    );
  }
}

String _bonjour(String? nom) => (nom == null || nom.trim().isEmpty)
    ? 'Bonjour'
    : 'Bonjour, ${nom.trim().split(' ').first}';

/// Une étape du parcours : son rang, ce qu'elle demande, et ce qu'il en reste.
/// Le chiffre ne ment jamais : « … » tant qu'il se lit, « – » s'il n'a pas pu
/// être lu, jamais un zéro inventé.
class _EtapeCard extends StatelessWidget {
  const _EtapeCard({
    required this.rang,
    required this.titre,
    required this.phrase,
    required this.compte,
    required this.libelle,
    required this.onTap,
  });

  final int rang;
  final String titre;
  final String phrase;
  final AsyncValue<int> compte;
  final String Function(int nombre) libelle;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final ThemeData theme = Theme.of(context);
    final ColorScheme scheme = theme.colorScheme;
    final int? nombre = compte.hasError ? null : compte.value;
    final String valeur = compte.hasError
        ? '–'
        : nombre == null
        ? '…'
        : '$nombre';
    final String mots = nombre == null
        ? 'en cours de lecture'
        : libelle(nombre);

    return Semantics(
      button: true,
      onTap: onTap,
      label: 'Étape $rang. $titre. $valeur $mots.',
      child: ExcludeSemantics(
        child: Padding(
          padding: const EdgeInsets.only(bottom: CpiSpacing.sm),
          child: CpiCard(
            onTap: onTap,
            child: Row(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: <Widget>[
                CpiTag('$rang'),
                const SizedBox(width: CpiSpacing.sm),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    mainAxisSize: MainAxisSize.min,
                    children: <Widget>[
                      Text(titre, style: theme.textTheme.titleLarge),
                      const SizedBox(height: CpiSpacing.xxs),
                      Text(
                        phrase,
                        style: theme.textTheme.bodyMedium?.copyWith(
                          color: scheme.onSurfaceVariant,
                        ),
                      ),
                      const SizedBox(height: CpiSpacing.sm),
                      Row(
                        children: <Widget>[
                          Text(
                            valeur,
                            maxLines: 1,
                            overflow: TextOverflow.ellipsis,
                            style: theme.textTheme.headlineMedium,
                          ),
                          const SizedBox(width: CpiSpacing.xs),
                          Expanded(
                            child: Text(
                              mots,
                              maxLines: 2,
                              overflow: TextOverflow.ellipsis,
                              style: theme.textTheme.titleMedium?.copyWith(
                                color: scheme.onSurfaceVariant,
                              ),
                            ),
                          ),
                        ],
                      ),
                    ],
                  ),
                ),
                const SizedBox(width: CpiSpacing.xs),
                Icon(
                  PhosphorIconsRegular.caretRight,
                  size: CpiIconSize.xl,
                  color: scheme.onSurfaceVariant,
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}

/// Les deux entrées secondaires du jour, en lignes plutôt qu'en cartes : elles
/// ne portent pas de chiffre à lire de loin.
class _Raccourcis extends ConsumerWidget {
  const _Raccourcis();

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final int unread = ref.watch(unreadNotificationsProvider).value ?? 0;
    final int rappels =
        ref.watch(representantRappelsProvider).value?.length ?? 0;
    return CpiCard.rows(<CpiRow>[
      CpiRow(
        title: 'Consigner un appel',
        subtitle: 'Après l\'appel, notez ce qui a été dit.',
        leading: const Icon(
          PhosphorIconsRegular.phoneCall,
          size: CpiIconSize.lg,
        ),
        onTap: () => context.pushOnce(Routes.phase2),
      ),
      CpiRow(
        title: rappels == 0 ? 'Rappels' : 'Rappels ($rappels)',
        subtitle: 'Ce qui a été promis au téléphone',
        leading: Icon(
          rappels == 0
              ? PhosphorIconsRegular.bell
              : PhosphorIconsRegular.bellRinging,
          size: CpiIconSize.lg,
        ),
        onTap: () => context.pushOnce(Routes.rappels),
      ),
      CpiRow(
        title: unread == 0
            ? 'Annonces'
            : 'Annonces ($unread non lue${unread > 1 ? 's' : ''})',
        leading: Icon(
          unread == 0 ? PhosphorIconsRegular.bell : PhosphorIconsFill.bell,
          size: CpiIconSize.lg,
        ),
        onTap: () => context.pushOnce(Routes.notifications),
      ),
    ]);
  }
}

class _ActivityCard extends StatelessWidget {
  const _ActivityCard({required this.days});

  final List<ActivityDay> days;

  @override
  Widget build(BuildContext context) {
    if (days.isEmpty) return const SizedBox.shrink();
    final ThemeData theme = Theme.of(context);
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: <Widget>[
        Padding(
          padding: const EdgeInsets.only(bottom: CpiSpacing.xs),
          child: Text('Ces 7 jours', style: theme.textTheme.titleSmall),
        ),
        CpiCard(child: ActivityChart(days: days)),
      ],
    );
  }
}

/// Les deux seuls gestes de départ de CHUES, derrière un bouton unique : la
/// feuille les nomme en toutes lettres plutôt que de les cacher dans les
/// cartes d'étapes.
class _PrimaryAction extends StatelessWidget {
  const _PrimaryAction({required this.onQualifier});

  final VoidCallback onQualifier;

  @override
  Widget build(BuildContext context) => CpiActionBar(
    child: CpiButton(
      'Commencer',
      icon: PhosphorIconsRegular.plus,
      // Le retour haptique vient de `CpiButton` : le rejouer ici vibre deux
      // fois.
      onPressed: () => unawaited(_choisirLeGeste(context, onQualifier)),
    ),
  );
}

Future<void> _choisirLeGeste(
  BuildContext context,
  VoidCallback onQualifier,
) async {
  final String? choix = await showCpiSheet<String>(
    context,
    title: 'Que voulez-vous faire ?',
    builder: (BuildContext sheet) => CpiCard.rows(<CpiRow>[
      CpiRow(
        leading: const Icon(
          PhosphorIconsRegular.phoneCall,
          size: CpiIconSize.lg,
        ),
        title: 'Qualifier un représentant',
        subtitle: 'Appelez-le et notez sa réponse.',
        onTap: () => Navigator.of(sheet).pop('qualifier'),
      ),
      CpiRow(
        leading: const Icon(
          PhosphorIconsRegular.identificationCard,
          size: CpiIconSize.lg,
        ),
        title: 'Ajouter un représentant',
        subtitle: 'Renseignez sa fiche complète.',
        onTap: () => Navigator.of(sheet).pop('representant'),
      ),
      CpiRow(
        leading: const Icon(
          PhosphorIconsRegular.userPlus,
          size: CpiIconSize.lg,
        ),
        title: 'Ajouter un prospect',
        subtitle: 'Renseignez un nouveau prospect.',
        onTap: () => Navigator.of(sheet).pop('prospect'),
      ),
    ]),
  );
  if (choix == null || !context.mounted) return;
  if (choix == 'qualifier') {
    onQualifier();
    return;
  }
  if (choix == 'representant') {
    context.pushOnce(Routes.newRepresentant);
    return;
  }
  context.pushOnce(Routes.representants);
}

import 'dart:async';
import 'dart:math' as math;

import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:forui/forui.dart';
import 'package:phosphor_flutter/phosphor_flutter.dart';

import '../../../core/providers/app_providers.dart';
import '../../../core/providers/connectivity.dart';
import '../../../core/router/back_navigation.dart';
import '../../../core/router/route_paths.dart';
import '../../../core/router/single_push.dart';
import '../../../core/theme/cpi_tokens.dart';
import '../../../core/utils/phone.dart';
import '../../../data/local/database.dart';
import '../../../ui/widgets/cpi_action_bar.dart';
import '../../../ui/widgets/cpi_kit.dart';
import '../../../ui/widgets/empty_state.dart';
import '../../../ui/widgets/error_state.dart';
import '../campagnes.dart';

/// La file d'une campagne, dans l'ordre EXACT du programme papier : le PDF rend
/// `day_index` puis `position`, et un téléconseiller qui suit les deux à la fois
/// perd sa place dès que l'écran s'en écarte.
class CampagneFileScreen extends ConsumerWidget {
  const CampagneFileScreen({
    super.key,
    required this.campaignId,
    this.grandPublic = false,
    this.representants = false,
  });

  final String campaignId;
  final bool grandPublic;
  final bool representants;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final AsyncValue<List<_QueueItem>> file = representants
        ? _mapQueue(
            ref.watch(repFileDeCampagneProvider(campaignId)),
            (RepCampaignQueueResult row) => _QueueItem(
              id: row.id,
              subjectId: row.representantId,
              position: row.position,
              dayIndex: row.dayIndex,
              name: row.fullName,
              phoneE164: row.phoneE164,
            ),
          )
        : _mapQueue(
            ref.watch(
              grandPublic
                  ? grandPublicFileDeCampagneProvider(campaignId)
                  : fileDeCampagneProvider(campaignId),
            ),
            (CampaignQueueResult row) => _QueueItem(
              id: row.id,
              subjectId: row.prospectId,
              position: row.position,
              dayIndex: row.dayIndex,
              name: '${row.prenom} ${row.nom}',
              phoneE164: row.phoneE164,
            ),
          );
    final RepCallCampaign? repCampagne = representants
        ? ref.watch(repCampagneProvider(campaignId)).value
        : null;
    final CallCampaign? campagne = representants
        ? null
        : ref.watch(campagneProvider(campaignId)).value;
    final int spreadDays = repCampagne?.spreadDays ?? campagne?.spreadDays ?? 1;
    final String nom = repCampagne?.name ?? campagne?.name ?? 'Campagne';
    final List<_QueueItem> restantes = file.value ?? const <_QueueItem>[];
    final bool horsLigne =
        ref.watch(connectivityProvider) != CpiConnectivity.online;

    return CpiPopScope(
      fallback: grandPublic
          ? CampagnesRoutes.grandPublicListe
          : CampagnesRoutes.liste,
      child: CpiScaffold(
        title: nom,
        // Le nom vient du web et n'a pas de longueur connue : en titre d'écran,
        // il prenait toute la hauteur à 1,76× et poussait la file dehors.
        showTitle: false,
        leading: CpiBackButton(
          fallback: grandPublic
              ? CampagnesRoutes.grandPublicListe
              : CampagnesRoutes.liste,
        ),
        banner: horsLigne
            ? const CpiStatusBand(
                text: 'Hors ligne. Liste du dernier téléchargement.',
                tone: CpiTone.warning,
              )
            : null,
        // La première fiche encore ouverte, dans l'ordre du programme : c'est
        // le seul geste de l'écran, et il ne demande pas de viser une ligne.
        footer: restantes.isEmpty
            ? null
            : CpiActionBar(
                child: CpiButton(
                  'Appeler le suivant',
                  icon: PhosphorIconsRegular.phoneCall,
                  onPressed: () => _appeler(
                    context,
                    restantes.first,
                    grandPublic: grandPublic,
                    representants: representants,
                  ),
                ),
              ),
        body: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: <Widget>[
            _NomDeLaFile(nom),
            Expanded(
              child: _corps(
                file,
                spreadDays,
                grandPublic: grandPublic,
                representants: representants,
                onRetry: () => ref.invalidate(
                  representants
                      ? repFileDeCampagneProvider(campaignId)
                      : grandPublic
                      ? grandPublicFileDeCampagneProvider(campaignId)
                      : fileDeCampagneProvider(campaignId),
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }

  /// L'échec passe AVANT le chargement : Riverpod réessaie indéfiniment une
  /// lecture en défaut, et `when(error:)` laisserait tourner l'indicateur sans
  /// jamais dire au téléconseiller ce qui s'est passé.
  static Widget _corps(
    AsyncValue<List<_QueueItem>> file,
    int spreadDays, {
    required bool grandPublic,
    required bool representants,
    required VoidCallback onRetry,
  }) {
    final Object? erreur = file.error;
    if (erreur != null) {
      return CpiErrorState(
        message:
            'La file de cette campagne n\'a pas pu être lue. '
            '${messageErreur(erreur)}',
        onRetry: onRetry,
      );
    }
    final List<_QueueItem>? taches = file.value;
    if (taches == null) return const Center(child: FCircularProgress());
    if (taches.isEmpty) return _FileVide(representants: representants);
    return _Programme(
      taches: taches,
      spreadDays: spreadDays,
      grandPublic: grandPublic,
      representants: representants,
    );
  }

  static AsyncValue<List<_QueueItem>> _mapQueue<T>(
    AsyncValue<List<T>> source,
    _QueueItem Function(T row) convert,
  ) {
    final Object? error = source.error;
    if (error != null) {
      return AsyncError<List<_QueueItem>>(
        error,
        source.stackTrace ?? StackTrace.current,
      );
    }
    final List<T>? rows = source.value;
    if (rows == null) return const AsyncLoading<List<_QueueItem>>();
    return AsyncData<List<_QueueItem>>(
      rows.map(convert).toList(growable: false),
    );
  }
}

/// Le nom de la liste, en tête du corps et plafonné à deux lignes.
class _NomDeLaFile extends StatelessWidget {
  const _NomDeLaFile(this.nom);

  final String nom;

  @override
  Widget build(BuildContext context) => Padding(
    padding: const EdgeInsets.fromLTRB(
      CpiSpacing.md,
      CpiSpacing.xs,
      CpiSpacing.md,
      CpiSpacing.md,
    ),
    child: Semantics(
      header: true,
      child: Text(
        nom,
        maxLines: 2,
        overflow: TextOverflow.ellipsis,
        style: Theme.of(context).textTheme.headlineSmall,
      ),
    ),
  );
}

/// Le parcours d'appel de CETTE fiche, selon la file d'où elle vient.
void _appeler(
  BuildContext context,
  _QueueItem tache, {
  required bool grandPublic,
  required bool representants,
}) {
  unawaited(HapticFeedback.selectionClick());
  context.pushOnce(
    representants
        ? Routes.representantQualificationFor(tache.subjectId)
        : grandPublic
        ? CampagnesRoutes.appelGrandPublicPour(tache.phoneE164)
        : CampagnesRoutes.appelPour(tache.phoneE164),
  );
}

class _QueueItem {
  const _QueueItem({
    required this.id,
    required this.subjectId,
    required this.position,
    required this.dayIndex,
    required this.name,
    required this.phoneE164,
  });

  final String id;
  final String subjectId;
  final int position;
  final int dayIndex;
  final String name;
  final String phoneE164;
}

class _Programme extends StatelessWidget {
  const _Programme({
    required this.taches,
    required this.spreadDays,
    required this.grandPublic,
    required this.representants,
  });

  final List<_QueueItem> taches;
  final int spreadDays;
  final bool grandPublic;
  final bool representants;

  @override
  Widget build(BuildContext context) {
    final int jours = math.max(spreadDays, taches.last.dayIndex + 1);
    final Map<int, int> parJour = <int, int>{};
    for (final _QueueItem t in taches) {
      parJour[t.dayIndex] = (parJour[t.dayIndex] ?? 0) + 1;
    }

    return ListView.builder(
      padding: const EdgeInsets.fromLTRB(
        CpiSpacing.md,
        0,
        CpiSpacing.md,
        CpiSpacing.xxl,
      ),
      itemCount: taches.length,
      itemBuilder: (BuildContext context, int index) {
        final _QueueItem tache = taches[index];
        final bool ouvreUnJour =
            index == 0 || taches[index - 1].dayIndex != tache.dayIndex;
        final Widget ligne = Padding(
          padding: const EdgeInsets.only(bottom: CpiSpacing.sm),
          child: _TacheTile(
            key: ValueKey<String>(tache.id),
            tache: tache,
            grandPublic: grandPublic,
            representants: representants,
          ),
        );
        if (!ouvreUnJour || jours <= 1) return ligne;
        return Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: <Widget>[
            _EnTeteDeJour(
              jour: tache.dayIndex + 1,
              jours: jours,
              fiches: parJour[tache.dayIndex] ?? 0,
            ),
            ligne,
          ],
        );
      },
    );
  }
}

class _EnTeteDeJour extends StatelessWidget {
  const _EnTeteDeJour({
    required this.jour,
    required this.jours,
    required this.fiches,
  });

  final int jour;
  final int jours;
  final int fiches;

  @override
  Widget build(BuildContext context) {
    final ThemeData theme = Theme.of(context);
    return Padding(
      padding: const EdgeInsets.fromLTRB(0, CpiSpacing.md, 0, CpiSpacing.xs),
      child: Semantics(
        header: true,
        child: Text(
          'Jour $jour sur $jours · ${fiches == 1 ? '1 fiche' : '$fiches fiches'}',
          style: theme.textTheme.labelLarge?.copyWith(
            color: theme.colorScheme.onSurfaceVariant,
          ),
        ),
      ),
    );
  }
}

class _TacheTile extends StatelessWidget {
  const _TacheTile({
    super.key,
    required this.tache,
    required this.grandPublic,
    required this.representants,
  });

  final _QueueItem tache;
  final bool grandPublic;
  final bool representants;

  @override
  Widget build(BuildContext context) => CpiCard.rows(<CpiRow>[
    CpiRow(
      title: '${tache.position} · ${tache.name}',
      subtitle: Phone.format(tache.phoneE164),
      trailing: const Icon(
        PhosphorIconsRegular.phoneCall,
        size: CpiIconSize.md,
      ),
      onTap: () => _appeler(
        context,
        tache,
        grandPublic: grandPublic,
        representants: representants,
      ),
    ),
  ]);
}

class _FileVide extends ConsumerWidget {
  const _FileVide({this.representants = false});

  final bool representants;

  @override
  Widget build(BuildContext context, WidgetRef ref) => CpiEmptyState(
    icon: PhosphorIconsDuotone.checkCircle,
    title: 'Tout est appelé. Bravo.',
    message: representants
        ? 'Un autre représentant à consigner ? Cherchez-le par son nom ou '
              'son numéro.'
        : 'Les prochaines arriveront plus tard.',
    action: Column(
      mainAxisSize: MainAxisSize.min,
      children: <Widget>[
        if (representants) ...<Widget>[
          CpiButton(
            'Chercher un représentant',
            icon: PhosphorIconsRegular.magnifyingGlass,
            expand: false,
            onPressed: () =>
                context.pushOnce(Routes.representantsPourQualifier()),
          ),
          const SizedBox(height: CpiSpacing.sm),
        ],
        CpiButton(
          'Recevoir la liste',
          variant: representants
              ? CpiButtonVariant.ghost
              : CpiButtonVariant.primary,
          icon: PhosphorIconsRegular.cloudArrowDown,
          expand: false,
          onPressed: () =>
              unawaited(ref.read(syncCoordinatorProvider.notifier).run()),
        ),
      ],
    ),
  );
}

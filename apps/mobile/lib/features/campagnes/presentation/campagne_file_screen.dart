import 'dart:async';
import 'dart:math' as math;

import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:phosphor_flutter/phosphor_flutter.dart';

import '../../../core/router/back_navigation.dart';
import '../../../core/router/single_push.dart';
import '../../../core/theme/cpi_tokens.dart';
import '../../../core/utils/phone.dart';
import '../../../data/local/database.dart';
import '../../../ui/widgets/offline_indicator.dart';
import '../../../ui/widgets/sync_badge.dart';
import '../campagnes.dart';

/// La file d'une campagne, dans l'ordre EXACT du programme papier : le PDF rend
/// `day_index` puis `position`, et un téléconseiller qui suit les deux à la fois
/// perd sa place dès que l'écran s'en écarte.
class CampagneFileScreen extends ConsumerWidget {
  const CampagneFileScreen({super.key, required this.campaignId});

  final String campaignId;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final AsyncValue<List<CampaignQueueResult>> file = ref.watch(
      fileDeCampagneProvider(campaignId),
    );
    final CallCampaign? campagne = ref.watch(campagneProvider(campaignId)).value;

    return CpiPopScope(
      fallback: CampagnesRoutes.liste,
      child: Scaffold(
        appBar: AppBar(
          title: Text(campagne?.name ?? 'Campagne'),
          leading: const CpiBackButton(fallback: CampagnesRoutes.liste),
          actions: const <Widget>[
            OfflineIndicator(),
            SyncBadge(),
            SizedBox(width: CpiSpacing.xs),
          ],
        ),
        body: _corps(file, campagne?.spreadDays ?? 1),
      ),
    );
  }

  /// L'échec passe AVANT le chargement : Riverpod réessaie indéfiniment une
  /// lecture en défaut, et `when(error:)` laisserait tourner l'indicateur sans
  /// jamais dire au téléconseiller ce qui s'est passé.
  static Widget _corps(AsyncValue<List<CampaignQueueResult>> file, int spreadDays) {
    final Object? erreur = file.error;
    if (erreur != null) {
      return Padding(
        padding: const EdgeInsets.all(CpiSpacing.xl),
        child: Center(child: Text('Lecture de la file impossible. $erreur')),
      );
    }
    final List<CampaignQueueResult>? taches = file.value;
    if (taches == null) return const Center(child: CircularProgressIndicator());
    if (taches.isEmpty) return const _FileVide();
    return _Programme(taches: taches, spreadDays: spreadDays);
  }
}

class _Programme extends StatelessWidget {
  const _Programme({required this.taches, required this.spreadDays});

  final List<CampaignQueueResult> taches;
  final int spreadDays;

  @override
  Widget build(BuildContext context) {
    final int jours = math.max(spreadDays, taches.last.dayIndex + 1);
    final Map<int, int> parJour = <int, int>{};
    for (final CampaignQueueResult t in taches) {
      parJour[t.dayIndex] = (parJour[t.dayIndex] ?? 0) + 1;
    }

    return ListView.builder(
      padding: const EdgeInsets.only(bottom: CpiSpacing.xxl),
      itemCount: taches.length,
      itemBuilder: (BuildContext context, int index) {
        final CampaignQueueResult tache = taches[index];
        final bool ouvreUnJour =
            index == 0 || taches[index - 1].dayIndex != tache.dayIndex;
        final Widget ligne = _TacheTile(
          key: ValueKey<String>(tache.id),
          tache: tache,
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
    return Container(
      width: double.infinity,
      color: theme.colorScheme.surfaceContainerHighest,
      padding: const EdgeInsets.fromLTRB(
        CpiSpacing.md,
        CpiSpacing.xs,
        CpiSpacing.md,
        CpiSpacing.xs,
      ),
      child: Text(
        'Jour $jour sur $jours · ${fiches == 1 ? '1 fiche' : '$fiches fiches'}',
        style: theme.textTheme.labelLarge,
      ),
    );
  }
}

class _TacheTile extends StatelessWidget {
  const _TacheTile({super.key, required this.tache});

  final CampaignQueueResult tache;

  @override
  Widget build(BuildContext context) {
    final ThemeData theme = Theme.of(context);
    return ListTile(
      title: Text(
        '${tache.position} · ${tache.prenom} ${tache.nom}',
        style: theme.textTheme.titleSmall,
      ),
      subtitle: Text(
        Phone.format(tache.phoneE164),
        style: theme.textTheme.bodySmall?.copyWith(
          color: theme.colorScheme.onSurfaceVariant,
        ),
      ),
      trailing: const Icon(PhosphorIconsRegular.phoneCall, size: 20),
      onTap: () {
        unawaited(HapticFeedback.selectionClick());
        context.pushOnce(CampagnesRoutes.appelPour(tache.phoneE164));
      },
    );
  }
}

class _FileVide extends StatelessWidget {
  const _FileVide();

  @override
  Widget build(BuildContext context) {
    final ThemeData theme = Theme.of(context);
    return Padding(
      padding: const EdgeInsets.all(CpiSpacing.xl),
      child: Column(
        mainAxisAlignment: MainAxisAlignment.center,
        children: <Widget>[
          Icon(
            PhosphorIconsDuotone.checkCircle,
            size: 56,
            color: theme.colorScheme.onSurfaceVariant,
          ),
          const SizedBox(height: CpiSpacing.md),
          Text('Rien à appeler ici', style: theme.textTheme.titleSmall),
          const SizedBox(height: CpiSpacing.xs),
          Text(
            'Les fiches restantes descendront à la prochaine synchronisation.',
            textAlign: TextAlign.center,
            style: theme.textTheme.bodyMedium?.copyWith(
              color: theme.colorScheme.onSurfaceVariant,
            ),
          ),
        ],
      ),
    );
  }
}

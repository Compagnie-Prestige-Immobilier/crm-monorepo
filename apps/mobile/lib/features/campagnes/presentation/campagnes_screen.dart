import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:phosphor_flutter/phosphor_flutter.dart';

import '../../../core/providers/app_providers.dart';
import '../../../core/router/back_navigation.dart';
import '../../../core/router/single_push.dart';
import '../../../core/theme/cpi_tokens.dart';
import '../../../data/local/database.dart';
import '../../../ui/widgets/cpi_pressable.dart';
import '../../../ui/widgets/offline_indicator.dart';
import '../../../ui/widgets/sync_badge.dart';
import '../campagnes.dart';

class CampagnesScreen extends ConsumerWidget {
  const CampagnesScreen({super.key, this.grandPublic = false});

  final bool grandPublic;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    return CpiPopScope(
      child: Scaffold(
        appBar: AppBar(
          title: const Text('Campagnes'),
          leading: const CpiBackButton(),
          actions: const <Widget>[
            OfflineIndicator(),
            SyncBadge(),
            SizedBox(width: CpiSpacing.xs),
          ],
        ),
        body: _corps(
          ref.watch(
            grandPublic ? grandPublicCampagnesProvider : campagnesProvider,
          ),
          grandPublic: grandPublic,
        ),
      ),
    );
  }

  /// L'échec passe AVANT le chargement : Riverpod réessaie indéfiniment une
  /// lecture en défaut, et `when(error:)` laisserait tourner l'indicateur sans
  /// jamais dire au téléconseiller ce qui s'est passé.
  static Widget _corps(
    AsyncValue<List<CampaignsWithOpenWorkResult>> campagnes, {
    required bool grandPublic,
  }) {
    final Object? erreur = campagnes.error;
    if (erreur != null) {
      return Padding(
        padding: const EdgeInsets.all(CpiSpacing.xl),
        child: Center(child: Text('Lecture des campagnes impossible. $erreur')),
      );
    }
    final List<CampaignsWithOpenWorkResult>? list = campagnes.value;
    if (list == null) return const Center(child: CircularProgressIndicator());
    if (list.isEmpty) return const _AucuneCampagne();
    return ListView.builder(
      padding: const EdgeInsets.only(bottom: CpiSpacing.xxl),
      itemCount: list.length,
      itemBuilder: (BuildContext context, int index) => CpiListEntrance(
        index: index,
        child: _CampagneTile(
          key: ValueKey<String>(list[index].id),
          campagne: list[index],
          grandPublic: grandPublic,
        ),
      ),
    );
  }
}

class _CampagneTile extends StatelessWidget {
  const _CampagneTile({
    super.key,
    required this.campagne,
    required this.grandPublic,
  });

  final CampaignsWithOpenWorkResult campagne;
  final bool grandPublic;

  @override
  Widget build(BuildContext context) {
    final ThemeData theme = Theme.of(context);
    return ListTile(
      leading: const Icon(
        PhosphorIconsDuotone.phoneList,
        size: CpiIconSize.xxl,
      ),
      title: Text(campagne.name, style: theme.textTheme.titleSmall),
      subtitle: Text(resteALire(campagne.ouvertes, campagne.spreadDays)),
      trailing: const Icon(
        PhosphorIconsRegular.caretRight,
        size: CpiIconSize.md,
      ),
      onTap: () {
        unawaited(HapticFeedback.selectionClick());
        context.pushOnce(
          grandPublic
              ? CampagnesRoutes.grandPublicFileFor(campagne.id)
              : CampagnesRoutes.fileFor(campagne.id),
        );
      },
    );
  }

  static String resteALire(int ouvertes, int jours) {
    final String fiches = ouvertes == 1 ? '1 fiche' : '$ouvertes fiches';
    if (jours <= 1) return '$fiches à appeler';
    return '$fiches à appeler, réparties sur $jours jours';
  }
}

class _AucuneCampagne extends ConsumerWidget {
  const _AucuneCampagne();

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final ThemeData theme = Theme.of(context);
    return Padding(
      padding: const EdgeInsets.all(CpiSpacing.xl),
      child: Column(
        mainAxisAlignment: MainAxisAlignment.center,
        children: <Widget>[
          Icon(
            PhosphorIconsDuotone.phoneList,
            size: CpiIconSize.display,
            color: theme.colorScheme.onSurfaceVariant,
          ),
          const SizedBox(height: CpiSpacing.md),
          Text('Aucune file confiée', style: theme.textTheme.titleSmall),
          const SizedBox(height: CpiSpacing.xs),
          Text(
            'Synchronisez pour recevoir les fiches à appeler.',
            textAlign: TextAlign.center,
            style: theme.textTheme.bodyMedium?.copyWith(
              color: theme.colorScheme.onSurfaceVariant,
            ),
          ),
          const SizedBox(height: CpiSpacing.lg),
          FilledButton.icon(
            onPressed: () =>
                unawaited(ref.read(syncCoordinatorProvider.notifier).run()),
            icon: const Icon(
              PhosphorIconsRegular.arrowsClockwise,
              size: CpiIconSize.md,
            ),
            label: const Text('Synchroniser'),
          ),
        ],
      ),
    );
  }
}

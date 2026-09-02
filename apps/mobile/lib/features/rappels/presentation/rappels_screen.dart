import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:forui/forui.dart';
import 'package:phosphor_flutter/phosphor_flutter.dart';

import '../../../core/providers/app_providers.dart';
import '../../../core/router/back_navigation.dart';
import '../../../core/router/route_paths.dart';
import '../../../core/router/single_push.dart';
import '../../../core/theme/cpi_tokens.dart';
import '../../../core/utils/phone.dart';
import '../../../ui/async_value_x.dart';
import '../../../ui/widgets/cpi_kit.dart';
import '../../../ui/widgets/empty_state.dart';
import '../../../ui/widgets/error_state.dart';
import 'rappels_en_retard_banner.dart';

/// Les rappels promis, du plus proche au plus lointain.
///
/// Le même écran pour les deux projets : un rappel Grand Public porte sur un
/// prospect, un rappel CHUES sur un représentant, et rien d'autre ne les
/// distingue à l'écran. L'accueil n'ouvrait que le PROCHAIN : les autres
/// n'étaient joignables par aucun chemin.
class RappelsScreen extends ConsumerWidget {
  const RappelsScreen({super.key, this.grandPublic = false});

  final bool grandPublic;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final AsyncValue<List<Rappel>> rappels = ref.watch(
      grandPublic ? grandPublicRappelsProvider : representantRappelsProvider,
    );
    final String retour = grandPublic ? Routes.grandPublic : Routes.chues;
    final DateTime maintenant = ref.watch(clockProvider).now();

    return CpiPopScope(
      fallback: retour,
      child: CpiScaffold(
        title: 'Rappels',
        leading: CpiBackButton(fallback: retour),
        banner: RappelsEnRetardBanner(grandPublic: grandPublic, lien: false),
        body: rappels.whenEchecDAbord(
          loading: () => const Center(
            child: FCircularProgress(semanticsLabel: 'Chargement'),
          ),
          error: (Object error, StackTrace _) => CpiErrorState(
            message:
                'Les rappels n\'ont pas pu être lus. ${messageErreur(error)}',
            onRetry: () => ref.invalidate(
              grandPublic
                  ? grandPublicRappelsProvider
                  : representantRappelsProvider,
            ),
          ),
          data: (List<Rappel> rows) {
            // Ceux que mon dernier appel n'a pas joints : ils n'ont pas de
            // rappel promis, et sans cette section rien ne les ramène.
            final List<Rappel> injoignables = grandPublic
                ? const <Rappel>[]
                : (ref.watch(representantsInjoignablesProvider).value ??
                      const <Rappel>[]);
            if (rows.isEmpty && injoignables.isEmpty) return const _Vide();
            return ListView.builder(
              padding: const EdgeInsets.fromLTRB(
                CpiSpacing.md,
                0,
                CpiSpacing.md,
                CpiSpacing.xxl,
              ),
              itemCount:
                  rows.length +
                  (injoignables.isEmpty ? 0 : injoignables.length + 1),
              itemBuilder: (BuildContext context, int index) {
                if (index == rows.length) return const _TitreInjoignables();
                final bool injoignable = index > rows.length;
                final Rappel rappel = injoignable
                    ? injoignables[index - rows.length - 1]
                    : rows[index];
                return Padding(
                  padding: const EdgeInsets.only(bottom: CpiSpacing.xs),
                  child: _RappelTile(
                    key: ValueKey<String>(rappel.id),
                    rappel: rappel,
                    maintenant: maintenant,
                    injoignable: injoignable,
                    destination: grandPublic
                        ? Routes.prospectDetailFor(rappel.sujetId)
                        : Routes.representantDetailFor(rappel.sujetId),
                  ),
                );
              },
            );
          },
        ),
      ),
    );
  }
}

/// Une ligne : qui rappeler, à quel numéro, à quelle heure, et si l'heure est
/// passée.
class _RappelTile extends StatelessWidget {
  const _RappelTile({
    super.key,
    required this.rappel,
    required this.maintenant,
    required this.destination,
    this.injoignable = false,
  });

  final Rappel rappel;
  final DateTime maintenant;
  final String destination;

  /// Aucun rappel n'a été promis : la date est celle du dernier appel, et rien
  /// n'est en retard.
  final bool injoignable;

  @override
  Widget build(BuildContext context) {
    final ThemeData theme = Theme.of(context);
    final ColorScheme scheme = theme.colorScheme;
    final String quand = quandRappeler(context, rappel.at, maintenant);
    final String heure = injoignable ? 'Dernier appel : $quand' : quand;
    final String phone = Phone.format(rappel.phoneE164);
    final bool enRetard = !injoignable && rappel.at.isBefore(maintenant);

    void ouvrir() {
      HapticFeedback.selectionClick().ignore();
      context.pushOnce(destination);
    }

    return Semantics(
      button: true,
      onTap: ouvrir,
      label:
          '${rappel.nom}. $phone. $heure.'
          '${enRetard ? ' En retard.' : ''}',
      child: ExcludeSemantics(
        child: CpiCard(
          onTap: ouvrir,
          child: Row(
            children: <Widget>[
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  mainAxisSize: MainAxisSize.min,
                  children: <Widget>[
                    Text(
                      rappel.nom,
                      maxLines: 2,
                      overflow: TextOverflow.ellipsis,
                      style: theme.textTheme.titleSmall,
                    ),
                    const SizedBox(height: CpiSpacing.xxs),
                    Text(
                      phone,
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                      style: theme.textTheme.bodyMedium?.copyWith(
                        color: scheme.onSurfaceVariant,
                      ),
                    ),
                    const SizedBox(height: CpiSpacing.xs),
                    Text(
                      heure,
                      maxLines: 2,
                      overflow: TextOverflow.ellipsis,
                      style: theme.textTheme.titleSmall,
                    ),
                    if (enRetard) ...<Widget>[
                      const SizedBox(height: CpiSpacing.xs),
                      const CpiTag('En retard', tone: CpiTone.danger),
                    ],
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
    );
  }
}

/// L'heure seule le jour même, la date devant sinon. Dakar est à UTC toute
/// l'année : l'heure saisie et l'heure lue coïncident.
String quandRappeler(BuildContext context, DateTime at, DateTime maintenant) {
  final MaterialLocalizations l = MaterialLocalizations.of(context);
  final DateTime local = at.toUtc();
  final String heure = l.formatTimeOfDay(TimeOfDay.fromDateTime(local));
  if (DateUtils.isSameDay(local, maintenant.toUtc())) return heure;
  return '${l.formatMediumDate(local)} à $heure';
}

class _TitreInjoignables extends StatelessWidget {
  const _TitreInjoignables();

  @override
  Widget build(BuildContext context) => Padding(
    padding: const EdgeInsets.only(top: CpiSpacing.md, bottom: CpiSpacing.sm),
    child: Semantics(
      header: true,
      child: Text(
        'Injoignables',
        style: Theme.of(context).textTheme.titleSmall,
      ),
    ),
  );
}

class _Vide extends StatelessWidget {
  const _Vide();

  @override
  Widget build(BuildContext context) => const CpiEmptyState(
    icon: PhosphorIconsDuotone.bellSlash,
    title: 'Aucun rappel prévu aujourd\'hui.',
    message: 'Les rappels promis pendant un appel apparaissent ici.',
  );
}

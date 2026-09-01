import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:forui/forui.dart';
import 'package:go_router/go_router.dart';
import 'package:phosphor_flutter/phosphor_flutter.dart';

import '../../core/providers/app_providers.dart';
import '../../core/router/route_paths.dart';
import '../../core/theme/cpi_tokens.dart';
import '../../core/utils/phone.dart';
import '../../data/local/database.dart';
import '../../ui/async_value_x.dart';
import '../../ui/widgets/cpi_kit.dart';
import '../../ui/widgets/empty_state.dart';
import '../../ui/widgets/error_state.dart';
import '../../ui/widgets/search_field.dart';
import '../../ui/widgets/sync_status_icon.dart';
import 'app_shell.dart';

/// Les prospects du Grand Public : retrouver une fiche ou en saisir une.
class GrandPublicFichesScreen extends ConsumerWidget {
  const GrandPublicFichesScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final AsyncValue<List<ProspectSyncViewData>> prospects = ref.watch(
      grandPublicProspectListProvider,
    );
    final AsyncValue<int> count = ref.watch(grandPublicProspectCountProvider);
    final String search = ref.watch(historiqueSearchProvider);

    return CpiScaffold(
      title: 'Fiches',
      subtitle: 'Prospects hors CHUES',
      actions: <Widget>[
        CpiHeaderAction(
          icon: PhosphorIconsRegular.userPlus,
          label: 'Nouveau prospect',
          onPressed: () => context.push(Routes.grandPublicNew).ignore(),
        ),
      ],
      banner: const PendingBanner(),
      body: prospects.whenEchecDAbord(
        loading: () => const Center(
          child: FCircularProgress(semanticsLabel: 'Chargement'),
        ),
        error: (Object error, StackTrace _) => CpiErrorState(
          message:
              'La liste des prospects n\'a pas pu être lue. '
              '${messageErreur(error)}',
          onRetry: () => ref.invalidate(grandPublicProspectListProvider),
        ),
        data: (List<ProspectSyncViewData> rows) => ListView.builder(
          padding: const EdgeInsets.only(bottom: CpiSpacing.xxl),
          itemCount: rows.isEmpty ? 2 : rows.length + 1,
          itemBuilder: (BuildContext context, int index) {
            if (index == 0) {
              return Padding(
                padding: const EdgeInsets.fromLTRB(
                  CpiSpacing.md,
                  0,
                  CpiSpacing.md,
                  CpiSpacing.sm,
                ),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.stretch,
                  children: <Widget>[
                    Text(
                      count.when(
                        data: (int value) =>
                            '$value prospect${value > 1 ? 's' : ''}',
                        loading: () => 'Prospects',
                        error: (Object _, StackTrace _) => 'Prospects',
                      ),
                      style: Theme.of(context).textTheme.titleMedium,
                    ),
                    const SizedBox(height: CpiSpacing.sm),
                    CpiSearchField(
                      initial: ref.read(historiqueSearchProvider),
                      onChanged: ref
                          .read(historiqueSearchProvider.notifier)
                          .set,
                    ),
                  ],
                ),
              );
            }
            if (rows.isEmpty) {
              return _Empty(searching: search.trim().isNotEmpty);
            }
            // Les gouttières de la page valent aussi pour les lignes : une
            // liste collée aux bords de l'écran n'a pas l'air d'appartenir à
            // ce qui la surmonte.
            return Padding(
              padding: const EdgeInsets.fromLTRB(
                CpiSpacing.md,
                0,
                CpiSpacing.md,
                CpiSpacing.xs,
              ),
              child: ProspectTile(
                key: ValueKey<String>(rows[index - 1].id),
                prospect: rows[index - 1],
              ),
            );
          },
        ),
      ),
    );
  }
}

/// Une ligne, un tap, la fiche. Le nom tient sur deux lignes, l'état passe sous
/// le numéro : en pastille de droite, il rognait la moitié de la largeur
/// disponible pour le nom.
class ProspectTile extends StatelessWidget {
  const ProspectTile({super.key, required this.prospect});

  final ProspectSyncViewData prospect;

  @override
  Widget build(BuildContext context) {
    final ThemeData theme = Theme.of(context);
    final ColorScheme scheme = theme.colorScheme;
    final String name = '${prospect.prenom} ${prospect.nom}'.trim();
    final String phone = Phone.format(prospect.phoneE164);
    final SyncStatus status = SyncStatus.parse(prospect.syncStatus ?? 'draft');
    final String? signal = status.aSignaler;

    void ouvrir() {
      HapticFeedback.selectionClick().ignore();
      context.push(Routes.prospectDetailFor(prospect.id)).ignore();
    }

    return Semantics(
      button: true,
      onTap: ouvrir,
      label: signal == null ? '$name. $phone.' : '$name. $phone. $signal.',
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
                      name,
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
                    if (signal != null) ...<Widget>[
                      const SizedBox(height: CpiSpacing.xs),
                      CpiTag(
                        signal,
                        tone: status.needsAttention
                            ? CpiTone.danger
                            : CpiTone.warning,
                      ),
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

class _Empty extends StatelessWidget {
  const _Empty({required this.searching});

  final bool searching;

  @override
  Widget build(BuildContext context) => CpiEmptyState(
    icon: searching
        ? PhosphorIconsDuotone.magnifyingGlass
        : PhosphorIconsDuotone.usersThree,
    title: searching ? 'Aucun résultat' : 'Aucun prospect',
    message: searching
        ? 'Vérifiez le nom ou le numéro, ou effacez la recherche.'
        : 'Ajoutez le premier prospect depuis le bouton en haut de l’écran.',
  );
}

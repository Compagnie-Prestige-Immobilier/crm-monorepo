import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:forui/forui.dart';
import 'package:phosphor_flutter/phosphor_flutter.dart';

import '../../../core/providers/app_providers.dart';
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
import '../../../ui/widgets/cpi_pressable.dart';
import '../../../ui/widgets/search_field.dart';
import '../../../ui/widgets/sync_status_icon.dart';
import '../../../ui/async_value_x.dart';
import 'representant_detail_screen.dart' show StatutTag;

class RepresentantPickerScreen extends ConsumerStatefulWidget {
  const RepresentantPickerScreen({super.key, this.pourQualifier = false});

  /// Consigner l'appel d'un représentant plutôt que saisir un prospect : c'est
  /// le chemin quand aucune liste d'appel n'a été confiée.
  final bool pourQualifier;

  @override
  ConsumerState<RepresentantPickerScreen> createState() =>
      _RepresentantPickerScreenState();
}

class _RepresentantPickerScreenState
    extends ConsumerState<RepresentantPickerScreen> {
  void _setSearch(String value) {
    ref.read(representantPickerSearchProvider.notifier).set(value);
  }

  @override
  Widget build(BuildContext context) {
    final AsyncValue<List<RepresentantSyncViewData>> rows = ref.watch(
      representantPickerListProvider,
    );
    final String search = ref.watch(representantPickerSearchProvider);
    final Map<String, String> departements = <String, String>{
      for (final Departement d
          in ref.watch(departementsProvider(null)).value ?? const [])
        d.id: d.name,
    };

    return CpiPopScope(
      child: CpiScaffold(
        title: widget.pourQualifier
            ? 'Qui avez-vous appelé ?'
            : 'Quel représentant ?',
        subtitle: widget.pourQualifier
            ? 'Cherchez son nom ou son numéro.'
            : 'Facultatif. Choisissez-le s’il vous a donné ce contact.',
        leading: const CpiBackButton(),
        footer: widget.pourQualifier
            ? null
            : CpiActionBar(
                child: CpiButton(
                  'Continuer sans représentant',
                  onPressed: () => context.pushOnce(Routes.newProspect),
                ),
              ),
        body: Column(
          children: <Widget>[
            Padding(
              padding: const EdgeInsets.fromLTRB(
                CpiSpacing.md,
                0,
                CpiSpacing.md,
                CpiSpacing.sm,
              ),
              child: CpiSearchField(
                initial: ref.read(representantPickerSearchProvider),
                onChanged: _setSearch,
              ),
            ),
            Expanded(
              child: rows.whenEchecDAbord(
                loading: () => const Center(child: FCircularProgress()),
                error: (Object e, StackTrace _) => CpiErrorState(
                  message:
                      'La liste des représentants n\'a pas pu être lue. '
                      '${messageErreur(e)}',
                  onRetry: () => ref.invalidate(representantPickerListProvider),
                ),
                data: (List<RepresentantSyncViewData> list) {
                  if (list.isEmpty) {
                    return _Empty(
                      query: search.trim(),
                      borne: ref.watch(perimetreBorneProvider).value ?? false,
                    );
                  }
                  return Column(
                    crossAxisAlignment: CrossAxisAlignment.stretch,
                    children: <Widget>[
                      _Compteur(nombre: list.length),
                      Expanded(
                        child: ListView.builder(
                          padding: const EdgeInsets.fromLTRB(
                            CpiSpacing.md,
                            0,
                            CpiSpacing.md,
                            CpiSpacing.xs,
                          ),
                          itemCount: list.length,
                          itemBuilder: (BuildContext context, int index) =>
                              CpiListEntrance(
                                index: index,
                                child: Padding(
                                  padding: const EdgeInsets.only(
                                    bottom: CpiSpacing.sm,
                                  ),
                                  child: _RepresentantRow(
                                    data: list[index],
                                    departement:
                                        departements[list[index].departementId],
                                    pourQualifier: widget.pourQualifier,
                                  ),
                                ),
                              ),
                        ),
                      ),
                    ],
                  );
                },
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class _Compteur extends StatelessWidget {
  const _Compteur({required this.nombre});

  final int nombre;

  @override
  Widget build(BuildContext context) => Padding(
    padding: const EdgeInsets.fromLTRB(
      CpiSpacing.md,
      0,
      CpiSpacing.md,
      CpiSpacing.xs,
    ),
    child: Text(
      nombre == 1 ? '1 représentant' : '$nombre représentants',
      style: Theme.of(context).textTheme.labelLarge?.copyWith(
        color: Theme.of(context).colorScheme.onSurfaceVariant,
      ),
    ),
  );
}

/// Un tap, une chose : la ligne emmène saisir le prospect que ce représentant
/// a donné, ou consigner l'appel qu'on vient de lui passer. La fiche complète
/// s'ouvre depuis « Mes fiches ».
class _RepresentantRow extends StatelessWidget {
  const _RepresentantRow({
    required this.data,
    this.departement,
    this.pourQualifier = false,
  });

  final RepresentantSyncViewData data;
  final String? departement;
  final bool pourQualifier;

  @override
  Widget build(BuildContext context) {
    final SyncStatus status = SyncStatus.parse(data.syncStatus ?? 'draft');
    final String subtitle = departement == null
        ? Phone.format(data.phoneE164)
        : '${Phone.format(data.phoneE164)} · $departement';

    final String? signal = status.aSignaler;
    return CpiCard.rows(<CpiRow>[
      CpiRow(
        leading: signal == null
            ? null
            : SyncStatusIcon(
                status: status,
                size: CpiIconSize.md,
                labelled: false,
              ),
        title: data.fullName,
        subtitle: subtitle,
        trailing: signal == null
            ? StatutTag(
                relationStatus: data.relationStatus,
                statutLabel: data.statutQualificationLabel,
                statutEffect: data.statutQualificationEffect,
                lastCallOutcome: data.lastCallOutcome,
              )
            : CpiTag(signal, tone: status.tone),
        // Les deux chemins passent par l'appel : celui qui vient de donner ses
        // contacts a bien decroche, et son appel se consignait nulle part.
        onTap: () => context.pushOnce(
          Routes.representantQualificationFor(
            data.id,
            puisProspects: !pourQualifier,
          ),
        ),
      ),
    ]);
  }
}

/// Aucune création ici : la base des représentants est importée depuis le web.
class _Empty extends StatelessWidget {
  const _Empty({required this.query, this.borne = false});

  final String query;

  /// Le compte ne voit que les fiches de ses campagnes : dire « vérifiez le
  /// nom » laisserait chercher une fiche que la recherche ne rendra jamais.
  final bool borne;

  @override
  Widget build(BuildContext context) {
    if (query.isEmpty || borne) {
      return const CpiEmptyState(
        icon: PhosphorIconsDuotone.usersThree,
        title: 'Aucune fiche dans vos campagnes.',
        message:
            'La liste se remplit quand une campagne vous attribue des numéros.',
      );
    }
    return const CpiEmptyState(
      icon: PhosphorIconsDuotone.magnifyingGlass,
      title: 'Aucun résultat',
      message: 'Vérifiez le nom ou le numéro.',
    );
  }
}

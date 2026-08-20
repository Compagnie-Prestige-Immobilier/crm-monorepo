import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:phosphor_flutter/phosphor_flutter.dart';

import '../../../core/providers/app_providers.dart';
import '../../../core/router/back_navigation.dart';
import '../../../core/router/route_paths.dart';
import '../../../core/router/single_push.dart';
import '../../../core/theme/cpi_colors.dart';
import '../../../core/theme/cpi_tokens.dart';
import '../../../core/utils/phone.dart';
import '../../../data/local/database.dart';
import '../../../ui/widgets/cpi_pressable.dart';
import '../../../ui/widgets/offline_indicator.dart';
import '../../../ui/widgets/search_field.dart';
import '../../../ui/widgets/sync_status_icon.dart';

class RepresentantPickerScreen extends ConsumerStatefulWidget {
  const RepresentantPickerScreen({super.key});

  @override
  ConsumerState<RepresentantPickerScreen> createState() =>
      _RepresentantPickerScreenState();
}

class _RepresentantPickerScreenState extends ConsumerState<RepresentantPickerScreen> {
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
      for (final Departement d in ref.watch(departementsProvider(null)).value ?? const [])
        d.id: d.name,
    };

    return CpiPopScope(
      child: Scaffold(
        appBar: AppBar(
          title: const Text('Choisir un représentant'),
          leading: const CpiBackButton(),
          actions: const <Widget>[OfflineIndicator(), SizedBox(width: CpiSpacing.xs)],
        ),
        body: SafeArea(
          child: Column(
            children: <Widget>[
              Padding(
                padding: const EdgeInsets.fromLTRB(
                  CpiSpacing.md,
                  CpiSpacing.sm,
                  CpiSpacing.md,
                  CpiSpacing.sm,
                ),
                child: CpiSearchField(
                  initial: ref.read(representantPickerSearchProvider),
                  onChanged: _setSearch,
                ),
              ),
              Expanded(
                child: rows.when(
                  loading: () => const Center(child: CircularProgressIndicator()),
                  error: (Object e, StackTrace _) =>
                      Center(child: Text('Lecture impossible : $e')),
                  data: (List<RepresentantSyncViewData> list) {
                    if (list.isEmpty) {
                      return _Empty(searching: search.trim().isNotEmpty);
                    }
                    return ListView.separated(
                      padding: const EdgeInsets.only(bottom: CpiSpacing.xs),
                      itemCount: list.length,
                      separatorBuilder: (BuildContext context, int index) =>
                          const Divider(
                            height: 1,
                            indent: CpiSpacing.md,
                            endIndent: CpiSpacing.md,
                          ),
                      itemBuilder: (BuildContext context, int index) => CpiListEntrance(
                        index: index,
                        child: _RepresentantRow(
                          data: list[index],
                          departement: departements[list[index].departementId],
                        ),
                      ),
                    );
                  },
                ),
              ),
              _CreateBar(query: search),
            ],
          ),
        ),
      ),
    );
  }
}

class _RepresentantRow extends StatelessWidget {
  const _RepresentantRow({required this.data, this.departement});

  final RepresentantSyncViewData data;
  final String? departement;

  @override
  Widget build(BuildContext context) {
    final ThemeData theme = Theme.of(context);
    final SyncStatus status = SyncStatus.parse(data.syncStatus ?? 'draft');
    final String subtitle = departement == null
        ? Phone.format(data.phoneE164)
        : '${Phone.format(data.phoneE164)} · $departement';

    void openDetail() {
      unawaited(HapticFeedback.selectionClick());
      context.pushOnce(Routes.representantDetailFor(data.id));
    }

    return Row(
      children: <Widget>[
        Expanded(
          child: Semantics(
            button: true,
            label: '${data.fullName}, $subtitle. Compléter la fiche.',
            child: ExcludeSemantics(
              child: InkWell(
                // Les fiches sont importées : choisir mène au formulaire
                // prérempli, jamais directement aux prospects.
                onTap: () {
                  unawaited(HapticFeedback.selectionClick());
                  context.pushOnce(Routes.representantFormFor(data.id));
                },
                onLongPress: openDetail,
                child: ConstrainedBox(
                  constraints: const BoxConstraints(
                    minHeight: kCpiMinTouchTarget + 12,
                  ),
                  child: Padding(
                    padding: const EdgeInsets.fromLTRB(
                      CpiSpacing.md,
                      CpiSpacing.sm,
                      CpiSpacing.xs,
                      CpiSpacing.sm,
                    ),
                    child: Row(
                      children: <Widget>[
                        SyncStatusIcon(status: status, size: 20),
                        const SizedBox(width: CpiSpacing.sm),
                        Expanded(
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            mainAxisSize: MainAxisSize.min,
                            children: <Widget>[
                              Text(data.fullName, style: theme.textTheme.titleSmall),
                              const SizedBox(height: 2),
                              Text(
                                subtitle,
                                style: theme.textTheme.bodySmall?.copyWith(
                                  color: theme.colorScheme.onSurfaceVariant,
                                ),
                              ),
                            ],
                          ),
                        ),
                        Icon(
                          PhosphorIconsRegular.pencilSimple,
                          size: 20,
                          color: context.cpi.accentText,
                        ),
                      ],
                    ),
                  ),
                ),
              ),
            ),
          ),
        ),
        IconButton(
          tooltip: 'Ouvrir la fiche',
          onPressed: openDetail,
          icon: const Icon(PhosphorIconsRegular.caretRight, size: 20),
        ),
        const SizedBox(width: CpiSpacing.xxs),
      ],
    );
  }
}

class _CreateBar extends StatelessWidget {
  const _CreateBar({required this.query});

  final String query;

  @override
  Widget build(BuildContext context) {
    final ThemeData theme = Theme.of(context);
    return Container(
      width: double.infinity,
      padding: const EdgeInsets.fromLTRB(
        CpiSpacing.md,
        CpiSpacing.xs,
        CpiSpacing.md,
        CpiSpacing.sm,
      ),
      decoration: BoxDecoration(
        color: theme.colorScheme.surface,
        border: Border(top: BorderSide(color: context.cpi.borderSubtle)),
      ),
      child: OutlinedButton.icon(
        onPressed: () {
          unawaited(HapticFeedback.selectionClick());
          context.pushOnce(Routes.newRepresentantPrefilled(query));
        },
        icon: const Icon(PhosphorIconsRegular.plus, size: 20),
        label: const Text('Nouveau représentant'),
      ),
    );
  }
}

class _Empty extends StatelessWidget {
  const _Empty({required this.searching});

  final bool searching;

  @override
  Widget build(BuildContext context) {
    final ThemeData theme = Theme.of(context);
    return Center(
      child: Padding(
        padding: const EdgeInsets.all(CpiSpacing.xl),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: <Widget>[
            Icon(
              searching
                  ? PhosphorIconsDuotone.magnifyingGlass
                  : PhosphorIconsDuotone.usersThree,
              size: 56,
              color: theme.colorScheme.onSurfaceVariant,
            ),
            const SizedBox(height: CpiSpacing.md),
            Text(
              searching ? 'Aucun résultat' : 'Aucun représentant',
              style: theme.textTheme.titleSmall,
              textAlign: TextAlign.center,
            ),
            const SizedBox(height: CpiSpacing.xs),
            Text(
              searching
                  ? 'Vérifiez le nom ou le numéro, ou créez la fiche.'
                  : 'Créez une première fiche pour commencer à saisir des prospects.',
              style: theme.textTheme.bodyMedium?.copyWith(
                color: theme.colorScheme.onSurfaceVariant,
              ),
              textAlign: TextAlign.center,
            ),
          ],
        ),
      ),
    );
  }
}

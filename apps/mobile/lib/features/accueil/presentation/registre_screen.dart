import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:phosphor_flutter/phosphor_flutter.dart';

import '../../../core/providers/app_providers.dart';
import '../../../core/providers/sync_coordinator.dart';
import '../../../core/router/route_paths.dart';
import '../../../core/theme/cpi_colors.dart';
import '../../../core/theme/cpi_tokens.dart';
import '../../../data/repositories/visites_repository.dart';
import '../../../ui/async_value_x.dart';
import '../../../ui/widgets/cpi_action_bar.dart';
import '../../../ui/widgets/cpi_pressable.dart';
import '../../../ui/widgets/empty_state.dart';
import '../../../ui/widgets/error_state.dart';
import '../../../ui/widgets/offline_indicator.dart';
import '../../../ui/widgets/search_field.dart';
import '../../../ui/widgets/sync_badge.dart';
import '../../../ui/widgets/sync_status_icon.dart';
import '../../auth/auth_state.dart';
import '../visites_repository.dart';
import 'acces_refuse.dart';

class RegistreScreen extends ConsumerWidget {
  const RegistreScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final ThemeData theme = Theme.of(context);
    final AuthState auth = ref.watch(authControllerProvider);

    if (!peutTenirLeRegistre(auth.role)) {
      return const AccesRefuse(title: 'Registre des visites');
    }

    final AsyncValue<VisitesPage> page = ref.watch(registreProvider);
    final String search = ref.watch(registreSearchProvider);

    return Scaffold(
      appBar: AppBar(
        leading: IconButton(
          icon: const Icon(PhosphorIconsRegular.squaresFour),
          tooltip: 'Projets',
          onPressed: () => context.go(Routes.home),
        ),
        title: const Text('Registre des visites'),
        actions: <Widget>[
          IconButton(
            icon: const Icon(PhosphorIconsRegular.chartBar),
            tooltip: 'Les chiffres',
            onPressed: () => context.push<void>(Routes.accueilChiffres),
          ),
          const OfflineIndicator(),
          const SyncBadge(),
          const SizedBox(width: CpiSpacing.xs),
        ],
      ),
      body: SafeArea(
        child: Column(
          children: <Widget>[
            Padding(
              padding: const EdgeInsets.fromLTRB(
                CpiSpacing.md,
                CpiSpacing.sm,
                CpiSpacing.md,
                CpiSpacing.xs,
              ),
              child: CpiSearchField(
                initial: search,
                hintText: 'Nom, entreprise, référence, téléphone',
                onChanged: ref.read(registreSearchProvider.notifier).set,
              ),
            ),
            const Padding(
              padding: EdgeInsets.symmetric(horizontal: CpiSpacing.md),
              child: _PeriodeChips(),
            ),
            const SizedBox(height: CpiSpacing.xs),
            Expanded(
              child: page.whenEchecDAbord(
                loading: () => const _RegistreEnCours(),
                error: (Object error, StackTrace _) => CpiErrorState(
                  message:
                      'Le registre n\'a pas pu être lu. ${messageErreur(error)}',
                  onRetry: () => ref.invalidate(registreProvider),
                ),
                data: (VisitesPage value) => RefreshIndicator(
                  color: theme.colorScheme.primary,
                  onRefresh: () async {
                    final SyncCoordinator sync = ref.read(
                      syncCoordinatorProvider.notifier,
                    );
                    await HapticFeedback.selectionClick();
                    await sync.run();
                  },
                  child: value.items.isEmpty
                      ? ListView(
                          physics: const AlwaysScrollableScrollPhysics(),
                          children: <Widget>[
                            _RegistreVide(searching: search.trim().isNotEmpty),
                          ],
                        )
                      : ListView.builder(
                          padding: const EdgeInsets.fromLTRB(
                            CpiSpacing.md,
                            0,
                            CpiSpacing.md,
                            CpiSpacing.md,
                          ),
                          physics: const AlwaysScrollableScrollPhysics(),
                          itemCount:
                              value.items.length +
                              1 +
                              (value.truncated ? 1 : 0),
                          itemBuilder: (BuildContext context, int index) {
                            if (index == 0) {
                              return Padding(
                                padding: const EdgeInsets.symmetric(
                                  vertical: CpiSpacing.xs,
                                ),
                                child: _Compte(nombre: value.items.length),
                              );
                            }
                            if (value.truncated && index == 1) {
                              return const Padding(
                                padding: EdgeInsets.only(bottom: CpiSpacing.xs),
                                child: _RegistreTronque(),
                              );
                            }
                            final int rang =
                                index - 1 - (value.truncated ? 1 : 0);
                            return Padding(
                              padding: const EdgeInsets.only(
                                bottom: CpiSpacing.xs,
                              ),
                              child: CpiListEntrance(
                                index: rang,
                                child: _LigneVisite(visite: value.items[rang]),
                              ),
                            );
                          },
                        ),
                ),
              ),
            ),
            CpiActionBar(
              child: FilledButton.icon(
                onPressed: () {
                  HapticFeedback.selectionClick().ignore();
                  // Par le routeur, pas par `Navigator` : c'est ce qui rend le
                  // formulaire mémorisable et son brouillon restaurable.
                  context.push<void>(Routes.accueilVisiteNew).ignore();
                },
                icon: const Icon(
                  PhosphorIconsRegular.userPlus,
                  size: CpiIconSize.lg,
                ),
                label: const Text('Inscrire un visiteur'),
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class _PeriodeChips extends ConsumerWidget {
  const _PeriodeChips();

  static const Map<PeriodeRegistre, String> _libelles =
      <PeriodeRegistre, String>{
        PeriodeRegistre.jour: 'Aujourd\'hui',
        PeriodeRegistre.semaine: '7 jours',
        PeriodeRegistre.mois: '30 jours',
        PeriodeRegistre.tout: 'Tout',
      };

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final PeriodeRegistre courante = ref.watch(registrePeriodeProvider);
    return Wrap(
      spacing: CpiSpacing.xs,
      runSpacing: CpiSpacing.xs,
      children: _libelles.entries
          .map(
            (MapEntry<PeriodeRegistre, String> e) => ChoiceChip(
              label: Text(e.value),
              selected: courante == e.key,
              onSelected: (bool choisi) {
                if (!choisi) return;
                ref.read(registrePeriodeProvider.notifier).set(e.key);
              },
              padding: const EdgeInsets.symmetric(
                horizontal: CpiSpacing.sm,
                vertical: CpiSpacing.xs,
              ),
            ),
          )
          .toList(growable: false),
    );
  }
}

class _Compte extends StatelessWidget {
  const _Compte({required this.nombre});

  final int nombre;

  @override
  Widget build(BuildContext context) {
    return Text(
      nombre == 1 ? '1 visite' : '$nombre visites',
      style: Theme.of(context).textTheme.titleMedium,
    );
  }
}

class _RegistreTronque extends StatelessWidget {
  const _RegistreTronque();

  @override
  Widget build(BuildContext context) {
    return Text(
      'Les ${VisitesRepository.registreRowCap} visites les plus récentes '
      'sont affichées. Affinez la période ou la recherche pour voir les autres.',
      style: Theme.of(context).textTheme.bodySmall?.copyWith(
        color: Theme.of(context).colorScheme.onSurfaceVariant,
      ),
    );
  }
}

String _texteEnvoi(SyncStatus statut) => switch (statut) {
  SyncStatus.conflict => 'Conflit à résoudre',
  SyncStatus.failed => 'Échec d\'envoi',
  SyncStatus.syncing => 'Envoi en cours',
  _ => 'En attente d\'envoi',
};

class _LigneVisite extends StatelessWidget {
  const _LigneVisite({required this.visite});

  final VisiteAvecStatut visite;

  @override
  Widget build(BuildContext context) {
    final ThemeData theme = Theme.of(context);
    final String heure = visite.time ?? '--:--';
    final List<String> details = <String>[
      visite.entrepriseLabel,
      visite.objetLabel,
      if (visite.destinataireLabel != null) visite.destinataireLabel!,
      if (visite.directionLabel != null) visite.directionLabel!,
    ];

    return Container(
      padding: const EdgeInsets.all(CpiSpacing.sm),
      decoration: BoxDecoration(
        color: theme.colorScheme.surfaceContainerLowest,
        borderRadius: CpiRadius.brLg,
        border: Border.all(color: context.cpi.borderSubtle),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        mainAxisSize: MainAxisSize.min,
        children: <Widget>[
          Row(
            crossAxisAlignment: CrossAxisAlignment.baseline,
            textBaseline: TextBaseline.alphabetic,
            children: <Widget>[
              Text(heure, style: theme.textTheme.titleMedium),
              const SizedBox(width: CpiSpacing.xs),
              Expanded(
                child: Text(
                  visite.reference ?? _texteEnvoi(visite.syncStatus),
                  textAlign: TextAlign.end,
                  style: theme.textTheme.bodySmall?.copyWith(
                    color: theme.colorScheme.onSurfaceVariant,
                  ),
                ),
              ),
            ],
          ),
          const SizedBox(height: CpiSpacing.xxs),
          Text(visite.visitorName, style: theme.textTheme.titleMedium),
          const SizedBox(height: CpiSpacing.xxs),
          Text(
            details.join(' · '),
            style: theme.textTheme.bodyMedium?.copyWith(
              color: theme.colorScheme.onSurfaceVariant,
            ),
          ),
          if (visite.phone != null) ...<Widget>[
            const SizedBox(height: CpiSpacing.xxs),
            Text(visite.phone!, style: theme.textTheme.bodyMedium),
          ],
        ],
      ),
    );
  }
}

class _RegistreVide extends StatelessWidget {
  const _RegistreVide({required this.searching});

  final bool searching;

  @override
  Widget build(BuildContext context) => searching
      ? const CpiEmptyState(
          icon: PhosphorIconsDuotone.magnifyingGlass,
          title: 'Aucun résultat',
          message:
              'Vérifiez le nom, l\'entreprise ou le numéro, ou changez de période.',
        )
      : const CpiEmptyState(
          icon: PhosphorIconsDuotone.clipboardText,
          title: 'Aucune visite pour cette période',
          message: 'Inscrivez le premier visiteur avec le bouton du bas.',
        );
}

class _RegistreEnCours extends StatelessWidget {
  const _RegistreEnCours();

  @override
  Widget build(BuildContext context) {
    return const Padding(
      padding: EdgeInsets.symmetric(vertical: CpiSpacing.xxl),
      child: Center(child: CircularProgressIndicator()),
    );
  }
}

import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:forui/forui.dart';
import 'package:go_router/go_router.dart';
import 'package:phosphor_flutter/phosphor_flutter.dart';

import '../../../core/providers/app_providers.dart';
import '../../../core/providers/connectivity.dart';
import '../../../core/providers/sync_coordinator.dart';
import '../../../core/router/route_paths.dart';
import '../../shell/projects.dart';
import '../../shell/workspace_switch.dart';
import '../../../core/theme/cpi_tokens.dart';
import '../../../data/repositories/visites_repository.dart';
import '../../../ui/async_value_x.dart';
import '../../../ui/widgets/cpi_action_bar.dart';
import '../../../ui/widgets/cpi_kit.dart';
import '../../../ui/widgets/empty_state.dart';
import '../../../ui/widgets/error_state.dart';
import '../../../ui/widgets/search_field.dart';
import '../../../ui/widgets/sync_status_icon.dart';
import '../../auth/auth_state.dart';
import '../visites_repository.dart';
import 'acces_refuse.dart';
import 'correction_visite_sheet.dart';

class RegistreScreen extends ConsumerWidget {
  const RegistreScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final AuthState auth = ref.watch(authControllerProvider);

    if (!peutTenirLeRegistre(auth.role)) {
      return const AccesRefuse(title: 'Registre');
    }

    final AsyncValue<VisitesPage> page = ref.watch(registreProvider);
    final String search = ref.watch(registreSearchProvider);
    final PeriodeRegistre periode = ref.watch(registrePeriodeProvider);

    return CpiScaffold(
      title: 'Registre',
      leading: const CpiWorkspaceSwitch(
        key: Key('Projets'),
        current: CpiProject.accueil,
      ),
      // Les chiffres ont leur onglet : une icône d'en-tête en plus offrirait
      // deux portes pour la même pièce.
      banner: const _BandeDesEnvois(),
      footer: CpiActionBar(
        child: CpiButton(
          'Inscrire un visiteur',
          icon: PhosphorIconsRegular.userPlus,
          onPressed: () async {
            // Par le routeur, pas par `Navigator` : c'est ce qui rend le
            // formulaire mémorisable et son brouillon restaurable.
            await context.push<void>(Routes.accueilVisiteNew);
            // La recherche a la portée de l'application : au retour du
            // formulaire, elle cacherait la visite qu'on vient d'inscrire.
            viderRechercheRegistre(ref);
          },
        ),
      ),
      // Recherche, puces et lignes dans le MÊME défilement : au-dessus d'une
      // liste, elles poussaient le corps hors de l'écran au grand texte.
      // Le `Builder` n'est pas décoratif : les messages de l'écran se disent
      // sous le `FToaster` que `CpiScaffold` installe, donc sous ce contexte-ci
      // et non celui de `build`.
      body: Builder(
        builder: (BuildContext toaster) => RefreshIndicator(
          color: Theme.of(context).colorScheme.primary,
          onRefresh: () async {
            final SyncCoordinator sync = ref.read(
              syncCoordinatorProvider.notifier,
            );
            await HapticFeedback.selectionClick();
            await sync.run();
          },
          child: CustomScrollView(
            physics: const AlwaysScrollableScrollPhysics(),
            slivers: <Widget>[
              SliverPadding(
                padding: const EdgeInsets.fromLTRB(
                  CpiSpacing.md,
                  0,
                  CpiSpacing.md,
                  CpiSpacing.sm,
                ),
                // Hors des branches asynchrones : la recherche garde son
                // élément, donc son focus, quand la liste se recharge.
                sliver: SliverToBoxAdapter(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.stretch,
                    children: <Widget>[
                      CpiSearchField(
                        // Le champ ne se relit pas : remonté, il repart du
                        // fournisseur, c'est-à-dire vide.
                        key: ValueKey<int>(
                          ref.watch(registreSearchResetProvider),
                        ),
                        initial: search,
                        hintText: 'Nom, société, n° de registre',
                        onChanged: ref
                            .read(registreSearchProvider.notifier)
                            .set,
                      ),
                      const SizedBox(height: CpiSpacing.sm),
                      const _PeriodeChips(),
                    ],
                  ),
                ),
              ),
              page.whenEchecDAbord(
                loading: () =>
                    const SliverToBoxAdapter(child: _RegistreEnCours()),
                // En adaptateur et non en `SliverFillRemaining` : ces deux blocs
                // mesurent leur contenu, et un remplissage leur demanderait une
                // hauteur intrinsèque qu'un `LayoutBuilder` ne sait pas donner.
                error: (Object error, StackTrace _) => SliverToBoxAdapter(
                  child: CpiErrorState(
                    message:
                        'Le registre n\'a pas pu être lu. ${messageErreur(error)}',
                    onRetry: () => ref.invalidate(registreProvider),
                  ),
                ),
                data: (VisitesPage value) => value.items.isEmpty
                    ? SliverToBoxAdapter(
                        child: _RegistreVide(
                          searching: search.trim().isNotEmpty,
                          onEffacer: () => viderRechercheRegistre(ref),
                        ),
                      )
                    // La ligne corrigée disparaît de la liste : le compte rendu
                    // se dit depuis un contexte qui, lui, reste monté.
                    : _Liste(
                        page: value,
                        search: search,
                        periode: periode,
                        toaster: toaster,
                      ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

/// L'état des envois, en haut du corps : le pied reste à la seule action.
class _BandeDesEnvois extends ConsumerWidget {
  const _BandeDesEnvois();

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final int enAttente = ref.watch(pendingSyncCountProvider).value ?? 0;
    final int bloquees = ref.watch(blockedSyncCountProvider).value ?? 0;
    if (enAttente == 0 && bloquees == 0) return const SizedBox.shrink();

    final Widget bande;
    if (enAttente == 0) {
      // Aucun envoi ne les débloquera : le dire, et emmener là où elles se
      // rattrapent, plutôt qu'un « Réessayer » qui ne change rien.
      bande = CpiStatusBand(
        text:
            '${bloquees > 1 ? '$bloquees saisies refusées' : '1 saisie refusée'} '
            'par le serveur.',
        tone: CpiTone.danger,
        actionLabel: 'Voir',
        onAction: () => context.go(Routes.accueilCorrections),
      );
    } else {
      final SyncCoordinator envois = ref.read(syncCoordinatorProvider.notifier);
      final SyncUiState sync = ref.watch(syncCoordinatorProvider);
      final bool horsLigne =
          ref.watch(connectivityProvider) != CpiConnectivity.online;
      final String fiches = enAttente > 1
          ? '$enAttente fiches'
          : '$enAttente fiche';
      final String? echec = sync.failureLabel;

      if (horsLigne) {
        bande = CpiStatusBand(
          text: 'Hors ligne. Pas encore envoyé : $fiches.',
          tone: CpiTone.warning,
        );
      } else if (sync.running) {
        bande = CpiStatusBand(text: 'Envoi en cours : $fiches.');
      } else if (echec != null) {
        bande = CpiStatusBand(
          text: 'Pas encore envoyé : $fiches. $echec',
          tone: CpiTone.danger,
          actionLabel: 'Réessayer',
          onAction: () => envois.nudge(),
        );
      } else {
        bande = CpiStatusBand(
          text: 'Pas encore envoyé : $fiches.',
          tone: CpiTone.warning,
          actionLabel: 'Envoyer maintenant',
          onAction: () => envois.nudge(),
        );
      }
    }

    return Padding(
      padding: const EdgeInsets.fromLTRB(
        CpiSpacing.md,
        0,
        CpiSpacing.md,
        CpiSpacing.sm,
      ),
      child: bande,
    );
  }
}

class _Liste extends StatelessWidget {
  const _Liste({
    required this.page,
    required this.search,
    required this.periode,
    required this.toaster,
  });

  final VisitesPage page;
  final String search;
  final PeriodeRegistre periode;
  final BuildContext toaster;

  @override
  Widget build(BuildContext context) => SliverPadding(
    padding: const EdgeInsets.fromLTRB(
      CpiSpacing.md,
      0,
      CpiSpacing.md,
      CpiSpacing.md,
    ),
    sliver: SliverList.builder(
      itemCount: page.items.length + 1,
      itemBuilder: (BuildContext context, int index) {
        if (index == 0) {
          return _EnTeteDeListe(page: page, search: search, periode: periode);
        }
        final VisiteAvecStatut visite = page.items[index - 1];
        return Padding(
          padding: const EdgeInsets.only(bottom: CpiSpacing.sm),
          child: _LigneVisite(
            key: ValueKey<String>(visite.id),
            visite: visite,
            toaster: toaster,
          ),
        );
      },
    ),
  );
}

/// Ce que la liste montre, en toutes lettres : combien, et de quoi.
class _EnTeteDeListe extends ConsumerWidget {
  const _EnTeteDeListe({
    required this.page,
    required this.search,
    required this.periode,
  });

  final VisitesPage page;
  final String search;
  final PeriodeRegistre periode;

  static const Map<PeriodeRegistre, String> _fenetres =
      <PeriodeRegistre, String>{
        PeriodeRegistre.jour: 'aujourd\'hui',
        PeriodeRegistre.semaine: 'sur 7 jours',
        PeriodeRegistre.mois: 'sur 30 jours',
        PeriodeRegistre.tout: 'depuis le début',
      };

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final int total = page.items.length;
    final String motif = search.trim();
    final String fenetre = _fenetres[periode]!;
    final String titre = motif.isEmpty
        ? '$total ${total == 1 ? 'visite' : 'visites'} $fenetre'
        : '$total ${total == 1 ? 'résultat' : 'résultats'} pour '
              '« $motif » · $fenetre';

    return Padding(
      padding: const EdgeInsets.only(bottom: CpiSpacing.xs),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: <Widget>[
          Text(titre, style: Theme.of(context).textTheme.titleMedium),
          if (motif.isNotEmpty)
            CpiButton(
              'Tout afficher',
              variant: CpiButtonVariant.ghost,
              expand: false,
              onPressed: () => viderRechercheRegistre(ref),
            ),
          if (page.truncated) ...<Widget>[
            const SizedBox(height: CpiSpacing.xs),
            const _RegistreTronque(),
          ],
        ],
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
      children: <Widget>[
        for (final MapEntry<PeriodeRegistre, String> e in _libelles.entries)
          MergeSemantics(
            child: Semantics(
              selected: courante == e.key,
              child: CpiButton(
                e.value,
                expand: false,
                variant: courante == e.key
                    ? CpiButtonVariant.primary
                    : CpiButtonVariant.secondary,
                onPressed: () =>
                    ref.read(registrePeriodeProvider.notifier).set(e.key),
              ),
            ),
          ),
      ],
    );
  }
}

class _RegistreTronque extends ConsumerWidget {
  const _RegistreTronque();

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final ThemeData theme = Theme.of(context);
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: <Widget>[
        Text(
          'Seules les ${VisitesRepository.registreRowCap} visites les plus '
          'récentes sont affichées.',
          style: theme.textTheme.bodyMedium?.copyWith(
            color: theme.colorScheme.onSurfaceVariant,
          ),
        ),
        const SizedBox(height: CpiSpacing.xs),
        CpiButton(
          'Voir aujourd\'hui seulement',
          variant: CpiButtonVariant.secondary,
          onPressed: () => ref
              .read(registrePeriodeProvider.notifier)
              .set(PeriodeRegistre.jour),
        ),
      ],
    );
  }
}

CpiTone _tonEnvoi(SyncStatus statut) {
  if (statut == SyncStatus.synced) return CpiTone.success;
  return statut.needsAttention ? CpiTone.danger : CpiTone.neutral;
}

/// Une visite, empilée : à la taille de texte maximale, une rangée
/// heure + nom + état ne tient sur aucun téléphone de 320 dp.
///
/// Toucher la ligne ouvre sa correction : c'est le seul endroit d'où l'accueil
/// peut rattraper une entrée faite au vol.
class _LigneVisite extends ConsumerWidget {
  const _LigneVisite({super.key, required this.visite, required this.toaster});

  final VisiteAvecStatut visite;
  final BuildContext toaster;

  Future<void> _corriger(BuildContext context) async {
    final bool? corrigee = await ouvrirCorrectionVisite(context, visite);
    if (corrigee == true && toaster.mounted) {
      cpiToast(toaster, 'Visite corrigée.');
    }
  }

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final ThemeData theme = Theme.of(context);
    final Color discret = theme.colorScheme.onSurfaceVariant;
    // Société · vient voir · objet. L'étage ne prend la place du destinataire
    // que lorsqu'il n'y en a pas : sur une ligne, deux repères de lieu se
    // lisent comme une hésitation.
    final String details = <String>[
      visite.entrepriseLabel,
      if (visite.destinataireLabel != null)
        visite.destinataireLabel!
      else if (visite.directionLabel != null)
        visite.directionLabel!,
      visite.objetLabel,
    ].join(' · ');
    final String? phone = visite.phone;
    final String? reference = visite.reference;

    return CpiCard(
      onTap: () => unawaited(_corriger(context)),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: <Widget>[
          Text(
            visite.time ?? '--:--',
            style: theme.textTheme.labelLarge?.copyWith(color: discret),
          ),
          Text(visite.visitorName, style: theme.textTheme.titleMedium),
          const SizedBox(height: CpiSpacing.xxs),
          Text(
            details,
            style: theme.textTheme.bodyMedium?.copyWith(color: discret),
          ),
          if (phone != null)
            Text(
              phone,
              style: theme.textTheme.bodyMedium?.copyWith(color: discret),
            ),
          if (reference != null)
            Text(
              reference,
              style: theme.textTheme.bodyMedium?.copyWith(color: discret),
            ),
          const SizedBox(height: CpiSpacing.sm),
          CpiTag(visite.syncStatus.label, tone: _tonEnvoi(visite.syncStatus)),
        ],
      ),
    );
  }
}

class _RegistreVide extends StatelessWidget {
  const _RegistreVide({required this.searching, required this.onEffacer});

  final bool searching;
  final VoidCallback onEffacer;

  @override
  Widget build(BuildContext context) => searching
      ? CpiEmptyState(
          icon: PhosphorIconsDuotone.magnifyingGlass,
          title: 'Aucun résultat',
          message: 'Essayez un autre nom, ou changez de période.',
          action: CpiButton(
            'Effacer la recherche',
            variant: CpiButtonVariant.secondary,
            expand: false,
            onPressed: onEffacer,
          ),
        )
      : const CpiEmptyState(
          icon: PhosphorIconsDuotone.clipboardText,
          title: 'Aucune visite pour cette période',
          message: 'Touchez « Inscrire un visiteur ».',
        );
}

class _RegistreEnCours extends StatelessWidget {
  const _RegistreEnCours();

  @override
  Widget build(BuildContext context) {
    return const Padding(
      padding: EdgeInsets.symmetric(vertical: CpiSpacing.xxl),
      child: Center(child: FCircularProgress()),
    );
  }
}

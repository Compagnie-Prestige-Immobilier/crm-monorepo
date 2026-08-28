import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:phosphor_flutter/phosphor_flutter.dart';

import '../../../core/providers/app_providers.dart';
import '../../../core/router/route_paths.dart';
import '../../../core/theme/cpi_colors.dart';
import '../../../core/theme/cpi_tokens.dart';
import '../../../data/repositories/visites_repository.dart';
import '../../../ui/widgets/activity_chart.dart';
import '../../../ui/widgets/cpi_kit.dart';
import '../../../ui/widgets/empty_state.dart';
import '../../../ui/widgets/error_state.dart';
import '../../auth/auth_state.dart';
import '../visites_repository.dart';
import 'acces_refuse.dart';

class ChiffresScreen extends ConsumerWidget {
  const ChiffresScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final AuthState auth = ref.watch(authControllerProvider);
    if (!peutTenirLeRegistre(auth.role)) {
      return const AccesRefuse(title: 'Chiffres');
    }

    final AsyncValue<CompteursAccueil> compteurs = ref.watch(
      compteursAccueilProvider,
    );
    final AsyncValue<List<ActivityDay>> activite = ref.watch(
      activiteVisites7JoursProvider,
    );
    final AsyncValue<TopLabels> top = ref.watch(topLabelsVisitesProvider);
    final AsyncValue<HeureDePointe?> pointe = ref.watch(
      heureDePointeVisitesProvider,
    );
    final List<LabelCompte> recus =
        ref.watch(destinatairesDuJourProvider).value ?? const <LabelCompte>[];
    final int refusees = ref.watch(blockedSyncCountProvider).value ?? 0;
    final CompteursAccueil? total = compteurs.value;
    final bool aucuneVisite =
        total != null &&
        total.jour == 0 &&
        total.septJours == 0 &&
        total.enAttente == 0;

    // Chaque carte est un filtre du registre : elle y emmène, qu'on soit
    // arrivé ici par l'en-tête ou par une adresse restaurée.
    void ouvrirPeriode(PeriodeRegistre periode) {
      ref.read(registrePeriodeProvider.notifier).set(periode);
      context.go(Routes.accueil);
    }

    return CpiScaffold(
      title: 'Chiffres',
      body: (compteurs.error ?? activite.error) != null
          ? CpiErrorState(
              message:
                  'Les chiffres n\'ont pas pu être lus. '
                  '${messageErreur(compteurs.error ?? activite.error!)}',
              onRetry: () {
                ref.invalidate(compteursAccueilProvider);
                ref.invalidate(activiteVisites7JoursProvider);
                ref.invalidate(topLabelsVisitesProvider);
                ref.invalidate(heureDePointeVisitesProvider);
              },
            )
          : ListView(
              padding: const EdgeInsets.fromLTRB(
                CpiSpacing.md,
                0,
                CpiSpacing.md,
                CpiSpacing.xl,
              ),
              children: <Widget>[
                _Chiffre(
                  cle: 'chiffre-jour',
                  label: 'Visites aujourd\'hui',
                  valeur: total?.jour,
                  onTap: () => ouvrirPeriode(PeriodeRegistre.jour),
                ),
                const SizedBox(height: CpiSpacing.sm),
                _Chiffre(
                  cle: 'chiffre-semaine',
                  label: 'Visites sur 7 jours',
                  valeur: total?.septJours,
                  onTap: () => ouvrirPeriode(PeriodeRegistre.semaine),
                ),
                const SizedBox(height: CpiSpacing.sm),
                _Chiffre(
                  cle: 'chiffre-attente',
                  label: 'Pas encore envoyé',
                  valeur: total?.enAttente,
                  couleur: context.cpi.accentText,
                  // Une saisie refusée ne part pas en réessayant : elle se
                  // corrige. La carte emmène là où c'est possible.
                  note: refusees == 0
                      ? null
                      : '${refusees > 1 ? '$refusees saisies refusées' : '1 saisie refusée'} '
                            'par le serveur. Touchez pour corriger.',
                  onTap: refusees == 0
                      ? () => ouvrirPeriode(PeriodeRegistre.tout)
                      : () => context.go(Routes.accueilCorrections),
                ),
                const SizedBox(height: CpiSpacing.sm),
                _RecusAujourdhui(lignes: recus),
                const SizedBox(height: CpiSpacing.lg),
                if (aucuneVisite)
                  const CpiEmptyState(
                    icon: PhosphorIconsDuotone.clipboardText,
                    title: 'Aucune visite pour l\'instant.',
                    message: 'Les chiffres arrivent dès la première visite.',
                  ),
                if (!aucuneVisite && activite.hasValue)
                  CpiCard(child: ActivityChart(days: activite.value!)),
                if (pointe.hasValue && pointe.value != null) ...<Widget>[
                  const SizedBox(height: CpiSpacing.lg),
                  CpiCard(
                    child: Text(
                      'Le plus de monde entre '
                      '${pointe.value!.heure.toString().padLeft(2, '0')} h et '
                      '${(pointe.value!.heure + 1).toString().padLeft(2, '0')} h',
                      style: Theme.of(context).textTheme.titleSmall,
                    ),
                  ),
                ],
                // Les entreprises ne sont plus réparties : trois sociétés du
                // groupe font un camembert qui ne dit rien.
                if (top.hasValue && top.value!.objets.isNotEmpty) ...<Widget>[
                  const SizedBox(height: CpiSpacing.lg),
                  _Repartition(
                    titre: 'Motifs de visite les plus fréquents',
                    lignes: top.value!.objets,
                  ),
                ],
              ],
            ),
    );
  }
}

/// Un chiffre par carte, en très gros, et la carte ouvre le registre filtré.
class _Chiffre extends StatelessWidget {
  const _Chiffre({
    required this.cle,
    required this.label,
    required this.valeur,
    required this.onTap,
    this.couleur,
    this.note,
  });

  final String cle;
  final String label;
  final int? valeur;
  final VoidCallback onTap;
  final Color? couleur;

  /// Ce que le chiffre demande, quand il demande quelque chose.
  final String? note;

  @override
  Widget build(BuildContext context) {
    final ThemeData theme = Theme.of(context);
    return CpiCard(
      key: ValueKey<String>(cle),
      onTap: onTap,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: <Widget>[
          Text(
            label,
            style: theme.textTheme.bodyMedium?.copyWith(
              color: theme.colorScheme.onSurfaceVariant,
            ),
          ),
          const SizedBox(height: CpiSpacing.xxs),
          Text(
            valeur == null ? '…' : '$valeur',
            style: theme.textTheme.headlineLarge?.copyWith(
              color: couleur ?? theme.colorScheme.primary,
            ),
          ),
          if (note != null)
            Text(
              note!,
              style: theme.textTheme.bodySmall?.copyWith(
                color: theme.colorScheme.error,
              ),
            ),
        ],
      ),
    );
  }
}

/// Qui a été demandé aujourd'hui, et combien de fois.
class _RecusAujourdhui extends StatelessWidget {
  const _RecusAujourdhui({required this.lignes});

  final List<LabelCompte> lignes;

  @override
  Widget build(BuildContext context) => _Repartition(
    cle: 'chiffre-recus',
    titre: 'Reçus aujourd\'hui',
    sousTitre: 'Par personne demandée',
    vide: 'Personne n\'a encore été demandé nommément aujourd\'hui.',
    lignes: lignes,
  );
}

class _Repartition extends StatelessWidget {
  const _Repartition({
    required this.titre,
    required this.lignes,
    this.sousTitre,
    this.vide = 'Rien sur les 30 derniers jours.',
    this.cle,
  });

  final String titre;
  final String? sousTitre;
  final String vide;
  final String? cle;
  final List<LabelCompte> lignes;

  @override
  Widget build(BuildContext context) {
    final ThemeData theme = Theme.of(context);
    final List<Color> couleurs = context.cpi.chartSeries;
    final int total = lignes.fold(0, (int a, LabelCompte l) => a + l.total);

    return CpiCard(
      key: cle == null ? null : ValueKey<String>(cle!),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: <Widget>[
          Text(titre, style: theme.textTheme.titleSmall),
          if (sousTitre != null)
            Text(
              sousTitre!,
              style: theme.textTheme.bodySmall?.copyWith(
                color: theme.colorScheme.onSurfaceVariant,
              ),
            ),
          const SizedBox(height: CpiSpacing.xs),
          for (int i = 0; i < lignes.length; i++)
            Padding(
              padding: const EdgeInsets.only(bottom: CpiSpacing.xxs),
              child: Row(
                children: <Widget>[
                  _Pastille(couleur: couleurs[i % couleurs.length]),
                  const SizedBox(width: CpiSpacing.xs),
                  Expanded(
                    child: Text(
                      lignes[i].libelle,
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                      style: theme.textTheme.bodyMedium,
                    ),
                  ),
                  const SizedBox(width: CpiSpacing.xs),
                  Text(
                    '${lignes[i].total}',
                    style: theme.textTheme.bodyMedium?.copyWith(
                      color: theme.colorScheme.onSurfaceVariant,
                    ),
                  ),
                ],
              ),
            ),
          if (total == 0)
            Text(
              vide,
              style: theme.textTheme.bodySmall?.copyWith(
                color: theme.colorScheme.onSurfaceVariant,
              ),
            ),
        ],
      ),
    );
  }
}

/// Repère de couleur d'une série, comme la légende du graphique d'activité.
class _Pastille extends StatelessWidget {
  const _Pastille({required this.couleur});

  final Color couleur;

  @override
  Widget build(BuildContext context) => SizedBox.square(
    dimension: CpiSpacing.xs,
    child: DecoratedBox(
      decoration: BoxDecoration(color: couleur, borderRadius: CpiRadius.brXs),
    ),
  );
}

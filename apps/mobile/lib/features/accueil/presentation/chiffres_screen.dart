import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:phosphor_flutter/phosphor_flutter.dart';

import '../../../core/providers/app_providers.dart';
import '../../../core/theme/cpi_colors.dart';
import '../../../core/theme/cpi_tokens.dart';
import '../../../data/repositories/visites_repository.dart';
import '../../../ui/widgets/activity_chart.dart';
import '../../../ui/widgets/error_state.dart';
import '../../../ui/widgets/summary_card.dart';
import '../../auth/auth_state.dart';
import '../visites_repository.dart';
import 'acces_refuse.dart';

class ChiffresScreen extends ConsumerWidget {
  const ChiffresScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final AuthState auth = ref.watch(authControllerProvider);
    if (!peutTenirLeRegistre(auth.role)) {
      return const AccesRefuse(title: 'Les chiffres de l\'accueil');
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

    void ouvrirPeriode(PeriodeRegistre periode) {
      ref.read(registrePeriodeProvider.notifier).set(periode);
      context.pop();
    }

    return Scaffold(
      appBar: AppBar(title: const Text('Les chiffres')),
      body: (compteurs.error ?? activite.error) != null
          ? CpiErrorState(
              message:
                  'Les chiffres de l\'accueil n\'ont pas pu être lus. '
                  '${messageErreur(compteurs.error ?? activite.error!)}',
              onRetry: () {
                ref.invalidate(compteursAccueilProvider);
                ref.invalidate(activiteVisites7JoursProvider);
                ref.invalidate(topLabelsVisitesProvider);
                ref.invalidate(heureDePointeVisitesProvider);
              },
            )
          : ListView(
              padding: const EdgeInsets.all(CpiSpacing.md),
              children: <Widget>[
                SummaryCard(
                  label: 'Visites aujourd\'hui',
                  value: '${compteurs.value?.jour ?? 0}',
                  icon: PhosphorIconsRegular.userCircle,
                  isLoading: !compteurs.hasValue,
                  onTap: () => ouvrirPeriode(PeriodeRegistre.jour),
                ),
                const SizedBox(height: CpiSpacing.sm),
                SummaryCard(
                  label: 'Visites sur 7 jours',
                  value: '${compteurs.value?.septJours ?? 0}',
                  icon: PhosphorIconsRegular.usersThree,
                  isLoading: !compteurs.hasValue,
                  onTap: () => ouvrirPeriode(PeriodeRegistre.semaine),
                ),
                const SizedBox(height: CpiSpacing.sm),
                SummaryCard(
                  label: 'En attente d\'envoi',
                  value: '${compteurs.value?.enAttente ?? 0}',
                  icon: PhosphorIconsRegular.cloudSlash,
                  accentColor: context.cpi.accentText,
                  isLoading: !compteurs.hasValue,
                  onTap: () => ouvrirPeriode(PeriodeRegistre.tout),
                ),
                const SizedBox(height: CpiSpacing.lg),
                if (activite.hasValue)
                  Container(
                    padding: const EdgeInsets.all(CpiSpacing.md),
                    decoration: BoxDecoration(
                      color: Theme.of(
                        context,
                      ).colorScheme.surfaceContainerLowest,
                      borderRadius: CpiRadius.brLg,
                      border: Border.all(color: context.cpi.borderSubtle),
                    ),
                    child: ActivityChart(days: activite.value!),
                  ),
                if (pointe.hasValue && pointe.value != null) ...<Widget>[
                  const SizedBox(height: CpiSpacing.lg),
                  Text(
                    'Le plus de monde entre '
                    '${pointe.value!.heure.toString().padLeft(2, '0')} h et '
                    '${(pointe.value!.heure + 1).toString().padLeft(2, '0')} h',
                    style: Theme.of(context).textTheme.titleSmall,
                  ),
                ],
                if (top.hasValue &&
                    (top.value!.entreprises.isNotEmpty ||
                        top.value!.objets.isNotEmpty)) ...<Widget>[
                  const SizedBox(height: CpiSpacing.lg),
                  if (top.value!.entreprises.isNotEmpty)
                    _Repartition(
                      titre: 'Entreprises les plus reçues',
                      lignes: top.value!.entreprises,
                    ),
                  if (top.value!.objets.isNotEmpty) ...<Widget>[
                    const SizedBox(height: CpiSpacing.md),
                    _Repartition(
                      titre: 'Objets de visite les plus fréquents',
                      lignes: top.value!.objets,
                    ),
                  ],
                ],
              ],
            ),
    );
  }
}

class _Repartition extends StatelessWidget {
  const _Repartition({required this.titre, required this.lignes});

  final String titre;
  final List<LabelCompte> lignes;

  @override
  Widget build(BuildContext context) {
    final ThemeData theme = Theme.of(context);
    final List<Color> couleurs = context.cpi.chartSeries;
    final int total = lignes.fold(0, (int a, LabelCompte l) => a + l.total);

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: <Widget>[
        Text(titre, style: theme.textTheme.titleSmall),
        const SizedBox(height: CpiSpacing.xs),
        for (int i = 0; i < lignes.length; i++)
          Padding(
            padding: const EdgeInsets.only(bottom: CpiSpacing.xxs),
            child: Row(
              children: <Widget>[
                Container(
                  width: 10,
                  height: 10,
                  decoration: BoxDecoration(
                    color: couleurs[i % couleurs.length],
                    borderRadius: CpiRadius.brXs,
                  ),
                ),
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
            'Rien sur les 30 derniers jours.',
            style: theme.textTheme.bodySmall?.copyWith(
              color: theme.colorScheme.onSurfaceVariant,
            ),
          ),
      ],
    );
  }
}

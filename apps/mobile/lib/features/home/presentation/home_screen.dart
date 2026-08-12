import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:phosphor_flutter/phosphor_flutter.dart';

import '../../../core/providers/app_providers.dart';
import '../../../core/router/route_paths.dart';
import '../../../core/theme/cpi_colors.dart';
import '../../../core/theme/cpi_tokens.dart';
import '../../../ui/widgets/summary_card.dart';
import '../../../ui/widgets/sync_badge.dart';
import '../../auth/auth_state.dart';

/// Écran d'accueil : trois compteurs et une action.
///
/// Le bouton principal est ancré en bas et occupe toute la largeur. L'app se
/// tient d'une main, debout, souvent au soleil : une action posée en haut de
/// l'écran est hors d'atteinte du pouce sur un téléphone de 6,5 pouces.
class HomeScreen extends ConsumerWidget {
  const HomeScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final ThemeData theme = Theme.of(context);
    final CpiColors cpi = context.cpi;
    final AuthState auth = ref.watch(authControllerProvider);
    final AsyncValue<int> representants = ref.watch(representantCountProvider);
    final AsyncValue<int> prospects = ref.watch(prospectCountProvider);
    final AsyncValue<int> pending = ref.watch(pendingSyncCountProvider);

    return Scaffold(
      appBar: AppBar(
        title: const Text('CPI GO'),
        actions: const <Widget>[SyncBadge(), SizedBox(width: CpiSpacing.xs)],
      ),
      body: SafeArea(
        child: Column(
          children: <Widget>[
            Expanded(
              // ListView.builder et non Column dans un SingleChildScrollView :
              // la liste s'allongera (activité récente, files en erreur) et un
              // Column construit tous ses enfants, visibles ou non.
              child: ListView.builder(
                padding: const EdgeInsets.fromLTRB(
                  CpiSpacing.md,
                  CpiSpacing.md,
                  CpiSpacing.md,
                  CpiSpacing.xs,
                ),
                itemCount: 6,
                itemBuilder: (BuildContext context, int index) {
                  switch (index) {
                    case 0:
                      return _Greeting(name: auth.fullName);
                    case 1:
                      return Padding(
                        padding: const EdgeInsets.only(bottom: CpiSpacing.sm),
                        child: SummaryCard(
                          label: 'Mes représentants',
                          value: '${representants.value ?? 0}',
                          isLoading: representants.isLoading,
                          icon: PhosphorIconsRegular.usersThree,
                          accentColor: theme.colorScheme.primary,
                          onTap: () => context.go(Routes.historique),
                        ),
                      );
                    case 2:
                      return Padding(
                        padding: const EdgeInsets.only(bottom: CpiSpacing.sm),
                        child: SummaryCard(
                          label: 'Mes prospects',
                          value: '${prospects.value ?? 0}',
                          isLoading: prospects.isLoading,
                          icon: PhosphorIconsRegular.identificationCard,
                          accentColor: cpi.info,
                          onTap: () => context.go(Routes.historique),
                        ),
                      );
                    case 3:
                      final int count = pending.value ?? 0;
                      return Padding(
                        padding: const EdgeInsets.only(bottom: CpiSpacing.sm),
                        child: SummaryCard(
                          label: 'En attente de synchronisation',
                          value: '$count',
                          isLoading: pending.isLoading,
                          icon: count == 0
                              ? PhosphorIconsRegular.checkCircle
                              : PhosphorIconsRegular.cloudSlash,
                          // `accentText` (#856011) et jamais `accent`
                          // (#C8921A) : ce chiffre est du texte, et l'or de
                          // surface fait 2,77:1.
                          accentColor: count == 0 ? cpi.success : cpi.accentText,
                          surfaceColor: count == 0 ? null : cpi.accentSurface,
                          onTap: () => context.go(Routes.corrections),
                        ),
                      );
                    case 4:
                      return const Padding(
                        padding: EdgeInsets.only(bottom: CpiSpacing.sm),
                        child: _Phase2Entry(),
                      );
                    default:
                      return const _OfflineNotice();
                  }
                },
              ),
            ),
            const _PrimaryAction(),
          ],
        ),
      ),
    );
  }
}

class _Greeting extends StatelessWidget {
  const _Greeting({this.name});

  final String? name;

  @override
  Widget build(BuildContext context) {
    final ThemeData theme = Theme.of(context);
    final String display = (name == null || name!.trim().isEmpty)
        ? 'Bonjour'
        : 'Bonjour, ${name!.split(' ').first}';
    return Padding(
      padding: const EdgeInsets.only(bottom: CpiSpacing.md),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: <Widget>[
          Text(display, style: theme.textTheme.headlineSmall),
          const SizedBox(height: CpiSpacing.xxs),
          Text(
            'Votre journée sur le terrain',
            style: theme.textTheme.bodyMedium?.copyWith(
              color: theme.colorScheme.onSurfaceVariant,
            ),
          ),
        ],
      ),
    );
  }
}

/// Entrée distincte vers la phase 2.
///
/// Une carte à part et non un quatrième compteur : la phase 2 n'est pas une
/// mesure de la prospection, c'est **un autre travail**, mené depuis un
/// programme PDF imprimé. La mêler aux compteurs de représentants et de
/// prospects laisserait croire à une continuité qui n'existe pas — et le
/// parcours de phase 1 n'est pas touché.
class _Phase2Entry extends ConsumerWidget {
  const _Phase2Entry();

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final ThemeData theme = Theme.of(context);
    final CpiColors cpi = context.cpi;
    final int pending = ref.watch(phase2PendingCountProvider).value ?? 0;
    final int directory = ref.watch(phase2DirectoryCountProvider).value ?? 0;

    void open() => context.go(Routes.phase2);

    return Semantics(
      button: true,
      // `onTap` EST l'action d'accessibilité, pas une redite du `InkWell`.
      // Sans lui, ce nœud s'annonce « bouton » à un lecteur d'écran mais
      // n'expose aucune action : `ExcludeSemantics` a supprimé celle de
      // l'`InkWell`, et l'utilisateur entend un bouton qu'il ne peut pas
      // activer. Vérifié sur l'appareil — la ligne apparaissait sans indicateur
      // « tap » dans l'arbre d'accessibilité.
      onTap: open,
      label:
          'Phase 2, méthodes d\'enrôlement. '
          '${directory == 0 ? 'Annuaire à télécharger.' : '$directory numéros dans l\'annuaire.'}'
          '${pending > 0 ? ' $pending saisies en attente d\'envoi.' : ''}',
      child: ExcludeSemantics(
        child: Material(
          color: theme.colorScheme.surfaceContainerLowest,
          borderRadius: CpiRadius.brLg,
          child: InkWell(
            borderRadius: CpiRadius.brLg,
            onTap: open,
            child: Container(
              constraints: const BoxConstraints(minHeight: 72),
              padding: const EdgeInsets.all(CpiSpacing.md),
              decoration: BoxDecoration(
                borderRadius: CpiRadius.brLg,
                border: Border.all(color: cpi.accentBorder.withValues(alpha: 0.5)),
              ),
              child: Row(
                children: <Widget>[
                  Container(
                    width: 44,
                    height: 44,
                    decoration: BoxDecoration(
                      // Surface décorative en or — c'est le seul usage autorisé
                      // de `#C8921A`. L'icône posée dessus utilise
                      // `accentForeground` (6,95:1), jamais l'or lui-même.
                      color: cpi.accent,
                      borderRadius: CpiRadius.brMd,
                    ),
                    child: Icon(
                      PhosphorIconsRegular.phoneCall,
                      size: 22,
                      color: cpi.accentForeground,
                    ),
                  ),
                  const SizedBox(width: CpiSpacing.sm),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      mainAxisSize: MainAxisSize.min,
                      children: <Widget>[
                        Text(
                          'Phase 2 — Méthodes d\'enrôlement',
                          style: theme.textTheme.titleMedium,
                        ),
                        const SizedBox(height: 2),
                        Text(
                          directory == 0
                              ? 'Annuaire à télécharger'
                              : pending > 0
                              ? '$pending saisie${pending > 1 ? 's' : ''} à envoyer'
                              : 'Consigner un appel',
                          style: theme.textTheme.bodySmall?.copyWith(
                            color: pending > 0 || directory == 0
                                ? cpi.accentText
                                : theme.colorScheme.onSurfaceVariant,
                          ),
                        ),
                      ],
                    ),
                  ),
                  Icon(
                    PhosphorIconsRegular.caretRight,
                    size: 18,
                    color: theme.colorScheme.onSurfaceVariant,
                  ),
                ],
              ),
            ),
          ),
        ),
      ),
    );
  }
}

class _OfflineNotice extends StatelessWidget {
  const _OfflineNotice();

  @override
  Widget build(BuildContext context) {
    final ThemeData theme = Theme.of(context);
    final CpiColors cpi = context.cpi;
    return Container(
      margin: const EdgeInsets.only(top: CpiSpacing.xs),
      padding: const EdgeInsets.all(CpiSpacing.sm),
      decoration: BoxDecoration(
        color: cpi.infoSurface,
        borderRadius: CpiRadius.brMd,
      ),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: <Widget>[
          Icon(PhosphorIconsRegular.wifiSlash, size: 18, color: cpi.info),
          const SizedBox(width: CpiSpacing.xs),
          Expanded(
            child: Text(
              'Vous pouvez saisir sans réseau. Tout est gardé sur l\'appareil '
              'et envoyé dès qu\'une connexion revient.',
              style: theme.textTheme.bodySmall?.copyWith(color: cpi.info),
            ),
          ),
        ],
      ),
    );
  }
}

/// Action principale, ancrée en zone de pouce.
class _PrimaryAction extends StatelessWidget {
  const _PrimaryAction();

  @override
  Widget build(BuildContext context) {
    final ThemeData theme = Theme.of(context);
    return Container(
      width: double.infinity,
      padding: const EdgeInsets.fromLTRB(
        CpiSpacing.md,
        CpiSpacing.sm,
        CpiSpacing.md,
        CpiSpacing.md,
      ),
      decoration: BoxDecoration(
        color: theme.colorScheme.surface,
        border: Border(top: BorderSide(color: context.cpi.borderSubtle)),
      ),
      child: FilledButton.icon(
        onPressed: () => context.go(Routes.newRepresentant),
        icon: const Icon(PhosphorIconsRegular.plus, size: 20),
        label: const Text('Nouveau représentant'),
      ),
    );
  }
}

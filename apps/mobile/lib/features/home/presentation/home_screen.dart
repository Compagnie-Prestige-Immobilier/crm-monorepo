import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:phosphor_flutter/phosphor_flutter.dart';

import '../../../core/providers/app_providers.dart';
import '../../../core/router/route_paths.dart';
import '../../../core/theme/cpi_colors.dart';
import '../../../core/theme/cpi_tokens.dart';
import '../../../ui/widgets/activity_chart.dart';
import '../../../ui/widgets/cpi_pressable.dart';
import '../../../ui/widgets/summary_card.dart';
import '../../../ui/widgets/sync_badge.dart';
import '../../auth/auth_state.dart';
import '../../notifications/presentation/notification_bell.dart';

/// Accueil : trois compteurs, sept jours d'activité, une action.
///
/// Le bouton principal est ancré en bas et occupe toute la largeur : une action
/// posée en haut d'un écran de 6,5 pouces est hors d'atteinte du pouce.
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
    final List<ActivityDay> activity =
        ref.watch(activityLast7DaysProvider).value ?? const <ActivityDay>[];

    return Scaffold(
      appBar: AppBar(
        title: const Text('CPI GO'),
        actions: const <Widget>[
          NotificationBell(),
          SyncBadge(),
          SizedBox(width: CpiSpacing.xs),
        ],
      ),
      body: SafeArea(
        child: Column(
          children: <Widget>[
            Expanded(
              // Tirer pour synchroniser : le geste attendu partout sur Android,
              // et le seul retour d'action que l'utilisateur peut déclencher
              // lui-même depuis l'accueil.
              child: RefreshIndicator(
                color: theme.colorScheme.primary,
                onRefresh: () async {
                  await HapticFeedback.selectionClick();
                  await ref.read(syncCoordinatorProvider.notifier).run();
                },
                child: ListView.builder(
                  // 12 dp en haut et non 16 : le contenu utile commence plus
                  // près du bandeau.
                  padding: const EdgeInsets.fromLTRB(
                    CpiSpacing.md,
                    CpiSpacing.sm,
                    CpiSpacing.md,
                    CpiSpacing.xs,
                  ),
                  physics: const AlwaysScrollableScrollPhysics(),
                  itemCount: 7,
                  itemBuilder: (BuildContext context, int index) {
                    final Widget child = switch (index) {
                      0 => _Greeting(name: auth.fullName),
                      1 => Padding(
                        padding: const EdgeInsets.only(bottom: CpiSpacing.xs),
                        child: SummaryCard(
                          label: 'Représentants',
                          value: '${representants.value ?? 0}',
                          isLoading: representants.isLoading,
                          icon: PhosphorIconsRegular.usersThree,
                          accentColor: theme.colorScheme.primary,
                          onTap: () => context.go(Routes.historique),
                        ),
                      ),
                      2 => Padding(
                        padding: const EdgeInsets.only(bottom: CpiSpacing.xs),
                        child: SummaryCard(
                          label: 'Prospects',
                          value: '${prospects.value ?? 0}',
                          isLoading: prospects.isLoading,
                          icon: PhosphorIconsRegular.identificationCard,
                          accentColor: cpi.info,
                          onTap: () => context.go(Routes.historique),
                        ),
                      ),
                      3 => Builder(
                        builder: (BuildContext context) {
                          final int count = pending.value ?? 0;
                          return Padding(
                            padding: const EdgeInsets.only(bottom: CpiSpacing.xs),
                            child: SummaryCard(
                              label: 'En attente d\'envoi',
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
                        },
                      ),
                      4 => Padding(
                        padding: const EdgeInsets.only(bottom: CpiSpacing.xs),
                        child: _ActivityCard(days: activity),
                      ),
                      5 => const Padding(
                        padding: EdgeInsets.only(bottom: CpiSpacing.xs),
                        child: _Phase2Entry(),
                      ),
                      _ => const SizedBox(height: CpiSpacing.xs),
                    };
                    return CpiListEntrance(index: index, child: child);
                  },
                ),
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
      padding: const EdgeInsets.only(bottom: CpiSpacing.sm),
      child: Text(display, style: theme.textTheme.headlineSmall),
    );
  }
}

/// Sept jours d'activité, en barres.
///
/// Aucun appel réseau : le flux vient de drift et se réémet à chaque écriture
/// locale. Voir `activityLast7DaysProvider`.
class _ActivityCard extends StatelessWidget {
  const _ActivityCard({required this.days});

  final List<ActivityDay> days;

  @override
  Widget build(BuildContext context) {
    if (days.isEmpty) return const SizedBox.shrink();
    final ThemeData theme = Theme.of(context);
    return Container(
      padding: const EdgeInsets.all(CpiSpacing.md),
      decoration: BoxDecoration(
        color: theme.colorScheme.surfaceContainerLowest,
        borderRadius: CpiRadius.brLg,
        border: Border.all(color: context.cpi.borderSubtle),
      ),
      child: ActivityChart(days: days),
    );
  }
}

/// Entrée vers la phase 2.
///
/// Une carte à part et non un quatrième compteur : la phase 2 n'est pas une
/// mesure de la prospection, c'est un autre travail.
class _Phase2Entry extends ConsumerWidget {
  const _Phase2Entry();

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final ThemeData theme = Theme.of(context);
    final CpiColors cpi = context.cpi;
    final int pending = ref.watch(phase2PendingCountProvider).value ?? 0;
    final int directory = ref.watch(phase2DirectoryCountProvider).value ?? 0;

    // `push` et non `go` : `go` remplace la pile, ce qui rendait inerte la
    // flèche de retour de l'écran Phase 2.
    void open() => context.push(Routes.phase2);

    return Semantics(
      button: true,
      // `onTap` EST l'action d'accessibilité, pas une redite du `InkWell` :
      // `ExcludeSemantics` a supprimé celle-ci.
      onTap: open,
      label:
          'Phase 2, méthodes d\'enrôlement. '
          '${directory == 0 ? 'Annuaire non téléchargé.' : '$directory numéros dans l\'annuaire.'}'
          '${pending > 0 ? ' $pending en attente d\'envoi.' : ''}',
      child: ExcludeSemantics(
        child: CpiPressable(
          onTap: open,
          child: Container(
            constraints: const BoxConstraints(minHeight: 72),
            padding: const EdgeInsets.all(CpiSpacing.md),
            decoration: BoxDecoration(
              color: theme.colorScheme.surfaceContainerLowest,
              borderRadius: CpiRadius.brLg,
              border: Border.all(color: cpi.accentBorder.withValues(alpha: 0.5)),
            ),
            child: Row(
              children: <Widget>[
                Container(
                  width: 44,
                  height: 44,
                  decoration: BoxDecoration(
                    // Surface décorative en or : seul usage autorisé de
                    // `#C8921A`. L'icône posée dessus utilise
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
                        'Phase 2 · Méthodes d\'enrôlement',
                        style: theme.textTheme.titleSmall,
                      ),
                      const SizedBox(height: 2),
                      Text(
                        directory == 0
                            ? 'Annuaire non téléchargé'
                            : pending > 0
                            ? '$pending en attente d\'envoi'
                            : 'Consigner un appel',
                        style: theme.textTheme.bodyMedium?.copyWith(
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
                  size: 20,
                  color: theme.colorScheme.onSurfaceVariant,
                ),
              ],
            ),
          ),
        ),
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
        CpiSpacing.xs,
        CpiSpacing.md,
        CpiSpacing.sm,
      ),
      decoration: BoxDecoration(
        color: theme.colorScheme.surface,
        border: Border(top: BorderSide(color: context.cpi.borderSubtle)),
      ),
      child: FilledButton.icon(
        onPressed: () {
          HapticFeedback.selectionClick();
          context.push(Routes.newRepresentant);
        },
        icon: const Icon(PhosphorIconsRegular.plus, size: 20),
        label: const Text('Nouveau représentant'),
      ),
    );
  }
}

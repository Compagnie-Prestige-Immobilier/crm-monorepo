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
import '../../../data/local/database.dart';
import '../../../ui/async_value_x.dart';
import '../../../ui/widgets/empty_state.dart';
import '../../../ui/widgets/error_state.dart';
import '../../../ui/widgets/offline_indicator.dart';
import '../../../ui/widgets/sync_badge.dart';
import '../../auth/auth_state.dart';
import '../visites_repository.dart';

class RegistreScreen extends ConsumerWidget {
  const RegistreScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final ThemeData theme = Theme.of(context);
    final AuthState auth = ref.watch(authControllerProvider);
    final AsyncValue<List<Visite>> registre = ref.watch(registreDuJourProvider);

    if (!peutTenirLeRegistre(auth.role)) {
      return Scaffold(
        appBar: AppBar(
          leading: IconButton(
            icon: const Icon(PhosphorIconsRegular.squaresFour),
            tooltip: 'Projets',
            onPressed: () => context.go(Routes.home),
          ),
          title: const Text('Registre des visites'),
        ),
        body: Padding(
          padding: const EdgeInsets.all(CpiSpacing.xl),
          child: Center(
            child: Text(
              'Ce compte ne tient pas le registre des visites. '
              'Demandez l\'accès à la direction.',
              textAlign: TextAlign.center,
              style: theme.textTheme.bodyLarge,
            ),
          ),
        ),
      );
    }

    return Scaffold(
      appBar: AppBar(
        leading: IconButton(
          icon: const Icon(PhosphorIconsRegular.squaresFour),
          tooltip: 'Projets',
          onPressed: () => context.go(Routes.home),
        ),
        title: const Text('Registre des visites'),
        actions: const <Widget>[
          OfflineIndicator(),
          SyncBadge(),
          SizedBox(width: CpiSpacing.xs),
        ],
      ),
      body: SafeArea(
        child: Column(
          children: <Widget>[
            Expanded(
              child: registre.whenEchecDAbord(
                loading: () => const _RegistreEnCours(),
                error: (Object error, StackTrace _) => CpiErrorState(
                  message:
                      'Le registre du jour n\'a pas pu être lu. '
                      '${messageErreur(error)}',
                  onRetry: () => ref.invalidate(registreDuJourProvider),
                ),
                data: (List<Visite> value) => RefreshIndicator(
                  color: theme.colorScheme.primary,
                  onRefresh: () async {
                    final SyncCoordinator sync = ref.read(
                      syncCoordinatorProvider.notifier,
                    );
                    await HapticFeedback.selectionClick();
                    await sync.run();
                  },
                  child: ListView(
                    padding: const EdgeInsets.fromLTRB(
                      CpiSpacing.md,
                      CpiSpacing.md,
                      CpiSpacing.md,
                      CpiSpacing.md,
                    ),
                    physics: const AlwaysScrollableScrollPhysics(),
                    children: value.isEmpty
                        ? const <Widget>[_RegistreVide()]
                        : <Widget>[
                            _Compte(nombre: value.length),
                            const SizedBox(height: CpiSpacing.xs),
                            for (final Visite visite in value)
                              Padding(
                                padding: const EdgeInsets.only(
                                  bottom: CpiSpacing.xs,
                                ),
                                child: _LigneVisite(visite: visite),
                              ),
                          ],
                  ),
                ),
              ),
            ),
            Container(
              width: double.infinity,
              padding: const EdgeInsets.fromLTRB(
                CpiSpacing.md,
                CpiSpacing.xs,
                CpiSpacing.md,
                CpiSpacing.sm,
              ),
              decoration: BoxDecoration(
                color: theme.colorScheme.surface,
                border: Border(
                  top: BorderSide(color: context.cpi.borderSubtle),
                ),
              ),
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

class _Compte extends StatelessWidget {
  const _Compte({required this.nombre});

  final int nombre;

  @override
  Widget build(BuildContext context) {
    return Text(
      nombre == 1 ? '1 visite aujourd\'hui' : '$nombre visites aujourd\'hui',
      style: Theme.of(context).textTheme.titleMedium,
    );
  }
}

class _LigneVisite extends StatelessWidget {
  const _LigneVisite({required this.visite});

  final Visite visite;

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
                  visite.reference ?? 'En attente d\'envoi',
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
  const _RegistreVide();

  @override
  Widget build(BuildContext context) => const CpiEmptyState(
    icon: PhosphorIconsDuotone.clipboardText,
    title: 'Aucune visite inscrite aujourd\'hui',
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

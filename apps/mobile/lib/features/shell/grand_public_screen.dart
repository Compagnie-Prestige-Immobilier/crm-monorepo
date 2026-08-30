import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:phosphor_flutter/phosphor_flutter.dart';

import '../../core/providers/app_providers.dart';
import '../../core/router/route_paths.dart';
import '../../core/theme/cpi_tokens.dart';
import '../../ui/widgets/cpi_kit.dart';
import '../rappels/presentation/rappels_en_retard_banner.dart';
import 'app_shell.dart';
import 'projects.dart';
import 'workspace_switch.dart';

/// L'écran de travail du Grand Public.
///
/// Rien ne s'y saisit : la base des prospects vient du bureau. Le travail du
/// téléconseiller, c'est la CONVERSION : appeler la file du jour, tenir les
/// rappels promis, et retrouver une fiche au besoin.
class GrandPublicScreen extends ConsumerWidget {
  const GrandPublicScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final AsyncValue<int> prospects = ref.watch(
      grandPublicProspectCountProvider,
    );
    final AsyncValue<List<Rappel>> rappels = ref.watch(
      grandPublicRappelsProvider,
    );
    void appeler() {
      HapticFeedback.selectionClick().ignore();
      context.push('/grand-public/phase2').ignore();
    }

    final List<Rappel>? prochains = rappels.value;
    final Rappel? prochain = prochains == null || prochains.isEmpty
        ? null
        : prochains.first;

    return CpiScaffold(
      title: 'Aujourd\'hui',
      subtitle: 'Prospects hors CHUES',
      leading: const CpiWorkspaceSwitch(
        key: Key('Projets'),
        current: CpiProject.grandPublic,
      ),
      banner: const PendingBanner(),
      body: RefreshIndicator(
        onRefresh: () async {
          await HapticFeedback.selectionClick();
          await ref.read(syncCoordinatorProvider.notifier).run();
        },
        child: ListView(
          physics: const AlwaysScrollableScrollPhysics(),
          padding: const EdgeInsets.fromLTRB(
            CpiSpacing.md,
            0,
            CpiSpacing.md,
            CpiSpacing.xl,
          ),
          children: <Widget>[
            const RappelsEnRetardBanner(grandPublic: true, padded: false),
            _GrandeCarte(
              nombre: 0,
              loading: false,
              titre: 'Appels du jour',
              icon: PhosphorIconsRegular.phoneCall,
              vide: 'Rien à appeler aujourd\'hui.',
              onTap: appeler,
            ),
            const SizedBox(height: CpiSpacing.sm),
            _Carte(
              nombre: prospects.value,
              titre: 'Prospects',
              detail: 'Retrouver une fiche',
              icon: PhosphorIconsRegular.usersThree,
              onTap: () => context.go(Routes.grandPublicFiches),
            ),
            const SizedBox(height: CpiSpacing.sm),
            _Carte(
              nombre: prochains?.length,
              titre: 'Rappels',
              detail: prochain == null
                  ? 'Aucun rappel prévu'
                  : 'Prochain ${_quand(context, prochain.at)}',
              icon: PhosphorIconsRegular.bellRinging,
              // Toujours ouvrable, même à zéro : c'est la liste qui dit qu'il
              // n'y a rien, pas une carte qui refuse le geste.
              onTap: () => context.push(Routes.grandPublicRappels).ignore(),
            ),
          ],
        ),
      ),
    );
  }

  /// Dakar est à UTC toute l'année : l'heure du serveur et celle du téléphone
  /// se lisent pareil.
  static String _quand(BuildContext context, DateTime at) {
    final MaterialLocalizations l = MaterialLocalizations.of(context);
    final DateTime local = at.toUtc();
    return '${l.formatMediumDate(local)} à '
        '${l.formatTimeOfDay(TimeOfDay.fromDateTime(local))}';
  }
}

/// La carte du travail du jour : le nombre en très gros, une seule destination.
class _GrandeCarte extends StatelessWidget {
  const _GrandeCarte({
    required this.nombre,
    required this.loading,
    required this.titre,
    required this.icon,
    required this.vide,
    required this.onTap,
  });

  final int nombre;
  final bool loading;
  final String titre;
  final IconData icon;
  final String vide;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final ThemeData theme = Theme.of(context);
    final ColorScheme scheme = theme.colorScheme;
    return Semantics(
      button: true,
      label: loading
          ? 'Chargement des appels du jour.'
          : nombre == 0
          ? '$vide Ouvrir la liste.'
          : '$nombre $titre. Ouvrir la liste.',
      child: ExcludeSemantics(
        child: CpiCard(
          onTap: onTap,
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            mainAxisSize: MainAxisSize.min,
            children: <Widget>[
              Row(
                children: <Widget>[
                  Icon(icon, size: CpiIconSize.xxl, color: scheme.primary),
                  const SizedBox(width: CpiSpacing.xs),
                  Expanded(
                    child: Text(titre, style: theme.textTheme.titleMedium),
                  ),
                  Icon(
                    PhosphorIconsRegular.caretRight,
                    size: CpiIconSize.xl,
                    color: scheme.onSurfaceVariant,
                  ),
                ],
              ),
              const SizedBox(height: CpiSpacing.xs),
              if (loading)
                Text('…', style: theme.textTheme.headlineSmall)
              else
                Text(
                  '$nombre',
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                  style: theme.textTheme.headlineSmall?.copyWith(
                    color: scheme.primary,
                  ),
                ),
              Text(
                nombre == 0 && !loading ? vide : 'À appeler',
                style: theme.textTheme.bodyMedium?.copyWith(
                  color: scheme.onSurfaceVariant,
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

/// Une carte de repère : un nombre, un mot, une destination.
class _Carte extends StatelessWidget {
  const _Carte({
    required this.nombre,
    required this.titre,
    required this.detail,
    required this.icon,
    required this.onTap,
  });

  final int? nombre;
  final String titre;
  final String detail;
  final IconData icon;
  final VoidCallback? onTap;

  @override
  Widget build(BuildContext context) {
    final ThemeData theme = Theme.of(context);
    final ColorScheme scheme = theme.colorScheme;
    final String compte = nombre == null ? '' : '$nombre ';
    return Semantics(
      button: onTap != null,
      enabled: onTap != null,
      onTap: onTap,
      label: '$compte$titre. $detail.',
      child: ExcludeSemantics(
        child: CpiCard(
          onTap: onTap,
          child: Row(
            children: <Widget>[
              Icon(icon, size: CpiIconSize.xxl, color: scheme.onSurfaceVariant),
              const SizedBox(width: CpiSpacing.sm),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  mainAxisSize: MainAxisSize.min,
                  children: <Widget>[
                    Text(
                      nombre == null ? titre : '$nombre $titre',
                      style: theme.textTheme.titleMedium,
                    ),
                    const SizedBox(height: CpiSpacing.xxs),
                    Text(
                      detail,
                      style: theme.textTheme.bodyMedium?.copyWith(
                        color: scheme.onSurfaceVariant,
                      ),
                    ),
                  ],
                ),
              ),
              if (onTap != null) ...<Widget>[
                const SizedBox(width: CpiSpacing.xs),
                Icon(
                  PhosphorIconsRegular.caretRight,
                  size: CpiIconSize.xl,
                  color: scheme.onSurfaceVariant,
                ),
              ],
            ],
          ),
        ),
      ),
    );
  }
}

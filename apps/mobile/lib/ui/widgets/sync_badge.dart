import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:phosphor_flutter/phosphor_flutter.dart';

import '../../core/providers/app_providers.dart';
import '../../core/router/route_paths.dart';
import '../../core/theme/cpi_colors.dart';
import '../../core/theme/cpi_tokens.dart';

/// Badge global de synchronisation, posé dans l'AppBar.
///
/// Il répond à une seule question, celle que le commercial se pose vingt fois
/// par jour : « est-ce que ce que j'ai saisi est parti ? ». Il compte donc les
/// opérations **non terminées** de l'outbox, pas les lignes locales.
///
/// Sur bordeaux, l'or lisible est `accent-on-dark` (#FFC65A, 8,71:1). L'or de
/// surface #C8921A y serait illisible.
class SyncBadge extends ConsumerWidget {
  const SyncBadge({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final AsyncValue<int> pending = ref.watch(pendingSyncCountProvider);
    final ThemeData theme = Theme.of(context);
    final int count = pending.value ?? 0;
    final bool clean = count == 0;

    return Semantics(
      button: true,
      label: clean
          ? 'Tout est synchronisé'
          : '$count élément${count > 1 ? 's' : ''} en attente de synchronisation',
      child: InkWell(
        onTap: () => context.go(Routes.corrections),
        borderRadius: CpiRadius.brFull,
        child: Padding(
          padding: const EdgeInsets.symmetric(
            horizontal: CpiSpacing.sm,
            vertical: CpiSpacing.xs,
          ),
          child: Row(
            mainAxisSize: MainAxisSize.min,
            children: <Widget>[
              // Le basculement « en attente » → « tout est envoyé » est le
              // seul événement que ce badge a à raconter : il se voit.
              AnimatedSwitcher(
                duration: CpiMotion.of(context).micro,
                switchInCurve: CpiMotion.of(context).easeSpring,
                transitionBuilder: (Widget child, Animation<double> a) =>
                    ScaleTransition(scale: a, child: child),
                child: Icon(
                  clean
                      ? PhosphorIconsRegular.checkCircle
                      : PhosphorIconsRegular.cloudSlash,
                  key: ValueKey<bool>(clean),
                  size: 22,
                  color: clean ? theme.colorScheme.onPrimary : context.cpi.accentOnDark,
                ),
              ),
              if (!clean) ...<Widget>[
                const SizedBox(width: CpiSpacing.xxs + 2),
                Text(
                  count > 99 ? '99+' : '$count',
                  style: theme.textTheme.labelLarge?.copyWith(
                    color: context.cpi.accentOnDark,
                  ),
                ),
              ],
            ],
          ),
        ),
      ),
    );
  }
}

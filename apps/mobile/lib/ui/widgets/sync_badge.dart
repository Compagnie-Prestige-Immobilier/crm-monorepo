import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:phosphor_flutter/phosphor_flutter.dart';

import '../../core/providers/app_providers.dart';
import '../../core/router/route_paths.dart';
import '../../core/theme/cpi_colors.dart';
import '../../core/theme/cpi_tokens.dart';

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
        child: ConstrainedBox(
          constraints: const BoxConstraints(minWidth: 48, minHeight: 48),
          child: Padding(
            padding: const EdgeInsets.symmetric(
              horizontal: CpiSpacing.sm,
              vertical: CpiSpacing.xs,
            ),
            child: Row(
              mainAxisSize: MainAxisSize.min,
              children: <Widget>[
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
      ),
    );
  }
}

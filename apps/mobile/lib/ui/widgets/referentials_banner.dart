import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:phosphor_flutter/phosphor_flutter.dart';

import '../../core/providers/app_providers.dart';
import '../../core/theme/cpi_colors.dart';
import '../../core/theme/cpi_tokens.dart';

class ReferentialsBanner extends ConsumerStatefulWidget {
  const ReferentialsBanner({super.key, required this.missing});

  final bool missing;

  @override
  ConsumerState<ReferentialsBanner> createState() => _ReferentialsBannerState();
}

class _ReferentialsBannerState extends ConsumerState<ReferentialsBanner> {
  bool _running = false;

  Future<void> _sync() async {
    setState(() => _running = true);
    try {
      await ref.read(syncCoordinatorProvider.notifier).run();
    } finally {
      if (mounted) setState(() => _running = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    if (!widget.missing) return const SizedBox.shrink();
    final ThemeData theme = Theme.of(context);
    final CpiColors cpi = context.cpi;

    return Semantics(
      liveRegion: true,
      child: Container(
        width: double.infinity,
        color: cpi.accentSurface,
        padding: const EdgeInsets.symmetric(
          horizontal: CpiSpacing.md,
          vertical: CpiSpacing.xs,
        ),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: <Widget>[
            Row(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: <Widget>[
                Icon(
                  PhosphorIconsRegular.cloudArrowDown,
                  size: CpiIconSize.sm,
                  color: cpi.accentText,
                ),
                const SizedBox(width: CpiSpacing.xs),
                Expanded(
                  child: Text(
                    'Référentiels non téléchargés : synchronisez pour pouvoir '
                    'enregistrer.',
                    style: theme.textTheme.bodySmall?.copyWith(
                      color: cpi.accentText,
                    ),
                  ),
                ),
              ],
            ),
            Align(
              alignment: AlignmentDirectional.centerEnd,
              child: TextButton(
                onPressed: _running ? null : _sync,
                child: _running
                    ? const SizedBox(
                        width: 16,
                        height: 16,
                        child: CircularProgressIndicator(strokeWidth: 2),
                      )
                    : const Text('Synchroniser'),
              ),
            ),
          ],
        ),
      ),
    );
  }
}

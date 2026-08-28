import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:forui/forui.dart';
import 'package:phosphor_flutter/phosphor_flutter.dart';

import '../../core/providers/app_providers.dart';
import '../../core/theme/cpi_colors.dart';
import '../../core/theme/cpi_tokens.dart';
import 'cpi_forui.dart';
import 'cpi_kit.dart';

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

    return Semantics(
      liveRegion: true,
      child: CpiForui(
        builder: (BuildContext context) => Padding(
          padding: const EdgeInsets.fromLTRB(
            CpiSpacing.md,
            CpiSpacing.xs,
            CpiSpacing.md,
            0,
          ),
          child: FAlert(
            // L'ambre porte l'avertissement sans virer au rouge : rien n'est
            // cassé, il manque un téléchargement. Le rembourrage est resserré :
            // le bandeau coiffe un formulaire, il ne doit pas lui prendre sa
            // place à 1,76x.
            style: FAlertStyleDelta.delta(
              iconStyle: IconThemeDataDelta.delta(
                color: context.cpi.accentText,
              ),
              padding: const EdgeInsetsGeometryDelta.value(
                EdgeInsets.symmetric(
                  horizontal: CpiSpacing.sm,
                  vertical: CpiSpacing.xs,
                ),
              ),
            ),
            icon: const Icon(PhosphorIconsRegular.cloudArrowDown),
            // Le corps de texte du bandeau reste celui d'une annotation : à
            // 1,76x, la taille de titre de ForUI lui ferait manger le
            // formulaire qu'il coiffe.
            title: Text(
              'Les listes ne sont pas encore sur ce téléphone.',
              style: Theme.of(context).textTheme.bodySmall,
            ),
            subtitle: CpiButton(
              'Recevoir les listes',
              variant: CpiButtonVariant.secondary,
              onPressed: _sync,
              loading: _running,
              expand: false,
            ),
          ),
        ),
      ),
    );
  }
}

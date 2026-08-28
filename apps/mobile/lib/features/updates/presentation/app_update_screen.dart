import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:forui/forui.dart';
import 'package:phosphor_flutter/phosphor_flutter.dart';

import '../../../core/updates/app_update_controller.dart';
import '../../../core/theme/cpi_tokens.dart';
import '../../../ui/widgets/cpi_action_bar.dart';
import '../../../ui/widgets/cpi_kit.dart';

class AppUpdateScreen extends ConsumerWidget {
  const AppUpdateScreen({super.key, required this.state});

  final AppUpdateState state;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final AndroidRelease release = state.release!;
    final bool force = release.forceUpdate;
    final AppUpdateController controller = ref.read(
      appUpdateControllerProvider.notifier,
    );
    final ThemeData theme = Theme.of(context);
    final bool downloading = state.status == AppUpdateStatus.downloading;

    return CpiScaffold(
      title: force
          ? 'Mise à jour nécessaire'
          : 'Une nouvelle version est disponible',
      body: SingleChildScrollView(
        padding: const EdgeInsets.fromLTRB(
          CpiSpacing.md,
          0,
          CpiSpacing.md,
          CpiSpacing.xl,
        ),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: <Widget>[
            DecoratedBox(
              decoration: BoxDecoration(
                color: theme.colorScheme.surfaceContainerHigh,
                shape: BoxShape.circle,
              ),
              child: Padding(
                padding: const EdgeInsets.all(CpiSpacing.md),
                child: Icon(
                  PhosphorIconsDuotone.cloudArrowDown,
                  size: CpiIconSize.xxxl,
                  color: theme.colorScheme.primary,
                ),
              ),
            ),
            const SizedBox(height: CpiSpacing.md),
            Text(
              'CPI GO ${release.versionName}',
              style: theme.textTheme.titleMedium,
            ),
            const SizedBox(height: CpiSpacing.xs),
            Text(
              _paragraph(state, release),
              style: theme.textTheme.bodyMedium?.copyWith(
                color: theme.colorScheme.onSurfaceVariant,
              ),
            ),
            if (force && !downloading) ...<Widget>[
              const SizedBox(height: CpiSpacing.sm),
              Text(
                'Cette mise à jour est obligatoire pour continuer à utiliser CPI GO.',
                style: theme.textTheme.labelMedium?.copyWith(
                  color: theme.colorScheme.onSurfaceVariant,
                ),
              ),
            ],
            if (downloading) ...<Widget>[
              const SizedBox(height: CpiSpacing.xl),
              if (state.progress == 0)
                const FProgress(semanticsLabel: 'Téléchargement en cours')
              else
                FDeterminateProgress(
                  value: state.progress.clamp(0, 1),
                  semanticsLabel: 'Téléchargement en cours',
                ),
              const SizedBox(height: CpiSpacing.sm),
              Semantics(
                liveRegion: true,
                child: Text(
                  state.progress == 0
                      ? 'Préparation du téléchargement…'
                      : '${(state.progress * 100).round()} % téléchargé',
                  style: theme.textTheme.labelMedium?.copyWith(
                    color: theme.colorScheme.onSurfaceVariant,
                  ),
                ),
              ),
            ],
          ],
        ),
      ),
      footer: downloading
          ? null
          : CpiActionBar(
              child: Column(
                mainAxisSize: MainAxisSize.min,
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: <Widget>[
                  _primary(state, controller),
                  if (!force) ...<Widget>[
                    const SizedBox(height: CpiSpacing.xs),
                    CpiButton(
                      'Plus tard',
                      variant: CpiButtonVariant.ghost,
                      onPressed: controller.postpone,
                    ),
                  ],
                ],
              ),
            ),
    );
  }
}

Widget _primary(AppUpdateState state, AppUpdateController controller) {
  if (state.isReady) {
    return CpiButton(
      'Installer la mise à jour',
      icon: PhosphorIconsRegular.deviceMobile,
      onPressed: controller.install,
    );
  }
  if (state.blocker == AppUpdateBlocker.meteredLink) {
    return CpiButton(
      'Télécharger maintenant',
      icon: PhosphorIconsRegular.downloadSimple,
      onPressed: controller.downloadNow,
    );
  }
  return CpiButton(
    'Réessayer',
    icon: PhosphorIconsRegular.arrowClockwise,
    onPressed: controller.retry,
  );
}

/// La seule phrase du corps : ce que la version apporte, ou ce qui bloque.
String _paragraph(AppUpdateState state, AndroidRelease release) {
  if (state.status == AppUpdateStatus.downloading) {
    return 'Le téléchargement est en cours. Gardez l\'application ouverte.';
  }
  if (!state.isReady) {
    if (state.blocker == AppUpdateBlocker.meteredLink) {
      return 'Vous êtes sur des données mobiles. '
          '${_megabytes(release.fileSize)} seront téléchargés. Sinon, le '
          'téléchargement démarrera seul au prochain Wi-Fi.';
    }
    return state.error ?? 'Le téléchargement n\'a pas pu démarrer.';
  }
  final String notes = release.notes?.trim() ?? '';
  if (notes.isNotEmpty) return notes;
  return 'La mise à jour est prête à être installée.';
}

String _megabytes(int bytes) {
  if (bytes <= 0) return 'Plusieurs mégaoctets';
  final double mb = bytes / (1024 * 1024);
  return '${mb.toStringAsFixed(mb >= 10 ? 0 : 1)} Mo';
}

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:forui/forui.dart';
import 'package:phosphor_flutter/phosphor_flutter.dart';

import '../../../core/providers/app_providers.dart';
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
    final bool force = state.belowFloor;
    final AppUpdateController controller = ref.read(
      appUpdateControllerProvider.notifier,
    );
    final ThemeData theme = Theme.of(context);
    final bool downloading = state.status == AppUpdateStatus.downloading;
    // L'écran bloquant prend la main APRÈS le montage de la synchronisation :
    // ce qui reste dans l'outbox part pendant qu'il s'affiche, et l'installation
    // n'est proposée qu'une fois la file vide.
    final int pending = ref.watch(pendingSyncCountProvider).value ?? 0;

    return CpiScaffold(
      title: force
          ? 'Mise à jour obligatoire'
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
            if (pending > 0) ...<Widget>[
              const SizedBox(height: CpiSpacing.md),
              CpiStatusBand(
                text: '$pending ${_saisies(pending)} encore à envoyer',
                tone: CpiTone.warning,
                padded: false,
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

String _saisies(int count) => count > 1 ? 'saisies' : 'saisie';

Widget _primary(AppUpdateState state, AppUpdateController controller) {
  if (state.isReady && !state.canInstall) {
    return CpiButton(
      'Autoriser l\'installation',
      icon: PhosphorIconsRegular.lockKeyOpen,
      onPressed: controller.openInstallSettings,
    );
  }
  if (state.isReady) {
    // Une mise à jour d'APK GARDE les données de l'application : les saisies non
    // envoyées survivent et partent après. Bloquer l'installation tant que la
    // file n'est pas vide laissait un bouton mort sans explication, et rendait
    // une mise à jour obligatoire impossible à poser. La bannière « X saisies à
    // envoyer » suffit à prévenir.
    return CpiButton(
      'Installer',
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
  if (state.blocker == AppUpdateBlocker.diskSpace) {
    return 'Il manque ${_megabytes(state.missingBytes)} sur le téléphone. '
        'Libérez de la place, puis réessayez.';
  }
  if (state.isReady && !state.canInstall) {
    return 'Android demande votre accord pour que CPI GO installe cette '
        'mise à jour. Ouvrez les réglages, autorisez CPI GO, puis revenez.';
  }
  if (!state.isReady) {
    if (state.blocker == AppUpdateBlocker.meteredLink) {
      return 'Vous êtes sur des données mobiles. '
          '${_megabytes(release.fileSize)} seront téléchargés. Sinon, le '
          'téléchargement démarrera seul au prochain Wi-Fi.';
    }
    return state.error ?? 'Le téléchargement n\'a pas pu démarrer.';
  }
  final String? erreur = state.error;
  if (erreur != null) return erreur;
  final String notes = release.notes?.trim() ?? '';
  if (notes.isNotEmpty) return notes;
  return 'La mise à jour est prête à être installée.';
}

String _megabytes(int bytes) {
  if (bytes <= 0) return 'Plusieurs mégaoctets';
  final double mb = bytes / (1024 * 1024);
  return '${mb.toStringAsFixed(mb >= 10 ? 0 : 1)} Mo';
}

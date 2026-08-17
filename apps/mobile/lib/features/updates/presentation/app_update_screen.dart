import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/updates/app_update_controller.dart';

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
    return Scaffold(
      body: SafeArea(
        child: Center(
          child: SingleChildScrollView(
            padding: const EdgeInsets.all(28),
            child: ConstrainedBox(
              constraints: const BoxConstraints(maxWidth: 420),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: <Widget>[
                  const Icon(Icons.system_update_rounded, size: 54),
                  const SizedBox(height: 24),
                  Text(
                    force
                        ? 'Mise à jour nécessaire'
                        : 'Une nouvelle version est disponible',
                    style: theme.textTheme.headlineSmall,
                    textAlign: TextAlign.center,
                  ),
                  const SizedBox(height: 10),
                  Text(
                    'CPI GO ${release.versionName}',
                    style: theme.textTheme.titleMedium,
                    textAlign: TextAlign.center,
                  ),
                  if (release.notes != null &&
                      release.notes!.trim().isNotEmpty) ...<Widget>[
                    const SizedBox(height: 16),
                    Text(release.notes!, textAlign: TextAlign.center),
                  ],
                  const SizedBox(height: 28),
                  if (state.status == AppUpdateStatus.downloading) ...<Widget>[
                    LinearProgressIndicator(
                      value: state.progress == 0 ? null : state.progress,
                    ),
                    const SizedBox(height: 10),
                    Text(
                      state.progress == 0
                          ? 'Préparation du téléchargement…'
                          : '${(state.progress * 100).round()} % téléchargé',
                      textAlign: TextAlign.center,
                    ),
                  ] else if (state.isReady) ...<Widget>[
                    FilledButton.icon(
                      onPressed: controller.install,
                      icon: const Icon(Icons.install_mobile_rounded),
                      label: const Text('Installer la mise à jour'),
                    ),
                  ] else if (state.blocker == AppUpdateBlocker.meteredLink) ...<Widget>[
                    Text(
                      'Vous êtes sur des données mobiles. '
                      '${_megabytes(release.fileSize)} seront téléchargés.',
                      textAlign: TextAlign.center,
                    ),
                    const SizedBox(height: 12),
                    FilledButton.icon(
                      onPressed: controller.downloadNow,
                      icon: const Icon(Icons.download_rounded),
                      label: const Text('Télécharger maintenant'),
                    ),
                    const SizedBox(height: 8),
                    Text(
                      'Sinon, le téléchargement démarrera seul au prochain Wi-Fi.',
                      style: theme.textTheme.bodySmall,
                      textAlign: TextAlign.center,
                    ),
                  ] else ...<Widget>[
                    Text(
                      state.error ?? 'Le téléchargement n’a pas pu démarrer.',
                      textAlign: TextAlign.center,
                    ),
                    const SizedBox(height: 12),
                    OutlinedButton.icon(
                      onPressed: controller.retry,
                      icon: const Icon(Icons.refresh_rounded),
                      label: const Text('Réessayer'),
                    ),
                  ],
                  if (!force) ...<Widget>[
                    const SizedBox(height: 12),
                    TextButton(
                      onPressed: controller.postpone,
                      child: const Text('Plus tard'),
                    ),
                  ],
                  if (force) ...<Widget>[
                    const SizedBox(height: 16),
                    Text(
                      'Cette mise à jour est obligatoire pour continuer à utiliser CPI GO.',
                      style: theme.textTheme.bodySmall,
                      textAlign: TextAlign.center,
                    ),
                  ],
                ],
              ),
            ),
          ),
        ),
      ),
    );
  }
}

String _megabytes(int bytes) {
  if (bytes <= 0) return 'Plusieurs mégaoctets';
  final double mb = bytes / (1024 * 1024);
  return '${mb.toStringAsFixed(mb >= 10 ? 0 : 1)} Mo';
}

import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:forui/forui.dart';
import 'package:intl/intl.dart';
import 'package:phosphor_flutter/phosphor_flutter.dart';

import '../../../core/network/api_environment.dart';
import '../../../core/providers/app_providers.dart';
import '../../../core/providers/sync_coordinator.dart';
import '../../../core/router/back_navigation.dart';
import '../../../core/sync/sync_engine.dart';
import '../../../core/theme/cpi_tokens.dart';
import '../../../core/theme/cpi_typography.dart';
import '../../../ui/widgets/cpi_kit.dart';
import '../../auth/auth_state.dart';
import '../../shell/app_shell.dart';

class AboutScreen extends ConsumerWidget {
  const AboutScreen({super.key});

  static final DateFormat _stamp = DateFormat('d MMMM y à HH:mm', 'fr');

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final String retour = reglagesDeLaCoque(context);
    return CpiPopScope(
      fallback: retour,
      child: CpiScaffold(
        title: 'À propos',
        leading: CpiBackButton(fallback: retour),
        // `Builder` : les messages de copie ont besoin d'un contexte sous le
        // `FToaster` que pose `CpiScaffold`.
        body: Builder(builder: (BuildContext context) => _body(context, ref)),
      ),
    );
  }

  Widget _body(BuildContext context, WidgetRef ref) {
    final ThemeData theme = Theme.of(context);
    final AuthState auth = ref.watch(authControllerProvider);
    final SyncUiState sync = ref.watch(syncCoordinatorProvider);
    final String build = ref.watch(buildNumberProvider);

    final List<({String label, String value})> rows =
        <({String label, String value})>[
          (label: 'Version', value: '1.0.0'),
          (label: 'Build', value: build),
          (label: 'Environnement', value: _environmentLabel),
          (label: 'Serveur', value: ApiEnvironment.baseUrl),
          (
            label: 'Version des données',
            value: 'v${SyncEngine.payloadVersion}',
          ),
          (
            label: 'Dernière synchronisation',
            value: sync.lastRunAt == null
                ? 'Aucune'
                : _stamp.format(sync.lastRunAt!),
          ),
          (label: 'Compte', value: auth.email ?? auth.fullName ?? 'Inconnu'),
          (label: 'Numéro de compte', value: auth.userId ?? 'Inconnu'),
        ];

    return ListView(
      padding: const EdgeInsets.fromLTRB(
        CpiSpacing.md,
        CpiSpacing.xs,
        CpiSpacing.md,
        CpiSpacing.xl,
      ),
      children: <Widget>[
        Row(
          children: <Widget>[
            Image.asset(
              'assets/brand/cpi-logo.png',
              width: 108,
              height: 44,
              cacheWidth: 216,
              fit: BoxFit.contain,
              filterQuality: FilterQuality.medium,
              semanticLabel: 'CPI',
            ),
            const SizedBox(width: CpiSpacing.sm),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: <Widget>[
                  Text('CPI GO', style: theme.textTheme.titleMedium),
                  Text(
                    'Version 1.0.0 · build $build',
                    style: theme.textTheme.bodyMedium?.copyWith(
                      color: theme.colorScheme.onSurfaceVariant,
                    ),
                  ),
                ],
              ),
            ),
          ],
        ),
        const SizedBox(height: CpiSpacing.lg),
        CpiButton(
          'Copier pour le support',
          icon: PhosphorIconsRegular.copy,
          onPressed: () => _copyAll(context, rows),
        ),
        const SizedBox(height: CpiSpacing.lg),
        Text(
          'INFORMATIONS TECHNIQUES',
          style: CpiTypography.sectionLabel.copyWith(
            color: theme.colorScheme.onSurfaceVariant,
          ),
        ),
        const SizedBox(height: CpiSpacing.xs),
        FTileGroup(
          children: <FTileMixin>[
            for (final ({String label, String value}) row in rows)
              _LigneCopiable(
                label: row.label,
                value: row.value,
                onCopy: () =>
                    _copyOne(context, label: row.label, value: row.value),
              ),
          ],
        ),
        const SizedBox(height: CpiSpacing.lg),
        Text(
          'Compagnie Prestige Immobilier.\n'
          'Tous droits réservés.',
          style: theme.textTheme.bodyMedium?.copyWith(
            color: theme.colorScheme.onSurfaceVariant,
          ),
        ),
      ],
    );
  }

  static String get _environmentLabel {
    const String url = ApiEnvironment.baseUrl;
    if (ApiEnvironment.isDevelopmentServer) return 'Développement';
    if (url.contains('demo') ||
        url.contains('staging') ||
        url.contains('recette')) {
      return 'Démonstration';
    }
    return 'Production';
  }

  static Future<void> _copyOne(
    BuildContext context, {
    required String label,
    required String value,
  }) => _copy(context, text: value, done: '$label copié');

  static Future<void> _copyAll(
    BuildContext context,
    List<({String label, String value})> rows,
  ) => _copy(
    context,
    text: rows
        .map((({String label, String value}) r) => '${r.label} : ${r.value}')
        .join('\n'),
    done: 'Informations copiées',
  );

  /// Le message bref est le SEUL compte rendu de la copie : celui de l'échec
  /// reste donc à l'écran tant qu'on ne le ferme pas.
  static Future<void> _copy(
    BuildContext context, {
    required String text,
    required String done,
  }) async {
    try {
      await Clipboard.setData(ClipboardData(text: text));
    } on Object {
      if (!context.mounted) return;
      cpiToast(context, 'Copie impossible. Réessayez.', persistent: true);
      return;
    }
    await HapticFeedback.selectionClick();
    if (!context.mounted) return;
    cpiToast(context, done);
  }
}

/// Une information technique et son geste de copie : la ligne entière copie,
/// et l'icône le dit. Aucun appui long, qui ne se verrait pas.
class _LigneCopiable extends StatelessWidget with FTileMixin {
  const _LigneCopiable({
    required this.label,
    required this.value,
    required this.onCopy,
  });

  final String label;
  final String value;
  final VoidCallback onCopy;

  @override
  Widget build(BuildContext context) {
    final ThemeData theme = Theme.of(context);
    return Semantics(
      container: true,
      button: true,
      label: '$label : $value. Copier',
      excludeSemantics: true,
      onTap: onCopy,
      child: FTile(
        title: Text(
          label,
          style: theme.textTheme.bodyMedium?.copyWith(
            color: theme.colorScheme.onSurfaceVariant,
          ),
        ),
        details: Text(value, textAlign: TextAlign.end),
        suffix: const Icon(PhosphorIconsRegular.copy, size: CpiIconSize.md),
        onPress: onCopy,
      ),
    );
  }
}

import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:intl/intl.dart';
import 'package:phosphor_flutter/phosphor_flutter.dart';

import '../../../core/network/api_environment.dart';
import '../../../core/providers/app_providers.dart';
import '../../../core/providers/sync_coordinator.dart';
import '../../../core/router/back_navigation.dart';
import '../../../core/router/route_paths.dart';
import '../../../core/sync/sync_engine.dart';
import '../../../core/theme/cpi_colors.dart';
import '../../../core/theme/cpi_tokens.dart';
import '../../../core/theme/cpi_typography.dart';
import '../../auth/auth_state.dart';

/// « À propos ».
///
/// C'est ici, et nulle part ailleurs, que vivent les valeurs techniques :
/// numéro de build, adresse du serveur, identifiant de compte. Sur un écran
/// courant, un identifiant de base de données n'informe personne ; ici il a un
/// usage précis — le dire au support — et un seul geste pour le transmettre.
class AboutScreen extends ConsumerWidget {
  const AboutScreen({super.key});

  static final DateFormat _stamp = DateFormat('d MMMM y à HH:mm', 'fr');

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final ThemeData theme = Theme.of(context);
    final CpiColors cpi = context.cpi;
    final AuthState auth = ref.watch(authControllerProvider);
    final SyncUiState sync = ref.watch(syncCoordinatorProvider);
    final String build = ref.watch(buildNumberProvider);

    final List<({String label, String value})> rows = <({String label, String value})>[
      (label: 'Version', value: '1.0.0'),
      (label: 'Build', value: build),
      (label: 'Environnement', value: _environmentLabel),
      (label: 'Serveur', value: ApiEnvironment.baseUrl),
      (label: 'Format des données', value: 'v${SyncEngine.payloadVersion}'),
      (
        label: 'Dernière synchronisation',
        value: sync.lastRunAt == null ? 'Aucune' : _stamp.format(sync.lastRunAt!),
      ),
      (label: 'Compte', value: auth.email ?? auth.fullName ?? 'Inconnu'),
      (label: 'Identifiant de compte', value: auth.userId ?? 'Inconnu'),
    ];

    return CpiPopScope(
      fallback: Routes.reglages,
      child: Scaffold(
        appBar: AppBar(
          title: const Text('À propos'),
          leading: const CpiBackButton(fallback: Routes.reglages),
        ),
        body: ListView(
          padding: const EdgeInsets.fromLTRB(
            CpiSpacing.md,
            CpiSpacing.sm,
            CpiSpacing.md,
            CpiSpacing.md,
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
            Text(
              'INFORMATIONS TECHNIQUES',
              style: CpiTypography.sectionLabel.copyWith(
                color: theme.colorScheme.onSurfaceVariant,
              ),
            ),
            const SizedBox(height: CpiSpacing.xs),
            Container(
              decoration: BoxDecoration(
                color: theme.colorScheme.surfaceContainerLowest,
                borderRadius: CpiRadius.brLg,
                border: Border.all(color: cpi.borderSubtle),
              ),
              child: Column(
                children: <Widget>[
                  for (int i = 0; i < rows.length; i++) ...<Widget>[
                    if (i > 0) Divider(height: 1, color: cpi.borderSubtle),
                    _InfoRow(label: rows[i].label, value: rows[i].value),
                  ],
                ],
              ),
            ),
            const SizedBox(height: CpiSpacing.sm),
            OutlinedButton.icon(
              onPressed: () => _copy(context, rows),
              icon: const Icon(PhosphorIconsRegular.copy, size: 20),
              label: const Text('Copier pour le support'),
            ),
            const SizedBox(height: CpiSpacing.lg),
            Text(
              'Compagnie Panafricaine d\'Investissement.\n'
              'Tous droits réservés.',
              style: theme.textTheme.bodyMedium?.copyWith(
                color: theme.colorScheme.onSurfaceVariant,
              ),
            ),
          ],
        ),
      ),
    );
  }

  /// Démonstration ou production, déduit de l'adresse du serveur.
  ///
  /// Déduit et non déclaré : un drapeau de build supplémentaire finirait par
  /// dire « production » alors que l'app pointe sur une machine de test, ce qui
  /// est précisément le mensonge que cet écran doit rendre impossible.
  static String get _environmentLabel {
    final String url = ApiEnvironment.baseUrl;
    if (url.contains('10.0.2.2') ||
        url.contains('localhost') ||
        url.contains('127.0.0.1')) {
      return 'Développement';
    }
    if (url.contains('demo') || url.contains('staging') || url.contains('recette')) {
      return 'Démonstration';
    }
    return 'Production';
  }

  static Future<void> _copy(
    BuildContext context,
    List<({String label, String value})> rows,
  ) async {
    final String text = rows
        .map((({String label, String value}) r) => '${r.label} : ${r.value}')
        .join('\n');
    await Clipboard.setData(ClipboardData(text: text));
    await HapticFeedback.selectionClick();
    if (!context.mounted) return;
    ScaffoldMessenger.of(
      context,
    ).showSnackBar(const SnackBar(content: Text('Informations copiées')));
  }
}

/// Ligne « libellé / valeur », copiable par appui long.
class _InfoRow extends StatelessWidget {
  const _InfoRow({required this.label, required this.value});

  final String label;
  final String value;

  @override
  Widget build(BuildContext context) {
    final ThemeData theme = Theme.of(context);
    return Semantics(
      label: '$label : $value. Appui long pour copier.',
      child: ExcludeSemantics(
        child: InkWell(
          onLongPress: () async {
            await Clipboard.setData(ClipboardData(text: value));
            await HapticFeedback.selectionClick();
            if (!context.mounted) return;
            ScaffoldMessenger.of(
              context,
            ).showSnackBar(SnackBar(content: Text('$label copié')));
          },
          child: Padding(
            padding: const EdgeInsets.symmetric(
              horizontal: CpiSpacing.sm,
              vertical: CpiSpacing.sm,
            ),
            child: Row(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: <Widget>[
                SizedBox(
                  width: 132,
                  child: Text(
                    label,
                    style: theme.textTheme.bodyMedium?.copyWith(
                      color: theme.colorScheme.onSurfaceVariant,
                    ),
                  ),
                ),
                Expanded(
                  child: Text(
                    value,
                    style: theme.textTheme.bodyMedium,
                    textAlign: TextAlign.end,
                  ),
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}

import 'dart:developer' as developer;
import 'dart:io';

import 'package:android_intent_plus/android_intent.dart';
import 'package:flutter/material.dart';
import 'package:phosphor_flutter/phosphor_flutter.dart';

import '../../../core/router/back_navigation.dart';
import '../../../core/router/route_paths.dart';
import '../../../core/theme/cpi_colors.dart';
import '../../../core/theme/cpi_tokens.dart';

class BatteryHelpScreen extends StatelessWidget {
  const BatteryHelpScreen({super.key});

  @override
  Widget build(BuildContext context) {
    final ThemeData theme = Theme.of(context);
    final CpiColors cpi = context.cpi;

    return CpiPopScope(
      fallback: Routes.reglages,
      child: Scaffold(
        appBar: AppBar(
          title: const Text('Autorisations et batterie'),
          leading: const CpiBackButton(fallback: Routes.reglages),
        ),
        body: ListView(
          padding: const EdgeInsets.all(CpiSpacing.md),
          children: <Widget>[
            Container(
              padding: const EdgeInsets.all(CpiSpacing.sm),
              decoration: BoxDecoration(
                color: cpi.infoSurface,
                borderRadius: CpiRadius.brMd,
              ),
              child: Row(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: <Widget>[
                  Icon(
                    PhosphorIconsRegular.info,
                    size: CpiIconSize.md,
                    color: cpi.info,
                  ),
                  const SizedBox(width: CpiSpacing.xs),
                  Expanded(
                    child: Text(
                      'Ces réglages permettent l\'envoi pendant que l\'app est '
                      'fermée.',
                      style: theme.textTheme.bodySmall?.copyWith(
                        color: cpi.info,
                      ),
                    ),
                  ),
                ],
              ),
            ),
            const SizedBox(height: CpiSpacing.lg),
            Text('Trois réglages', style: theme.textTheme.titleSmall),
            const SizedBox(height: CpiSpacing.xs),
            const _Step(
              index: 1,
              title: 'Optimisation de la batterie',
              body:
                  'Réglages → Batterie → Optimisation de la batterie → CPI GO → '
                  '« Ne pas optimiser ».',
            ),
            const _Step(
              index: 2,
              title: 'Démarrage automatique (Xiaomi, Tecno, Infinix, itel)',
              body:
                  'Sécurité → Autorisations → Démarrage automatique → activer '
                  'CPI GO.',
            ),
            const _Step(
              index: 3,
              title: 'Verrouiller l\'app dans les tâches récentes',
              body:
                  'Ouvrez les applications récentes, puis touchez le cadenas '
                  'sur CPI GO. Sur beaucoup de ROM, seul ce cadenas empêche la '
                  'fermeture automatique.',
            ),
            const SizedBox(height: CpiSpacing.lg),
            FilledButton.icon(
              onPressed: _openBatterySettings,
              icon: const Icon(PhosphorIconsRegular.gear, size: CpiIconSize.md),
              label: const Text('Ouvrir les réglages de batterie'),
            ),
            const SizedBox(height: CpiSpacing.xs),
            OutlinedButton.icon(
              onPressed: _openAppSettings,
              icon: const Icon(
                PhosphorIconsRegular.slidersHorizontal,
                size: CpiIconSize.md,
              ),
              label: const Text('Ouvrir la fiche de l\'application'),
            ),
          ],
        ),
      ),
    );
  }

  static Future<void> _openBatterySettings() async {
    if (!Platform.isAndroid) return;
    try {
      await const AndroidIntent(
        action: 'android.settings.IGNORE_BATTERY_OPTIMIZATION_SETTINGS',
      ).launch();
    } on Object catch (e) {
      developer.log(
        'Réglages de batterie inaccessibles : $e',
        name: 'cpi.perm',
      );
      await _openAppSettings();
    }
  }

  static Future<void> _openAppSettings() async {
    if (!Platform.isAndroid) return;
    try {
      await const AndroidIntent(
        action: 'android.settings.APPLICATION_DETAILS_SETTINGS',
        data: 'package:sn.cpi.go',
      ).launch();
    } on Object catch (e) {
      developer.log('Fiche application inaccessible : $e', name: 'cpi.perm');
    }
  }
}

class _Step extends StatelessWidget {
  const _Step({required this.index, required this.title, required this.body});

  final int index;
  final String title;
  final String body;

  @override
  Widget build(BuildContext context) {
    final ThemeData theme = Theme.of(context);
    return Padding(
      padding: const EdgeInsets.only(top: CpiSpacing.sm),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: <Widget>[
          Container(
            width: 26,
            height: 26,
            alignment: Alignment.center,
            decoration: BoxDecoration(
              color: context.cpi.accent,
              borderRadius: CpiRadius.brFull,
            ),
            child: Text(
              '$index',
              style: theme.textTheme.labelLarge?.copyWith(
                color: context.cpi.accentForeground,
              ),
            ),
          ),
          const SizedBox(width: CpiSpacing.sm),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: <Widget>[
                Text(title, style: theme.textTheme.titleSmall),
                const SizedBox(height: 2),
                Text(body, style: theme.textTheme.bodySmall),
              ],
            ),
          ),
        ],
      ),
    );
  }
}

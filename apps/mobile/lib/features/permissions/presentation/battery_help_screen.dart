import 'dart:developer' as developer;
import 'dart:io';

import 'package:android_intent_plus/android_intent.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:forui/forui.dart';
import 'package:phosphor_flutter/phosphor_flutter.dart';

import '../../../core/notifications/rep_callback_notifications.dart';
import '../../../core/router/back_navigation.dart';
import '../../../core/theme/cpi_tokens.dart';
import '../../../ui/widgets/cpi_kit.dart';
import '../../shell/app_shell.dart';
import '../alarme_permission.dart';

class BatteryHelpScreen extends ConsumerWidget {
  const BatteryHelpScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final ThemeData theme = Theme.of(context);
    final String retour = reglagesDeLaCoque(context);

    return CpiPopScope(
      fallback: retour,
      child: CpiScaffold(
        title: 'L\'app s\'arrête toute seule ?',
        leading: CpiBackButton(fallback: retour),
        // `Builder` : le message de repli a besoin d'un contexte SOUS le
        // `FToaster` que pose `CpiScaffold`.
        body: Builder(
          builder: (BuildContext context) => ListView(
            padding: const EdgeInsets.fromLTRB(
              CpiSpacing.md,
              CpiSpacing.xs,
              CpiSpacing.md,
              CpiSpacing.xl,
            ),
            children: <Widget>[
              const CpiStatusBand(
                text:
                    'Ces trois réglages laissent l\'app envoyer quand elle est '
                    'fermée.',
              ),
              const SizedBox(height: CpiSpacing.lg),
              Text('Trois réglages', style: theme.textTheme.titleSmall),
              const SizedBox(height: CpiSpacing.xs),
              const CpiCard.rows(<CpiRow>[
                CpiRow(
                  leading: _StepNumber(1),
                  title: 'Optimisation de la batterie',
                  subtitle:
                      'Réglages → Batterie → Optimisation de la batterie → '
                      'CPI GO → « Ne pas optimiser ».',
                ),
                CpiRow(
                  leading: _StepNumber(2),
                  title: 'Démarrage automatique (Xiaomi, Tecno, Infinix, itel)',
                  subtitle:
                      'Sécurité → Autorisations → Démarrage automatique → '
                      'activer CPI GO.',
                ),
                CpiRow(
                  leading: _StepNumber(3),
                  title: 'Mettre le cadenas sur l\'app',
                  subtitle:
                      'Ouvrez les applications récentes, puis touchez le '
                      'cadenas sur CPI GO. Sur beaucoup de téléphones, seul ce '
                      'cadenas empêche la fermeture automatique.',
                ),
              ]),
              const SizedBox(height: CpiSpacing.lg),
              Text('Les rappels promis', style: theme.textTheme.titleSmall),
              const SizedBox(height: CpiSpacing.xs),
              const CpiCard.rows(<CpiRow>[
                CpiRow(
                  leading: _StepNumber(4),
                  title: 'Alarme sur l\'écran verrouillé',
                  subtitle:
                      'Depuis Android 14, l\'alarme d\'un rappel ne s\'affiche '
                      'par-dessus l\'écran verrouillé qu\'avec cette '
                      'autorisation.',
                ),
              ]),
              const SizedBox(height: CpiSpacing.lg),
              if (Platform.isAndroid) ...<Widget>[
                CpiButton(
                  'Ouvrir les réglages du téléphone',
                  icon: PhosphorIconsRegular.gear,
                  onPressed: () => _openBatterySettings(context),
                ),
                const SizedBox(height: CpiSpacing.xs),
                CpiButton(
                  'Autoriser l\'alarme plein écran',
                  variant: CpiButtonVariant.ghost,
                  icon: PhosphorIconsRegular.bellRinging,
                  onPressed: () => ref
                      .read(repCallbackNotificationsProvider)
                      .requestFullScreenIntent(),
                ),
                const SizedBox(height: CpiSpacing.xs),
                CpiButton(
                  'Ouvrir la fiche de l\'application',
                  variant: CpiButtonVariant.ghost,
                  onPressed: () => ouvrirLaFicheApplication(context),
                ),
              ] else
                Text(
                  'Ces réglages n\'existent que sur Android.',
                  style: theme.textTheme.bodyMedium?.copyWith(
                    color: theme.colorScheme.onSurfaceVariant,
                  ),
                ),
            ],
          ),
        ),
      ),
    );
  }

  static Future<void> _openBatterySettings(BuildContext context) async {
    try {
      await const AndroidIntent(
        action: 'android.settings.IGNORE_BATTERY_OPTIMIZATION_SETTINGS',
      ).launch();
    } on Object catch (e) {
      developer.log(
        'Réglages de batterie inaccessibles : $e',
        name: 'cpi.perm',
      );
      if (!context.mounted) return;
      await ouvrirLaFicheApplication(context);
    }
  }
}

/// Rang de l'étape, en pastille : le pas à suivre se lit dans l'ordre.
class _StepNumber extends StatelessWidget {
  const _StepNumber(this.index);

  final int index;

  @override
  Widget build(BuildContext context) => FBadge(child: Text('$index'));
}

import 'dart:developer' as developer;
import 'dart:io';

import 'package:android_intent_plus/android_intent.dart';
import 'package:flutter/material.dart';
import 'package:phosphor_flutter/phosphor_flutter.dart';

import '../../../core/theme/cpi_colors.dart';
import '../../../core/theme/cpi_tokens.dart';

/// « Autorisations & batterie ».
///
/// ## Pourquoi cet écran existe
///
/// Android ne dit jamais « j'ai supprimé votre tâche de fond ». Sur les ROM
/// Transsion (Tecno, Infinix, itel) et Xiaomi — qui représentent l'essentiel du
/// parc sénégalais — une couche maison tue les processus en arrière-plan
/// indépendamment de ce que prévoit AOSP, et souvent indépendamment de
/// l'exemption d'optimisation de batterie standard. Le résultat, côté
/// utilisateur, est une app qui « ne synchronise pas », sans message, sans
/// erreur, sans rien à cliquer.
///
/// Le seul remède est humain : indiquer le réglage constructeur à changer. On
/// ouvre donc l'écran système correspondant, et on décrit le chemin en toutes
/// lettres pour les ROM où l'Intent n'aboutit pas.
///
/// **On ne demande PAS `REQUEST_IGNORE_BATTERY_OPTIMIZATIONS`.** Google Play
/// n'accepte cette permission que pour une liste courte de cas d'usage — alarmes,
/// VoIP, suivi d'activité — dont la synchronisation de données ne fait pas
/// partie. La demander ferait rejeter la publication. On ouvre l'écran de
/// réglages, l'utilisateur décide.
class BatteryHelpScreen extends StatelessWidget {
  const BatteryHelpScreen({super.key});

  @override
  Widget build(BuildContext context) {
    final ThemeData theme = Theme.of(context);
    final CpiColors cpi = context.cpi;

    return Scaffold(
      appBar: AppBar(title: const Text('Autorisations & batterie')),
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
                Icon(PhosphorIconsRegular.info, size: 20, color: cpi.info),
                const SizedBox(width: CpiSpacing.xs),
                Expanded(
                  child: Text(
                    'Vos saisies ne sont jamais perdues : elles restent sur '
                    'l\'appareil jusqu\'à leur envoi. Ces réglages servent '
                    'seulement à ce que l\'envoi puisse se faire pendant que '
                    'l\'app est fermée.',
                    style: theme.textTheme.bodySmall?.copyWith(color: cpi.info),
                  ),
                ),
              ],
            ),
          ),
          const SizedBox(height: CpiSpacing.lg),
          Text('Trois réglages à vérifier', style: theme.textTheme.titleSmall),
          const SizedBox(height: CpiSpacing.xs),
          const _Step(
            index: 1,
            title: 'Optimisation de la batterie',
            body: 'Réglages → Batterie → Optimisation de la batterie → CPI GO → '
                '« Ne pas optimiser ».',
          ),
          const _Step(
            index: 2,
            title: 'Démarrage automatique (Xiaomi, Tecno, Infinix, itel)',
            body: 'Sécurité → Autorisations → Démarrage automatique → activer '
                'CPI GO. Sans cette autorisation, l\'app ne peut pas être '
                'réveillée par le système.',
          ),
          const _Step(
            index: 3,
            title: 'Verrouiller l\'app dans les tâches récentes',
            body: 'Ouvrez les applications récentes, puis touchez le cadenas '
                'sur CPI GO. Sur beaucoup de ROM, c\'est ce cadenas — et rien '
                'd\'autre — qui empêche la fermeture automatique.',
          ),
          const SizedBox(height: CpiSpacing.lg),
          FilledButton.icon(
            onPressed: _openBatterySettings,
            icon: const Icon(PhosphorIconsRegular.gear, size: 20),
            label: const Text('Ouvrir les réglages de batterie'),
          ),
          const SizedBox(height: CpiSpacing.xs),
          OutlinedButton.icon(
            onPressed: _openAppSettings,
            icon: const Icon(PhosphorIconsRegular.slidersHorizontal, size: 20),
            label: const Text('Ouvrir la fiche de l\'application'),
          ),
        ],
      ),
    );
  }

  static Future<void> _openBatterySettings() async {
    if (!Platform.isAndroid) return;
    try {
      // Écran de LISTE, et non la boîte de dialogue de demande directe : cette
      // dernière exige `REQUEST_IGNORE_BATTERY_OPTIMIZATIONS`, que Google Play
      // refuse pour de la synchronisation de données.
      await const AndroidIntent(
        action: 'android.settings.IGNORE_BATTERY_OPTIMIZATION_SETTINGS',
      ).launch();
    } on Object catch (e) {
      developer.log('Réglages de batterie inaccessibles : $e', name: 'cpi.perm');
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
              // Surface or décorative — le texte posé dessus est
              // `accentForeground` (#1C0810, 6,95:1), jamais l'or lui-même.
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

import 'dart:developer' as developer;

import 'package:flutter/foundation.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:shared_preferences/shared_preferences.dart';

import '../../core/providers/app_providers.dart';
import '../../core/telephonie/telephonie_port.dart';
import '../../core/theme/cpi_tokens.dart';
import '../../ui/widgets/cpi_kit.dart';
import 'alarme_permission.dart';

/// EB-37 : la lecture du journal d'appels donne la durée de communication.
/// Demandée UNE fois, à la première ouverture de fiche ; refusée, elle se
/// rappelle à l'accueil et en supervision, sans jamais bloquer la saisie.
const String kClePrefsJournalDemande = 'cpi.telephonie.journalDemande';

/// Vrai si la permission est accordée, faux si refusée, nul hors Android ou
/// quand le canal natif ne répond pas : « inconnu » n'est pas « refusé ».
Future<bool?> journalAppelsAutorise(Telephonie telephonie) async {
  if (defaultTargetPlatform != TargetPlatform.android) return null;
  final EtatTelephonie etat = await telephonie.etat();
  if (etat.permissions.isEmpty) return null;
  return etat.permission(PermissionsTelephonie.journalAppels) ==
      EtatPermission.accordee;
}

/// Ne lève jamais : une préférence ou un canal absent ne doit pas interrompre
/// l'ouverture de la fiche qui vient de réussir.
Future<void> demanderLeJournalUneFois(BuildContext context, WidgetRef ref) async {
  try {
    final SharedPreferences prefs = ref.read(sharedPreferencesProvider);
    if (prefs.getBool(kClePrefsJournalDemande) ?? false) return;
    await prefs.setBool(kClePrefsJournalDemande, true);

    final Telephonie telephonie = ref.read(telephonieProvider);
    if (await journalAppelsAutorise(telephonie) != false || !context.mounted) {
      return;
    }
    final bool? continuer = await cpiConfirm(
      context,
      title: 'Journal d\'appels',
      message:
          'CPI GO lit le journal d\'appels pour mesurer la durée de vos '
          'communications.',
      confirmLabel: 'Continuer',
      cancelLabel: 'Plus tard',
    );
    if (continuer != true) return;
    await telephonie.demanderPermission(PermissionsTelephonie.journalAppels);
    ref.invalidate(journalAppelsAutoriseProvider);
  } on Object catch (e) {
    developer.log('Journal d\'appels non demandé : $e', name: 'cpi.perm');
  }
}

final FutureProvider<bool?> journalAppelsAutoriseProvider =
    FutureProvider<bool?>(
      (Ref ref) => journalAppelsAutorise(ref.watch(telephonieProvider)),
    );

/// Bandeau tant que la permission a été demandée puis refusée.
class JournalAppelsBanner extends ConsumerWidget {
  const JournalAppelsBanner({super.key, this.padded = true});

  final bool padded;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final bool demandee =
        ref.watch(sharedPreferencesProvider).getBool(kClePrefsJournalDemande) ??
        false;
    final bool? autorise = ref.watch(journalAppelsAutoriseProvider).value;
    if (!demandee || autorise != false) return const SizedBox.shrink();

    return Padding(
      padding: padded
          ? EdgeInsets.zero
          : const EdgeInsets.only(bottom: CpiSpacing.sm),
      child: CpiStatusBand(
        text: 'Journal d\'appels refusé : la durée de vos appels n\'est pas mesurée.',
        tone: CpiTone.warning,
        actionLabel: 'Autoriser',
        onAction: () async {
          final Telephonie telephonie = ref.read(telephonieProvider);
          final EtatTelephonie etat = await telephonie.etat();
          if (etat.permission(PermissionsTelephonie.journalAppels) ==
              EtatPermission.definitive) {
            if (context.mounted) await ouvrirLaFicheApplication(context);
          } else {
            await telephonie.demanderPermission(
              PermissionsTelephonie.journalAppels,
            );
          }
          ref.invalidate(journalAppelsAutoriseProvider);
        },
        padded: padded,
      ),
    );
  }
}

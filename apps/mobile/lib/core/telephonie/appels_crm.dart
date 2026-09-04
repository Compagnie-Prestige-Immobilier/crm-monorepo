import 'dart:async';

import 'package:drift/drift.dart' show Value;
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:shared_preferences/shared_preferences.dart';

import '../../data/local/database.dart';
import '../../data/repositories/write_repository.dart';
import '../../ui/widgets/cpi_kit.dart';
import '../providers/app_providers.dart';
import '../utils/ids.dart';
import '../utils/phone.dart';
import 'preuve_appel.dart';
import 'telephonie_port.dart';

/// L'entrée du journal n'existe qu'APRÈS le raccrochage : deux relances
/// suffisent à la voir arriver sans tenir le téléphone éveillé.
const List<Duration> kRelancesRapprochement = <Duration>[
  Duration(seconds: 5),
  Duration(seconds: 20),
];

/// Ce que le premier balayage remonte, sur un téléphone qui n'a jamais été
/// balayé. Au-delà, l'appel est trop vieux pour qu'on se souvienne de quoi il
/// retournait.
const Duration kFenetrePremierBalayage = Duration(days: 7);

/// Autour de l'appel du journal, le moment où une saisie manuelle porte SUR CET
/// APPEL : un peu avant qu'il ne commence, longtemps après qu'il se termine.
const Duration kAvantConsignation = Duration(minutes: 5);
const Duration kApresConsignation = Duration(hours: 2);

const String kClePrefsDernierBalayage = 'cpi.telephonie.dernierBalayage';

/// Lance les appels des fiches et rapproche chacun de son entrée dans le
/// journal du téléphone.
///
/// L'état est l'identifiant de la dernière preuve posée : ce que les fiches
/// affichent vient de la table `preuves_appel`, pas d'ici.
class AppelsCrm extends Notifier<String?> {
  AppLifecycleListener? _cycle;
  StreamSubscription<EvenementTelephonie>? _evenements;
  Timer? _relance;
  int _relances = 0;
  String _etatAppel = 'aucun';
  bool _balayage = false;

  @override
  String? build() {
    _cycle = AppLifecycleListener(onResume: () => unawaited(reprendre()));
    _evenements = ref.read(telephonieProvider).evenements.listen(_surEvenement);
    ref.onDispose(() {
      _relance?.cancel();
      unawaited(_evenements?.cancel());
      _cycle?.dispose();
    });
    // L'application a pu être tuée pendant l'appel : le retour au premier plan
    // n'aura jamais lieu pour cette preuve-là.
    unawaited(Future<void>.microtask(reprendre));
    return null;
  }

  Future<void> lancer(
    BuildContext context, {
    required String kind,
    required String id,
    required String e164,
  }) async {
    final AppDatabase db = ref.read(appDatabaseProvider);
    final Telephonie telephonie = ref.read(telephonieProvider);
    final DateTime lanceA = ref.read(clockProvider).now();
    final ModeAppel mode = await telephonie.appeler(e164);

    await db
        .into(db.preuvesAppel)
        .insert(
          PreuvesAppelCompanion.insert(
            id: Ids.newId(),
            kind: kind,
            entityId: id,
            phoneE164: e164,
            lanceAt: lanceA,
            mode: mode.name,
          ),
        );
    _relances = 0;

    if (mode != ModeAppel.aucun) return;
    await Clipboard.setData(ClipboardData(text: e164));
    if (!context.mounted) return;
    cpiToast(context, 'Numéro copié. Composez-le depuis le téléphone.');
  }

  Future<void> reprendre() {
    _relances = 0;
    return rapprocherEnAttente();
  }

  /// Remplit les preuves encore sans entrée de journal. Relance si le journal
  /// n'a rien : l'appel vient peut-être de se terminer.
  Future<void> rapprocherEnAttente() async {
    final AppDatabase db = ref.read(appDatabaseProvider);
    final Telephonie telephonie = ref.read(telephonieProvider);
    final DateTime maintenant = ref.read(clockProvider).now();
    final DateTime seuil = maintenant.subtract(kFenetrePreuve);
    final List<PreuvesAppelData> attente = await db
        .preuvesEnAttente(seuilSecondes: seuil.millisecondsSinceEpoch ~/ 1000)
        .get();
    if (attente.isEmpty) return;

    bool manquant = false;
    for (final PreuvesAppelData preuve in attente) {
      final List<EntreeJournal> entrees = await telephonie.journal(
        e164: preuve.phoneE164,
        depuis: preuve.lanceAt.subtract(kMargeJournal),
      );
      final EntreeJournal? trouvee = rapprocher(
        entrees,
        e164: preuve.phoneE164,
        lanceA: preuve.lanceAt,
      );
      if (trouvee == null) {
        manquant = true;
        continue;
      }
      await (db.update(
        db.preuvesAppel,
      )..where((PreuvesAppel row) => row.id.equals(preuve.id))).write(
        PreuvesAppelCompanion(
          journalType: Value<String?>(trouvee.type),
          journalDureeS: Value<int?>(trouvee.dureeSecondes),
          journalAt: Value<DateTime?>(trouvee.at),
          rapprocheAt: Value<DateTime?>(maintenant),
        ),
      );
      if (state != preuve.id) state = preuve.id;
    }
    if (manquant) _programmerRelance();
  }

  /// Retrouve dans le journal du téléphone les appels passés ou reçus avec un
  /// numéro de fiche SANS passer par l'application, et pose une preuve
  /// `detecte` pour chacun. Rend le nombre d'appels nouvellement retrouvés.
  ///
  /// Sans l'autorisation `READ_CALL_LOG` le canal rend une liste vide : le
  /// parcours ne change pas et rien n'est dit. Un numéro sans fiche ne laisse
  /// AUCUNE trace, ni en base ni dans les journaux.
  Future<int> balayerJournal() async {
    if (_balayage) return 0;
    _balayage = true;
    try {
      final AppDatabase db = ref.read(appDatabaseProvider);
      final WriteRepository writes = ref.read(writeRepositoryProvider);
      final SharedPreferences prefs = ref.read(sharedPreferencesProvider);
      final DateTime maintenant = ref.read(clockProvider).now();
      final int? precedent = prefs.getInt(kClePrefsDernierBalayage);
      // Le journal n'inscrit l'appel qu'au raccrochage, avec l'heure de son
      // DÉBUT : reprendre au curseur exact perdrait pour toujours l'appel
      // commencé avant le balayage précédent et fini après. Le recouvrement est
      // sans risque, `preuveExiste` écarte le doublon.
      final DateTime depuis = precedent == null
          ? maintenant.subtract(kFenetrePremierBalayage)
          : DateTime.fromMillisecondsSinceEpoch(
              precedent,
              isUtc: true,
            ).subtract(kFenetrePreuve);
      final List<EntreeJournal> entrees = await ref
          .read(telephonieProvider)
          .journal(depuis: depuis);

      int retrouves = 0;
      for (final EntreeJournal entree in entrees) {
        final String? e164 = _numeroDeFiche(entree.numero);
        if (e164 == null) continue;
        // Un représentant et un prospect peuvent porter le même numéro : la
        // requête rend le représentant d'abord, et c'est lui qu'on retient.
        final FicheParTelephoneResult? fiche =
            (await db.ficheParTelephone(e164: e164).get()).firstOrNull;
        if (fiche == null) continue;
        if (await _dejaVu(db, fiche, entree)) continue;
        await writes.enregistrerAppelDetecte(
          kind: fiche.kind,
          entityId: fiche.entityId,
          phoneE164: e164,
          journalType: entree.type,
          dureeSecondes: entree.dureeSecondes,
          journalAt: entree.at,
        );
        retrouves++;
      }
      await prefs.setInt(
        kClePrefsDernierBalayage,
        maintenant.millisecondsSinceEpoch,
      );
      return retrouves;
    } finally {
      _balayage = false;
    }
  }

  /// Cet appel du journal a déjà sa preuve, ou une saisie manuelle le couvre.
  Future<bool> _dejaVu(
    AppDatabase db,
    FicheParTelephoneResult fiche,
    EntreeJournal entree,
  ) async {
    final int existe = await db
        .preuveExiste(
          kind: fiche.kind,
          entityId: fiche.entityId,
          journalAtSecondes: entree.at.millisecondsSinceEpoch / 1000,
        )
        .getSingle();
    if (existe > 0) return true;

    final DateTime debut = entree.at.subtract(kAvantConsignation);
    final DateTime fin = entree.at.add(kApresConsignation);
    final DateTime? saisi = fiche.dernierAppel;
    if (saisi != null && !saisi.isBefore(debut) && !saisi.isAfter(fin)) {
      return true;
    }
    if (fiche.kind != 'prospect') return false;
    final int saisies = await db
        .appelSaisiEntre(
          prospectId: fiche.entityId,
          debutSecondes: debut.millisecondsSinceEpoch ~/ 1000,
          finSecondes: fin.millisecondsSinceEpoch ~/ 1000,
        )
        .getSingle();
    return saisies > 0;
  }

  void _programmerRelance() {
    if (_relances >= kRelancesRapprochement.length) return;
    final Duration delai = kRelancesRapprochement[_relances++];
    _relance?.cancel();
    _relance = Timer(delai, () => unawaited(rapprocherEnAttente()));
  }

  void _surEvenement(EvenementTelephonie evenement) {
    if (evenement is! EvenementEtatAppel) return;
    final String precedent = _etatAppel;
    _etatAppel = evenement.etat;
    if (evenement.etat != 'aucun' || precedent != 'decroche') return;
    unawaited(ref.read(telephonieProvider).arreterServiceAppel());
    unawaited(reprendre());
  }
}

final NotifierProvider<AppelsCrm, String?> appelsCrmProvider =
    NotifierProvider<AppelsCrm, String?>(AppelsCrm.new);

/// Le numéro du journal ramené à la forme des fiches. Repli sur les neuf
/// derniers chiffres, comme [rapprocher] : le journal garde le numéro tel qu'il
/// a été composé, la fiche le porte en E.164.
String? _numeroDeFiche(String brut) {
  final String? e164 = Phone.toE164(brut);
  if (e164 != null) return e164;
  final String chiffres = Phone.digitsOf(brut);
  if (chiffres.length < kChiffresComparaison) return null;
  // Un numéro qui s'annonce d'un autre pays se cherche tel quel : le ramener au
  // plan sénégalais le poserait sur la fiche du premier numéro qui finit pareil.
  if (Phone.isInternational(brut)) return '+$chiffres';
  final String fin = chiffres.substring(chiffres.length - kChiffresComparaison);
  return '+$kSenegalCallingCode$fin';
}

extension PreuveLisible on PreuvesAppelData {
  String get libelle => libellePreuve(
    type: journalType,
    dureeSecondes: journalDureeS,
    at: journalAt,
  );
}

/// La dernière preuve posée pour cette entité, rapprochée ou non.
final dernierePreuveProvider =
    StreamProvider.family<PreuvesAppelData?, ({String kind, String id})>((
      Ref ref,
      ({String kind, String id}) cible,
    ) {
      // Une fiche ouverte tient le rapprochement en vie : sans cela, personne
      // ne le relancerait après un redémarrage de l'application.
      ref.watch(appelsCrmProvider.notifier);
      final AppDatabase db = ref.watch(appDatabaseProvider);
      return db
          .dernierePreuvePour(kind: cible.kind, entityId: cible.id)
          .watchSingleOrNull();
    });

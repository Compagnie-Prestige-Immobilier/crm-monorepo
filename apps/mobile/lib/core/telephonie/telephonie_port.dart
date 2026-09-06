import 'dart:async';
import 'dart:developer' as developer;

import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

/// Le canal `sn.cpi.go/telephonie` : appeler depuis une fiche, relire le
/// journal d'appels, connaître les autorisations et les services en cours.
///
/// Rien ici ne LÈVE : sur un téléphone sans le canal natif, ou hors Android,
/// chaque méthode rend la valeur la plus prudente (aucune autorisation, journal
/// vide, `ModeAppel.aucun`) et le parcours retombe sur le composeur puis le
/// presse-papiers.
class Telephonie {
  const Telephonie({
    MethodChannel canal = canalParDefaut,
    EventChannel evenementsCanal = evenementsParDefaut,
  }) : _canal = canal,
       _evenementsCanal = evenementsCanal;

  static const MethodChannel canalParDefaut = MethodChannel(
    'sn.cpi.go/telephonie',
  );

  static const EventChannel evenementsParDefaut = EventChannel(
    'sn.cpi.go/telephonie/events',
  );

  final MethodChannel _canal;
  final EventChannel _evenementsCanal;

  Future<EtatTelephonie> etat() async {
    final Map<Object?, Object?>? brut = await _appeler<Map<Object?, Object?>>(
      'etat',
    );
    return brut == null ? const EtatTelephonie() : EtatTelephonie.fromMap(brut);
  }

  Future<EtatPermission> demanderPermission(String nom) async =>
      lireEtatPermission(
        await _appeler<String>('demanderPermission', <String, Object?>{
          'nom': nom,
        }),
      );

  Future<bool> demanderExemptionBatterie() async =>
      await _appeler<bool>('demanderExemptionBatterie') ?? false;

  Future<bool> demanderRoleScreening() async =>
      await _appeler<bool>('demanderRoleScreening') ?? false;

  Future<ModeAppel> appeler(String e164) async => lireModeAppel(
    await _appeler<String>('appeler', <String, Object?>{'e164': e164}),
  );

  /// [e164] nul rend TOUT le journal depuis [depuis], numéro brut compris : le
  /// balayage cherche des fiches que l'appelant ne connaît pas encore.
  Future<List<EntreeJournal>> journal({
    String? e164,
    required DateTime depuis,
  }) async {
    final List<Object?>? brut = await _appeler<List<Object?>>(
      'journal',
      <String, Object?>{
        'e164': ?e164,
        'depuisMillis': depuis.millisecondsSinceEpoch,
      },
    );
    if (brut == null) return const <EntreeJournal>[];
    return brut
        .whereType<Map<Object?, Object?>>()
        .map(EntreeJournal.fromMap)
        .toList(growable: false);
  }

  Future<bool> synchroService({
    required bool actif,
    required String titre,
  }) async =>
      await _appeler<bool>('synchroService', <String, Object?>{
        'actif': actif,
        'titre': titre,
      }) ??
      false;

  Future<void> arreterServiceAppel() => _appeler<Object>('arreterServiceAppel');

  /// Diffusion : le diagnostic et [AppelsCrm] écoutent tous deux, et un
  /// `EventChannel` n'accepte qu'un abonné à la fois.
  Stream<EvenementTelephonie> get evenements => _evenementsCanal
      .receiveBroadcastStream()
      .handleError((Object error, StackTrace stack) {
        developer.log(
          'Événements téléphonie indisponibles : $error',
          name: 'cpi.tel',
        );
      })
      .map(
        (Object? brut) => brut is Map<Object?, Object?>
            ? EvenementTelephonie.fromMap(brut)
            : null,
      )
      .where((EvenementTelephonie? e) => e != null)
      .cast<EvenementTelephonie>();

  Future<T?> _appeler<T>(
    String methode, [
    Map<String, Object?>? arguments,
  ]) async {
    try {
      return await _canal.invokeMethod<T>(methode, arguments);
    } on Object catch (error) {
      developer.log(
        'Téléphonie « $methode » indisponible : $error',
        name: 'cpi.tel',
      );
      return null;
    }
  }
}

final Provider<Telephonie> telephonieProvider = Provider<Telephonie>(
  (Ref ref) => const Telephonie(),
);

/// Les trois autorisations que le canal sait demander. Le nom est celui
/// d'Android, sans son préfixe : le Kotlin le recompose.
abstract final class PermissionsTelephonie {
  static const String appeler = 'CALL_PHONE';
  static const String etatTelephone = 'READ_PHONE_STATE';
  static const String journalAppels = 'READ_CALL_LOG';

  static const List<String> toutes = <String>[
    appeler,
    etatTelephone,
    journalAppels,
  ];
}

enum EtatPermission { accordee, refusee, definitive }

EtatPermission lireEtatPermission(Object? valeur) => switch (valeur) {
  'accordee' => EtatPermission.accordee,
  'definitive' => EtatPermission.definitive,
  _ => EtatPermission.refusee,
};

/// Ce qu'Android a réellement fait de la demande d'appel : composer lui-même,
/// ouvrir le clavier téléphonique, ou rien du tout.
enum ModeAppel { call, dial, aucun }

ModeAppel lireModeAppel(Object? valeur) => switch (valeur) {
  'call' => ModeAppel.call,
  'dial' => ModeAppel.dial,
  _ => ModeAppel.aucun,
};

/// Vocabulaire du journal d'appels, figé par le contrat du canal et repris tel
/// quel par le serveur (`DEVICE_CALL_TYPES`).
const Set<String> kTypesJournal = <String>{
  'sortant',
  'entrant',
  'manque',
  'rejete',
  'bloque',
  'messagerie',
  'externe',
  'inconnu',
};

class EntreeJournal {
  const EntreeJournal({
    required this.type,
    required this.at,
    required this.dureeSecondes,
    required this.numero,
  });

  factory EntreeJournal.fromMap(Map<Object?, Object?> map) => EntreeJournal(
    type: kTypesJournal.contains(map['type'])
        ? map['type']! as String
        : 'inconnu',
    at:
        lireInstant(map['at']) ??
        DateTime.fromMillisecondsSinceEpoch(0, isUtc: true),
    dureeSecondes: (map['dureeSecondes'] as num?)?.toInt() ?? 0,
    numero: map['numero'] as String? ?? '',
  );

  final String type;
  final DateTime at;
  final int dureeSecondes;
  final String numero;
}

class EtatTelephonie {
  const EtatTelephonie({
    this.permissions = const <String, EtatPermission>{},
    this.batterieExemptee = false,
    this.etatAppel = 'aucun',
    this.sim = 'inconnue',
    this.reseau = 'inconnu',
    this.roleScreeningDisponible = false,
    this.roleScreeningTenu = false,
    this.serviceSynchro = false,
    this.serviceAppel = false,
    this.typeServiceAppel,
    this.dernierBoot,
    this.dernierBootTraite,
    this.appelsHorsCrmIgnores = 0,
    this.dernierHorsCrm,
    this.dernierEntrantCrm,
  });

  factory EtatTelephonie.fromMap(Map<Object?, Object?> map) {
    final Map<Object?, Object?> permissions = _sous(map['permissions']);
    final Map<Object?, Object?> telephone = _sous(map['telephone']);
    final Map<Object?, Object?> role = _sous(map['roleScreening']);
    final Map<Object?, Object?> services = _sous(map['services']);
    final Map<Object?, Object?>? horsCrm = map['dernierHorsCrm'] is Map
        ? _sous(map['dernierHorsCrm'])
        : null;
    final Map<Object?, Object?>? entrant = map['dernierEntrantCrm'] is Map
        ? _sous(map['dernierEntrantCrm'])
        : null;
    final DateTime? horsCrmAt = lireInstant(horsCrm?['at']);
    final DateTime? entrantAt = lireInstant(entrant?['at']);

    return EtatTelephonie(
      permissions: <String, EtatPermission>{
        for (final String nom in PermissionsTelephonie.toutes)
          nom: lireEtatPermission(permissions[nom]),
      },
      batterieExemptee: map['batterieExemptee'] == true,
      etatAppel: telephone['etatAppel'] as String? ?? 'aucun',
      sim: telephone['sim'] as String? ?? 'inconnue',
      reseau: telephone['reseau'] as String? ?? 'inconnu',
      roleScreeningDisponible: role['disponible'] == true,
      roleScreeningTenu: role['tenu'] == true,
      serviceSynchro: services['synchro'] == true,
      serviceAppel: services['appel'] == true,
      typeServiceAppel: services['typeAppel'] as String?,
      dernierBoot: lireInstant(map['dernierBoot']),
      dernierBootTraite: lireInstant(map['dernierBootTraite']),
      appelsHorsCrmIgnores: (map['appelsHorsCrmIgnores'] as num?)?.toInt() ?? 0,
      dernierHorsCrm: horsCrmAt == null
          ? null
          : (
              at: horsCrmAt,
              numeroMasque: horsCrm?['numeroMasque'] as String? ?? '',
            ),
      dernierEntrantCrm: entrantAt == null
          ? null
          : (
              at: entrantAt,
              kind: entrant?['kind'] as String? ?? '',
              id: entrant?['id'] as String? ?? '',
            ),
    );
  }

  final Map<String, EtatPermission> permissions;
  final bool batterieExemptee;
  final String etatAppel;
  final String sim;
  final String reseau;
  final bool roleScreeningDisponible;
  final bool roleScreeningTenu;
  final bool serviceSynchro;
  final bool serviceAppel;
  final String? typeServiceAppel;
  final DateTime? dernierBoot;
  final DateTime? dernierBootTraite;
  final int appelsHorsCrmIgnores;
  final ({DateTime at, String numeroMasque})? dernierHorsCrm;
  final ({DateTime at, String kind, String id})? dernierEntrantCrm;

  EtatPermission permission(String nom) =>
      permissions[nom] ?? EtatPermission.refusee;

  static Map<Object?, Object?> _sous(Object? valeur) =>
      valeur is Map<Object?, Object?> ? valeur : const <Object?, Object?>{};
}

sealed class EvenementTelephonie {
  const EvenementTelephonie();

  static EvenementTelephonie? fromMap(Map<Object?, Object?> map) {
    final DateTime at = lireInstant(map['at']) ?? DateTime.now().toUtc();
    return switch (map['type']) {
      'etatAppel' => EvenementEtatAppel(
        etat: map['etat'] as String? ?? 'aucun',
        numero: map['numero'] as String?,
      ),
      'entrantCrm' => EvenementEntrantCrm(
        kind: map['kind'] as String? ?? '',
        id: map['id'] as String? ?? '',
        at: at,
      ),
      'horsCrm' => EvenementHorsCrm(at: at),
      _ => null,
    };
  }
}

class EvenementEtatAppel extends EvenementTelephonie {
  const EvenementEtatAppel({required this.etat, this.numero});

  final String etat;
  final String? numero;
}

class EvenementEntrantCrm extends EvenementTelephonie {
  const EvenementEntrantCrm({
    required this.kind,
    required this.id,
    required this.at,
  });

  final String kind;
  final String id;
  final DateTime at;
}

class EvenementHorsCrm extends EvenementTelephonie {
  const EvenementHorsCrm({required this.at});

  final DateTime at;
}

/// Millisecondes ou texte ISO : le canal porte les deux formes selon la source
/// (journal d'appels contre préférences natives).
DateTime? lireInstant(Object? valeur) {
  if (valeur is num) {
    return DateTime.fromMillisecondsSinceEpoch(valeur.toInt(), isUtc: true);
  }
  if (valeur is String) return DateTime.tryParse(valeur)?.toUtc();
  return null;
}

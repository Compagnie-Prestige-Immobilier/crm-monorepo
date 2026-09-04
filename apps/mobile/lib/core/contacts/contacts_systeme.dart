import 'dart:convert';
import 'dart:developer' as developer;

import 'package:crypto/crypto.dart';
import 'package:drift/drift.dart' show Value;
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../data/local/database.dart';
import '../../data/repositories/reference_repository.dart';
import '../providers/app_providers.dart';

/// Le portefeuille du téléconseiller, recopié dans le répertoire du téléphone
/// pour que le dialer natif affiche un nom au lieu d'un numéro inconnu.
///
/// Ce qui décide QUOI écrire et QUAND vit ici, en Dart : le canal natif ne fait
/// que poser le lot, et chaque ligne de Kotlin ne se corrige que par un APK
/// complet propagé sur le parc.
///
/// La reconnaissance d'appel est un confort. Sans la permission, ou après un
/// échec du fournisseur de contacts, tout se tait et l'application fonctionne à
/// l'identique.
class ContactsSysteme {
  ContactsSysteme({
    required AppDatabase database,
    required ReferenceRepository reference,
    this.channel = const MethodChannel(canal),
  }) : _db = database,
       _reference = reference;

  static const String canal = 'sn.cpi.go/contacts';

  /// Même table que les curseurs de pull : c'est un marqueur de collection, et
  /// la déconnexion la vide déjà.
  static const String _empreinteKey = 'contacts_repertoire';

  final AppDatabase _db;
  final ReferenceRepository _reference;
  final MethodChannel channel;

  /// Écrit le portefeuille de [userId] si son contenu a changé depuis la
  /// dernière fois.
  ///
  /// [demanderLaPermission] n'est vrai qu'à la connexion : une boîte de dialogue
  /// système ouverte par un cycle de synchronisation de fond tomberait au milieu
  /// d'une saisie, sans que rien à l'écran ne l'explique.
  Future<void> rafraichir(
    String userId, {
    bool demanderLaPermission = false,
  }) async {
    try {
      if (!await _permis(demander: demanderLaPermission)) return;
      final List<FicheAppelant> fiches = await _reference.portefeuilleAppelant(
        userId,
      );
      final List<Map<String, String>> lot = <Map<String, String>>[
        for (final FicheAppelant fiche in fiches)
          if (fiche.nom.isNotEmpty && fiche.tel.isNotEmpty)
            <String, String>{
              'id': fiche.id,
              'nom': fiche.nom,
              'tel': fiche.tel,
            },
      ];
      final String empreinte = _empreinte(userId, lot);
      if (empreinte == await _empreinteEcrite()) return;
      final int millis =
          await channel.invokeMethod<int>('write', <String, Object>{
            'contacts': lot,
          }) ??
          0;
      await _garderLEmpreinte(empreinte);
      developer.log(
        '${lot.length} fiches au répertoire en $millis ms',
        name: 'cpi.contacts',
      );
    } on Object catch (e) {
      // L'empreinte n'est pas écrite : le cycle suivant réessaiera.
      developer.log('Répertoire non écrit : $e', name: 'cpi.contacts');
    }
  }

  /// Retire le compte, donc les fiches qui lui appartiennent.
  ///
  /// Appelé à la déconnexion : le portefeuille d'un téléconseiller ne doit pas
  /// rester lisible dans le répertoire du suivant.
  Future<void> oublier() async {
    try {
      await channel.invokeMethod<void>('clear');
    } on Object catch (e) {
      developer.log('Répertoire non purgé : $e', name: 'cpi.contacts');
    } finally {
      await (_db.delete(
        _db.syncState,
      )..where((SyncState t) => t.collection.equals(_empreinteKey))).go();
    }
  }

  Future<bool> _permis({required bool demander}) async {
    final bool accorde =
        await channel.invokeMethod<bool>('hasPermission') ?? false;
    if (accorde || !demander) return accorde;
    return await channel.invokeMethod<bool>('requestPermission') ?? false;
  }

  Future<String?> _empreinteEcrite() async {
    final SyncStateData? row =
        await (_db.select(_db.syncState)
              ..where((SyncState t) => t.collection.equals(_empreinteKey)))
            .getSingleOrNull();
    return row?.cursor;
  }

  Future<void> _garderLEmpreinte(String empreinte) {
    return _db
        .into(_db.syncState)
        .insertOnConflictUpdate(
          SyncStateCompanion.insert(
            collection: _empreinteKey,
            cursor: Value<String?>(empreinte),
          ),
        );
  }

  /// Le compte fait partie de l'empreinte : changer de téléconseiller sur le
  /// même téléphone doit réécrire, même à portefeuille identique.
  static String _empreinte(String userId, List<Map<String, String>> lot) {
    final StringBuffer buffer = StringBuffer(userId);
    for (final Map<String, String> fiche in lot) {
      buffer.write(' ${fiche['id']} ${fiche['nom']} ${fiche['tel']}');
    }
    return sha1.convert(utf8.encode(buffer.toString())).toString();
  }
}

final Provider<ContactsSysteme> contactsSystemeProvider =
    Provider<ContactsSysteme>((Ref ref) {
      return ContactsSysteme(
        database: ref.watch(appDatabaseProvider),
        reference: ref.watch(referenceRepositoryProvider),
      );
    });

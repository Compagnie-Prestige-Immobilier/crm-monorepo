import 'dart:convert';
import 'dart:developer' as developer;

import 'package:shared_preferences/shared_preferences.dart';

import '../../features/campagnes/campagnes.dart';
import 'route_paths.dart';

class RouteMemory {
  RouteMemory(this._prefs, {required this.buildNumber, this.draftExists});

  final Future<bool> Function(String draftId)? draftExists;

  static const String _key = 'route_memory.v2';
  static const Duration maxAge = Duration(hours: 24);

  static const List<String> allowList = <String>[
    Routes.home,
    Routes.accueil,
    Routes.accueilChiffres,
    Routes.accueilVisiteNew,
    Routes.chues,
    Routes.grandPublic,
    Routes.representants,
    Routes.newRepresentant,
    Routes.prospects,
    Routes.newProspect,
    Routes.corrections,
    Routes.historique,
    Routes.phase2,
    CampagnesRoutes.liste,
    Routes.notifications,
  ];

  final SharedPreferences _prefs;

  final String buildNumber;

  String? read({required bool authenticated, DateTime? now}) {
    if (!authenticated) return null;
    final String? raw = _prefs.getString(_key);
    if (raw == null || raw.isEmpty) return null;

    final Map<String, Object?> record;
    try {
      final Object? decoded = jsonDecode(raw);
      if (decoded is! Map) {
        throw const FormatException('mémoire de route non objet');
      }
      record = decoded.cast<String, Object?>();
    } on FormatException catch (e) {
      developer.log(
        'Mémoire de route illisible, effacée : $e',
        name: 'cpi.route',
      );
      unawaitedClear();
      return null;
    }

    if (record['build'] != buildNumber) return null;

    final int? stamp = record['at'] as int?;
    if (stamp == null) return null;
    final DateTime savedAt = DateTime.fromMillisecondsSinceEpoch(
      stamp,
      isUtc: true,
    );
    if ((now ?? DateTime.now().toUtc()).difference(savedAt) > maxAge) {
      return null;
    }

    final Object? location = record['uri'];
    if (location is! String || location.isEmpty) return null;
    if (!isRestorable(location)) return null;
    return location;
  }

  Future<void> write(String location, {DateTime? now}) async {
    if (await _wouldBuryADraft(location)) return;
    if (Routes.isPublic(location)) return;
    if (!isRestorable(location)) {
      await clear();
      return;
    }
    await _prefs.setString(
      _key,
      jsonEncode(<String, Object?>{
        'uri': location,
        'build': buildNumber,
        'at': (now ?? DateTime.now().toUtc()).millisecondsSinceEpoch,
      }),
    );
  }

  Future<bool> _wouldBuryADraft(String incoming) async {
    final Future<bool> Function(String)? lookup = draftExists;
    if (lookup == null) return false;

    final String? stored = _prefs.getString(_key);
    if (stored == null || stored.isEmpty) return false;

    final String? location = _locationOf(stored);
    if (location == null) return false;

    final Uri storedUri = Uri.tryParse(location) ?? Uri(path: location);
    final String? draftId = storedUri.queryParameters[Routes.draftParam];
    if (draftId == null || draftId.isEmpty) return false;

    if (!_isAncestor(incoming, storedUri.path)) return false;
    return lookup(draftId);
  }

  String? _locationOf(String raw) {
    try {
      final Object? decoded = jsonDecode(raw);
      if (decoded is! Map) return null;
      final Object? uri = decoded['uri'];
      return uri is String && uri.isNotEmpty ? uri : null;
    } on FormatException {
      return null;
    }
  }

  static bool _isAncestor(String incoming, String storedPath) {
    final Uri uri = Uri.tryParse(incoming) ?? Uri(path: incoming);
    final String path = uri.path.isEmpty ? Routes.home : uri.path;
    if (path == Routes.home) return false;
    return storedPath.startsWith('$path/');
  }

  Future<void> clear() => _prefs.remove(_key);

  void unawaitedClear() {
    clear().ignore();
  }

  static bool isRestorable(String location) {
    if (Routes.isPublic(location)) return false;
    final Uri uri = Uri.tryParse(location) ?? Uri(path: location);
    final String path = uri.path.isEmpty ? Routes.home : uri.path;
    for (final String allowed in allowList) {
      if (path == allowed) return true;
      if (allowed != Routes.home && path.startsWith('$allowed/')) return true;
    }
    return false;
  }
}

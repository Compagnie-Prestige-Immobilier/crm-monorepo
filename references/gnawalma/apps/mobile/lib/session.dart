import 'dart:convert';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import 'package:fresh_dio/fresh_dio.dart';
import 'package:shared_preferences/shared_preferences.dart';

import 'api.dart';
import 'models.dart';

const _secure = FlutterSecureStorage(aOptions: AndroidOptions(encryptedSharedPreferences: true));
final _prefs = SharedPreferencesAsync();

class Session {
  const Session(this.token, this.user);
  final String token;
  final User user;
}

class SessionNotifier extends AsyncNotifier<Session?> {
  Fresh<OAuth2Token> get _fresh => ref.read(freshProvider);

  @override
  Future<Session?> build() async {
    final sub = _fresh.authenticationStatus.listen(_onStatus);
    ref.onDispose(sub.cancel);
    final token = (await _fresh.token)?.accessToken;
    final user = await _secure.read(key: 'user');
    if (token == null || user == null) return null;
    return Session(token, User.fromJson(jsonDecode(user)));
  }

  Future<void> _onStatus(AuthenticationStatus status) async {
    final current = state.value;
    if (current == null) return;
    if (status == AuthenticationStatus.unauthenticated) {
      sessionNotice.value = 'Session expirée, reconnectez-vous.';
      return _forget();
    }
    final token = (await _fresh.token)?.accessToken;
    if (token != null && token != current.token) state = AsyncData(Session(token, current.user));
  }

  Future<void> set(String token, User user) async {
    await _fresh.setToken(OAuth2Token(accessToken: token));
    await _secure.write(key: 'user', value: jsonEncode(user.toJson()));
    state = AsyncData(Session(token, user));
  }

  Future<void> setToken(String token) async {
    final s = state.value;
    if (s != null) await set(token, s.user);
  }

  Future<void> setUser(User user) async {
    final s = state.value;
    if (s != null) await set(s.token, user);
  }

  Future<void> clear() async {
    await _forget();
    await _fresh.clearToken();
  }

  Future<void> _forget() async {
    await _secure.delete(key: 'user');
    state = const AsyncData(null);
  }
}

/// Message à montrer une fois : la racine de l'application le sert en toast et vide le cache.
final sessionNotice = ValueNotifier<String?>(null);

Future<void> rememberIdentifier(String identifier) => _prefs.setString('last_identifier', identifier);
Future<String?> lastIdentifier() => _prefs.getString('last_identifier');

typedef PendingContact = ({int atelierId, String channel, DateTime at});

/// Contact passé sans compte : « id|canal|date », rejoué à la connexion.
PendingContact? parsePendingContact(String s) {
  final p = s.split('|');
  final id = p.length == 3 ? int.tryParse(p[0]) : null;
  final at = id == null ? null : DateTime.tryParse(p[2]);
  return at == null || p[1].isEmpty ? null : (atelierId: id!, channel: p[1], at: at);
}

Future<void> addPendingContact(int atelierId, String channel) async {
  final all = [...?await _prefs.getStringList(_pendingContacts), '$atelierId|$channel|${DateTime.now().toIso8601String()}'];
  await _prefs.setStringList(_pendingContacts, all.length > 20 ? all.sublist(all.length - 20) : all);
}

Future<List<String>> takePendingContacts() async {
  final all = await _prefs.getStringList(_pendingContacts) ?? [];
  if (all.isNotEmpty) await _prefs.remove(_pendingContacts);
  return all;
}

const _pendingContacts = 'pending_contacts';

final sessionProvider = AsyncNotifierProvider<SessionNotifier, Session?>(SessionNotifier.new);
final userProvider = Provider<User?>((ref) => ref.watch(sessionProvider).value?.user);

class PrefNotifier extends AsyncNotifier<String?> {
  PrefNotifier(this.key);
  final String key;

  @override
  Future<String?> build() async {
    final v = await _prefs.getString(key);
    if (v != null) return v;
    // Migration depuis le stockage sécurisé (v2.0).
    final legacy = await _secure.read(key: key);
    if (legacy != null) await _prefs.setString(key, legacy);
    return legacy;
  }

  Future<void> set(String? v) async {
    state = AsyncData(v);
    v == null ? await _prefs.remove(key) : await _prefs.setString(key, v);
  }
}

final introSeenProvider = AsyncNotifierProvider<PrefNotifier, String?>(() => PrefNotifier('intro_seen'));
final themePrefProvider = AsyncNotifierProvider<PrefNotifier, String?>(() => PrefNotifier('theme'));
final themeModeProvider = Provider<ThemeMode>((ref) => switch (ref.watch(themePrefProvider).value) {
  'light' => ThemeMode.light, 'dark' => ThemeMode.dark, _ => ThemeMode.system,
});

// Réglage activé par défaut : absence de valeur enregistrée = activé.
final dueRemindersPrefProvider = AsyncNotifierProvider<PrefNotifier, String?>(() => PrefNotifier('due_reminders'));

const _accents = {'à': 'a', 'â': 'a', 'ä': 'a', 'é': 'e', 'è': 'e', 'ê': 'e', 'ë': 'e', 'î': 'i', 'ï': 'i', 'ô': 'o', 'ö': 'o', 'ù': 'u', 'û': 'u', 'ü': 'u', 'ç': 'c'};

/// Comparaison insensible aux accents et à la casse, pour l'historique et le rapprochement des régions.
String foldAccents(String s) => s.toLowerCase().split('').map((c) => _accents[c] ?? c).join();

class SearchHistoryNotifier extends AsyncNotifier<List<String>> {
  static const _key = 'search_history', _max = 8;

  @override
  Future<List<String>> build() async {
    final v = await _prefs.getString(_key);
    if (v == null) return [];
    return (jsonDecode(v) as List).cast<String>();
  }

  Future<void> add(String query) async {
    final q = query.trim();
    if (q.length < 2) return;
    final list = [...state.value ?? <String>[]];
    list.removeWhere((e) => foldAccents(e) == foldAccents(q));
    list.insert(0, q);
    await _save(list.take(_max).toList());
  }

  Future<void> remove(String query) async {
    await _save([for (final e in state.value ?? <String>[]) if (e != query) e]);
  }

  Future<void> clear() => _save([]);

  Future<void> _save(List<String> list) async {
    state = AsyncData(list);
    await _prefs.setString(_key, jsonEncode(list));
  }
}

final searchHistoryProvider = AsyncNotifierProvider<SearchHistoryNotifier, List<String>>(SearchHistoryNotifier.new);

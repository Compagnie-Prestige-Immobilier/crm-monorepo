import 'dart:convert';

/// Message push, modèle **Dart pur**.
///
/// Aucun import Flutter, aucun import Firebase : c'est ce qui rend l'analyse
/// d'un message — et surtout la validation de sa route — testable sans
/// appareil, sans arbre de widgets et sans projet Firebase.
///
/// La conversion depuis `RemoteMessage` vit dans `push_transport.dart` ; ici on
/// ne connaît qu'une `Map<String, String>`, qui est exactement ce que FCM
/// transporte dans `data`.
class PushMessage {
  const PushMessage({
    required this.id,
    required this.title,
    required this.body,
    required this.category,
    this.route,
    this.payload,
    required this.sentAt,
  });

  /// Identifiant serveur de la notification. Sert de clé locale : deux remises
  /// du même message ne créent qu'une ligne.
  final String id;
  final String title;
  final String body;
  final String category;

  /// Route interne à ouvrir au tap. `null` quand la notification n'est
  /// qu'informative.
  final String? route;
  final String? payload;
  final DateTime sentAt;

  /// Routes internes acceptées.
  ///
  /// **C'est un contrôle de sécurité, pas une commodité.** Une notification est
  /// affichée avec le nom et l'icône de CPI GO ; l'utilisateur ne peut pas
  /// inspecter la destination avant d'appuyer. Une valeur `https://…` laissée
  /// passer jusqu'à un navigateur ferait de chaque envoi un vecteur
  /// d'hameçonnage parfaitement crédible.
  ///
  /// Le serveur applique déjà la même règle. La refaire ici n'est pas
  /// redondant : le message vient du réseau, et le client ne doit jamais
  /// dépendre du seul bon comportement de l'émetteur.
  static bool isSafeRoute(String? route) {
    if (route == null || route.isEmpty) return false;
    if (!route.startsWith('/')) return false;
    // `//host` est une URL relative au protocole : le navigateur l'ouvrirait.
    if (route.startsWith('//')) return false;
    if (route.contains('\\')) return false;
    return true;
  }

  /// Construit un message depuis la charge utile FCM.
  ///
  /// Renvoie `null` si le message n'est pas exploitable — sans identifiant, il
  /// n'y a rien à dédupliquer ni à marquer lu. On préfère ignorer en silence
  /// plutôt que de créer une ligne fantôme dans la boîte de réception.
  static PushMessage? fromData(
    Map<String, String> data, {
    String? notificationTitle,
    String? notificationBody,
    DateTime? receivedAt,
  }) {
    final String? id = data['notificationId'];
    if (id == null || id.isEmpty) return null;

    final String title = notificationTitle ?? data['title'] ?? '';
    final String body = notificationBody ?? data['body'] ?? '';
    final String? rawRoute = data['route'];

    return PushMessage(
      id: id,
      title: title,
      body: body,
      category: data['category'] ?? 'ANNONCE',
      // Une route refusée est effacée, pas conservée « au cas où » : la garder
      // en base ferait ressurgir la question de sa validité à chaque tap.
      route: isSafeRoute(rawRoute) ? rawRoute : null,
      payload: data['payload'],
      sentAt: receivedAt ?? DateTime.now().toUtc(),
    );
  }

  /// Sérialisation pour le passage entre isolats, si un jour c'est nécessaire.
  Map<String, Object?> toJson() => <String, Object?>{
    'id': id,
    'title': title,
    'body': body,
    'category': category,
    'route': route,
    'payload': payload,
    'sentAt': sentAt.toIso8601String(),
  };

  static PushMessage fromJson(Map<String, Object?> json) => PushMessage(
    id: json['id']! as String,
    title: json['title']! as String,
    body: json['body']! as String,
    category: json['category']! as String,
    route: json['route'] as String?,
    payload: json['payload'] as String?,
    sentAt: DateTime.parse(json['sentAt']! as String),
  );

  String encode() => jsonEncode(toJson());

  @override
  String toString() => 'PushMessage($id, route: $route)';
}

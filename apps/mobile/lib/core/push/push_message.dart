import 'dart:convert';

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

  final String id;
  final String title;
  final String body;
  final String category;

  final String? route;
  final String? payload;
  final DateTime sentAt;

  static bool isSafeRoute(String? route) {
    if (route == null || route.isEmpty) return false;
    if (!route.startsWith('/')) return false;
    if (route.startsWith('//')) return false;
    if (route.contains('\\')) return false;
    return true;
  }

  static PushMessage? fromData(
    Map<String, String> data, {
    String? notificationTitle,
    String? notificationBody,
    DateTime? receivedAt,
  }) {
    final String? id = data['notificationId'];
    if (id == null || id.isEmpty) return null;

    final String title = notificationTitle ?? '';
    final String body = notificationBody ?? '';
    final String? rawRoute = data['route'];

    return PushMessage(
      id: id,
      title: title,
      body: body,
      category: data['category'] ?? 'ANNONCE',
      route: isSafeRoute(rawRoute) ? rawRoute : null,
      payload: data['payload'],
      sentAt: receivedAt ?? DateTime.now().toUtc(),
    );
  }

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

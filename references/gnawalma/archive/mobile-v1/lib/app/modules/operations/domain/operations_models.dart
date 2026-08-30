import '../../../data/models/order_model.dart';
import '../../../data/models/order_status_mapping.dart';

class RemoteAtelier {
  const RemoteAtelier({
    required this.id,
    required this.name,
    required this.phone,
    required this.status,
    required this.specialties,
    required this.profileCompleteness,
    required this.membershipRole,
    required this.version,
    this.description,
    this.address,
    this.region,
    this.latitude,
    this.longitude,
    this.tiktokUrl,
    this.instagramUrl,
    this.facebookUrl,
  });

  final String id;
  final String name;
  final String phone;
  final String status;
  final List<String> specialties;
  final int profileCompleteness;
  final String membershipRole;
  final int version;
  final String? description;
  final String? address;

  /// Région administrative déclarée : la valeur sur laquelle la recherche
  /// cliente filtre, distincte de l'adresse libre qui la contient souvent.
  final String? region;

  /// Read back from the server. `POST /operations/ateliers` has always accepted
  /// coordinates, but nothing here parsed them, so an atelier's location was
  /// write-only from the app's point of view — it could set a position it could
  /// never display or correct.
  final double? latitude;
  final double? longitude;

  /// Réseaux publiés sur la fiche publique (§2.2). Relus pour que l'atelier
  /// puisse les corriger après la configuration, et pas seulement pendant.
  final String? tiktokUrl;
  final String? instagramUrl;
  final String? facebookUrl;

  factory RemoteAtelier.fromJson(Map<String, dynamic> json) {
    return RemoteAtelier(
      id: _requiredString(json, 'id'),
      name: _string(json['name']) ?? 'Atelier',
      phone: _string(json['phone']) ?? '',
      status: _string(json['status']) ?? 'draft',
      specialties: _stringList(json['specialties']),
      profileCompleteness: _integer(json['profileCompleteness']),
      // Defaults to the least privileged role. 'atelier_staff' is not a role
      // the API can issue (apps/api/src/auth/auth.types.ts) — it was a value
      // this build invented and then treated as authoritative.
      membershipRole: _string(json['membershipRole']) ?? 'atelier_manager',
      version: _integer(json['version'], fallback: 1),
      description: _string(json['description']),
      address: _string(json['address']),
      region: _string(json['region']),
      latitude: _double(json['latitude']),
      longitude: _double(json['longitude']),
      tiktokUrl: _string(json['tiktokUrl']),
      instagramUrl: _string(json['instagramUrl']),
      facebookUrl: _string(json['facebookUrl']),
    );
  }
}

class OperationsDashboardSummary {
  const OperationsDashboardSummary({
    required this.activeOrders,
    required this.readyOrders,
    required this.overdueOrders,
    required this.unpaidCfa,
    required this.receivedTodayCfa,
    required this.clientsCount,
    this.nextDueAt,
  });

  final int activeOrders;
  final int readyOrders;
  final int overdueOrders;
  final int unpaidCfa;
  final int receivedTodayCfa;
  final int clientsCount;
  final DateTime? nextDueAt;

  factory OperationsDashboardSummary.fromJson(Map<String, dynamic> json) {
    return OperationsDashboardSummary(
      activeOrders: _integer(json['activeOrders']),
      readyOrders: _integer(json['readyOrders']),
      overdueOrders: _integer(json['overdueOrders']),
      unpaidCfa: _integer(json['unpaidCfa']),
      receivedTodayCfa: _integer(json['receivedTodayCfa']),
      clientsCount: _integer(json['clientsCount']),
      nextDueAt: _dateTime(json['nextDueAt']),
    );
  }
}

/// A client request as the receiving atelier sees it.
///
/// `contact_events` had a single reader — the client's own history — so a
/// request sent from the marketplace landed in a table the atelier it named
/// could not read. The exchange only becomes `completed` once both sides
/// confirm, and only a completed exchange can be reviewed, so without this the
/// second confirmation could never happen and no rating shown in the app could
/// ever have come from a real client.
class RemoteAtelierContact {
  const RemoteAtelierContact({
    required this.id,
    required this.channel,
    required this.status,
    required this.createdAt,
    this.completedAt,
    this.clientConfirmedAt,
    this.atelierConfirmedAt,
    this.clientName,
    this.clientPhone,
  });

  final String id;
  final String channel;
  final String status;
  final DateTime createdAt;
  final DateTime? completedAt;
  final DateTime? clientConfirmedAt;
  final DateTime? atelierConfirmedAt;
  final String? clientName;
  final String? clientPhone;

  String get channelLabel => switch (channel) {
    'whatsapp' => 'WhatsApp',
    'phone' => 'Appel',
    'sms' => 'SMS',
    'appointment' => 'Rendez-vous',
    _ => 'Contact',
  };

  String get statusLabel => switch (status) {
    'created' => 'Nouvelle demande',
    'accepted' => 'Acceptée',
    'declined' => 'Refusée',
    'completed' => 'Terminée',
    'disputed' => 'À vérifier',
    'cancelled' => 'Annulée',
    _ => status,
  };

  /// This atelier has not confirmed yet and the exchange is still open.
  bool get canConfirm =>
      atelierConfirmedAt == null &&
      (status == 'created' || status == 'accepted');

  /// This atelier has confirmed; the client's own confirmation is missing.
  bool get awaitingClientConfirmation =>
      atelierConfirmedAt != null &&
      clientConfirmedAt == null &&
      status != 'completed' &&
      status != 'disputed';

  factory RemoteAtelierContact.fromJson(Map<String, dynamic> json) {
    return RemoteAtelierContact(
      id: _requiredString(json, 'id'),
      channel: _string(json['channel']) ?? 'phone',
      status: _string(json['status']) ?? 'created',
      createdAt: _dateTime(json['createdAt']) ?? DateTime.now(),
      completedAt: _dateTime(json['completedAt']),
      clientConfirmedAt: _dateTime(json['clientConfirmedAt']),
      atelierConfirmedAt: _dateTime(json['atelierConfirmedAt']),
      clientName: _string(json['clientName']),
      clientPhone: _string(json['clientPhone']),
    );
  }
}

/// Une commande d'un autre atelier.
///
/// Décision du commanditaire : les ateliers voient l'activité les uns des
/// autres. Ce que le serveur envoie s'arrête là — aucun client, aucun montant,
/// aucune mesure ne traverse.
class SharedOrder {
  const SharedOrder({
    required this.id,
    required this.reference,
    required this.status,
    required this.atelierName,
    required this.garmentTypes,
    required this.itemCount,
    this.atelierRegion,
    this.dueAt,
  });

  final String id;
  final String reference;
  final String status;
  final String atelierName;
  final String? atelierRegion;
  final List<String> garmentTypes;
  final int itemCount;
  final DateTime? dueAt;

  factory SharedOrder.fromJson(Map<String, dynamic> json) {
    return SharedOrder(
      id: _requiredString(json, 'id'),
      reference: _string(json['reference']) ?? '—',
      status: _string(json['status']) ?? 'draft',
      atelierName: _string(json['atelierName']) ?? 'Atelier',
      atelierRegion: _string(json['atelierRegion']),
      garmentTypes: _stringList(json['garmentTypes']),
      itemCount: _integer(json['itemCount']),
      dueAt: _dateTime(json['dueAt']),
    );
  }
}

class RemotePage<T> {
  const RemotePage({
    required this.items,
    required this.limit,
    required this.offset,
    required this.hasMore,
  });

  final List<T> items;
  final int limit;
  final int offset;
  final bool hasMore;

  factory RemotePage.fromJson(
    Map<String, dynamic> json,
    T Function(Map<String, dynamic> item) decoder,
  ) {
    final rawItems = json['items'];
    return RemotePage<T>(
      items: rawItems is List
          ? rawItems
                .whereType<Map>()
                .map((item) => decoder(Map<String, dynamic>.from(item)))
                .toList(growable: false)
          : const [],
      limit: _integer(json['limit'], fallback: 30),
      offset: _integer(json['offset']),
      hasMore: json['hasMore'] == true,
    );
  }
}

class RemoteClient {
  const RemoteClient({
    required this.id,
    required this.fullName,
    required this.version,
    required this.createdAt,
    required this.updatedAt,
    this.phone,
    this.email,
    this.notes,
    this.orderCount = 0,
    this.totalSpentCfa = 0,
    this.lastOrderAt,
  });

  final String id;
  final String fullName;
  final String? phone;
  final String? email;
  final String? notes;
  final int version;
  final DateTime? createdAt;
  final DateTime? updatedAt;
  final int orderCount;
  final int totalSpentCfa;
  final DateTime? lastOrderAt;

  factory RemoteClient.fromJson(Map<String, dynamic> json) {
    return RemoteClient(
      id: _requiredString(json, 'id'),
      fullName: _string(json['fullName']) ?? 'Client',
      phone: _string(json['phone']),
      email: _string(json['email']),
      notes: _string(json['notes']),
      version: _integer(json['version'], fallback: 1),
      createdAt: _dateTime(json['createdAt']),
      updatedAt: _dateTime(json['updatedAt']),
      orderCount: _integer(json['orderCount']),
      totalSpentCfa: _integer(json['totalSpentCfa']),
      lastOrderAt: _dateTime(json['lastOrderAt']),
    );
  }
}

class RemoteOrderClient {
  const RemoteOrderClient({required this.id, required this.fullName});

  final String id;
  final String fullName;

  factory RemoteOrderClient.fromJson(Map<String, dynamic> json) {
    return RemoteOrderClient(
      id: _requiredString(json, 'id'),
      fullName: _string(json['fullName']) ?? 'Client',
    );
  }
}

class RemoteOrderItem {
  const RemoteOrderItem({
    required this.id,
    required this.garmentType,
    required this.unitPriceCfa,
    required this.status,
    this.beneficiaryId,
    this.measurementVersionId,
  });

  final String id;
  final String garmentType;
  final int unitPriceCfa;
  final String status;
  final String? beneficiaryId;
  final String? measurementVersionId;

  factory RemoteOrderItem.fromJson(Map<String, dynamic> json) {
    return RemoteOrderItem(
      id: _requiredString(json, 'id'),
      garmentType: _string(json['garmentType']) ?? 'Article',
      unitPriceCfa: _integer(json['unitPriceCfa']),
      status: _string(json['status']) ?? 'confirmed',
      beneficiaryId: _string(json['beneficiaryId']),
      measurementVersionId: _string(json['measurementVersionId']),
    );
  }
}

class RemoteOrder {
  const RemoteOrder({
    required this.id,
    required this.reference,
    required this.status,
    required this.totalCfa,
    required this.paidCfa,
    required this.remainingCfa,
    required this.version,
    required this.client,
    required this.items,
    this.dueAt,
    this.notes,
    this.createdAt,
    this.updatedAt,
  });

  final String id;
  final String reference;

  /// Raw wire value. Use [orderStatus] to compare against the local enum —
  /// the two vocabularies share only two of six values.
  final String status;

  /// The wire status resolved to the enum the UI renders.
  OrderStatus get orderStatus => orderStatusFromWire(status);

  final int totalCfa;
  final int paidCfa;
  final int remainingCfa;
  final DateTime? dueAt;
  final String? notes;
  final int version;
  final DateTime? createdAt;
  final DateTime? updatedAt;
  final RemoteOrderClient client;
  final List<RemoteOrderItem> items;

  factory RemoteOrder.fromJson(Map<String, dynamic> json) {
    final rawClient = json['client'];
    final rawItems = json['items'];
    return RemoteOrder(
      id: _requiredString(json, 'id'),
      reference: _string(json['reference']) ?? 'Commande',
      status: _string(json['status']) ?? 'confirmed',
      totalCfa: _integer(json['totalCfa']),
      paidCfa: _integer(json['paidCfa']),
      remainingCfa: _integer(json['remainingCfa']),
      dueAt: _dateTime(json['dueAt']),
      notes: _string(json['notes']),
      version: _integer(json['version'], fallback: 1),
      createdAt: _dateTime(json['createdAt']),
      updatedAt: _dateTime(json['updatedAt']),
      client: rawClient is Map
          ? RemoteOrderClient.fromJson(Map<String, dynamic>.from(rawClient))
          : const RemoteOrderClient(id: '', fullName: 'Client'),
      items: rawItems is List
          ? rawItems
                .whereType<Map>()
                .map(
                  (item) =>
                      RemoteOrderItem.fromJson(Map<String, dynamic>.from(item)),
                )
                .toList(growable: false)
          : const [],
    );
  }
}

class RemoteInventoryItem {
  const RemoteInventoryItem({
    required this.id,
    required this.kind,
    required this.name,
    required this.quantity,
    required this.unit,
    required this.version,
    this.costCfa,
    this.createdAt,
    this.updatedAt,
  });

  final String id;
  final String kind;
  final String name;
  final double quantity;
  final String unit;
  final int? costCfa;
  final int version;
  final DateTime? createdAt;
  final DateTime? updatedAt;

  factory RemoteInventoryItem.fromJson(Map<String, dynamic> json) {
    return RemoteInventoryItem(
      id: _requiredString(json, 'id'),
      kind: _string(json['kind']) ?? 'supply',
      name: _string(json['name']) ?? 'Article',
      quantity: _decimal(json['quantity']),
      unit: _string(json['unit']) ?? 'unité',
      costCfa: json['costCfa'] == null ? null : _integer(json['costCfa']),
      version: _integer(json['version'], fallback: 1),
      createdAt: _dateTime(json['createdAt']),
      updatedAt: _dateTime(json['updatedAt']),
    );
  }
}

class RemotePayment {
  const RemotePayment({
    required this.id,
    required this.orderId,
    required this.amountCfa,
    required this.method,
    this.note,
    this.createdAt,
  });

  final String id;
  final String orderId;
  final int amountCfa;
  final String method;
  final String? note;
  final DateTime? createdAt;

  factory RemotePayment.fromJson(Map<String, dynamic> json) {
    return RemotePayment(
      id: _requiredString(json, 'id'),
      orderId: _requiredString(json, 'orderId'),
      amountCfa: _integer(json['amountCfa']),
      method: _string(json['method']) ?? 'other',
      note: _string(json['note']),
      createdAt: _dateTime(json['createdAt']),
    );
  }
}

String _requiredString(Map<String, dynamic> json, String key) {
  final value = _string(json[key]);
  if (value == null || value.isEmpty) {
    throw FormatException('Missing required field: $key');
  }
  return value;
}

String? _string(Object? value) {
  if (value == null) return null;
  final result = value.toString().trim();
  return result.isEmpty ? null : result;
}

int _integer(Object? value, {int fallback = 0}) {
  if (value is int) return value;
  if (value is num) return value.toInt();
  return int.tryParse(value?.toString() ?? '') ?? fallback;
}

/// Nullable decimal. Distinct from [_decimal], which substitutes a value —
/// an absent coordinate is not the same as a coordinate at zero.
double? _double(Object? value) {
  if (value == null) return null;
  if (value is num) return value.toDouble();
  return double.tryParse(value.toString());
}

double _decimal(Object? value, {double fallback = 0}) {
  if (value is num) return value.toDouble();
  return double.tryParse(value?.toString() ?? '') ?? fallback;
}

DateTime? _dateTime(Object? value) {
  final raw = _string(value);
  return raw == null ? null : DateTime.tryParse(raw)?.toLocal();
}

List<String> _stringList(Object? value) {
  if (value is! List) return const [];
  return value.map(_string).whereType<String>().toList(growable: false);
}

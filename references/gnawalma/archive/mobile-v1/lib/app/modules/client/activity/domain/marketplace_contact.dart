class MarketplaceContact {
  const MarketplaceContact({
    required this.id,
    required this.atelierId,
    required this.atelierName,
    required this.channel,
    required this.status,
    required this.createdAt,
    required this.hasReview,
    this.completedAt,
    this.clientConfirmedAt,
    this.atelierLogoUrl,
    this.atelierCoverUrl,
    this.atelierPhone,
    this.atelierWhatsapp,
    this.atelierAddress,
  });

  final String id;
  final String atelierId;
  final String atelierName;
  final String channel;
  final String status;
  final DateTime createdAt;
  final DateTime? completedAt;

  /// When this client confirmed their half of the exchange.
  ///
  /// Confirmation is bilateral (`migrations/0003_bilateral_contacts.sql`): a
  /// contact only becomes `completed` once both sides agree, so the client's
  /// own confirmation has to be tracked separately from the status.
  final DateTime? clientConfirmedAt;

  final bool hasReview;
  final String? atelierLogoUrl;
  final String? atelierCoverUrl;
  final String? atelierPhone;
  final String? atelierWhatsapp;
  final String? atelierAddress;

  String get channelLabel => switch (channel) {
    'whatsapp' => 'WhatsApp',
    'phone' => 'Appel',
    'sms' => 'SMS',
    'appointment' => 'Rendez-vous',
    _ => 'Contact',
  };

  String get statusLabel => switch (status) {
    'created' => 'Demande envoyée',
    'accepted' => 'Acceptée',
    'declined' => 'Refusée',
    'completed' => 'Terminée',
    'disputed' => 'À vérifier',
    'cancelled' => 'Annulée',
    _ => status,
  };

  bool get canReview => status == 'completed' && !hasReview;

  /// True when this client has not yet confirmed and still could.
  ///
  /// Confirming does not by itself complete the exchange — the atelier has to
  /// confirm too — so this only tracks whether *this* side has spoken.
  bool get canConfirm =>
      clientConfirmedAt == null &&
      (status == 'created' || status == 'accepted');

  /// The client has confirmed and is waiting on the atelier.
  bool get awaitingAtelierConfirmation =>
      clientConfirmedAt != null &&
      status != 'completed' &&
      status != 'disputed';

  factory MarketplaceContact.fromJson(Map<String, dynamic> json) {
    return MarketplaceContact(
      id: json['id'] as String,
      atelierId: json['atelierId'] as String,
      atelierName: json['atelierName'] as String? ?? 'Atelier',
      channel: json['channel'] as String? ?? 'phone',
      status: json['status'] as String? ?? 'created',
      createdAt:
          DateTime.tryParse(json['createdAt'] as String? ?? '')?.toLocal() ??
          DateTime.now(),
      completedAt: DateTime.tryParse(
        json['completedAt'] as String? ?? '',
      )?.toLocal(),
      clientConfirmedAt: DateTime.tryParse(
        json['clientConfirmedAt'] as String? ?? '',
      )?.toLocal(),
      hasReview: json['hasReview'] as bool? ?? false,
      atelierLogoUrl: json['atelierLogoUrl'] as String?,
      atelierCoverUrl: json['atelierCoverUrl'] as String?,
      atelierPhone: json['atelierPhone'] as String?,
      atelierWhatsapp: json['atelierWhatsapp'] as String?,
      atelierAddress: json['atelierAddress'] as String?,
    );
  }
}

class AtelierPortfolioItem {
  const AtelierPortfolioItem({
    required this.id,
    required this.imageUrl,
    this.title,
    this.garmentType,
  });

  final String id;
  final String imageUrl;
  final String? title;
  final String? garmentType;

  factory AtelierPortfolioItem.fromJson(Map<String, dynamic> json) {
    return AtelierPortfolioItem(
      id: json['id'] as String? ?? '',
      imageUrl: json['imageUrl'] as String? ?? '',
      title: json['title'] as String?,
      garmentType: json['garmentType'] as String?,
    );
  }
}

class MarketplaceAtelier {
  const MarketplaceAtelier({
    required this.id,
    required this.name,
    required this.specialties,
    required this.portfolio,
    required this.rating,
    this.reviewCount,
    this.profileCompleteness,
    this.acceptsNewClients,
    this.description,
    this.address,
    this.region,
    this.phone,
    this.whatsapp,
    this.logoUrl,
    this.coverUrl,
    this.tiktokUrl,
    this.instagramUrl,
    this.facebookUrl,
    this.distanceMeters,
    this.latitude,
    this.longitude,
    this.responseTimeMinutes,
    this.nextAvailableAt,
    this.openingHours = const {},
    this.supportedLanguages = const ['fr'],
  });

  final String id;
  final String name;
  final String? description;
  final String? address;

  /// Région administrative déclarée. Le repère qu'un client lit avant la rue.
  final String? region;
  final String? phone;
  final String? whatsapp;
  final String? logoUrl;
  final String? coverUrl;

  /// Réseaux du couturier (§2.2 du cahier des charges).
  ///
  /// C'est là que vivent réellement les réalisations d'un artisan : la galerie
  /// interne ne contient que ce qu'il a pris le temps de téléverser ici, alors
  /// qu'il publie déjà tout son travail sur ces comptes.
  final String? tiktokUrl;
  final String? instagramUrl;
  final String? facebookUrl;

  /// Les liens réellement publiés, dans l'ordre d'affichage.
  List<({String label, String url})> get socialLinks => [
    if ((tiktokUrl ?? '').trim().isNotEmpty)
      (label: 'TikTok', url: tiktokUrl!.trim()),
    if ((instagramUrl ?? '').trim().isNotEmpty)
      (label: 'Instagram', url: instagramUrl!.trim()),
    if ((facebookUrl ?? '').trim().isNotEmpty)
      (label: 'Facebook', url: facebookUrl!.trim()),
  ];

  final List<String> specialties;
  final List<AtelierPortfolioItem> portfolio;
  final double rating;

  /// Null when the source does not carry these — a cached favourite knows the
  /// atelier's name and address but not its live review count or whether it is
  /// still taking work. They are nullable so "unknown" can be rendered as
  /// unknown; defaulting them made the UI assert availability it had never
  /// been told.
  final int? reviewCount;
  final int? distanceMeters;

  /// Zone déclarée par le couturier, pour la carte (§2.1). Nulle pour un
  /// favori mis en cache, qui ne conserve que le nom et l'adresse.
  final double? latitude;
  final double? longitude;
  final int? responseTimeMinutes;
  final int? profileCompleteness;
  final bool? acceptsNewClients;
  final DateTime? nextAvailableAt;
  final Map<String, dynamic> openingHours;
  final List<String> supportedLanguages;

  String get distanceLabel {
    final meters = distanceMeters;
    if (meters == null) return 'Distance indisponible';
    if (meters < 1000) return '$meters m';
    return '${(meters / 1000).toStringAsFixed(meters < 10_000 ? 1 : 0)} km';
  }

  String get primarySpecialty =>
      specialties.isEmpty ? 'Couture sur mesure' : specialties.first;

  /// Null when availability is unknown, so callers omit the claim rather than
  /// guessing at it.
  String? get availabilityLabel {
    final accepting = acceptsNewClients;
    if (accepting == null) return null;
    if (!accepting) return 'Complet actuellement';
    if (nextAvailableAt == null) return 'Nouveaux clients acceptés';
    final days = nextAvailableAt!.difference(DateTime.now()).inDays;
    if (days <= 0) return 'Disponible maintenant';
    if (days == 1) return 'Disponible demain';
    return 'Disponible dans $days jours';
  }

  factory MarketplaceAtelier.fromJson(Map<String, dynamic> json) {
    DateTime? parseDate(dynamic value) {
      if (value is! String || value.isEmpty) return null;
      return DateTime.tryParse(value)?.toLocal();
    }

    return MarketplaceAtelier(
      id: json['id'] as String,
      name: json['name'] as String? ?? 'Atelier',
      description: json['description'] as String?,
      address: json['address'] as String?,
      region: json['region'] as String?,
      phone: json['phone'] as String?,
      whatsapp: json['whatsapp'] as String?,
      logoUrl: json['logoUrl'] as String?,
      coverUrl: json['coverUrl'] as String?,
      tiktokUrl: json['tiktokUrl'] as String?,
      instagramUrl: json['instagramUrl'] as String?,
      facebookUrl: json['facebookUrl'] as String?,
      specialties: (json['specialties'] as List<dynamic>? ?? const [])
          .whereType<String>()
          .toList(growable: false),
      portfolio: (json['portfolio'] as List<dynamic>? ?? const [])
          .whereType<Map>()
          .map(
            (item) =>
                AtelierPortfolioItem.fromJson(Map<String, dynamic>.from(item)),
          )
          .toList(growable: false),
      rating: (json['rating'] as num?)?.toDouble() ?? 0,
      reviewCount: (json['reviewCount'] as num?)?.toInt(),
      distanceMeters: (json['distanceMeters'] as num?)?.toInt(),
      latitude: (json['latitude'] as num?)?.toDouble(),
      longitude: (json['longitude'] as num?)?.toDouble(),
      responseTimeMinutes: (json['responseTimeMinutes'] as num?)?.toInt(),
      profileCompleteness: (json['profileCompleteness'] as num?)?.toInt(),
      acceptsNewClients: json['acceptsNewClients'] as bool?,
      nextAvailableAt: parseDate(json['nextAvailableAt']),
      openingHours: json['openingHours'] is Map
          ? Map<String, dynamic>.from(json['openingHours'] as Map)
          : const {},
      supportedLanguages:
          (json['supportedLanguages'] as List<dynamic>? ?? const ['fr'])
              .whereType<String>()
              .toList(growable: false),
    );
  }
}

/// Une mise en avant sur l'accueil.
///
/// Éditée depuis le back-office, pas figée dans l'application : l'accueil ne
/// portait aucun emplacement éditorial, et rien ne pouvait y être annoncé sans
/// publier une version.
class MarketplacePromotion {
  const MarketplacePromotion({
    required this.id,
    required this.title,
    required this.imageUrl,
    this.subtitle,
    this.atelierId,
  });

  final String id;
  final String title;
  final String imageUrl;
  final String? subtitle;
  final String? atelierId;

  factory MarketplacePromotion.fromJson(Map<String, dynamic> json) {
    return MarketplacePromotion(
      id: json['id'] as String? ?? '',
      title: json['title'] as String? ?? '',
      imageUrl: json['imageUrl'] as String? ?? '',
      subtitle: json['subtitle'] as String?,
      atelierId: json['atelierId'] as String?,
    );
  }
}

class MarketplaceSearchQuery {
  const MarketplaceSearchQuery({
    this.latitude,
    this.longitude,
    this.text,
    this.region,
    this.specialty,
    this.radiusMeters,
    this.limit = 30,
    this.offset = 0,
  });

  /// Position de l'utilisateur, quand il l'a accordée.
  ///
  /// Valait par défaut le centre de Dakar — 14.7167 / -17.4677 — pour tout le
  /// pays : « près de chez vous » mesurait donc une distance depuis un point
  /// que l'utilisateur n'avait jamais donné, et un client de Ziguinchor voyait
  /// « à 450 km » sur l'atelier d'en face. Sans position, la recherche reste
  /// possible et n'annonce aucune distance.
  final double? latitude;
  final double? longitude;
  final String? text;

  /// Région administrative. Filtre exact, pas une recherche plein texte.
  final String? region;

  /// Une valeur d'`AtelierSpecialties` : Homme, Femme ou Enfant.
  final String? specialty;

  /// Rayon de recherche, en mètres. `null` = pas de limite de distance.
  ///
  /// Le fil d'accueil en fixe un, parce qu'il montre « les couturiers les plus
  /// proches ». La recherche n'en fixe aucun par défaut : §2.1 en fait un
  /// filtre que l'on choisit, et chercher un atelier par son nom ne doit pas
  /// échouer silencieusement parce qu'il est à 20 km.
  final int? radiusMeters;
  final int limit;
  final int offset;

  bool get hasOrigin => latitude != null && longitude != null;

  MarketplaceSearchQuery copyWith({
    double? latitude,
    double? longitude,
    bool clearOrigin = false,
    String? text,
    bool clearText = false,
    String? region,
    bool clearRegion = false,
    String? specialty,
    bool clearSpecialty = false,
    int? radiusMeters,
    bool clearRadius = false,
    int? limit,
    int? offset,
  }) {
    return MarketplaceSearchQuery(
      latitude: clearOrigin ? null : latitude ?? this.latitude,
      longitude: clearOrigin ? null : longitude ?? this.longitude,
      text: clearText ? null : text ?? this.text,
      region: clearRegion ? null : region ?? this.region,
      specialty: clearSpecialty ? null : specialty ?? this.specialty,
      radiusMeters: clearRadius ? null : radiusMeters ?? this.radiusMeters,
      limit: limit ?? this.limit,
      offset: offset ?? this.offset,
    );
  }

  @override
  bool operator ==(Object other) {
    return other is MarketplaceSearchQuery &&
        other.latitude == latitude &&
        other.longitude == longitude &&
        other.text == text &&
        other.region == region &&
        other.specialty == specialty &&
        other.radiusMeters == radiusMeters &&
        other.limit == limit &&
        other.offset == offset;
  }

  @override
  int get hashCode => Object.hash(
    latitude,
    longitude,
    text,
    region,
    specialty,
    radiusMeters,
    limit,
    offset,
  );
}

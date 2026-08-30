/// Un atelier dans le classement (§2.4).
class RankedAtelier {
  const RankedAtelier({
    required this.id,
    required this.rank,
    required this.name,
    required this.specialties,
    required this.rating,
    required this.reviewCount,
    this.address,
    this.logoUrl,
    this.distanceMeters,
    this.acceptsNewClients = true,
  });

  final String id;
  final int rank;
  final String name;
  final List<String> specialties;
  final double rating;
  final int reviewCount;
  final String? address;
  final String? logoUrl;
  final int? distanceMeters;
  final bool acceptsNewClients;

  /// Un atelier sans avis n'a pas une note de zéro : il n'a pas de note.
  ///
  /// Le classement le place quand même — le serveur le ramène à la moyenne
  /// générale tant qu'il n'a pas d'avis — mais afficher « 0,0 » le ferait
  /// passer pour mauvais alors que personne ne l'a encore jugé.
  bool get hasRating => reviewCount > 0;

  String get specialtyLabel =>
      specialties.isEmpty ? 'Couture sur mesure' : specialties.first;

  factory RankedAtelier.fromJson(Map<String, dynamic> json) {
    return RankedAtelier(
      id: json['id'] as String,
      rank: (json['rank'] as num?)?.toInt() ?? 0,
      name: json['name'] as String? ?? 'Atelier',
      specialties: (json['specialties'] as List<dynamic>? ?? const [])
          .whereType<String>()
          .toList(growable: false),
      rating: (json['rating'] as num?)?.toDouble() ?? 0,
      reviewCount: (json['reviewCount'] as num?)?.toInt() ?? 0,
      address: json['address'] as String?,
      logoUrl: json['logoUrl'] as String?,
      distanceMeters: (json['distanceMeters'] as num?)?.toInt(),
      acceptsNewClients: json['acceptsNewClients'] as bool? ?? true,
    );
  }
}

/// Le périmètre du classement : tout le pays, ou une zone autour du client.
class RankingScope {
  const RankingScope({this.latitude, this.longitude, this.radiusMeters});

  /// Classement général (§2.4).
  static const general = RankingScope();

  /// Classement par zone : le second que le cahier des charges demande.
  ///
  /// Bâti sur la position réelle de l'utilisateur. Il partait auparavant du
  /// centre de Dakar quel que soit l'endroit d'où on ouvrait l'écran.
  static RankingScope around(double latitude, double longitude) => RankingScope(
    latitude: latitude,
    longitude: longitude,
    radiusMeters: 15_000,
  );

  final double? latitude;
  final double? longitude;
  final int? radiusMeters;

  bool get isScoped => radiusMeters != null;

  @override
  bool operator ==(Object other) =>
      other is RankingScope &&
      other.latitude == latitude &&
      other.longitude == longitude &&
      other.radiusMeters == radiusMeters;

  @override
  int get hashCode => Object.hash(latitude, longitude, radiusMeters);
}

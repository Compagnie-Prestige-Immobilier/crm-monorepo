import 'package:isar_plus/isar_plus.dart';

part 'favorite_workshop_model.g.dart';

/// Favorite Workshop Model
///
/// Persists workshops the client has bookmarked locally
/// using Isar for offline-capable favorites.
@collection
class FavoriteWorkshopModel {
  FavoriteWorkshopModel({
    required this.workshopId,
    required this.workshopName,
    this.specialty,
    this.phone,
    this.address,
    this.distanceKm,
    this.rating,
    this.imageUrl,
    this.isVerified = false,
  });

  int id = 0;

  /// Unique workshop identifier (from API or local)
  late String workshopId;

  /// Workshop display name
  late String workshopName;

  /// Main specialty (e.g., "Wax, Bazin")
  String? specialty;

  /// Contact phone
  String? phone;

  /// Address
  String? address;

  /// Approximate distance in km
  double? distanceKm;

  /// Average rating (1-5)
  double? rating;

  /// Profile image URL
  String? imageUrl;

  /// Verification status
  bool isVerified = false;

  /// When this was saved as favorite
  DateTime createdAt = DateTime.now();
}

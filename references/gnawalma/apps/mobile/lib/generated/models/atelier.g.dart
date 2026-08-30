// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'atelier.dart';

// **************************************************************************
// JsonSerializableGenerator
// **************************************************************************

Atelier _$AtelierFromJson(Map<String, dynamic> json) => Atelier(
  id: (json['id'] as num).toInt(),
  name: json['name'] as String,
  specialties:
      (json['specialties'] as List<dynamic>?)
          ?.map((e) => e as String)
          .toList() ??
      const [],
  wizardStep: (json['wizard_step'] as num?)?.toInt() ?? 1,
  reviewsCount: (json['reviews_count'] as num?)?.toInt() ?? 0,
  isFavorite: json['is_favorite'] as bool? ?? false,
  photos:
      (json['photos'] as List<dynamic>?)
          ?.map((e) => PortfolioPhoto.fromJson(e as Map<String, dynamic>))
          .toList() ??
      const [],
  reviews:
      (json['reviews'] as List<dynamic>?)
          ?.map((e) => Review.fromJson(e as Map<String, dynamic>))
          .toList() ??
      const [],
  userId: (json['user_id'] as num?)?.toInt(),
  description: json['description'] as String?,
  phone: json['phone'] as String?,
  region: json['region'] as String?,
  address: json['address'] as String?,
  registreCommerce: json['registre_commerce'] as String?,
  latitude: json['latitude'] as num?,
  longitude: json['longitude'] as num?,
  logoPath: json['logo_path'] as String?,
  coverPath: json['cover_path'] as String?,
  tiktok: json['tiktok'] as String?,
  instagram: json['instagram'] as String?,
  facebook: json['facebook'] as String?,
  completedAt: const NullableLocalDateTimeConverter().fromJson(
    json['completed_at'],
  ),
  verifiedAt: const NullableLocalDateTimeConverter().fromJson(
    json['verified_at'],
  ),
  createdAt: const NullableLocalDateTimeConverter().fromJson(
    json['created_at'],
  ),
  updatedAt: const NullableLocalDateTimeConverter().fromJson(
    json['updated_at'],
  ),
  logoUrl: json['logo_url'] as String?,
  coverUrl: json['cover_url'] as String?,
  distanceKm: json['distance_km'] as num?,
  reviewsAvgRating: json['reviews_avg_rating'] as String?,
);

Map<String, dynamic> _$AtelierToJson(Atelier instance) => <String, dynamic>{
  'id': instance.id,
  'user_id': instance.userId,
  'name': instance.name,
  'description': instance.description,
  'phone': instance.phone,
  'region': instance.region,
  'address': instance.address,
  'registre_commerce': instance.registreCommerce,
  'latitude': instance.latitude,
  'longitude': instance.longitude,
  'specialties': instance.specialties,
  'logo_path': instance.logoPath,
  'cover_path': instance.coverPath,
  'tiktok': instance.tiktok,
  'instagram': instance.instagram,
  'facebook': instance.facebook,
  'wizard_step': instance.wizardStep,
  'completed_at': const NullableLocalDateTimeConverter().toJson(
    instance.completedAt,
  ),
  'verified_at': const NullableLocalDateTimeConverter().toJson(
    instance.verifiedAt,
  ),
  'created_at': const NullableLocalDateTimeConverter().toJson(
    instance.createdAt,
  ),
  'updated_at': const NullableLocalDateTimeConverter().toJson(
    instance.updatedAt,
  ),
  'logo_url': instance.logoUrl,
  'cover_url': instance.coverUrl,
  'distance_km': instance.distanceKm,
  'reviews_avg_rating': instance.reviewsAvgRating,
  'reviews_count': instance.reviewsCount,
  'is_favorite': instance.isFavorite,
  'photos': instance.photos,
  'reviews': instance.reviews,
};

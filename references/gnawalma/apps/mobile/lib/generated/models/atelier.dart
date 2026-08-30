// coverage:ignore-file
// GENERATED CODE - DO NOT MODIFY BY HAND
// ignore_for_file: type=lint, unused_import, invalid_annotation_target, unnecessary_import

import 'package:json_annotation/json_annotation.dart';

import 'portfolio_photo.dart';
import 'review.dart';

import 'package:gnawalma/json_converters.dart';
part 'atelier.g.dart';

@JsonSerializable()
class Atelier {
  const Atelier({
    required this.id,
    required this.name,
    this.specialties = const [],
    this.wizardStep = 1,
    this.reviewsCount = 0,
    this.isFavorite = false,
    this.photos = const [],
    this.reviews = const [],
    this.userId,
    this.description,
    this.phone,
    this.region,
    this.address,
    this.registreCommerce,
    this.latitude,
    this.longitude,
    this.logoPath,
    this.coverPath,
    this.tiktok,
    this.instagram,
    this.facebook,
    this.completedAt,
    this.verifiedAt,
    this.createdAt,
    this.updatedAt,
    this.logoUrl,
    this.coverUrl,
    this.distanceKm,
    this.reviewsAvgRating,
  });
  
  factory Atelier.fromJson(Map<String, Object?> json) => _$AtelierFromJson(json);
  
  final int id;
  @JsonKey(name: 'user_id')
  final int? userId;
  final String name;
  final String? description;
  final String? phone;
  final String? region;
  final String? address;
  @JsonKey(name: 'registre_commerce')
  final String? registreCommerce;
  final num? latitude;
  final num? longitude;
  final List<String> specialties;
  @JsonKey(name: 'logo_path')
  final String? logoPath;
  @JsonKey(name: 'cover_path')
  final String? coverPath;
  final String? tiktok;
  final String? instagram;
  final String? facebook;
  @JsonKey(name: 'wizard_step')
  final int wizardStep;
	@NullableLocalDateTimeConverter()
  @JsonKey(name: 'completed_at')
  final DateTime? completedAt;
	@NullableLocalDateTimeConverter()
  @JsonKey(name: 'verified_at')
  final DateTime? verifiedAt;
	@NullableLocalDateTimeConverter()
  @JsonKey(name: 'created_at')
  final DateTime? createdAt;
	@NullableLocalDateTimeConverter()
  @JsonKey(name: 'updated_at')
  final DateTime? updatedAt;
  @JsonKey(name: 'logo_url')
  final String? logoUrl;
  @JsonKey(name: 'cover_url')
  final String? coverUrl;
  @JsonKey(name: 'distance_km')
  final num? distanceKm;
  @JsonKey(name: 'reviews_avg_rating')
  final String? reviewsAvgRating;
  @JsonKey(name: 'reviews_count')
  final int reviewsCount;
  @JsonKey(name: 'is_favorite')
  final bool isFavorite;
  final List<PortfolioPhoto> photos;
  final List<Review> reviews;

  Map<String, Object?> toJson() => _$AtelierToJson(this);
}

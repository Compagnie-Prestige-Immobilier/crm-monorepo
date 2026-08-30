// coverage:ignore-file
// GENERATED CODE - DO NOT MODIFY BY HAND
// ignore_for_file: type=lint, unused_import, invalid_annotation_target, unnecessary_import

import 'package:json_annotation/json_annotation.dart';

import 'atelier.dart';

import 'package:gnawalma/json_converters.dart';
part 'promotion.g.dart';

@JsonSerializable()
class Promotion {
  const Promotion({
    required this.id,
    required this.title,
    required this.imagePath,
    required this.atelierId,
    required this.searchQuery,
    required this.active,
    required this.position,
    required this.createdAt,
    required this.updatedAt,
    required this.imageUrl,
    this.atelier,
  });
  
  factory Promotion.fromJson(Map<String, Object?> json) => _$PromotionFromJson(json);
  
  final int id;
  final String title;
  @JsonKey(name: 'image_path')
  final String imagePath;
  @JsonKey(name: 'atelier_id')
  final int? atelierId;
  @JsonKey(name: 'search_query')
  final String? searchQuery;
  final bool active;
  final int position;
	@NullableLocalDateTimeConverter()
  @JsonKey(name: 'created_at')
  final DateTime? createdAt;
	@NullableLocalDateTimeConverter()
  @JsonKey(name: 'updated_at')
  final DateTime? updatedAt;
  @JsonKey(name: 'image_url')
  final String imageUrl;
  final Atelier? atelier;

  Map<String, Object?> toJson() => _$PromotionToJson(this);
}

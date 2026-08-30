// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'promotion.dart';

// **************************************************************************
// JsonSerializableGenerator
// **************************************************************************

Promotion _$PromotionFromJson(Map<String, dynamic> json) => Promotion(
  id: (json['id'] as num).toInt(),
  title: json['title'] as String,
  imagePath: json['image_path'] as String,
  atelierId: (json['atelier_id'] as num?)?.toInt(),
  searchQuery: json['search_query'] as String?,
  active: json['active'] as bool,
  position: (json['position'] as num).toInt(),
  createdAt: const NullableLocalDateTimeConverter().fromJson(
    json['created_at'],
  ),
  updatedAt: const NullableLocalDateTimeConverter().fromJson(
    json['updated_at'],
  ),
  imageUrl: json['image_url'] as String,
  atelier: json['atelier'] == null
      ? null
      : Atelier.fromJson(json['atelier'] as Map<String, dynamic>),
);

Map<String, dynamic> _$PromotionToJson(Promotion instance) => <String, dynamic>{
  'id': instance.id,
  'title': instance.title,
  'image_path': instance.imagePath,
  'atelier_id': instance.atelierId,
  'search_query': instance.searchQuery,
  'active': instance.active,
  'position': instance.position,
  'created_at': const NullableLocalDateTimeConverter().toJson(
    instance.createdAt,
  ),
  'updated_at': const NullableLocalDateTimeConverter().toJson(
    instance.updatedAt,
  ),
  'image_url': instance.imageUrl,
  'atelier': instance.atelier,
};

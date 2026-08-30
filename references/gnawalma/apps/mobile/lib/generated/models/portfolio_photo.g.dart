// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'portfolio_photo.dart';

// **************************************************************************
// JsonSerializableGenerator
// **************************************************************************

PortfolioPhoto _$PortfolioPhotoFromJson(Map<String, dynamic> json) =>
    PortfolioPhoto(
      id: (json['id'] as num).toInt(),
      atelierId: (json['atelier_id'] as num).toInt(),
      path: json['path'] as String,
      position: (json['position'] as num).toInt(),
      createdAt: const NullableLocalDateTimeConverter().fromJson(
        json['created_at'],
      ),
      updatedAt: const NullableLocalDateTimeConverter().fromJson(
        json['updated_at'],
      ),
      url: json['url'] as String,
    );

Map<String, dynamic> _$PortfolioPhotoToJson(PortfolioPhoto instance) =>
    <String, dynamic>{
      'id': instance.id,
      'atelier_id': instance.atelierId,
      'path': instance.path,
      'position': instance.position,
      'created_at': const NullableLocalDateTimeConverter().toJson(
        instance.createdAt,
      ),
      'updated_at': const NullableLocalDateTimeConverter().toJson(
        instance.updatedAt,
      ),
      'url': instance.url,
    };

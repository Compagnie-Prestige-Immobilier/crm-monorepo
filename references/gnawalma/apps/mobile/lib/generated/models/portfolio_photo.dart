// coverage:ignore-file
// GENERATED CODE - DO NOT MODIFY BY HAND
// ignore_for_file: type=lint, unused_import, invalid_annotation_target, unnecessary_import

import 'package:json_annotation/json_annotation.dart';

import 'package:gnawalma/json_converters.dart';
part 'portfolio_photo.g.dart';

@JsonSerializable()
class PortfolioPhoto {
  const PortfolioPhoto({
    required this.id,
    required this.atelierId,
    required this.path,
    required this.position,
    required this.createdAt,
    required this.updatedAt,
    required this.url,
  });
  
  factory PortfolioPhoto.fromJson(Map<String, Object?> json) => _$PortfolioPhotoFromJson(json);
  
  final int id;
  @JsonKey(name: 'atelier_id')
  final int atelierId;
  final String path;
  final int position;
	@NullableLocalDateTimeConverter()
  @JsonKey(name: 'created_at')
  final DateTime? createdAt;
	@NullableLocalDateTimeConverter()
  @JsonKey(name: 'updated_at')
  final DateTime? updatedAt;
  final String url;

  Map<String, Object?> toJson() => _$PortfolioPhotoToJson(this);
}

// coverage:ignore-file
// GENERATED CODE - DO NOT MODIFY BY HAND
// ignore_for_file: type=lint, unused_import, invalid_annotation_target, unnecessary_import

import 'package:json_annotation/json_annotation.dart';

part 'avis_request_body.g.dart';

@JsonSerializable()
class AvisRequestBody {
  const AvisRequestBody({
    required this.atelierId,
    required this.rating,
    this.text,
  });
  
  factory AvisRequestBody.fromJson(Map<String, Object?> json) => _$AvisRequestBodyFromJson(json);
  
  @JsonKey(name: 'atelier_id')
  final int atelierId;
  final int rating;
  final String? text;

  Map<String, Object?> toJson() => _$AvisRequestBodyToJson(this);
}

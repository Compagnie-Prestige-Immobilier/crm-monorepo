// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'avis_request_body.dart';

// **************************************************************************
// JsonSerializableGenerator
// **************************************************************************

AvisRequestBody _$AvisRequestBodyFromJson(Map<String, dynamic> json) =>
    AvisRequestBody(
      atelierId: (json['atelier_id'] as num).toInt(),
      rating: (json['rating'] as num).toInt(),
      text: json['text'] as String?,
    );

Map<String, dynamic> _$AvisRequestBodyToJson(AvisRequestBody instance) =>
    <String, dynamic>{
      'atelier_id': instance.atelierId,
      'rating': instance.rating,
      'text': instance.text,
    };

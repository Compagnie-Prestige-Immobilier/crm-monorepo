// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'review.dart';

// **************************************************************************
// JsonSerializableGenerator
// **************************************************************************

Review _$ReviewFromJson(Map<String, dynamic> json) => Review(
  id: (json['id'] as num).toInt(),
  userId: (json['user_id'] as num).toInt(),
  atelierId: (json['atelier_id'] as num).toInt(),
  rating: (json['rating'] as num).toInt(),
  text: json['text'] as String?,
  status: json['status'] as String,
  createdAt: const LocalDateTimeConverter().fromJson(json['created_at']),
  updatedAt: const NullableLocalDateTimeConverter().fromJson(
    json['updated_at'],
  ),
  user: json['user'] == null
      ? null
      : User.fromJson(json['user'] as Map<String, dynamic>),
);

Map<String, dynamic> _$ReviewToJson(Review instance) => <String, dynamic>{
  'id': instance.id,
  'user_id': instance.userId,
  'atelier_id': instance.atelierId,
  'rating': instance.rating,
  'text': instance.text,
  'status': instance.status,
  'created_at': const LocalDateTimeConverter().toJson(instance.createdAt),
  'updated_at': const NullableLocalDateTimeConverter().toJson(
    instance.updatedAt,
  ),
  'user': instance.user,
};

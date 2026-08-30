// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'contact.dart';

// **************************************************************************
// JsonSerializableGenerator
// **************************************************************************

Contact _$ContactFromJson(Map<String, dynamic> json) => Contact(
  id: (json['id'] as num).toInt(),
  userId: (json['user_id'] as num).toInt(),
  channel: json['channel'] as String,
  message: json['message'] as String?,
  sharePhone: json['share_phone'] as bool,
  handledAt: const NullableLocalDateTimeConverter().fromJson(
    json['handled_at'],
  ),
  createdAt: const LocalDateTimeConverter().fromJson(json['created_at']),
  updatedAt: const NullableLocalDateTimeConverter().fromJson(
    json['updated_at'],
  ),
  atelierId: (json['atelier_id'] as num?)?.toInt(),
  myRating: (json['my_rating'] as num?)?.toInt(),
  user: json['user'] == null
      ? null
      : User.fromJson(json['user'] as Map<String, dynamic>),
  atelier: json['atelier'] == null
      ? null
      : Atelier.fromJson(json['atelier'] as Map<String, dynamic>),
);

Map<String, dynamic> _$ContactToJson(Contact instance) => <String, dynamic>{
  'id': instance.id,
  'user_id': instance.userId,
  'atelier_id': instance.atelierId,
  'channel': instance.channel,
  'message': instance.message,
  'share_phone': instance.sharePhone,
  'handled_at': const NullableLocalDateTimeConverter().toJson(
    instance.handledAt,
  ),
  'created_at': const LocalDateTimeConverter().toJson(instance.createdAt),
  'updated_at': const NullableLocalDateTimeConverter().toJson(
    instance.updatedAt,
  ),
  'my_rating': instance.myRating,
  'user': instance.user,
  'atelier': instance.atelier,
};

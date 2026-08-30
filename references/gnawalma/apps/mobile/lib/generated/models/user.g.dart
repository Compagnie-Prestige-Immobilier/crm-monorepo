// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'user.dart';

// **************************************************************************
// JsonSerializableGenerator
// **************************************************************************

User _$UserFromJson(Map<String, dynamic> json) => User(
  id: (json['id'] as num).toInt(),
  name: json['name'] as String,
  email: json['email'] as String?,
  phone: json['phone'] as String?,
  role: json['role'] as String?,
  createdAt: const NullableLocalDateTimeConverter().fromJson(
    json['created_at'],
  ),
  updatedAt: const NullableLocalDateTimeConverter().fromJson(
    json['updated_at'],
  ),
  atelier: json['atelier'] == null
      ? null
      : Atelier.fromJson(json['atelier'] as Map<String, dynamic>),
);

Map<String, dynamic> _$UserToJson(User instance) => <String, dynamic>{
  'id': instance.id,
  'name': instance.name,
  'email': instance.email,
  'phone': instance.phone,
  'role': instance.role,
  'created_at': const NullableLocalDateTimeConverter().toJson(
    instance.createdAt,
  ),
  'updated_at': const NullableLocalDateTimeConverter().toJson(
    instance.updatedAt,
  ),
  'atelier': instance.atelier,
};

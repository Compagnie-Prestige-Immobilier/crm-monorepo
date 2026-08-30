// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'beneficiary.dart';

// **************************************************************************
// JsonSerializableGenerator
// **************************************************************************

Beneficiary _$BeneficiaryFromJson(Map<String, dynamic> json) => Beneficiary(
  id: (json['id'] as num).toInt(),
  clientId: (json['client_id'] as num).toInt(),
  label: json['label'] as String,
  gender: json['gender'] as String,
  measurements: json['measurements'] as String?,
  createdAt: const NullableLocalDateTimeConverter().fromJson(
    json['created_at'],
  ),
  updatedAt: const NullableLocalDateTimeConverter().fromJson(
    json['updated_at'],
  ),
);

Map<String, dynamic> _$BeneficiaryToJson(Beneficiary instance) =>
    <String, dynamic>{
      'id': instance.id,
      'client_id': instance.clientId,
      'label': instance.label,
      'gender': instance.gender,
      'measurements': instance.measurements,
      'created_at': const NullableLocalDateTimeConverter().toJson(
        instance.createdAt,
      ),
      'updated_at': const NullableLocalDateTimeConverter().toJson(
        instance.updatedAt,
      ),
    };

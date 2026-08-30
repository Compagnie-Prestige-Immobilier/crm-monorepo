// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'order.dart';

// **************************************************************************
// JsonSerializableGenerator
// **************************************************************************

Order _$OrderFromJson(Map<String, dynamic> json) => Order(
  id: (json['id'] as num).toInt(),
  atelierId: (json['atelier_id'] as num).toInt(),
  beneficiaryId: (json['beneficiary_id'] as num?)?.toInt(),
  reference: json['reference'] as String,
  measurements: json['measurements'] as String,
  description: json['description'] as String?,
  fabricPhotoPath: json['fabric_photo_path'] as String?,
  totalCfa: (json['total_cfa'] as num).toInt(),
  status: json['status'] as String,
  dueAt: const LocalDateTimeConverter().fromJson(json['due_at']),
  createdAt: const NullableLocalDateTimeConverter().fromJson(
    json['created_at'],
  ),
  updatedAt: const NullableLocalDateTimeConverter().fromJson(
    json['updated_at'],
  ),
  paidCfa: (json['paid_cfa'] as num).toInt(),
  remainingCfa: (json['remaining_cfa'] as num).toInt(),
  fabricPhotoUrl: json['fabric_photo_url'] as String?,
  payments:
      (json['payments'] as List<dynamic>?)
          ?.map((e) => Payment.fromJson(e as Map<String, dynamic>))
          .toList() ??
      const [],
  clientId: (json['client_id'] as num?)?.toInt(),
  client: json['client'] == null
      ? null
      : Client.fromJson(json['client'] as Map<String, dynamic>),
  beneficiary: json['beneficiary'] == null
      ? null
      : Beneficiary.fromJson(json['beneficiary'] as Map<String, dynamic>),
);

Map<String, dynamic> _$OrderToJson(Order instance) => <String, dynamic>{
  'id': instance.id,
  'atelier_id': instance.atelierId,
  'client_id': instance.clientId,
  'beneficiary_id': instance.beneficiaryId,
  'reference': instance.reference,
  'measurements': instance.measurements,
  'description': instance.description,
  'fabric_photo_path': instance.fabricPhotoPath,
  'total_cfa': instance.totalCfa,
  'status': instance.status,
  'due_at': const LocalDateTimeConverter().toJson(instance.dueAt),
  'created_at': const NullableLocalDateTimeConverter().toJson(
    instance.createdAt,
  ),
  'updated_at': const NullableLocalDateTimeConverter().toJson(
    instance.updatedAt,
  ),
  'paid_cfa': instance.paidCfa,
  'remaining_cfa': instance.remainingCfa,
  'fabric_photo_url': instance.fabricPhotoUrl,
  'client': instance.client,
  'beneficiary': instance.beneficiary,
  'payments': instance.payments,
};

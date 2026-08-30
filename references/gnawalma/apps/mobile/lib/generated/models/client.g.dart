// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'client.dart';

// **************************************************************************
// JsonSerializableGenerator
// **************************************************************************

Client _$ClientFromJson(Map<String, dynamic> json) => Client(
  id: (json['id'] as num).toInt(),
  name: json['name'] as String,
  ordersCount: (json['orders_count'] as num?)?.toInt() ?? 0,
  totalSpentCfa: (json['total_spent_cfa'] as num?)?.toInt() ?? 0,
  remainingCfa: (json['remaining_cfa'] as num?)?.toInt() ?? 0,
  beneficiaries:
      (json['beneficiaries'] as List<dynamic>?)
          ?.map((e) => Beneficiary.fromJson(e as Map<String, dynamic>))
          .toList() ??
      const [],
  orders:
      (json['orders'] as List<dynamic>?)
          ?.map((e) => Order.fromJson(e as Map<String, dynamic>))
          .toList() ??
      const [],
  atelierId: (json['atelier_id'] as num?)?.toInt(),
  phone: json['phone'] as String?,
  address: json['address'] as String?,
  notes: json['notes'] as String?,
  createdAt: const NullableLocalDateTimeConverter().fromJson(
    json['created_at'],
  ),
  updatedAt: const NullableLocalDateTimeConverter().fromJson(
    json['updated_at'],
  ),
);

Map<String, dynamic> _$ClientToJson(Client instance) => <String, dynamic>{
  'id': instance.id,
  'atelier_id': instance.atelierId,
  'name': instance.name,
  'phone': instance.phone,
  'address': instance.address,
  'notes': instance.notes,
  'created_at': const NullableLocalDateTimeConverter().toJson(
    instance.createdAt,
  ),
  'updated_at': const NullableLocalDateTimeConverter().toJson(
    instance.updatedAt,
  ),
  'orders_count': instance.ordersCount,
  'total_spent_cfa': instance.totalSpentCfa,
  'remaining_cfa': instance.remainingCfa,
  'beneficiaries': instance.beneficiaries,
  'orders': instance.orders,
};

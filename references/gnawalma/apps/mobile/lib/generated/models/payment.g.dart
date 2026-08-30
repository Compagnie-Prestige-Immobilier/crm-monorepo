// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'payment.dart';

// **************************************************************************
// JsonSerializableGenerator
// **************************************************************************

Payment _$PaymentFromJson(Map<String, dynamic> json) => Payment(
  id: (json['id'] as num).toInt(),
  orderId: (json['order_id'] as num).toInt(),
  amountCfa: (json['amount_cfa'] as num).toInt(),
  createdAt: const LocalDateTimeConverter().fromJson(json['created_at']),
);

Map<String, dynamic> _$PaymentToJson(Payment instance) => <String, dynamic>{
  'id': instance.id,
  'order_id': instance.orderId,
  'amount_cfa': instance.amountCfa,
  'created_at': const LocalDateTimeConverter().toJson(instance.createdAt),
};

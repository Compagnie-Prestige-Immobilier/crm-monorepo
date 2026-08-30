// coverage:ignore-file
// GENERATED CODE - DO NOT MODIFY BY HAND
// ignore_for_file: type=lint, unused_import, invalid_annotation_target, unnecessary_import

import 'package:json_annotation/json_annotation.dart';

import 'package:gnawalma/json_converters.dart';
part 'payment.g.dart';

@JsonSerializable()
class Payment {
  const Payment({
    required this.id,
    required this.orderId,
    required this.amountCfa,
    required this.createdAt,
  });
  
  factory Payment.fromJson(Map<String, Object?> json) => _$PaymentFromJson(json);
  
  final int id;
  @JsonKey(name: 'order_id')
  final int orderId;
  @JsonKey(name: 'amount_cfa')
  final int amountCfa;
	@LocalDateTimeConverter()
  @JsonKey(name: 'created_at')
  final DateTime createdAt;

  Map<String, Object?> toJson() => _$PaymentToJson(this);
}

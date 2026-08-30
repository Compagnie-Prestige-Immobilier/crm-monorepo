// coverage:ignore-file
// GENERATED CODE - DO NOT MODIFY BY HAND
// ignore_for_file: type=lint, unused_import, invalid_annotation_target, unnecessary_import

import 'package:json_annotation/json_annotation.dart';

import 'beneficiary.dart';
import 'order.dart';

import 'package:gnawalma/json_converters.dart';
part 'client.g.dart';

@JsonSerializable()
class Client {
  const Client({
    required this.id,
    required this.name,
    this.ordersCount = 0,
    this.totalSpentCfa = 0,
    this.remainingCfa = 0,
    this.beneficiaries = const [],
    this.orders = const [],
    this.atelierId,
    this.phone,
    this.address,
    this.notes,
    this.createdAt,
    this.updatedAt,
  });
  
  factory Client.fromJson(Map<String, Object?> json) => _$ClientFromJson(json);
  
  final int id;
  @JsonKey(name: 'atelier_id')
  final int? atelierId;
  final String name;
  final String? phone;
  final String? address;
  final String? notes;
	@NullableLocalDateTimeConverter()
  @JsonKey(name: 'created_at')
  final DateTime? createdAt;
	@NullableLocalDateTimeConverter()
  @JsonKey(name: 'updated_at')
  final DateTime? updatedAt;
  @JsonKey(name: 'orders_count')
  final int ordersCount;
  @JsonKey(name: 'total_spent_cfa')
  final int totalSpentCfa;
  @JsonKey(name: 'remaining_cfa')
  final int remainingCfa;
  final List<Beneficiary> beneficiaries;
  final List<Order> orders;

  Map<String, Object?> toJson() => _$ClientToJson(this);
}

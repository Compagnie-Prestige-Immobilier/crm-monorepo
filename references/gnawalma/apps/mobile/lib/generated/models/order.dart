// coverage:ignore-file
// GENERATED CODE - DO NOT MODIFY BY HAND
// ignore_for_file: type=lint, unused_import, invalid_annotation_target, unnecessary_import

import 'package:json_annotation/json_annotation.dart';

import 'beneficiary.dart';
import 'client.dart';
import 'payment.dart';

import 'package:gnawalma/json_converters.dart';
part 'order.g.dart';

@JsonSerializable()
class Order {
  const Order({
    required this.id,
    required this.atelierId,
    required this.beneficiaryId,
    required this.reference,
    required this.measurements,
    required this.description,
    required this.fabricPhotoPath,
    required this.totalCfa,
    required this.status,
    required this.dueAt,
    required this.createdAt,
    required this.updatedAt,
    required this.paidCfa,
    required this.remainingCfa,
    required this.fabricPhotoUrl,
    this.payments = const [],
    this.clientId,
    this.client,
    this.beneficiary,
  });
  
  factory Order.fromJson(Map<String, Object?> json) => _$OrderFromJson(json);
  
  final int id;
  @JsonKey(name: 'atelier_id')
  final int atelierId;
  @JsonKey(name: 'client_id')
  final int? clientId;
  @JsonKey(name: 'beneficiary_id')
  final int? beneficiaryId;
  final String reference;
  final String measurements;
  final String? description;
  @JsonKey(name: 'fabric_photo_path')
  final String? fabricPhotoPath;
  @JsonKey(name: 'total_cfa')
  final int totalCfa;
  final String status;
	@LocalDateTimeConverter()
  @JsonKey(name: 'due_at')
  final DateTime dueAt;
	@NullableLocalDateTimeConverter()
  @JsonKey(name: 'created_at')
  final DateTime? createdAt;
	@NullableLocalDateTimeConverter()
  @JsonKey(name: 'updated_at')
  final DateTime? updatedAt;
  @JsonKey(name: 'paid_cfa')
  final int paidCfa;
  @JsonKey(name: 'remaining_cfa')
  final int remainingCfa;
  @JsonKey(name: 'fabric_photo_url')
  final String? fabricPhotoUrl;
  final Client? client;
  final Beneficiary? beneficiary;
  final List<Payment> payments;

  Map<String, Object?> toJson() => _$OrderToJson(this);
}

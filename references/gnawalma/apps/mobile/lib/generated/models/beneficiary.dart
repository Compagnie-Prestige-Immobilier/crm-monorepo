// coverage:ignore-file
// GENERATED CODE - DO NOT MODIFY BY HAND
// ignore_for_file: type=lint, unused_import, invalid_annotation_target, unnecessary_import

import 'package:json_annotation/json_annotation.dart';

import 'package:gnawalma/json_converters.dart';
part 'beneficiary.g.dart';

@JsonSerializable()
class Beneficiary {
  const Beneficiary({
    required this.id,
    required this.clientId,
    required this.label,
    required this.gender,
    required this.measurements,
    required this.createdAt,
    required this.updatedAt,
  });
  
  factory Beneficiary.fromJson(Map<String, Object?> json) => _$BeneficiaryFromJson(json);
  
  final int id;
  @JsonKey(name: 'client_id')
  final int clientId;
  final String label;
  final String gender;
  final String? measurements;
	@NullableLocalDateTimeConverter()
  @JsonKey(name: 'created_at')
  final DateTime? createdAt;
	@NullableLocalDateTimeConverter()
  @JsonKey(name: 'updated_at')
  final DateTime? updatedAt;

  Map<String, Object?> toJson() => _$BeneficiaryToJson(this);
}

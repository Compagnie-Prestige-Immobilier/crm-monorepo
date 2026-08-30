// coverage:ignore-file
// GENERATED CODE - DO NOT MODIFY BY HAND
// ignore_for_file: type=lint, unused_import, invalid_annotation_target, unnecessary_import

import 'package:json_annotation/json_annotation.dart';

import 'package:gnawalma/json_converters.dart';
part 'report.g.dart';

@JsonSerializable()
class Report {
  const Report({
    required this.id,
    required this.userId,
    required this.reportableType,
    required this.reportableId,
    required this.reason,
    required this.createdAt,
    required this.updatedAt,
  });
  
  factory Report.fromJson(Map<String, Object?> json) => _$ReportFromJson(json);
  
  final int id;
  @JsonKey(name: 'user_id')
  final int userId;
  @JsonKey(name: 'reportable_type')
  final String reportableType;
  @JsonKey(name: 'reportable_id')
  final int reportableId;
  final String reason;
	@NullableLocalDateTimeConverter()
  @JsonKey(name: 'created_at')
  final DateTime? createdAt;
	@NullableLocalDateTimeConverter()
  @JsonKey(name: 'updated_at')
  final DateTime? updatedAt;

  Map<String, Object?> toJson() => _$ReportToJson(this);
}

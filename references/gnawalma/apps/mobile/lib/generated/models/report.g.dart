// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'report.dart';

// **************************************************************************
// JsonSerializableGenerator
// **************************************************************************

Report _$ReportFromJson(Map<String, dynamic> json) => Report(
  id: (json['id'] as num).toInt(),
  userId: (json['user_id'] as num).toInt(),
  reportableType: json['reportable_type'] as String,
  reportableId: (json['reportable_id'] as num).toInt(),
  reason: json['reason'] as String,
  createdAt: const NullableLocalDateTimeConverter().fromJson(
    json['created_at'],
  ),
  updatedAt: const NullableLocalDateTimeConverter().fromJson(
    json['updated_at'],
  ),
);

Map<String, dynamic> _$ReportToJson(Report instance) => <String, dynamic>{
  'id': instance.id,
  'user_id': instance.userId,
  'reportable_type': instance.reportableType,
  'reportable_id': instance.reportableId,
  'reason': instance.reason,
  'created_at': const NullableLocalDateTimeConverter().toJson(
    instance.createdAt,
  ),
  'updated_at': const NullableLocalDateTimeConverter().toJson(
    instance.updatedAt,
  ),
};

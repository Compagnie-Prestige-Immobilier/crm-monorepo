import 'package:json_annotation/json_annotation.dart';

class LocalDateTimeConverter implements JsonConverter<DateTime, Object?> {
  const LocalDateTimeConverter();
  @override
  DateTime fromJson(Object? json) => DateTime.parse(json.toString()).toLocal();
  @override
  Object? toJson(DateTime v) => v.toUtc().toIso8601String();
}

class NullableLocalDateTimeConverter implements JsonConverter<DateTime?, Object?> {
  const NullableLocalDateTimeConverter();
  @override
  DateTime? fromJson(Object? json) => json == null ? null : DateTime.tryParse(json.toString())?.toLocal();
  @override
  Object? toJson(DateTime? v) => v?.toUtc().toIso8601String();
}

// coverage:ignore-file
// GENERATED CODE - DO NOT MODIFY BY HAND
// ignore_for_file: type=lint, unused_import, invalid_annotation_target, unnecessary_import

import 'package:json_annotation/json_annotation.dart';

/// Name not received and was auto-generated.
@JsonEnum()
enum Enum0 {
  @JsonValue('tissu')
  tissu('tissu'),
  @JsonValue('logo')
  logo('logo'),
  @JsonValue('couverture')
  couverture('couverture'),
  @JsonValue('portfolio')
  portfolio('portfolio'),
  /// Default value for all unparsed values, allows backward compatibility when adding new values on the backend.
  $unknown(null);

  const Enum0(this.json);

  factory Enum0.fromJson(String json) => values.firstWhere(
        (e) => e.json == json,
        orElse: () => $unknown,
      );

  final String? json;

  @override
  String toString() => json?.toString() ?? super.toString();
  /// Returns all defined enum values excluding the $unknown value.
  static List<Enum0> get $valuesDefined => values.where((value) => value != $unknown).toList();
}

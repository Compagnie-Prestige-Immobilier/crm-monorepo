// coverage:ignore-file
// GENERATED CODE - DO NOT MODIFY BY HAND
// ignore_for_file: type=lint, unused_import, invalid_annotation_target, unnecessary_import

import 'package:json_annotation/json_annotation.dart';

@JsonEnum()
enum Status {
  @JsonValue('en_cours')
  enCours('en_cours'),
  @JsonValue('pret')
  pret('pret'),
  @JsonValue('livre')
  livre('livre'),
  @JsonValue('annule')
  annule('annule'),
  /// Default value for all unparsed values, allows backward compatibility when adding new values on the backend.
  $unknown(null);

  const Status(this.json);

  factory Status.fromJson(String json) => values.firstWhere(
        (e) => e.json == json,
        orElse: () => $unknown,
      );

  final String? json;

  @override
  String toString() => json?.toString() ?? super.toString();
  /// Returns all defined enum values excluding the $unknown value.
  static List<Status> get $valuesDefined => values.where((value) => value != $unknown).toList();
}

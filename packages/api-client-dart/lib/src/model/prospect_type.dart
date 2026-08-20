//
// AUTO-GENERATED FILE, DO NOT MODIFY!
//

// ignore_for_file: unused_element
import 'package:json_annotation/json_annotation.dart';

/// Hors CHUES : ce qu’est le prospect. Nul si la question n’a pas été posée.
enum ProspectType {
  /// Hors CHUES : ce qu’est le prospect. Nul si la question n’a pas été posée.
  @JsonValue(r'FONCTIONNAIRE')
  FONCTIONNAIRE(r'FONCTIONNAIRE'),

  /// Hors CHUES : ce qu’est le prospect. Nul si la question n’a pas été posée.
  @JsonValue(r'SECTEUR_PRIVE')
  SECTEUR_PRIVE(r'SECTEUR_PRIVE'),

  /// Hors CHUES : ce qu’est le prospect. Nul si la question n’a pas été posée.
  @JsonValue(r'INFORMEL')
  INFORMEL(r'INFORMEL'),

  /// Hors CHUES : ce qu’est le prospect. Nul si la question n’a pas été posée.
  @JsonValue(r'DIASPORA')
  DIASPORA(r'DIASPORA'),

  /// Hors CHUES : ce qu’est le prospect. Nul si la question n’a pas été posée.
  @JsonValue(r'unknown_default_open_api')
  unknownDefaultOpenApi(r'unknown_default_open_api');

  const ProspectType(this.value);

  final String value;

  @override
  String toString() => value;
}

//
// AUTO-GENERATED FILE, DO NOT MODIFY!
//

// ignore_for_file: unused_element
import 'package:copy_with_extension/copy_with_extension.dart';
import 'package:json_annotation/json_annotation.dart';
import 'package:equatable/src/equatable_utils.dart';

part 'visite_referentiel_dto.g.dart';

@CopyWith()
@JsonSerializable(
  checked: true,
  createToJson: true,
  disallowUnrecognizedKeys: false,
  explicitToJson: true,
)
class VisiteReferentielDto {
  /// Returns a new [VisiteReferentielDto] instance.
  VisiteReferentielDto({
    required this.id,

    required this.code,

    required this.label,

    required this.isActive,

    required this.isSystem,

    required this.sortOrder,

    required this.updatedAt,
  });

  @JsonKey(name: r'id', required: true, includeIfNull: false)
  final String id;

  /// Code stable, jamais modifiable après création.
  @JsonKey(name: r'code', required: true, includeIfNull: false)
  final String code;

  @JsonKey(name: r'label', required: true, includeIfNull: false)
  final String label;

  @JsonKey(name: r'isActive', required: true, includeIfNull: false)
  final bool isActive;

  /// Entrée reprise du classeur d’origine : renommable, désactivable, jamais effacée.
  @JsonKey(name: r'isSystem', required: true, includeIfNull: false)
  final bool isSystem;

  @JsonKey(name: r'sortOrder', required: true, includeIfNull: false)
  final num sortOrder;

  @JsonKey(name: r'updatedAt', required: true, includeIfNull: false)
  final DateTime updatedAt;

  bool operator ==(Object other) {
    return identical(this, other) ||
        other is VisiteReferentielDto &&
            runtimeType == other.runtimeType &&
            equals(
              [id, code, label, isActive, isSystem, sortOrder, updatedAt],
              [
                other.id,
                other.code,
                other.label,
                other.isActive,
                other.isSystem,
                other.sortOrder,
                other.updatedAt,
              ],
            );
  }

  @override
  int get hashCode =>
      runtimeType.hashCode ^
      mapPropsToHashCode([
        id,
        code,
        label,
        isActive,
        isSystem,
        sortOrder,
        updatedAt,
      ]);

  factory VisiteReferentielDto.fromJson(Map<String, dynamic> json) =>
      _$VisiteReferentielDtoFromJson(json);

  Map<String, dynamic> toJson() => _$VisiteReferentielDtoToJson(this);

  @override
  String toString() {
    return toJson().toString();
  }
}

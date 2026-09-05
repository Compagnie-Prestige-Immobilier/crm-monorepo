//
// AUTO-GENERATED FILE, DO NOT MODIFY!
//

// ignore_for_file: unused_element
import 'package:copy_with_extension/copy_with_extension.dart';
import 'package:json_annotation/json_annotation.dart';
import 'package:equatable/src/equatable_utils.dart';

part 'visite_import_change_field_dto.g.dart';

@CopyWith()
@JsonSerializable(
  checked: true,
  createToJson: true,
  disallowUnrecognizedKeys: false,
  explicitToJson: true,
)
class VisiteImportChangeFieldDto {
  /// Returns a new [VisiteImportChangeFieldDto] instance.
  VisiteImportChangeFieldDto({
    required this.field,

    required this.label,

    required this.before,

    required this.after,
  });

  /// Clé machine de la colonne, ex. `entreprise`.
  @JsonKey(name: r'field', required: true, includeIfNull: false)
  final String field;

  /// En-tête de la colonne, tel qu’affiché.
  @JsonKey(name: r'label', required: true, includeIfNull: false)
  final String label;

  @JsonKey(name: r'before', required: true, includeIfNull: false)
  final String before;

  @JsonKey(name: r'after', required: true, includeIfNull: false)
  final String after;

  bool operator ==(Object other) {
    return identical(this, other) ||
        other is VisiteImportChangeFieldDto &&
            runtimeType == other.runtimeType &&
            equals(
              [field, label, before, after],
              [other.field, other.label, other.before, other.after],
            );
  }

  @override
  int get hashCode =>
      runtimeType.hashCode ^ mapPropsToHashCode([field, label, before, after]);

  factory VisiteImportChangeFieldDto.fromJson(Map<String, dynamic> json) =>
      _$VisiteImportChangeFieldDtoFromJson(json);

  Map<String, dynamic> toJson() => _$VisiteImportChangeFieldDtoToJson(this);

  @override
  String toString() {
    return toJson().toString();
  }
}

//
// AUTO-GENERATED FILE, DO NOT MODIFY!
//

// ignore_for_file: unused_element
import 'package:copy_with_extension/copy_with_extension.dart';
import 'package:json_annotation/json_annotation.dart';
import 'package:equatable/src/equatable_utils.dart';

part 'create_visite_referentiel_dto.g.dart';

@CopyWith()
@JsonSerializable(
  checked: true,
  createToJson: true,
  disallowUnrecognizedKeys: false,
  explicitToJson: true,
)
class CreateVisiteReferentielDto {
  /// Returns a new [CreateVisiteReferentielDto] instance.
  CreateVisiteReferentielDto({
    required this.code,

    required this.label,

    this.sortOrder = 100,
  });

  /// Majuscules, chiffres et tirets bas. Immuable une fois créé.
  @JsonKey(name: r'code', required: true, includeIfNull: false)
  final String code;

  @JsonKey(name: r'label', required: true, includeIfNull: false)
  final String label;

  @JsonKey(
    defaultValue: 100,
    name: r'sortOrder',
    required: false,
    includeIfNull: false,
  )
  final num? sortOrder;

  bool operator ==(Object other) {
    return identical(this, other) ||
        other is CreateVisiteReferentielDto &&
            runtimeType == other.runtimeType &&
            equals(
              [code, label, sortOrder],
              [other.code, other.label, other.sortOrder],
            );
  }

  @override
  int get hashCode =>
      runtimeType.hashCode ^ mapPropsToHashCode([code, label, sortOrder]);

  factory CreateVisiteReferentielDto.fromJson(Map<String, dynamic> json) =>
      _$CreateVisiteReferentielDtoFromJson(json);

  Map<String, dynamic> toJson() => _$CreateVisiteReferentielDtoToJson(this);

  @override
  String toString() {
    return toJson().toString();
  }
}

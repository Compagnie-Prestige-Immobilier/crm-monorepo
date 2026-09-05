//
// AUTO-GENERATED FILE, DO NOT MODIFY!
//

// ignore_for_file: unused_element
import 'package:copy_with_extension/copy_with_extension.dart';
import 'package:json_annotation/json_annotation.dart';
import 'package:equatable/src/equatable_utils.dart';

part 'reorder_visite_referentiel_dto.g.dart';

@CopyWith()
@JsonSerializable(
  checked: true,
  createToJson: true,
  disallowUnrecognizedKeys: false,
  explicitToJson: true,
)
class ReorderVisiteReferentielDto {
  /// Returns a new [ReorderVisiteReferentielDto] instance.
  ReorderVisiteReferentielDto({required this.ids});

  /// Les entrées dans leur nouvel ordre. Celles omises gardent leur rang.
  @JsonKey(name: r'ids', required: true, includeIfNull: false)
  final List<String> ids;

  bool operator ==(Object other) {
    return identical(this, other) ||
        other is ReorderVisiteReferentielDto &&
            runtimeType == other.runtimeType &&
            equals([ids], [other.ids]);
  }

  @override
  int get hashCode => runtimeType.hashCode ^ mapPropsToHashCode([ids]);

  factory ReorderVisiteReferentielDto.fromJson(Map<String, dynamic> json) =>
      _$ReorderVisiteReferentielDtoFromJson(json);

  Map<String, dynamic> toJson() => _$ReorderVisiteReferentielDtoToJson(this);

  @override
  String toString() {
    return toJson().toString();
  }
}

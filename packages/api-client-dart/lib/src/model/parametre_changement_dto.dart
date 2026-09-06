//
// AUTO-GENERATED FILE, DO NOT MODIFY!
//

// ignore_for_file: unused_element
import 'package:copy_with_extension/copy_with_extension.dart';
import 'package:json_annotation/json_annotation.dart';
import 'package:equatable/src/equatable_utils.dart';

part 'parametre_changement_dto.g.dart';

@CopyWith()
@JsonSerializable(
  checked: true,
  createToJson: true,
  disallowUnrecognizedKeys: false,
  explicitToJson: true,
)
class ParametreChangementDto {
  /// Returns a new [ParametreChangementDto] instance.
  ParametreChangementDto({
    required this.id,

    required this.cle,

    required this.ancienne,

    required this.nouvelle,

    required this.parNom,

    required this.le,
  });

  @JsonKey(name: r'id', required: true, includeIfNull: false)
  final String id;

  @JsonKey(name: r'cle', required: true, includeIfNull: false)
  final String cle;

  @JsonKey(name: r'ancienne', required: true, includeIfNull: true)
  final String? ancienne;

  @JsonKey(name: r'nouvelle', required: true, includeIfNull: false)
  final String nouvelle;

  @JsonKey(name: r'parNom', required: true, includeIfNull: false)
  final String parNom;

  @JsonKey(name: r'le', required: true, includeIfNull: false)
  final String le;

  bool operator ==(Object other) {
    return identical(this, other) ||
        other is ParametreChangementDto &&
            runtimeType == other.runtimeType &&
            equals(
              [id, cle, ancienne, nouvelle, parNom, le],
              [
                other.id,
                other.cle,
                other.ancienne,
                other.nouvelle,
                other.parNom,
                other.le,
              ],
            );
  }

  @override
  int get hashCode =>
      runtimeType.hashCode ^
      mapPropsToHashCode([id, cle, ancienne, nouvelle, parNom, le]);

  factory ParametreChangementDto.fromJson(Map<String, dynamic> json) =>
      _$ParametreChangementDtoFromJson(json);

  Map<String, dynamic> toJson() => _$ParametreChangementDtoToJson(this);

  @override
  String toString() {
    return toJson().toString();
  }
}

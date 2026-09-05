//
// AUTO-GENERATED FILE, DO NOT MODIFY!
//

// ignore_for_file: unused_element
import 'package:copy_with_extension/copy_with_extension.dart';
import 'package:json_annotation/json_annotation.dart';
import 'package:equatable/src/equatable_utils.dart';

part 'enregistrer_brouillon_dto.g.dart';

@CopyWith()
@JsonSerializable(
  checked: true,
  createToJson: true,
  disallowUnrecognizedKeys: false,
  explicitToJson: true,
)
class EnregistrerBrouillonDto {
  /// Returns a new [EnregistrerBrouillonDto] instance.
  EnregistrerBrouillonDto({required this.draft, this.firstInputAt});

  /// Remplace le brouillon précédent en entier.
  @JsonKey(name: r'draft', required: true, includeIfNull: false)
  final Map<String, Object> draft;

  /// Heure du terrain de la première saisie. Le serveur ne la retient qu’une fois, à la première requête ; les suivantes ne la déplacent pas. Absente, l’heure du serveur en tient lieu.
  @JsonKey(name: r'firstInputAt', required: false, includeIfNull: false)
  final DateTime? firstInputAt;

  bool operator ==(Object other) {
    return identical(this, other) ||
        other is EnregistrerBrouillonDto &&
            runtimeType == other.runtimeType &&
            equals([draft, firstInputAt], [other.draft, other.firstInputAt]);
  }

  @override
  int get hashCode =>
      runtimeType.hashCode ^ mapPropsToHashCode([draft, firstInputAt]);

  factory EnregistrerBrouillonDto.fromJson(Map<String, dynamic> json) =>
      _$EnregistrerBrouillonDtoFromJson(json);

  Map<String, dynamic> toJson() => _$EnregistrerBrouillonDtoToJson(this);

  @override
  String toString() {
    return toJson().toString();
  }
}

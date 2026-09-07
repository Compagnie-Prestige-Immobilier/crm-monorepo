//
// AUTO-GENERATED FILE, DO NOT MODIFY!
//

// ignore_for_file: unused_element
import 'package:copy_with_extension/copy_with_extension.dart';
import 'package:json_annotation/json_annotation.dart';
import 'package:equatable/src/equatable_utils.dart';

part 'reglage_champ_dto.g.dart';

@CopyWith()
@JsonSerializable(
  checked: true,
  createToJson: true,
  disallowUnrecognizedKeys: false,
  explicitToJson: true,
)
class ReglageChampDto {
  /// Returns a new [ReglageChampDto] instance.
  ReglageChampDto({
    required this.champ,

    required this.libelle,

    required this.visible,

    required this.obligatoire,

    required this.impose,
  });

  /// Clé du champ dans le catalogue de la conversion.
  @JsonKey(name: r'champ', required: true, includeIfNull: false)
  final String champ;

  @JsonKey(name: r'libelle', required: true, includeIfNull: false)
  final String libelle;

  @JsonKey(name: r'visible', required: true, includeIfNull: false)
  final bool visible;

  @JsonKey(name: r'obligatoire', required: true, includeIfNull: false)
  final bool obligatoire;

  /// Champ exigé par les indicateurs et le closing : il ne peut pas être masqué.
  @JsonKey(name: r'impose', required: true, includeIfNull: false)
  final bool impose;

  bool operator ==(Object other) {
    return identical(this, other) ||
        other is ReglageChampDto &&
            runtimeType == other.runtimeType &&
            equals(
              [champ, libelle, visible, obligatoire, impose],
              [
                other.champ,
                other.libelle,
                other.visible,
                other.obligatoire,
                other.impose,
              ],
            );
  }

  @override
  int get hashCode =>
      runtimeType.hashCode ^
      mapPropsToHashCode([champ, libelle, visible, obligatoire, impose]);

  factory ReglageChampDto.fromJson(Map<String, dynamic> json) =>
      _$ReglageChampDtoFromJson(json);

  Map<String, dynamic> toJson() => _$ReglageChampDtoToJson(this);

  @override
  String toString() {
    return toJson().toString();
  }
}

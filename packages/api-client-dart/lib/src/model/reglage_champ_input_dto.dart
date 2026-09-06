//
// AUTO-GENERATED FILE, DO NOT MODIFY!
//

// ignore_for_file: unused_element
import 'package:copy_with_extension/copy_with_extension.dart';
import 'package:json_annotation/json_annotation.dart';
import 'package:equatable/src/equatable_utils.dart';

part 'reglage_champ_input_dto.g.dart';

@CopyWith()
@JsonSerializable(
  checked: true,
  createToJson: true,
  disallowUnrecognizedKeys: false,
  explicitToJson: true,
)
class ReglageChampInputDto {
  /// Returns a new [ReglageChampInputDto] instance.
  ReglageChampInputDto({
    required this.champ,

    required this.visible,

    required this.obligatoire,
  });

  @JsonKey(name: r'champ', required: true, includeIfNull: false)
  final String champ;

  @JsonKey(name: r'visible', required: true, includeIfNull: false)
  final bool visible;

  @JsonKey(name: r'obligatoire', required: true, includeIfNull: false)
  final bool obligatoire;

  bool operator ==(Object other) {
    return identical(this, other) ||
        other is ReglageChampInputDto &&
            runtimeType == other.runtimeType &&
            equals(
              [champ, visible, obligatoire],
              [other.champ, other.visible, other.obligatoire],
            );
  }

  @override
  int get hashCode =>
      runtimeType.hashCode ^ mapPropsToHashCode([champ, visible, obligatoire]);

  factory ReglageChampInputDto.fromJson(Map<String, dynamic> json) =>
      _$ReglageChampInputDtoFromJson(json);

  Map<String, dynamic> toJson() => _$ReglageChampInputDtoToJson(this);

  @override
  String toString() {
    return toJson().toString();
  }
}

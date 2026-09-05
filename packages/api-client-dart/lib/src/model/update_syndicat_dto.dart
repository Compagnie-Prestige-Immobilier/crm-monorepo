//
// AUTO-GENERATED FILE, DO NOT MODIFY!
//

// ignore_for_file: unused_element
import 'package:copy_with_extension/copy_with_extension.dart';
import 'package:json_annotation/json_annotation.dart';
import 'package:equatable/src/equatable_utils.dart';

part 'update_syndicat_dto.g.dart';

@CopyWith()
@JsonSerializable(
  checked: true,
  createToJson: true,
  disallowUnrecognizedKeys: false,
  explicitToJson: true,
)
class UpdateSyndicatDto {
  /// Returns a new [UpdateSyndicatDto] instance.
  UpdateSyndicatDto({
    this.name,

    this.sigle,

    this.secteur,

    this.isActive = true,

    this.sortOrder = 100,
  });

  @JsonKey(name: r'name', required: false, includeIfNull: false)
  final String? name;

  @JsonKey(name: r'sigle', required: false, includeIfNull: false)
  final String? sigle;

  @JsonKey(name: r'secteur', required: false, includeIfNull: false)
  final String? secteur;

  @JsonKey(
    defaultValue: true,
    name: r'isActive',
    required: false,
    includeIfNull: false,
  )
  final bool? isActive;

  @JsonKey(
    defaultValue: 100,
    name: r'sortOrder',
    required: false,
    includeIfNull: false,
  )
  final num? sortOrder;

  bool operator ==(Object other) {
    return identical(this, other) ||
        other is UpdateSyndicatDto &&
            runtimeType == other.runtimeType &&
            equals(
              [name, sigle, secteur, isActive, sortOrder],
              [
                other.name,
                other.sigle,
                other.secteur,
                other.isActive,
                other.sortOrder,
              ],
            );
  }

  @override
  int get hashCode =>
      runtimeType.hashCode ^
      mapPropsToHashCode([name, sigle, secteur, isActive, sortOrder]);

  factory UpdateSyndicatDto.fromJson(Map<String, dynamic> json) =>
      _$UpdateSyndicatDtoFromJson(json);

  Map<String, dynamic> toJson() => _$UpdateSyndicatDtoToJson(this);

  @override
  String toString() {
    return toJson().toString();
  }
}

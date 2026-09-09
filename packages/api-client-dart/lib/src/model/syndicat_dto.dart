//
// AUTO-GENERATED FILE, DO NOT MODIFY!
//

// ignore_for_file: unused_element
import 'package:copy_with_extension/copy_with_extension.dart';
import 'package:json_annotation/json_annotation.dart';
import 'package:equatable/src/equatable_utils.dart';

part 'syndicat_dto.g.dart';

@CopyWith()
@JsonSerializable(
  checked: true,
  createToJson: true,
  disallowUnrecognizedKeys: false,
  explicitToJson: true,
)
class SyndicatDto {
  /// Returns a new [SyndicatDto] instance.
  SyndicatDto({
    required this.id,

    required this.name,

    required this.sigle,

    required this.secteur,

    required this.isActive,

    required this.sortOrder,

    required this.updatedAt,
  });

  @JsonKey(name: r'id', required: true, includeIfNull: false)
  final String id;

  @JsonKey(name: r'name', required: true, includeIfNull: false)
  final String name;

  @JsonKey(name: r'sigle', required: true, includeIfNull: false)
  final String sigle;

  @JsonKey(name: r'secteur', required: true, includeIfNull: true)
  final String? secteur;

  @JsonKey(name: r'isActive', required: true, includeIfNull: false)
  final bool isActive;

  @JsonKey(name: r'sortOrder', required: true, includeIfNull: false)
  final num sortOrder;

  @JsonKey(name: r'updatedAt', required: true, includeIfNull: false)
  final DateTime updatedAt;

  bool operator ==(Object other) {
    return identical(this, other) ||
        other is SyndicatDto &&
            runtimeType == other.runtimeType &&
            equals(
              [id, name, sigle, secteur, isActive, sortOrder, updatedAt],
              [
                other.id,
                other.name,
                other.sigle,
                other.secteur,
                other.isActive,
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
        name,
        sigle,
        secteur,
        isActive,
        sortOrder,
        updatedAt,
      ]);

  factory SyndicatDto.fromJson(Map<String, dynamic> json) =>
      _$SyndicatDtoFromJson(json);

  Map<String, dynamic> toJson() => _$SyndicatDtoToJson(this);

  @override
  String toString() {
    return toJson().toString();
  }
}

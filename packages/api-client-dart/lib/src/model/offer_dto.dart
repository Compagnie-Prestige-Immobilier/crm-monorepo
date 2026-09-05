//
// AUTO-GENERATED FILE, DO NOT MODIFY!
//

// ignore_for_file: unused_element
import 'package:copy_with_extension/copy_with_extension.dart';
import 'package:json_annotation/json_annotation.dart';
import 'package:equatable/src/equatable_utils.dart';

part 'offer_dto.g.dart';

@CopyWith()
@JsonSerializable(
  checked: true,
  createToJson: true,
  disallowUnrecognizedKeys: false,
  explicitToJson: true,
)
class OfferDto {
  /// Returns a new [OfferDto] instance.
  OfferDto({
    required this.id,

    required this.code,

    required this.label,

    required this.description,

    required this.position,

    required this.isActive,

    required this.updatedAt,
  });

  @JsonKey(name: r'id', required: true, includeIfNull: false)
  final String id;

  @JsonKey(name: r'code', required: true, includeIfNull: false)
  final String code;

  @JsonKey(name: r'label', required: true, includeIfNull: false)
  final String label;

  @JsonKey(name: r'description', required: true, includeIfNull: true)
  final String? description;

  @JsonKey(name: r'position', required: true, includeIfNull: false)
  final num position;

  @JsonKey(name: r'isActive', required: true, includeIfNull: false)
  final bool isActive;

  @JsonKey(name: r'updatedAt', required: true, includeIfNull: false)
  final DateTime updatedAt;

  bool operator ==(Object other) {
    return identical(this, other) ||
        other is OfferDto &&
            runtimeType == other.runtimeType &&
            equals(
              [id, code, label, description, position, isActive, updatedAt],
              [
                other.id,
                other.code,
                other.label,
                other.description,
                other.position,
                other.isActive,
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
        description,
        position,
        isActive,
        updatedAt,
      ]);

  factory OfferDto.fromJson(Map<String, dynamic> json) =>
      _$OfferDtoFromJson(json);

  Map<String, dynamic> toJson() => _$OfferDtoToJson(this);

  @override
  String toString() {
    return toJson().toString();
  }
}

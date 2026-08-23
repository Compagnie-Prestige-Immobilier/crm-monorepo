//
// AUTO-GENERATED FILE, DO NOT MODIFY!
//

// ignore_for_file: unused_element
import 'package:copy_with_extension/copy_with_extension.dart';
import 'package:json_annotation/json_annotation.dart';
import 'package:equatable/src/equatable_utils.dart';

part 'set_active_dto.g.dart';

@CopyWith()
@JsonSerializable(
  checked: true,
  createToJson: true,
  disallowUnrecognizedKeys: false,
  explicitToJson: true,
)
class SetActiveDto {
  /// Returns a new [SetActiveDto] instance.
  SetActiveDto({required this.isActive, this.handoverToId});

  @JsonKey(name: r'isActive', required: true, includeIfNull: false)
  final bool isActive;

  /// Compte qui reprend le portefeuille. Exigé si le compte désactivé en a un.
  @JsonKey(name: r'handoverToId', required: false, includeIfNull: false)
  final String? handoverToId;

  bool operator ==(Object other) {
    return identical(this, other) ||
        other is SetActiveDto &&
            runtimeType == other.runtimeType &&
            equals(
              [isActive, handoverToId],
              [other.isActive, other.handoverToId],
            );
  }

  @override
  int get hashCode =>
      runtimeType.hashCode ^ mapPropsToHashCode([isActive, handoverToId]);

  factory SetActiveDto.fromJson(Map<String, dynamic> json) =>
      _$SetActiveDtoFromJson(json);

  Map<String, dynamic> toJson() => _$SetActiveDtoToJson(this);

  @override
  String toString() {
    return toJson().toString();
  }
}

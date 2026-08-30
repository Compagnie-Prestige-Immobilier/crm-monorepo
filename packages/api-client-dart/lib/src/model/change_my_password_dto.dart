//
// AUTO-GENERATED FILE, DO NOT MODIFY!
//

// ignore_for_file: unused_element
import 'package:copy_with_extension/copy_with_extension.dart';
import 'package:json_annotation/json_annotation.dart';
import 'package:equatable/src/equatable_utils.dart';

part 'change_my_password_dto.g.dart';

@CopyWith()
@JsonSerializable(
  checked: true,
  createToJson: true,
  disallowUnrecognizedKeys: false,
  explicitToJson: true,
)
class ChangeMyPasswordDto {
  /// Returns a new [ChangeMyPasswordDto] instance.
  ChangeMyPasswordDto({
    required this.currentPassword,

    required this.newPassword,
  });

  @JsonKey(name: r'currentPassword', required: true, includeIfNull: false)
  final String currentPassword;

  @JsonKey(name: r'newPassword', required: true, includeIfNull: false)
  final String newPassword;

  bool operator ==(Object other) {
    return identical(this, other) ||
        other is ChangeMyPasswordDto &&
            runtimeType == other.runtimeType &&
            equals(
              [currentPassword, newPassword],
              [other.currentPassword, other.newPassword],
            );
  }

  @override
  int get hashCode =>
      runtimeType.hashCode ^ mapPropsToHashCode([currentPassword, newPassword]);

  factory ChangeMyPasswordDto.fromJson(Map<String, dynamic> json) =>
      _$ChangeMyPasswordDtoFromJson(json);

  Map<String, dynamic> toJson() => _$ChangeMyPasswordDtoToJson(this);

  @override
  String toString() {
    return toJson().toString();
  }
}

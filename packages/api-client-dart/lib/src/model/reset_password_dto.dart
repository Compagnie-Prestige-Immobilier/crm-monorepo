//
// AUTO-GENERATED FILE, DO NOT MODIFY!
//

// ignore_for_file: unused_element
import 'package:copy_with_extension/copy_with_extension.dart';
import 'package:json_annotation/json_annotation.dart';
import 'package:equatable/src/equatable_utils.dart';

part 'reset_password_dto.g.dart';

@CopyWith()
@JsonSerializable(
  checked: true,
  createToJson: true,
  disallowUnrecognizedKeys: false,
  explicitToJson: true,
)
class ResetPasswordDto {
  /// Returns a new [ResetPasswordDto] instance.
  ResetPasswordDto({required this.password});

  @JsonKey(name: r'password', required: true, includeIfNull: false)
  final String password;

  bool operator ==(Object other) {
    return identical(this, other) ||
        other is ResetPasswordDto &&
            runtimeType == other.runtimeType &&
            equals([password], [other.password]);
  }

  @override
  int get hashCode => runtimeType.hashCode ^ mapPropsToHashCode([password]);

  factory ResetPasswordDto.fromJson(Map<String, dynamic> json) =>
      _$ResetPasswordDtoFromJson(json);

  Map<String, dynamic> toJson() => _$ResetPasswordDtoToJson(this);

  @override
  String toString() {
    return toJson().toString();
  }
}

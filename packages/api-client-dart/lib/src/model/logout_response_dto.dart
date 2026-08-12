//
// AUTO-GENERATED FILE, DO NOT MODIFY!
//

// ignore_for_file: unused_element
import 'package:copy_with_extension/copy_with_extension.dart';
import 'package:json_annotation/json_annotation.dart';
import 'package:equatable/src/equatable_utils.dart';

part 'logout_response_dto.g.dart';

@CopyWith()
@JsonSerializable(
  checked: true,
  createToJson: true,
  disallowUnrecognizedKeys: false,
  explicitToJson: true,
)
class LogoutResponseDto {
  /// Returns a new [LogoutResponseDto] instance.
  LogoutResponseDto({required this.revoked});

  @JsonKey(name: r'revoked', required: true, includeIfNull: false)
  final bool revoked;

  bool operator ==(Object other) {
    return identical(this, other) ||
        other is LogoutResponseDto &&
            runtimeType == other.runtimeType &&
            equals([revoked], [other.revoked]);
  }

  @override
  int get hashCode => runtimeType.hashCode ^ mapPropsToHashCode([revoked]);

  factory LogoutResponseDto.fromJson(Map<String, dynamic> json) =>
      _$LogoutResponseDtoFromJson(json);

  Map<String, dynamic> toJson() => _$LogoutResponseDtoToJson(this);

  @override
  String toString() {
    return toJson().toString();
  }
}

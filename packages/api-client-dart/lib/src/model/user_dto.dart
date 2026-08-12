//
// AUTO-GENERATED FILE, DO NOT MODIFY!
//

// ignore_for_file: unused_element
import 'package:crm_api_client/src/model/role.dart';
import 'package:copy_with_extension/copy_with_extension.dart';
import 'package:json_annotation/json_annotation.dart';
import 'package:equatable/src/equatable_utils.dart';

part 'user_dto.g.dart';

@CopyWith()
@JsonSerializable(
  checked: true,
  createToJson: true,
  disallowUnrecognizedKeys: false,
  explicitToJson: true,
)
class UserDto {
  /// Returns a new [UserDto] instance.
  UserDto({
    required this.id,

    required this.email,

    required this.username,

    required this.fullName,

    required this.role,

    required this.isActive,

    required this.departementId,

    required this.departementName,

    required this.phoneE164,

    required this.lastLoginAt,

    required this.createdAt,

    required this.prospectCount,
  });

  @JsonKey(name: r'id', required: true, includeIfNull: false)
  final String id;

  @JsonKey(name: r'email', required: true, includeIfNull: false)
  final String email;

  @JsonKey(name: r'username', required: true, includeIfNull: false)
  final String username;

  @JsonKey(name: r'fullName', required: true, includeIfNull: false)
  final String fullName;

  @JsonKey(
    name: r'role',
    required: true,
    includeIfNull: false,
    unknownEnumValue: Role.unknownDefaultOpenApi,
  )
  final Role role;

  @JsonKey(name: r'isActive', required: true, includeIfNull: false)
  final bool isActive;

  @JsonKey(name: r'departementId', required: true, includeIfNull: true)
  final String? departementId;

  @JsonKey(name: r'departementName', required: true, includeIfNull: true)
  final String? departementName;

  @JsonKey(name: r'phoneE164', required: true, includeIfNull: true)
  final String? phoneE164;

  @JsonKey(name: r'lastLoginAt', required: true, includeIfNull: true)
  final DateTime? lastLoginAt;

  @JsonKey(name: r'createdAt', required: true, includeIfNull: false)
  final DateTime createdAt;

  /// Nombre de prospects saisis par ce commercial.
  @JsonKey(name: r'prospectCount', required: true, includeIfNull: false)
  final num prospectCount;

  bool operator ==(Object other) {
    return identical(this, other) ||
        other is UserDto &&
            runtimeType == other.runtimeType &&
            equals(
              [
                id,
                email,
                username,
                fullName,
                role,
                isActive,
                departementId,
                departementName,
                phoneE164,
                lastLoginAt,
                createdAt,
                prospectCount,
              ],
              [
                other.id,
                other.email,
                other.username,
                other.fullName,
                other.role,
                other.isActive,
                other.departementId,
                other.departementName,
                other.phoneE164,
                other.lastLoginAt,
                other.createdAt,
                other.prospectCount,
              ],
            );
  }

  @override
  int get hashCode =>
      runtimeType.hashCode ^
      mapPropsToHashCode([
        id,
        email,
        username,
        fullName,
        role,
        isActive,
        departementId,
        departementName,
        phoneE164,
        lastLoginAt,
        createdAt,
        prospectCount,
      ]);

  factory UserDto.fromJson(Map<String, dynamic> json) =>
      _$UserDtoFromJson(json);

  Map<String, dynamic> toJson() => _$UserDtoToJson(this);

  @override
  String toString() {
    return toJson().toString();
  }
}

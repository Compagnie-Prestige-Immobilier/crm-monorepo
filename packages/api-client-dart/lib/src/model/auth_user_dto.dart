//
// AUTO-GENERATED FILE, DO NOT MODIFY!
//

// ignore_for_file: unused_element
import 'package:crm_api_client/src/model/role.dart';
import 'package:copy_with_extension/copy_with_extension.dart';
import 'package:json_annotation/json_annotation.dart';
import 'package:equatable/src/equatable_utils.dart';

part 'auth_user_dto.g.dart';

@CopyWith()
@JsonSerializable(
  checked: true,
  createToJson: true,
  disallowUnrecognizedKeys: false,
  explicitToJson: true,
)
class AuthUserDto {
  /// Returns a new [AuthUserDto] instance.
  AuthUserDto({
    required this.id,

    required this.email,

    required this.username,

    required this.fullName,

    required this.role,

    required this.isActive,

    required this.workspace,

    this.departementId,

    this.phoneE164,

    this.lastLoginAt,
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

  @JsonKey(
    name: r'workspace',
    required: true,
    includeIfNull: false,
    unknownEnumValue: AuthUserDtoWorkspaceEnum.unknownDefaultOpenApi,
  )
  final AuthUserDtoWorkspaceEnum workspace;

  @JsonKey(name: r'departementId', required: false, includeIfNull: false)
  final String? departementId;

  @JsonKey(name: r'phoneE164', required: false, includeIfNull: false)
  final String? phoneE164;

  @JsonKey(name: r'lastLoginAt', required: false, includeIfNull: false)
  final DateTime? lastLoginAt;

  bool operator ==(Object other) {
    return identical(this, other) ||
        other is AuthUserDto &&
            runtimeType == other.runtimeType &&
            equals(
              [
                id,
                email,
                username,
                fullName,
                role,
                isActive,
                workspace,
                departementId,
                phoneE164,
                lastLoginAt,
              ],
              [
                other.id,
                other.email,
                other.username,
                other.fullName,
                other.role,
                other.isActive,
                other.workspace,
                other.departementId,
                other.phoneE164,
                other.lastLoginAt,
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
        workspace,
        departementId,
        phoneE164,
        lastLoginAt,
      ]);

  factory AuthUserDto.fromJson(Map<String, dynamic> json) =>
      _$AuthUserDtoFromJson(json);

  Map<String, dynamic> toJson() => _$AuthUserDtoToJson(this);

  @override
  String toString() {
    return toJson().toString();
  }
}

enum AuthUserDtoWorkspaceEnum {
  @JsonValue(r'public')
  public(r'public'),
  @JsonValue(r'demo')
  demo(r'demo'),
  @JsonValue(r'unknown_default_open_api')
  unknownDefaultOpenApi(r'unknown_default_open_api');

  const AuthUserDtoWorkspaceEnum(this.value);

  final String value;

  @override
  String toString() => value;
}

//
// AUTO-GENERATED FILE, DO NOT MODIFY!
//

// ignore_for_file: unused_element
import 'package:crm_api_client/src/model/role.dart';
import 'package:copy_with_extension/copy_with_extension.dart';
import 'package:json_annotation/json_annotation.dart';
import 'package:equatable/src/equatable_utils.dart';

part 'create_user_dto.g.dart';

@CopyWith()
@JsonSerializable(
  checked: true,
  createToJson: true,
  disallowUnrecognizedKeys: false,
  explicitToJson: true,
)
class CreateUserDto {
  /// Returns a new [CreateUserDto] instance.
  CreateUserDto({
    required this.email,

    required this.username,

    required this.fullName,

    required this.password,

    this.role = Role.COMMERCIAL,

    this.phone,
  });

  @JsonKey(name: r'email', required: true, includeIfNull: false)
  final String email;

  /// Identifiant de connexion alternatif : lettres, chiffres, point, tiret bas.
  @JsonKey(name: r'username', required: true, includeIfNull: false)
  final String username;

  @JsonKey(name: r'fullName', required: true, includeIfNull: false)
  final String fullName;

  @JsonKey(name: r'password', required: true, includeIfNull: false)
  final String password;

  @JsonKey(
    defaultValue: Role.COMMERCIAL,
    name: r'role',
    required: false,
    includeIfNull: false,
    unknownEnumValue: Role.unknownDefaultOpenApi,
  )
  final Role? role;

  /// Téléphone, normalisé en E.164 par le serveur.
  @JsonKey(name: r'phone', required: false, includeIfNull: false)
  final String? phone;

  bool operator ==(Object other) {
    return identical(this, other) ||
        other is CreateUserDto &&
            runtimeType == other.runtimeType &&
            equals(
              [email, username, fullName, password, role, phone],
              [
                other.email,
                other.username,
                other.fullName,
                other.password,
                other.role,
                other.phone,
              ],
            );
  }

  @override
  int get hashCode =>
      runtimeType.hashCode ^
      mapPropsToHashCode([email, username, fullName, password, role, phone]);

  factory CreateUserDto.fromJson(Map<String, dynamic> json) =>
      _$CreateUserDtoFromJson(json);

  Map<String, dynamic> toJson() => _$CreateUserDtoToJson(this);

  @override
  String toString() {
    return toJson().toString();
  }
}

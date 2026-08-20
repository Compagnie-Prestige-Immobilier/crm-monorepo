//
// AUTO-GENERATED FILE, DO NOT MODIFY!
//

// ignore_for_file: unused_element
import 'package:crm_api_client/src/model/role.dart';
import 'package:copy_with_extension/copy_with_extension.dart';
import 'package:json_annotation/json_annotation.dart';
import 'package:equatable/src/equatable_utils.dart';

part 'update_user_dto.g.dart';

@CopyWith()
@JsonSerializable(
  checked: true,
  createToJson: true,
  disallowUnrecognizedKeys: false,
  explicitToJson: true,
)
class UpdateUserDto {
  /// Returns a new [UpdateUserDto] instance.
  UpdateUserDto({
    this.email,

    this.username,

    this.fullName,

    this.role = Role.COMMERCIAL,

    this.departementId,

    this.phone,
  });

  @JsonKey(name: r'email', required: false, includeIfNull: false)
  final String? email;

  /// Identifiant de connexion alternatif : lettres, chiffres, point, tiret bas.
  @JsonKey(name: r'username', required: false, includeIfNull: false)
  final String? username;

  @JsonKey(name: r'fullName', required: false, includeIfNull: false)
  final String? fullName;

  @JsonKey(
    defaultValue: Role.COMMERCIAL,
    name: r'role',
    required: false,
    includeIfNull: false,
    unknownEnumValue: Role.unknownDefaultOpenApi,
  )
  final Role? role;

  @JsonKey(name: r'departementId', required: false, includeIfNull: false)
  final String? departementId;

  /// Téléphone, normalisé en E.164 par le serveur.
  @JsonKey(name: r'phone', required: false, includeIfNull: false)
  final String? phone;

  bool operator ==(Object other) {
    return identical(this, other) ||
        other is UpdateUserDto &&
            runtimeType == other.runtimeType &&
            equals(
              [email, username, fullName, role, departementId, phone],
              [
                other.email,
                other.username,
                other.fullName,
                other.role,
                other.departementId,
                other.phone,
              ],
            );
  }

  @override
  int get hashCode =>
      runtimeType.hashCode ^
      mapPropsToHashCode([
        email,
        username,
        fullName,
        role,
        departementId,
        phone,
      ]);

  factory UpdateUserDto.fromJson(Map<String, dynamic> json) =>
      _$UpdateUserDtoFromJson(json);

  Map<String, dynamic> toJson() => _$UpdateUserDtoToJson(this);

  @override
  String toString() {
    return toJson().toString();
  }
}

//
// AUTO-GENERATED FILE, DO NOT MODIFY!
//

// ignore_for_file: unused_element
import 'package:crm_api_client/src/model/auth_user_dto.dart';
import 'package:copy_with_extension/copy_with_extension.dart';
import 'package:json_annotation/json_annotation.dart';
import 'package:equatable/src/equatable_utils.dart';

part 'auth_tokens_dto.g.dart';

@CopyWith()
@JsonSerializable(
  checked: true,
  createToJson: true,
  disallowUnrecognizedKeys: false,
  explicitToJson: true,
)
class AuthTokensDto {
  /// Returns a new [AuthTokensDto] instance.
  AuthTokensDto({
    required this.accessToken,

    required this.refreshToken,

    required this.expiresIn,

    required this.user,
  });

  /// JWT à placer dans l’en-tête Authorization: Bearer.
  @JsonKey(name: r'accessToken', required: true, includeIfNull: false)
  final String accessToken;

  /// À conserver côté client ; tourné à chaque usage.
  @JsonKey(name: r'refreshToken', required: true, includeIfNull: false)
  final String refreshToken;

  /// Durée de vie de l’access token, en secondes.
  @JsonKey(name: r'expiresIn', required: true, includeIfNull: false)
  final num expiresIn;

  @JsonKey(name: r'user', required: true, includeIfNull: false)
  final AuthUserDto user;

  bool operator ==(Object other) {
    return identical(this, other) ||
        other is AuthTokensDto &&
            runtimeType == other.runtimeType &&
            equals(
              [accessToken, refreshToken, expiresIn, user],
              [
                other.accessToken,
                other.refreshToken,
                other.expiresIn,
                other.user,
              ],
            );
  }

  @override
  int get hashCode =>
      runtimeType.hashCode ^
      mapPropsToHashCode([accessToken, refreshToken, expiresIn, user]);

  factory AuthTokensDto.fromJson(Map<String, dynamic> json) =>
      _$AuthTokensDtoFromJson(json);

  Map<String, dynamic> toJson() => _$AuthTokensDtoToJson(this);

  @override
  String toString() {
    return toJson().toString();
  }
}

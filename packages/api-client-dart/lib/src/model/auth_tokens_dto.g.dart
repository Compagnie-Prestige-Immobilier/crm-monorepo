// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'auth_tokens_dto.dart';

// **************************************************************************
// CopyWithGenerator
// **************************************************************************

abstract class _$AuthTokensDtoCWProxy {
  AuthTokensDto accessToken(String accessToken);

  AuthTokensDto refreshToken(String refreshToken);

  AuthTokensDto expiresIn(num expiresIn);

  AuthTokensDto user(AuthUserDto user);

  /// This function **does support** nullification of nullable fields. All `null` values passed to `non-nullable` fields will be ignored. You can also use `AuthTokensDto(...).copyWith.fieldName(...)` to override fields one at a time with nullification support.
  ///
  /// Usage
  /// ```dart
  /// AuthTokensDto(...).copyWith(id: 12, name: "My name")
  /// ````
  AuthTokensDto call({
    String accessToken,
    String refreshToken,
    num expiresIn,
    AuthUserDto user,
  });
}

/// Proxy class for `copyWith` functionality. This is a callable class and can be used as follows: `instanceOfAuthTokensDto.copyWith(...)`. Additionally contains functions for specific fields e.g. `instanceOfAuthTokensDto.copyWith.fieldName(...)`
class _$AuthTokensDtoCWProxyImpl implements _$AuthTokensDtoCWProxy {
  const _$AuthTokensDtoCWProxyImpl(this._value);

  final AuthTokensDto _value;

  @override
  AuthTokensDto accessToken(String accessToken) =>
      this(accessToken: accessToken);

  @override
  AuthTokensDto refreshToken(String refreshToken) =>
      this(refreshToken: refreshToken);

  @override
  AuthTokensDto expiresIn(num expiresIn) => this(expiresIn: expiresIn);

  @override
  AuthTokensDto user(AuthUserDto user) => this(user: user);

  @override
  /// This function **does support** nullification of nullable fields. All `null` values passed to `non-nullable` fields will be ignored. You can also use `AuthTokensDto(...).copyWith.fieldName(...)` to override fields one at a time with nullification support.
  ///
  /// Usage
  /// ```dart
  /// AuthTokensDto(...).copyWith(id: 12, name: "My name")
  /// ````
  AuthTokensDto call({
    Object? accessToken = const $CopyWithPlaceholder(),
    Object? refreshToken = const $CopyWithPlaceholder(),
    Object? expiresIn = const $CopyWithPlaceholder(),
    Object? user = const $CopyWithPlaceholder(),
  }) {
    return AuthTokensDto(
      accessToken: accessToken == const $CopyWithPlaceholder()
          ? _value.accessToken
          // ignore: cast_nullable_to_non_nullable
          : accessToken as String,
      refreshToken: refreshToken == const $CopyWithPlaceholder()
          ? _value.refreshToken
          // ignore: cast_nullable_to_non_nullable
          : refreshToken as String,
      expiresIn: expiresIn == const $CopyWithPlaceholder()
          ? _value.expiresIn
          // ignore: cast_nullable_to_non_nullable
          : expiresIn as num,
      user: user == const $CopyWithPlaceholder()
          ? _value.user
          // ignore: cast_nullable_to_non_nullable
          : user as AuthUserDto,
    );
  }
}

extension $AuthTokensDtoCopyWith on AuthTokensDto {
  /// Returns a callable class that can be used as follows: `instanceOfAuthTokensDto.copyWith(...)` or like so:`instanceOfAuthTokensDto.copyWith.fieldName(...)`.
  // ignore: library_private_types_in_public_api
  _$AuthTokensDtoCWProxy get copyWith => _$AuthTokensDtoCWProxyImpl(this);
}

// **************************************************************************
// JsonSerializableGenerator
// **************************************************************************

AuthTokensDto _$AuthTokensDtoFromJson(Map<String, dynamic> json) =>
    $checkedCreate('AuthTokensDto', json, ($checkedConvert) {
      $checkKeys(
        json,
        requiredKeys: const [
          'accessToken',
          'refreshToken',
          'expiresIn',
          'user',
        ],
      );
      final val = AuthTokensDto(
        accessToken: $checkedConvert('accessToken', (v) => v as String),
        refreshToken: $checkedConvert('refreshToken', (v) => v as String),
        expiresIn: $checkedConvert('expiresIn', (v) => v as num),
        user: $checkedConvert(
          'user',
          (v) => AuthUserDto.fromJson(v as Map<String, dynamic>),
        ),
      );
      return val;
    });

Map<String, dynamic> _$AuthTokensDtoToJson(AuthTokensDto instance) =>
    <String, dynamic>{
      'accessToken': instance.accessToken,
      'refreshToken': instance.refreshToken,
      'expiresIn': instance.expiresIn,
      'user': instance.user.toJson(),
    };

// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'login_dto.dart';

// **************************************************************************
// CopyWithGenerator
// **************************************************************************

abstract class _$LoginDtoCWProxy {
  LoginDto identifier(String identifier);

  LoginDto password(String password);

  /// This function **does support** nullification of nullable fields. All `null` values passed to `non-nullable` fields will be ignored. You can also use `LoginDto(...).copyWith.fieldName(...)` to override fields one at a time with nullification support.
  ///
  /// Usage
  /// ```dart
  /// LoginDto(...).copyWith(id: 12, name: "My name")
  /// ````
  LoginDto call({String identifier, String password});
}

/// Proxy class for `copyWith` functionality. This is a callable class and can be used as follows: `instanceOfLoginDto.copyWith(...)`. Additionally contains functions for specific fields e.g. `instanceOfLoginDto.copyWith.fieldName(...)`
class _$LoginDtoCWProxyImpl implements _$LoginDtoCWProxy {
  const _$LoginDtoCWProxyImpl(this._value);

  final LoginDto _value;

  @override
  LoginDto identifier(String identifier) => this(identifier: identifier);

  @override
  LoginDto password(String password) => this(password: password);

  @override
  /// This function **does support** nullification of nullable fields. All `null` values passed to `non-nullable` fields will be ignored. You can also use `LoginDto(...).copyWith.fieldName(...)` to override fields one at a time with nullification support.
  ///
  /// Usage
  /// ```dart
  /// LoginDto(...).copyWith(id: 12, name: "My name")
  /// ````
  LoginDto call({
    Object? identifier = const $CopyWithPlaceholder(),
    Object? password = const $CopyWithPlaceholder(),
  }) {
    return LoginDto(
      identifier: identifier == const $CopyWithPlaceholder()
          ? _value.identifier
          // ignore: cast_nullable_to_non_nullable
          : identifier as String,
      password: password == const $CopyWithPlaceholder()
          ? _value.password
          // ignore: cast_nullable_to_non_nullable
          : password as String,
    );
  }
}

extension $LoginDtoCopyWith on LoginDto {
  /// Returns a callable class that can be used as follows: `instanceOfLoginDto.copyWith(...)` or like so:`instanceOfLoginDto.copyWith.fieldName(...)`.
  // ignore: library_private_types_in_public_api
  _$LoginDtoCWProxy get copyWith => _$LoginDtoCWProxyImpl(this);
}

// **************************************************************************
// JsonSerializableGenerator
// **************************************************************************

LoginDto _$LoginDtoFromJson(Map<String, dynamic> json) =>
    $checkedCreate('LoginDto', json, ($checkedConvert) {
      $checkKeys(json, requiredKeys: const ['identifier', 'password']);
      final val = LoginDto(
        identifier: $checkedConvert('identifier', (v) => v as String),
        password: $checkedConvert('password', (v) => v as String),
      );
      return val;
    });

Map<String, dynamic> _$LoginDtoToJson(LoginDto instance) => <String, dynamic>{
  'identifier': instance.identifier,
  'password': instance.password,
};

// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'reset_password_dto.dart';

// **************************************************************************
// CopyWithGenerator
// **************************************************************************

abstract class _$ResetPasswordDtoCWProxy {
  ResetPasswordDto password(String password);

  /// This function **does support** nullification of nullable fields. All `null` values passed to `non-nullable` fields will be ignored. You can also use `ResetPasswordDto(...).copyWith.fieldName(...)` to override fields one at a time with nullification support.
  ///
  /// Usage
  /// ```dart
  /// ResetPasswordDto(...).copyWith(id: 12, name: "My name")
  /// ````
  ResetPasswordDto call({String password});
}

/// Proxy class for `copyWith` functionality. This is a callable class and can be used as follows: `instanceOfResetPasswordDto.copyWith(...)`. Additionally contains functions for specific fields e.g. `instanceOfResetPasswordDto.copyWith.fieldName(...)`
class _$ResetPasswordDtoCWProxyImpl implements _$ResetPasswordDtoCWProxy {
  const _$ResetPasswordDtoCWProxyImpl(this._value);

  final ResetPasswordDto _value;

  @override
  ResetPasswordDto password(String password) => this(password: password);

  @override
  /// This function **does support** nullification of nullable fields. All `null` values passed to `non-nullable` fields will be ignored. You can also use `ResetPasswordDto(...).copyWith.fieldName(...)` to override fields one at a time with nullification support.
  ///
  /// Usage
  /// ```dart
  /// ResetPasswordDto(...).copyWith(id: 12, name: "My name")
  /// ````
  ResetPasswordDto call({Object? password = const $CopyWithPlaceholder()}) {
    return ResetPasswordDto(
      password: password == const $CopyWithPlaceholder()
          ? _value.password
          // ignore: cast_nullable_to_non_nullable
          : password as String,
    );
  }
}

extension $ResetPasswordDtoCopyWith on ResetPasswordDto {
  /// Returns a callable class that can be used as follows: `instanceOfResetPasswordDto.copyWith(...)` or like so:`instanceOfResetPasswordDto.copyWith.fieldName(...)`.
  // ignore: library_private_types_in_public_api
  _$ResetPasswordDtoCWProxy get copyWith => _$ResetPasswordDtoCWProxyImpl(this);
}

// **************************************************************************
// JsonSerializableGenerator
// **************************************************************************

ResetPasswordDto _$ResetPasswordDtoFromJson(Map<String, dynamic> json) =>
    $checkedCreate('ResetPasswordDto', json, ($checkedConvert) {
      $checkKeys(json, requiredKeys: const ['password']);
      final val = ResetPasswordDto(
        password: $checkedConvert('password', (v) => v as String),
      );
      return val;
    });

Map<String, dynamic> _$ResetPasswordDtoToJson(ResetPasswordDto instance) =>
    <String, dynamic>{'password': instance.password};

// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'logout_response_dto.dart';

// **************************************************************************
// CopyWithGenerator
// **************************************************************************

abstract class _$LogoutResponseDtoCWProxy {
  LogoutResponseDto revoked(bool revoked);

  /// This function **does support** nullification of nullable fields. All `null` values passed to `non-nullable` fields will be ignored. You can also use `LogoutResponseDto(...).copyWith.fieldName(...)` to override fields one at a time with nullification support.
  ///
  /// Usage
  /// ```dart
  /// LogoutResponseDto(...).copyWith(id: 12, name: "My name")
  /// ````
  LogoutResponseDto call({bool revoked});
}

/// Proxy class for `copyWith` functionality. This is a callable class and can be used as follows: `instanceOfLogoutResponseDto.copyWith(...)`. Additionally contains functions for specific fields e.g. `instanceOfLogoutResponseDto.copyWith.fieldName(...)`
class _$LogoutResponseDtoCWProxyImpl implements _$LogoutResponseDtoCWProxy {
  const _$LogoutResponseDtoCWProxyImpl(this._value);

  final LogoutResponseDto _value;

  @override
  LogoutResponseDto revoked(bool revoked) => this(revoked: revoked);

  @override
  /// This function **does support** nullification of nullable fields. All `null` values passed to `non-nullable` fields will be ignored. You can also use `LogoutResponseDto(...).copyWith.fieldName(...)` to override fields one at a time with nullification support.
  ///
  /// Usage
  /// ```dart
  /// LogoutResponseDto(...).copyWith(id: 12, name: "My name")
  /// ````
  LogoutResponseDto call({Object? revoked = const $CopyWithPlaceholder()}) {
    return LogoutResponseDto(
      revoked: revoked == const $CopyWithPlaceholder()
          ? _value.revoked
          // ignore: cast_nullable_to_non_nullable
          : revoked as bool,
    );
  }
}

extension $LogoutResponseDtoCopyWith on LogoutResponseDto {
  /// Returns a callable class that can be used as follows: `instanceOfLogoutResponseDto.copyWith(...)` or like so:`instanceOfLogoutResponseDto.copyWith.fieldName(...)`.
  // ignore: library_private_types_in_public_api
  _$LogoutResponseDtoCWProxy get copyWith =>
      _$LogoutResponseDtoCWProxyImpl(this);
}

// **************************************************************************
// JsonSerializableGenerator
// **************************************************************************

LogoutResponseDto _$LogoutResponseDtoFromJson(Map<String, dynamic> json) =>
    $checkedCreate('LogoutResponseDto', json, ($checkedConvert) {
      $checkKeys(json, requiredKeys: const ['revoked']);
      final val = LogoutResponseDto(
        revoked: $checkedConvert('revoked', (v) => v as bool),
      );
      return val;
    });

Map<String, dynamic> _$LogoutResponseDtoToJson(LogoutResponseDto instance) =>
    <String, dynamic>{'revoked': instance.revoked};

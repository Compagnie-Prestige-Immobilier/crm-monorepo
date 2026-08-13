// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'unregister_device_dto.dart';

// **************************************************************************
// CopyWithGenerator
// **************************************************************************

abstract class _$UnregisterDeviceDtoCWProxy {
  UnregisterDeviceDto token(String token);

  /// This function **does support** nullification of nullable fields. All `null` values passed to `non-nullable` fields will be ignored. You can also use `UnregisterDeviceDto(...).copyWith.fieldName(...)` to override fields one at a time with nullification support.
  ///
  /// Usage
  /// ```dart
  /// UnregisterDeviceDto(...).copyWith(id: 12, name: "My name")
  /// ````
  UnregisterDeviceDto call({String token});
}

/// Proxy class for `copyWith` functionality. This is a callable class and can be used as follows: `instanceOfUnregisterDeviceDto.copyWith(...)`. Additionally contains functions for specific fields e.g. `instanceOfUnregisterDeviceDto.copyWith.fieldName(...)`
class _$UnregisterDeviceDtoCWProxyImpl implements _$UnregisterDeviceDtoCWProxy {
  const _$UnregisterDeviceDtoCWProxyImpl(this._value);

  final UnregisterDeviceDto _value;

  @override
  UnregisterDeviceDto token(String token) => this(token: token);

  @override
  /// This function **does support** nullification of nullable fields. All `null` values passed to `non-nullable` fields will be ignored. You can also use `UnregisterDeviceDto(...).copyWith.fieldName(...)` to override fields one at a time with nullification support.
  ///
  /// Usage
  /// ```dart
  /// UnregisterDeviceDto(...).copyWith(id: 12, name: "My name")
  /// ````
  UnregisterDeviceDto call({Object? token = const $CopyWithPlaceholder()}) {
    return UnregisterDeviceDto(
      token: token == const $CopyWithPlaceholder()
          ? _value.token
          // ignore: cast_nullable_to_non_nullable
          : token as String,
    );
  }
}

extension $UnregisterDeviceDtoCopyWith on UnregisterDeviceDto {
  /// Returns a callable class that can be used as follows: `instanceOfUnregisterDeviceDto.copyWith(...)` or like so:`instanceOfUnregisterDeviceDto.copyWith.fieldName(...)`.
  // ignore: library_private_types_in_public_api
  _$UnregisterDeviceDtoCWProxy get copyWith =>
      _$UnregisterDeviceDtoCWProxyImpl(this);
}

// **************************************************************************
// JsonSerializableGenerator
// **************************************************************************

UnregisterDeviceDto _$UnregisterDeviceDtoFromJson(Map<String, dynamic> json) =>
    $checkedCreate('UnregisterDeviceDto', json, ($checkedConvert) {
      $checkKeys(json, requiredKeys: const ['token']);
      final val = UnregisterDeviceDto(
        token: $checkedConvert('token', (v) => v as String),
      );
      return val;
    });

Map<String, dynamic> _$UnregisterDeviceDtoToJson(
  UnregisterDeviceDto instance,
) => <String, dynamic>{'token': instance.token};

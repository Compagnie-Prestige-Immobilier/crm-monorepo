// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'register_device_dto.dart';

// **************************************************************************
// CopyWithGenerator
// **************************************************************************

abstract class _$RegisterDeviceDtoCWProxy {
  RegisterDeviceDto token(String token);

  RegisterDeviceDto platform(DevicePlatform? platform);

  RegisterDeviceDto appVersion(String? appVersion);

  RegisterDeviceDto pendingOps(num? pendingOps);

  /// This function **does support** nullification of nullable fields. All `null` values passed to `non-nullable` fields will be ignored. You can also use `RegisterDeviceDto(...).copyWith.fieldName(...)` to override fields one at a time with nullification support.
  ///
  /// Usage
  /// ```dart
  /// RegisterDeviceDto(...).copyWith(id: 12, name: "My name")
  /// ````
  RegisterDeviceDto call({
    String token,
    DevicePlatform? platform,
    String? appVersion,
    num? pendingOps,
  });
}

/// Proxy class for `copyWith` functionality. This is a callable class and can be used as follows: `instanceOfRegisterDeviceDto.copyWith(...)`. Additionally contains functions for specific fields e.g. `instanceOfRegisterDeviceDto.copyWith.fieldName(...)`
class _$RegisterDeviceDtoCWProxyImpl implements _$RegisterDeviceDtoCWProxy {
  const _$RegisterDeviceDtoCWProxyImpl(this._value);

  final RegisterDeviceDto _value;

  @override
  RegisterDeviceDto token(String token) => this(token: token);

  @override
  RegisterDeviceDto platform(DevicePlatform? platform) =>
      this(platform: platform);

  @override
  RegisterDeviceDto appVersion(String? appVersion) =>
      this(appVersion: appVersion);

  @override
  RegisterDeviceDto pendingOps(num? pendingOps) => this(pendingOps: pendingOps);

  @override
  /// This function **does support** nullification of nullable fields. All `null` values passed to `non-nullable` fields will be ignored. You can also use `RegisterDeviceDto(...).copyWith.fieldName(...)` to override fields one at a time with nullification support.
  ///
  /// Usage
  /// ```dart
  /// RegisterDeviceDto(...).copyWith(id: 12, name: "My name")
  /// ````
  RegisterDeviceDto call({
    Object? token = const $CopyWithPlaceholder(),
    Object? platform = const $CopyWithPlaceholder(),
    Object? appVersion = const $CopyWithPlaceholder(),
    Object? pendingOps = const $CopyWithPlaceholder(),
  }) {
    return RegisterDeviceDto(
      token: token == const $CopyWithPlaceholder()
          ? _value.token
          // ignore: cast_nullable_to_non_nullable
          : token as String,
      platform: platform == const $CopyWithPlaceholder()
          ? _value.platform
          // ignore: cast_nullable_to_non_nullable
          : platform as DevicePlatform?,
      appVersion: appVersion == const $CopyWithPlaceholder()
          ? _value.appVersion
          // ignore: cast_nullable_to_non_nullable
          : appVersion as String?,
      pendingOps: pendingOps == const $CopyWithPlaceholder()
          ? _value.pendingOps
          // ignore: cast_nullable_to_non_nullable
          : pendingOps as num?,
    );
  }
}

extension $RegisterDeviceDtoCopyWith on RegisterDeviceDto {
  /// Returns a callable class that can be used as follows: `instanceOfRegisterDeviceDto.copyWith(...)` or like so:`instanceOfRegisterDeviceDto.copyWith.fieldName(...)`.
  // ignore: library_private_types_in_public_api
  _$RegisterDeviceDtoCWProxy get copyWith =>
      _$RegisterDeviceDtoCWProxyImpl(this);
}

// **************************************************************************
// JsonSerializableGenerator
// **************************************************************************

RegisterDeviceDto _$RegisterDeviceDtoFromJson(Map<String, dynamic> json) =>
    $checkedCreate('RegisterDeviceDto', json, ($checkedConvert) {
      $checkKeys(json, requiredKeys: const ['token']);
      final val = RegisterDeviceDto(
        token: $checkedConvert('token', (v) => v as String),
        platform: $checkedConvert(
          'platform',
          (v) => $enumDecodeNullable(
            _$DevicePlatformEnumMap,
            v,
            unknownValue: DevicePlatform.unknownDefaultOpenApi,
          ),
        ),
        appVersion: $checkedConvert('appVersion', (v) => v as String?),
        pendingOps: $checkedConvert('pendingOps', (v) => v as num?),
      );
      return val;
    });

Map<String, dynamic> _$RegisterDeviceDtoToJson(RegisterDeviceDto instance) =>
    <String, dynamic>{
      'token': instance.token,
      if (_$DevicePlatformEnumMap[instance.platform] case final value?)
        'platform': value,
      if (instance.appVersion case final value?) 'appVersion': value,
      if (instance.pendingOps case final value?) 'pendingOps': value,
    };

const _$DevicePlatformEnumMap = {
  DevicePlatform.ANDROID: 'ANDROID',
  DevicePlatform.IOS: 'IOS',
  DevicePlatform.WEB: 'WEB',
  DevicePlatform.unknownDefaultOpenApi: 'unknown_default_open_api',
};

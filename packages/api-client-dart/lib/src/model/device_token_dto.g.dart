// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'device_token_dto.dart';

// **************************************************************************
// CopyWithGenerator
// **************************************************************************

abstract class _$DeviceTokenDtoCWProxy {
  DeviceTokenDto id(String id);

  DeviceTokenDto platform(DevicePlatform platform);

  DeviceTokenDto appVersion(String? appVersion);

  DeviceTokenDto lastSeenAt(DateTime lastSeenAt);

  DeviceTokenDto pushEnabled(bool pushEnabled);

  /// This function **does support** nullification of nullable fields. All `null` values passed to `non-nullable` fields will be ignored. You can also use `DeviceTokenDto(...).copyWith.fieldName(...)` to override fields one at a time with nullification support.
  ///
  /// Usage
  /// ```dart
  /// DeviceTokenDto(...).copyWith(id: 12, name: "My name")
  /// ````
  DeviceTokenDto call({
    String id,
    DevicePlatform platform,
    String? appVersion,
    DateTime lastSeenAt,
    bool pushEnabled,
  });
}

/// Proxy class for `copyWith` functionality. This is a callable class and can be used as follows: `instanceOfDeviceTokenDto.copyWith(...)`. Additionally contains functions for specific fields e.g. `instanceOfDeviceTokenDto.copyWith.fieldName(...)`
class _$DeviceTokenDtoCWProxyImpl implements _$DeviceTokenDtoCWProxy {
  const _$DeviceTokenDtoCWProxyImpl(this._value);

  final DeviceTokenDto _value;

  @override
  DeviceTokenDto id(String id) => this(id: id);

  @override
  DeviceTokenDto platform(DevicePlatform platform) => this(platform: platform);

  @override
  DeviceTokenDto appVersion(String? appVersion) => this(appVersion: appVersion);

  @override
  DeviceTokenDto lastSeenAt(DateTime lastSeenAt) =>
      this(lastSeenAt: lastSeenAt);

  @override
  DeviceTokenDto pushEnabled(bool pushEnabled) =>
      this(pushEnabled: pushEnabled);

  @override
  /// This function **does support** nullification of nullable fields. All `null` values passed to `non-nullable` fields will be ignored. You can also use `DeviceTokenDto(...).copyWith.fieldName(...)` to override fields one at a time with nullification support.
  ///
  /// Usage
  /// ```dart
  /// DeviceTokenDto(...).copyWith(id: 12, name: "My name")
  /// ````
  DeviceTokenDto call({
    Object? id = const $CopyWithPlaceholder(),
    Object? platform = const $CopyWithPlaceholder(),
    Object? appVersion = const $CopyWithPlaceholder(),
    Object? lastSeenAt = const $CopyWithPlaceholder(),
    Object? pushEnabled = const $CopyWithPlaceholder(),
  }) {
    return DeviceTokenDto(
      id: id == const $CopyWithPlaceholder()
          ? _value.id
          // ignore: cast_nullable_to_non_nullable
          : id as String,
      platform: platform == const $CopyWithPlaceholder()
          ? _value.platform
          // ignore: cast_nullable_to_non_nullable
          : platform as DevicePlatform,
      appVersion: appVersion == const $CopyWithPlaceholder()
          ? _value.appVersion
          // ignore: cast_nullable_to_non_nullable
          : appVersion as String?,
      lastSeenAt: lastSeenAt == const $CopyWithPlaceholder()
          ? _value.lastSeenAt
          // ignore: cast_nullable_to_non_nullable
          : lastSeenAt as DateTime,
      pushEnabled: pushEnabled == const $CopyWithPlaceholder()
          ? _value.pushEnabled
          // ignore: cast_nullable_to_non_nullable
          : pushEnabled as bool,
    );
  }
}

extension $DeviceTokenDtoCopyWith on DeviceTokenDto {
  /// Returns a callable class that can be used as follows: `instanceOfDeviceTokenDto.copyWith(...)` or like so:`instanceOfDeviceTokenDto.copyWith.fieldName(...)`.
  // ignore: library_private_types_in_public_api
  _$DeviceTokenDtoCWProxy get copyWith => _$DeviceTokenDtoCWProxyImpl(this);
}

// **************************************************************************
// JsonSerializableGenerator
// **************************************************************************

DeviceTokenDto _$DeviceTokenDtoFromJson(Map<String, dynamic> json) =>
    $checkedCreate('DeviceTokenDto', json, ($checkedConvert) {
      $checkKeys(
        json,
        requiredKeys: const [
          'id',
          'platform',
          'appVersion',
          'lastSeenAt',
          'pushEnabled',
        ],
      );
      final val = DeviceTokenDto(
        id: $checkedConvert('id', (v) => v as String),
        platform: $checkedConvert(
          'platform',
          (v) => $enumDecode(
            _$DevicePlatformEnumMap,
            v,
            unknownValue: DevicePlatform.unknownDefaultOpenApi,
          ),
        ),
        appVersion: $checkedConvert('appVersion', (v) => v as String?),
        lastSeenAt: $checkedConvert(
          'lastSeenAt',
          (v) => DateTime.parse(v as String),
        ),
        pushEnabled: $checkedConvert('pushEnabled', (v) => v as bool),
      );
      return val;
    });

Map<String, dynamic> _$DeviceTokenDtoToJson(DeviceTokenDto instance) =>
    <String, dynamic>{
      'id': instance.id,
      'platform': _$DevicePlatformEnumMap[instance.platform]!,
      'appVersion': instance.appVersion,
      'lastSeenAt': instance.lastSeenAt.toIso8601String(),
      'pushEnabled': instance.pushEnabled,
    };

const _$DevicePlatformEnumMap = {
  DevicePlatform.ANDROID: 'ANDROID',
  DevicePlatform.IOS: 'IOS',
  DevicePlatform.WEB: 'WEB',
  DevicePlatform.unknownDefaultOpenApi: 'unknown_default_open_api',
};

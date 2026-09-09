// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'device_call_detection_dto.dart';

// **************************************************************************
// CopyWithGenerator
// **************************************************************************

abstract class _$DeviceCallDetectionDtoCWProxy {
  DeviceCallDetectionDto id(String id);

  DeviceCallDetectionDto performedById(String performedById);

  DeviceCallDetectionDto performedByName(String performedByName);

  DeviceCallDetectionDto deviceCallType(
    DeviceCallDetectionDtoDeviceCallTypeEnum deviceCallType,
  );

  DeviceCallDetectionDto deviceCallDurationSeconds(
    num deviceCallDurationSeconds,
  );

  DeviceCallDetectionDto deviceCallAt(DateTime deviceCallAt);

  DeviceCallDetectionDto detectedAt(DateTime detectedAt);

  DeviceCallDetectionDto attemptId(String? attemptId);

  /// This function **does support** nullification of nullable fields. All `null` values passed to `non-nullable` fields will be ignored. You can also use `DeviceCallDetectionDto(...).copyWith.fieldName(...)` to override fields one at a time with nullification support.
  ///
  /// Usage
  /// ```dart
  /// DeviceCallDetectionDto(...).copyWith(id: 12, name: "My name")
  /// ````
  DeviceCallDetectionDto call({
    String id,
    String performedById,
    String performedByName,
    DeviceCallDetectionDtoDeviceCallTypeEnum deviceCallType,
    num deviceCallDurationSeconds,
    DateTime deviceCallAt,
    DateTime detectedAt,
    String? attemptId,
  });
}

/// Proxy class for `copyWith` functionality. This is a callable class and can be used as follows: `instanceOfDeviceCallDetectionDto.copyWith(...)`. Additionally contains functions for specific fields e.g. `instanceOfDeviceCallDetectionDto.copyWith.fieldName(...)`
class _$DeviceCallDetectionDtoCWProxyImpl
    implements _$DeviceCallDetectionDtoCWProxy {
  const _$DeviceCallDetectionDtoCWProxyImpl(this._value);

  final DeviceCallDetectionDto _value;

  @override
  DeviceCallDetectionDto id(String id) => this(id: id);

  @override
  DeviceCallDetectionDto performedById(String performedById) =>
      this(performedById: performedById);

  @override
  DeviceCallDetectionDto performedByName(String performedByName) =>
      this(performedByName: performedByName);

  @override
  DeviceCallDetectionDto deviceCallType(
    DeviceCallDetectionDtoDeviceCallTypeEnum deviceCallType,
  ) => this(deviceCallType: deviceCallType);

  @override
  DeviceCallDetectionDto deviceCallDurationSeconds(
    num deviceCallDurationSeconds,
  ) => this(deviceCallDurationSeconds: deviceCallDurationSeconds);

  @override
  DeviceCallDetectionDto deviceCallAt(DateTime deviceCallAt) =>
      this(deviceCallAt: deviceCallAt);

  @override
  DeviceCallDetectionDto detectedAt(DateTime detectedAt) =>
      this(detectedAt: detectedAt);

  @override
  DeviceCallDetectionDto attemptId(String? attemptId) =>
      this(attemptId: attemptId);

  @override
  /// This function **does support** nullification of nullable fields. All `null` values passed to `non-nullable` fields will be ignored. You can also use `DeviceCallDetectionDto(...).copyWith.fieldName(...)` to override fields one at a time with nullification support.
  ///
  /// Usage
  /// ```dart
  /// DeviceCallDetectionDto(...).copyWith(id: 12, name: "My name")
  /// ````
  DeviceCallDetectionDto call({
    Object? id = const $CopyWithPlaceholder(),
    Object? performedById = const $CopyWithPlaceholder(),
    Object? performedByName = const $CopyWithPlaceholder(),
    Object? deviceCallType = const $CopyWithPlaceholder(),
    Object? deviceCallDurationSeconds = const $CopyWithPlaceholder(),
    Object? deviceCallAt = const $CopyWithPlaceholder(),
    Object? detectedAt = const $CopyWithPlaceholder(),
    Object? attemptId = const $CopyWithPlaceholder(),
  }) {
    return DeviceCallDetectionDto(
      id: id == const $CopyWithPlaceholder()
          ? _value.id
          // ignore: cast_nullable_to_non_nullable
          : id as String,
      performedById: performedById == const $CopyWithPlaceholder()
          ? _value.performedById
          // ignore: cast_nullable_to_non_nullable
          : performedById as String,
      performedByName: performedByName == const $CopyWithPlaceholder()
          ? _value.performedByName
          // ignore: cast_nullable_to_non_nullable
          : performedByName as String,
      deviceCallType: deviceCallType == const $CopyWithPlaceholder()
          ? _value.deviceCallType
          // ignore: cast_nullable_to_non_nullable
          : deviceCallType as DeviceCallDetectionDtoDeviceCallTypeEnum,
      deviceCallDurationSeconds:
          deviceCallDurationSeconds == const $CopyWithPlaceholder()
          ? _value.deviceCallDurationSeconds
          // ignore: cast_nullable_to_non_nullable
          : deviceCallDurationSeconds as num,
      deviceCallAt: deviceCallAt == const $CopyWithPlaceholder()
          ? _value.deviceCallAt
          // ignore: cast_nullable_to_non_nullable
          : deviceCallAt as DateTime,
      detectedAt: detectedAt == const $CopyWithPlaceholder()
          ? _value.detectedAt
          // ignore: cast_nullable_to_non_nullable
          : detectedAt as DateTime,
      attemptId: attemptId == const $CopyWithPlaceholder()
          ? _value.attemptId
          // ignore: cast_nullable_to_non_nullable
          : attemptId as String?,
    );
  }
}

extension $DeviceCallDetectionDtoCopyWith on DeviceCallDetectionDto {
  /// Returns a callable class that can be used as follows: `instanceOfDeviceCallDetectionDto.copyWith(...)` or like so:`instanceOfDeviceCallDetectionDto.copyWith.fieldName(...)`.
  // ignore: library_private_types_in_public_api
  _$DeviceCallDetectionDtoCWProxy get copyWith =>
      _$DeviceCallDetectionDtoCWProxyImpl(this);
}

// **************************************************************************
// JsonSerializableGenerator
// **************************************************************************

DeviceCallDetectionDto _$DeviceCallDetectionDtoFromJson(
  Map<String, dynamic> json,
) => $checkedCreate('DeviceCallDetectionDto', json, ($checkedConvert) {
  $checkKeys(
    json,
    requiredKeys: const [
      'id',
      'performedById',
      'performedByName',
      'deviceCallType',
      'deviceCallDurationSeconds',
      'deviceCallAt',
      'detectedAt',
      'attemptId',
    ],
  );
  final val = DeviceCallDetectionDto(
    id: $checkedConvert('id', (v) => v as String),
    performedById: $checkedConvert('performedById', (v) => v as String),
    performedByName: $checkedConvert('performedByName', (v) => v as String),
    deviceCallType: $checkedConvert(
      'deviceCallType',
      (v) => $enumDecode(
        _$DeviceCallDetectionDtoDeviceCallTypeEnumEnumMap,
        v,
        unknownValue:
            DeviceCallDetectionDtoDeviceCallTypeEnum.unknownDefaultOpenApi,
      ),
    ),
    deviceCallDurationSeconds: $checkedConvert(
      'deviceCallDurationSeconds',
      (v) => v as num,
    ),
    deviceCallAt: $checkedConvert(
      'deviceCallAt',
      (v) => DateTime.parse(v as String),
    ),
    detectedAt: $checkedConvert(
      'detectedAt',
      (v) => DateTime.parse(v as String),
    ),
    attemptId: $checkedConvert('attemptId', (v) => v as String?),
  );
  return val;
});

Map<String, dynamic> _$DeviceCallDetectionDtoToJson(
  DeviceCallDetectionDto instance,
) => <String, dynamic>{
  'id': instance.id,
  'performedById': instance.performedById,
  'performedByName': instance.performedByName,
  'deviceCallType':
      _$DeviceCallDetectionDtoDeviceCallTypeEnumEnumMap[instance
          .deviceCallType]!,
  'deviceCallDurationSeconds': instance.deviceCallDurationSeconds,
  'deviceCallAt': instance.deviceCallAt.toIso8601String(),
  'detectedAt': instance.detectedAt.toIso8601String(),
  'attemptId': instance.attemptId,
};

const _$DeviceCallDetectionDtoDeviceCallTypeEnumEnumMap = {
  DeviceCallDetectionDtoDeviceCallTypeEnum.sortant: 'sortant',
  DeviceCallDetectionDtoDeviceCallTypeEnum.entrant: 'entrant',
  DeviceCallDetectionDtoDeviceCallTypeEnum.manque: 'manque',
  DeviceCallDetectionDtoDeviceCallTypeEnum.rejete: 'rejete',
  DeviceCallDetectionDtoDeviceCallTypeEnum.bloque: 'bloque',
  DeviceCallDetectionDtoDeviceCallTypeEnum.messagerie: 'messagerie',
  DeviceCallDetectionDtoDeviceCallTypeEnum.externe: 'externe',
  DeviceCallDetectionDtoDeviceCallTypeEnum.inconnu: 'inconnu',
  DeviceCallDetectionDtoDeviceCallTypeEnum.unknownDefaultOpenApi:
      'unknown_default_open_api',
};

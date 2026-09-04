// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'device_call_detection_list_dto.dart';

// **************************************************************************
// CopyWithGenerator
// **************************************************************************

abstract class _$DeviceCallDetectionListDtoCWProxy {
  DeviceCallDetectionListDto items(List<DeviceCallDetectionDto> items);

  /// This function **does support** nullification of nullable fields. All `null` values passed to `non-nullable` fields will be ignored. You can also use `DeviceCallDetectionListDto(...).copyWith.fieldName(...)` to override fields one at a time with nullification support.
  ///
  /// Usage
  /// ```dart
  /// DeviceCallDetectionListDto(...).copyWith(id: 12, name: "My name")
  /// ````
  DeviceCallDetectionListDto call({List<DeviceCallDetectionDto> items});
}

/// Proxy class for `copyWith` functionality. This is a callable class and can be used as follows: `instanceOfDeviceCallDetectionListDto.copyWith(...)`. Additionally contains functions for specific fields e.g. `instanceOfDeviceCallDetectionListDto.copyWith.fieldName(...)`
class _$DeviceCallDetectionListDtoCWProxyImpl
    implements _$DeviceCallDetectionListDtoCWProxy {
  const _$DeviceCallDetectionListDtoCWProxyImpl(this._value);

  final DeviceCallDetectionListDto _value;

  @override
  DeviceCallDetectionListDto items(List<DeviceCallDetectionDto> items) =>
      this(items: items);

  @override
  /// This function **does support** nullification of nullable fields. All `null` values passed to `non-nullable` fields will be ignored. You can also use `DeviceCallDetectionListDto(...).copyWith.fieldName(...)` to override fields one at a time with nullification support.
  ///
  /// Usage
  /// ```dart
  /// DeviceCallDetectionListDto(...).copyWith(id: 12, name: "My name")
  /// ````
  DeviceCallDetectionListDto call({
    Object? items = const $CopyWithPlaceholder(),
  }) {
    return DeviceCallDetectionListDto(
      items: items == const $CopyWithPlaceholder()
          ? _value.items
          // ignore: cast_nullable_to_non_nullable
          : items as List<DeviceCallDetectionDto>,
    );
  }
}

extension $DeviceCallDetectionListDtoCopyWith on DeviceCallDetectionListDto {
  /// Returns a callable class that can be used as follows: `instanceOfDeviceCallDetectionListDto.copyWith(...)` or like so:`instanceOfDeviceCallDetectionListDto.copyWith.fieldName(...)`.
  // ignore: library_private_types_in_public_api
  _$DeviceCallDetectionListDtoCWProxy get copyWith =>
      _$DeviceCallDetectionListDtoCWProxyImpl(this);
}

// **************************************************************************
// JsonSerializableGenerator
// **************************************************************************

DeviceCallDetectionListDto _$DeviceCallDetectionListDtoFromJson(
  Map<String, dynamic> json,
) => $checkedCreate('DeviceCallDetectionListDto', json, ($checkedConvert) {
  $checkKeys(json, requiredKeys: const ['items']);
  final val = DeviceCallDetectionListDto(
    items: $checkedConvert(
      'items',
      (v) => (v as List<dynamic>)
          .map(
            (e) => DeviceCallDetectionDto.fromJson(e as Map<String, dynamic>),
          )
          .toList(),
    ),
  );
  return val;
});

Map<String, dynamic> _$DeviceCallDetectionListDtoToJson(
  DeviceCallDetectionListDto instance,
) => <String, dynamic>{'items': instance.items.map((e) => e.toJson()).toList()};

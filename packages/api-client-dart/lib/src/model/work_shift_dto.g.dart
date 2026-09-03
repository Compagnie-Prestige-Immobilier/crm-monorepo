// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'work_shift_dto.dart';

// **************************************************************************
// CopyWithGenerator
// **************************************************************************

abstract class _$WorkShiftDtoCWProxy {
  WorkShiftDto key(WorkShiftDtoKeyEnum key);

  WorkShiftDto label(String label);

  WorkShiftDto start(String start);

  WorkShiftDto end(String end);

  /// This function **does support** nullification of nullable fields. All `null` values passed to `non-nullable` fields will be ignored. You can also use `WorkShiftDto(...).copyWith.fieldName(...)` to override fields one at a time with nullification support.
  ///
  /// Usage
  /// ```dart
  /// WorkShiftDto(...).copyWith(id: 12, name: "My name")
  /// ````
  WorkShiftDto call({
    WorkShiftDtoKeyEnum key,
    String label,
    String start,
    String end,
  });
}

/// Proxy class for `copyWith` functionality. This is a callable class and can be used as follows: `instanceOfWorkShiftDto.copyWith(...)`. Additionally contains functions for specific fields e.g. `instanceOfWorkShiftDto.copyWith.fieldName(...)`
class _$WorkShiftDtoCWProxyImpl implements _$WorkShiftDtoCWProxy {
  const _$WorkShiftDtoCWProxyImpl(this._value);

  final WorkShiftDto _value;

  @override
  WorkShiftDto key(WorkShiftDtoKeyEnum key) => this(key: key);

  @override
  WorkShiftDto label(String label) => this(label: label);

  @override
  WorkShiftDto start(String start) => this(start: start);

  @override
  WorkShiftDto end(String end) => this(end: end);

  @override
  /// This function **does support** nullification of nullable fields. All `null` values passed to `non-nullable` fields will be ignored. You can also use `WorkShiftDto(...).copyWith.fieldName(...)` to override fields one at a time with nullification support.
  ///
  /// Usage
  /// ```dart
  /// WorkShiftDto(...).copyWith(id: 12, name: "My name")
  /// ````
  WorkShiftDto call({
    Object? key = const $CopyWithPlaceholder(),
    Object? label = const $CopyWithPlaceholder(),
    Object? start = const $CopyWithPlaceholder(),
    Object? end = const $CopyWithPlaceholder(),
  }) {
    return WorkShiftDto(
      key: key == const $CopyWithPlaceholder()
          ? _value.key
          // ignore: cast_nullable_to_non_nullable
          : key as WorkShiftDtoKeyEnum,
      label: label == const $CopyWithPlaceholder()
          ? _value.label
          // ignore: cast_nullable_to_non_nullable
          : label as String,
      start: start == const $CopyWithPlaceholder()
          ? _value.start
          // ignore: cast_nullable_to_non_nullable
          : start as String,
      end: end == const $CopyWithPlaceholder()
          ? _value.end
          // ignore: cast_nullable_to_non_nullable
          : end as String,
    );
  }
}

extension $WorkShiftDtoCopyWith on WorkShiftDto {
  /// Returns a callable class that can be used as follows: `instanceOfWorkShiftDto.copyWith(...)` or like so:`instanceOfWorkShiftDto.copyWith.fieldName(...)`.
  // ignore: library_private_types_in_public_api
  _$WorkShiftDtoCWProxy get copyWith => _$WorkShiftDtoCWProxyImpl(this);
}

// **************************************************************************
// JsonSerializableGenerator
// **************************************************************************

WorkShiftDto _$WorkShiftDtoFromJson(Map<String, dynamic> json) =>
    $checkedCreate('WorkShiftDto', json, ($checkedConvert) {
      $checkKeys(json, requiredKeys: const ['key', 'label', 'start', 'end']);
      final val = WorkShiftDto(
        key: $checkedConvert(
          'key',
          (v) => $enumDecode(
            _$WorkShiftDtoKeyEnumEnumMap,
            v,
            unknownValue: WorkShiftDtoKeyEnum.unknownDefaultOpenApi,
          ),
        ),
        label: $checkedConvert('label', (v) => v as String),
        start: $checkedConvert('start', (v) => v as String),
        end: $checkedConvert('end', (v) => v as String),
      );
      return val;
    });

Map<String, dynamic> _$WorkShiftDtoToJson(WorkShiftDto instance) =>
    <String, dynamic>{
      'key': _$WorkShiftDtoKeyEnumEnumMap[instance.key]!,
      'label': instance.label,
      'start': instance.start,
      'end': instance.end,
    };

const _$WorkShiftDtoKeyEnumEnumMap = {
  WorkShiftDtoKeyEnum.morning: 'morning',
  WorkShiftDtoKeyEnum.afternoon: 'afternoon',
  WorkShiftDtoKeyEnum.unknownDefaultOpenApi: 'unknown_default_open_api',
};

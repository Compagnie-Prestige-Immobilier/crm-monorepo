// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'update_work_shifts_dto.dart';

// **************************************************************************
// CopyWithGenerator
// **************************************************************************

abstract class _$UpdateWorkShiftsDtoCWProxy {
  UpdateWorkShiftsDto morningStart(String morningStart);

  UpdateWorkShiftsDto morningEnd(String morningEnd);

  UpdateWorkShiftsDto afternoonStart(String afternoonStart);

  UpdateWorkShiftsDto afternoonEnd(String afternoonEnd);

  /// This function **does support** nullification of nullable fields. All `null` values passed to `non-nullable` fields will be ignored. You can also use `UpdateWorkShiftsDto(...).copyWith.fieldName(...)` to override fields one at a time with nullification support.
  ///
  /// Usage
  /// ```dart
  /// UpdateWorkShiftsDto(...).copyWith(id: 12, name: "My name")
  /// ````
  UpdateWorkShiftsDto call({
    String morningStart,
    String morningEnd,
    String afternoonStart,
    String afternoonEnd,
  });
}

/// Proxy class for `copyWith` functionality. This is a callable class and can be used as follows: `instanceOfUpdateWorkShiftsDto.copyWith(...)`. Additionally contains functions for specific fields e.g. `instanceOfUpdateWorkShiftsDto.copyWith.fieldName(...)`
class _$UpdateWorkShiftsDtoCWProxyImpl implements _$UpdateWorkShiftsDtoCWProxy {
  const _$UpdateWorkShiftsDtoCWProxyImpl(this._value);

  final UpdateWorkShiftsDto _value;

  @override
  UpdateWorkShiftsDto morningStart(String morningStart) =>
      this(morningStart: morningStart);

  @override
  UpdateWorkShiftsDto morningEnd(String morningEnd) =>
      this(morningEnd: morningEnd);

  @override
  UpdateWorkShiftsDto afternoonStart(String afternoonStart) =>
      this(afternoonStart: afternoonStart);

  @override
  UpdateWorkShiftsDto afternoonEnd(String afternoonEnd) =>
      this(afternoonEnd: afternoonEnd);

  @override
  /// This function **does support** nullification of nullable fields. All `null` values passed to `non-nullable` fields will be ignored. You can also use `UpdateWorkShiftsDto(...).copyWith.fieldName(...)` to override fields one at a time with nullification support.
  ///
  /// Usage
  /// ```dart
  /// UpdateWorkShiftsDto(...).copyWith(id: 12, name: "My name")
  /// ````
  UpdateWorkShiftsDto call({
    Object? morningStart = const $CopyWithPlaceholder(),
    Object? morningEnd = const $CopyWithPlaceholder(),
    Object? afternoonStart = const $CopyWithPlaceholder(),
    Object? afternoonEnd = const $CopyWithPlaceholder(),
  }) {
    return UpdateWorkShiftsDto(
      morningStart: morningStart == const $CopyWithPlaceholder()
          ? _value.morningStart
          // ignore: cast_nullable_to_non_nullable
          : morningStart as String,
      morningEnd: morningEnd == const $CopyWithPlaceholder()
          ? _value.morningEnd
          // ignore: cast_nullable_to_non_nullable
          : morningEnd as String,
      afternoonStart: afternoonStart == const $CopyWithPlaceholder()
          ? _value.afternoonStart
          // ignore: cast_nullable_to_non_nullable
          : afternoonStart as String,
      afternoonEnd: afternoonEnd == const $CopyWithPlaceholder()
          ? _value.afternoonEnd
          // ignore: cast_nullable_to_non_nullable
          : afternoonEnd as String,
    );
  }
}

extension $UpdateWorkShiftsDtoCopyWith on UpdateWorkShiftsDto {
  /// Returns a callable class that can be used as follows: `instanceOfUpdateWorkShiftsDto.copyWith(...)` or like so:`instanceOfUpdateWorkShiftsDto.copyWith.fieldName(...)`.
  // ignore: library_private_types_in_public_api
  _$UpdateWorkShiftsDtoCWProxy get copyWith =>
      _$UpdateWorkShiftsDtoCWProxyImpl(this);
}

// **************************************************************************
// JsonSerializableGenerator
// **************************************************************************

UpdateWorkShiftsDto _$UpdateWorkShiftsDtoFromJson(Map<String, dynamic> json) =>
    $checkedCreate('UpdateWorkShiftsDto', json, ($checkedConvert) {
      $checkKeys(
        json,
        requiredKeys: const [
          'morningStart',
          'morningEnd',
          'afternoonStart',
          'afternoonEnd',
        ],
      );
      final val = UpdateWorkShiftsDto(
        morningStart: $checkedConvert('morningStart', (v) => v as String),
        morningEnd: $checkedConvert('morningEnd', (v) => v as String),
        afternoonStart: $checkedConvert('afternoonStart', (v) => v as String),
        afternoonEnd: $checkedConvert('afternoonEnd', (v) => v as String),
      );
      return val;
    });

Map<String, dynamic> _$UpdateWorkShiftsDtoToJson(
  UpdateWorkShiftsDto instance,
) => <String, dynamic>{
  'morningStart': instance.morningStart,
  'morningEnd': instance.morningEnd,
  'afternoonStart': instance.afternoonStart,
  'afternoonEnd': instance.afternoonEnd,
};

// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'work_shifts_dto.dart';

// **************************************************************************
// CopyWithGenerator
// **************************************************************************

abstract class _$WorkShiftsDtoCWProxy {
  WorkShiftsDto shifts(List<WorkShiftDto> shifts);

  WorkShiftsDto updatedAt(DateTime? updatedAt);

  /// This function **does support** nullification of nullable fields. All `null` values passed to `non-nullable` fields will be ignored. You can also use `WorkShiftsDto(...).copyWith.fieldName(...)` to override fields one at a time with nullification support.
  ///
  /// Usage
  /// ```dart
  /// WorkShiftsDto(...).copyWith(id: 12, name: "My name")
  /// ````
  WorkShiftsDto call({List<WorkShiftDto> shifts, DateTime? updatedAt});
}

/// Proxy class for `copyWith` functionality. This is a callable class and can be used as follows: `instanceOfWorkShiftsDto.copyWith(...)`. Additionally contains functions for specific fields e.g. `instanceOfWorkShiftsDto.copyWith.fieldName(...)`
class _$WorkShiftsDtoCWProxyImpl implements _$WorkShiftsDtoCWProxy {
  const _$WorkShiftsDtoCWProxyImpl(this._value);

  final WorkShiftsDto _value;

  @override
  WorkShiftsDto shifts(List<WorkShiftDto> shifts) => this(shifts: shifts);

  @override
  WorkShiftsDto updatedAt(DateTime? updatedAt) => this(updatedAt: updatedAt);

  @override
  /// This function **does support** nullification of nullable fields. All `null` values passed to `non-nullable` fields will be ignored. You can also use `WorkShiftsDto(...).copyWith.fieldName(...)` to override fields one at a time with nullification support.
  ///
  /// Usage
  /// ```dart
  /// WorkShiftsDto(...).copyWith(id: 12, name: "My name")
  /// ````
  WorkShiftsDto call({
    Object? shifts = const $CopyWithPlaceholder(),
    Object? updatedAt = const $CopyWithPlaceholder(),
  }) {
    return WorkShiftsDto(
      shifts: shifts == const $CopyWithPlaceholder()
          ? _value.shifts
          // ignore: cast_nullable_to_non_nullable
          : shifts as List<WorkShiftDto>,
      updatedAt: updatedAt == const $CopyWithPlaceholder()
          ? _value.updatedAt
          // ignore: cast_nullable_to_non_nullable
          : updatedAt as DateTime?,
    );
  }
}

extension $WorkShiftsDtoCopyWith on WorkShiftsDto {
  /// Returns a callable class that can be used as follows: `instanceOfWorkShiftsDto.copyWith(...)` or like so:`instanceOfWorkShiftsDto.copyWith.fieldName(...)`.
  // ignore: library_private_types_in_public_api
  _$WorkShiftsDtoCWProxy get copyWith => _$WorkShiftsDtoCWProxyImpl(this);
}

// **************************************************************************
// JsonSerializableGenerator
// **************************************************************************

WorkShiftsDto _$WorkShiftsDtoFromJson(Map<String, dynamic> json) =>
    $checkedCreate('WorkShiftsDto', json, ($checkedConvert) {
      $checkKeys(json, requiredKeys: const ['shifts', 'updatedAt']);
      final val = WorkShiftsDto(
        shifts: $checkedConvert(
          'shifts',
          (v) => (v as List<dynamic>)
              .map((e) => WorkShiftDto.fromJson(e as Map<String, dynamic>))
              .toList(),
        ),
        updatedAt: $checkedConvert(
          'updatedAt',
          (v) => v == null ? null : DateTime.parse(v as String),
        ),
      );
      return val;
    });

Map<String, dynamic> _$WorkShiftsDtoToJson(WorkShiftsDto instance) =>
    <String, dynamic>{
      'shifts': instance.shifts.map((e) => e.toJson()).toList(),
      'updatedAt': instance.updatedAt?.toIso8601String(),
    };

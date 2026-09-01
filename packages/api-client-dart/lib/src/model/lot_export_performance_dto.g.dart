// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'lot_export_performance_dto.dart';

// **************************************************************************
// CopyWithGenerator
// **************************************************************************

abstract class _$LotExportPerformanceDtoCWProxy {
  LotExportPerformanceDto teleconseillerId(String teleconseillerId);

  LotExportPerformanceDto teleconseillerName(String teleconseillerName);

  LotExportPerformanceDto assigned(num assigned);

  LotExportPerformanceDto treated(num treated);

  LotExportPerformanceDto completionRate(num completionRate);

  LotExportPerformanceDto assignedCalls(num assignedCalls);

  LotExportPerformanceDto outsideAssignmentCalls(num outsideAssignmentCalls);

  /// This function **does support** nullification of nullable fields. All `null` values passed to `non-nullable` fields will be ignored. You can also use `LotExportPerformanceDto(...).copyWith.fieldName(...)` to override fields one at a time with nullification support.
  ///
  /// Usage
  /// ```dart
  /// LotExportPerformanceDto(...).copyWith(id: 12, name: "My name")
  /// ````
  LotExportPerformanceDto call({
    String teleconseillerId,
    String teleconseillerName,
    num assigned,
    num treated,
    num completionRate,
    num assignedCalls,
    num outsideAssignmentCalls,
  });
}

/// Proxy class for `copyWith` functionality. This is a callable class and can be used as follows: `instanceOfLotExportPerformanceDto.copyWith(...)`. Additionally contains functions for specific fields e.g. `instanceOfLotExportPerformanceDto.copyWith.fieldName(...)`
class _$LotExportPerformanceDtoCWProxyImpl
    implements _$LotExportPerformanceDtoCWProxy {
  const _$LotExportPerformanceDtoCWProxyImpl(this._value);

  final LotExportPerformanceDto _value;

  @override
  LotExportPerformanceDto teleconseillerId(String teleconseillerId) =>
      this(teleconseillerId: teleconseillerId);

  @override
  LotExportPerformanceDto teleconseillerName(String teleconseillerName) =>
      this(teleconseillerName: teleconseillerName);

  @override
  LotExportPerformanceDto assigned(num assigned) => this(assigned: assigned);

  @override
  LotExportPerformanceDto treated(num treated) => this(treated: treated);

  @override
  LotExportPerformanceDto completionRate(num completionRate) =>
      this(completionRate: completionRate);

  @override
  LotExportPerformanceDto assignedCalls(num assignedCalls) =>
      this(assignedCalls: assignedCalls);

  @override
  LotExportPerformanceDto outsideAssignmentCalls(num outsideAssignmentCalls) =>
      this(outsideAssignmentCalls: outsideAssignmentCalls);

  @override
  /// This function **does support** nullification of nullable fields. All `null` values passed to `non-nullable` fields will be ignored. You can also use `LotExportPerformanceDto(...).copyWith.fieldName(...)` to override fields one at a time with nullification support.
  ///
  /// Usage
  /// ```dart
  /// LotExportPerformanceDto(...).copyWith(id: 12, name: "My name")
  /// ````
  LotExportPerformanceDto call({
    Object? teleconseillerId = const $CopyWithPlaceholder(),
    Object? teleconseillerName = const $CopyWithPlaceholder(),
    Object? assigned = const $CopyWithPlaceholder(),
    Object? treated = const $CopyWithPlaceholder(),
    Object? completionRate = const $CopyWithPlaceholder(),
    Object? assignedCalls = const $CopyWithPlaceholder(),
    Object? outsideAssignmentCalls = const $CopyWithPlaceholder(),
  }) {
    return LotExportPerformanceDto(
      teleconseillerId: teleconseillerId == const $CopyWithPlaceholder()
          ? _value.teleconseillerId
          // ignore: cast_nullable_to_non_nullable
          : teleconseillerId as String,
      teleconseillerName: teleconseillerName == const $CopyWithPlaceholder()
          ? _value.teleconseillerName
          // ignore: cast_nullable_to_non_nullable
          : teleconseillerName as String,
      assigned: assigned == const $CopyWithPlaceholder()
          ? _value.assigned
          // ignore: cast_nullable_to_non_nullable
          : assigned as num,
      treated: treated == const $CopyWithPlaceholder()
          ? _value.treated
          // ignore: cast_nullable_to_non_nullable
          : treated as num,
      completionRate: completionRate == const $CopyWithPlaceholder()
          ? _value.completionRate
          // ignore: cast_nullable_to_non_nullable
          : completionRate as num,
      assignedCalls: assignedCalls == const $CopyWithPlaceholder()
          ? _value.assignedCalls
          // ignore: cast_nullable_to_non_nullable
          : assignedCalls as num,
      outsideAssignmentCalls:
          outsideAssignmentCalls == const $CopyWithPlaceholder()
          ? _value.outsideAssignmentCalls
          // ignore: cast_nullable_to_non_nullable
          : outsideAssignmentCalls as num,
    );
  }
}

extension $LotExportPerformanceDtoCopyWith on LotExportPerformanceDto {
  /// Returns a callable class that can be used as follows: `instanceOfLotExportPerformanceDto.copyWith(...)` or like so:`instanceOfLotExportPerformanceDto.copyWith.fieldName(...)`.
  // ignore: library_private_types_in_public_api
  _$LotExportPerformanceDtoCWProxy get copyWith =>
      _$LotExportPerformanceDtoCWProxyImpl(this);
}

// **************************************************************************
// JsonSerializableGenerator
// **************************************************************************

LotExportPerformanceDto _$LotExportPerformanceDtoFromJson(
  Map<String, dynamic> json,
) => $checkedCreate('LotExportPerformanceDto', json, ($checkedConvert) {
  $checkKeys(
    json,
    requiredKeys: const [
      'teleconseillerId',
      'teleconseillerName',
      'assigned',
      'treated',
      'completionRate',
      'assignedCalls',
      'outsideAssignmentCalls',
    ],
  );
  final val = LotExportPerformanceDto(
    teleconseillerId: $checkedConvert('teleconseillerId', (v) => v as String),
    teleconseillerName: $checkedConvert(
      'teleconseillerName',
      (v) => v as String,
    ),
    assigned: $checkedConvert('assigned', (v) => v as num),
    treated: $checkedConvert('treated', (v) => v as num),
    completionRate: $checkedConvert('completionRate', (v) => v as num),
    assignedCalls: $checkedConvert('assignedCalls', (v) => v as num),
    outsideAssignmentCalls: $checkedConvert(
      'outsideAssignmentCalls',
      (v) => v as num,
    ),
  );
  return val;
});

Map<String, dynamic> _$LotExportPerformanceDtoToJson(
  LotExportPerformanceDto instance,
) => <String, dynamic>{
  'teleconseillerId': instance.teleconseillerId,
  'teleconseillerName': instance.teleconseillerName,
  'assigned': instance.assigned,
  'treated': instance.treated,
  'completionRate': instance.completionRate,
  'assignedCalls': instance.assignedCalls,
  'outsideAssignmentCalls': instance.outsideAssignmentCalls,
};

// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'sync_call_task_dto.dart';

// **************************************************************************
// CopyWithGenerator
// **************************************************************************

abstract class _$SyncCallTaskDtoCWProxy {
  SyncCallTaskDto id(String id);

  SyncCallTaskDto campaignId(String campaignId);

  SyncCallTaskDto prospectId(String prospectId);

  SyncCallTaskDto position(num position);

  SyncCallTaskDto dayIndex(num dayIndex);

  SyncCallTaskDto status(CallTaskStatus status);

  SyncCallTaskDto isActive(bool isActive);

  SyncCallTaskDto updatedAt(DateTime updatedAt);

  /// This function **does support** nullification of nullable fields. All `null` values passed to `non-nullable` fields will be ignored. You can also use `SyncCallTaskDto(...).copyWith.fieldName(...)` to override fields one at a time with nullification support.
  ///
  /// Usage
  /// ```dart
  /// SyncCallTaskDto(...).copyWith(id: 12, name: "My name")
  /// ````
  SyncCallTaskDto call({
    String id,
    String campaignId,
    String prospectId,
    num position,
    num dayIndex,
    CallTaskStatus status,
    bool isActive,
    DateTime updatedAt,
  });
}

/// Proxy class for `copyWith` functionality. This is a callable class and can be used as follows: `instanceOfSyncCallTaskDto.copyWith(...)`. Additionally contains functions for specific fields e.g. `instanceOfSyncCallTaskDto.copyWith.fieldName(...)`
class _$SyncCallTaskDtoCWProxyImpl implements _$SyncCallTaskDtoCWProxy {
  const _$SyncCallTaskDtoCWProxyImpl(this._value);

  final SyncCallTaskDto _value;

  @override
  SyncCallTaskDto id(String id) => this(id: id);

  @override
  SyncCallTaskDto campaignId(String campaignId) => this(campaignId: campaignId);

  @override
  SyncCallTaskDto prospectId(String prospectId) => this(prospectId: prospectId);

  @override
  SyncCallTaskDto position(num position) => this(position: position);

  @override
  SyncCallTaskDto dayIndex(num dayIndex) => this(dayIndex: dayIndex);

  @override
  SyncCallTaskDto status(CallTaskStatus status) => this(status: status);

  @override
  SyncCallTaskDto isActive(bool isActive) => this(isActive: isActive);

  @override
  SyncCallTaskDto updatedAt(DateTime updatedAt) => this(updatedAt: updatedAt);

  @override
  /// This function **does support** nullification of nullable fields. All `null` values passed to `non-nullable` fields will be ignored. You can also use `SyncCallTaskDto(...).copyWith.fieldName(...)` to override fields one at a time with nullification support.
  ///
  /// Usage
  /// ```dart
  /// SyncCallTaskDto(...).copyWith(id: 12, name: "My name")
  /// ````
  SyncCallTaskDto call({
    Object? id = const $CopyWithPlaceholder(),
    Object? campaignId = const $CopyWithPlaceholder(),
    Object? prospectId = const $CopyWithPlaceholder(),
    Object? position = const $CopyWithPlaceholder(),
    Object? dayIndex = const $CopyWithPlaceholder(),
    Object? status = const $CopyWithPlaceholder(),
    Object? isActive = const $CopyWithPlaceholder(),
    Object? updatedAt = const $CopyWithPlaceholder(),
  }) {
    return SyncCallTaskDto(
      id: id == const $CopyWithPlaceholder()
          ? _value.id
          // ignore: cast_nullable_to_non_nullable
          : id as String,
      campaignId: campaignId == const $CopyWithPlaceholder()
          ? _value.campaignId
          // ignore: cast_nullable_to_non_nullable
          : campaignId as String,
      prospectId: prospectId == const $CopyWithPlaceholder()
          ? _value.prospectId
          // ignore: cast_nullable_to_non_nullable
          : prospectId as String,
      position: position == const $CopyWithPlaceholder()
          ? _value.position
          // ignore: cast_nullable_to_non_nullable
          : position as num,
      dayIndex: dayIndex == const $CopyWithPlaceholder()
          ? _value.dayIndex
          // ignore: cast_nullable_to_non_nullable
          : dayIndex as num,
      status: status == const $CopyWithPlaceholder()
          ? _value.status
          // ignore: cast_nullable_to_non_nullable
          : status as CallTaskStatus,
      isActive: isActive == const $CopyWithPlaceholder()
          ? _value.isActive
          // ignore: cast_nullable_to_non_nullable
          : isActive as bool,
      updatedAt: updatedAt == const $CopyWithPlaceholder()
          ? _value.updatedAt
          // ignore: cast_nullable_to_non_nullable
          : updatedAt as DateTime,
    );
  }
}

extension $SyncCallTaskDtoCopyWith on SyncCallTaskDto {
  /// Returns a callable class that can be used as follows: `instanceOfSyncCallTaskDto.copyWith(...)` or like so:`instanceOfSyncCallTaskDto.copyWith.fieldName(...)`.
  // ignore: library_private_types_in_public_api
  _$SyncCallTaskDtoCWProxy get copyWith => _$SyncCallTaskDtoCWProxyImpl(this);
}

// **************************************************************************
// JsonSerializableGenerator
// **************************************************************************

SyncCallTaskDto _$SyncCallTaskDtoFromJson(Map<String, dynamic> json) =>
    $checkedCreate('SyncCallTaskDto', json, ($checkedConvert) {
      $checkKeys(
        json,
        requiredKeys: const [
          'id',
          'campaignId',
          'prospectId',
          'position',
          'dayIndex',
          'status',
          'isActive',
          'updatedAt',
        ],
      );
      final val = SyncCallTaskDto(
        id: $checkedConvert('id', (v) => v as String),
        campaignId: $checkedConvert('campaignId', (v) => v as String),
        prospectId: $checkedConvert('prospectId', (v) => v as String),
        position: $checkedConvert('position', (v) => v as num),
        dayIndex: $checkedConvert('dayIndex', (v) => v as num),
        status: $checkedConvert(
          'status',
          (v) => $enumDecode(
            _$CallTaskStatusEnumMap,
            v,
            unknownValue: CallTaskStatus.unknownDefaultOpenApi,
          ),
        ),
        isActive: $checkedConvert('isActive', (v) => v as bool),
        updatedAt: $checkedConvert(
          'updatedAt',
          (v) => DateTime.parse(v as String),
        ),
      );
      return val;
    });

Map<String, dynamic> _$SyncCallTaskDtoToJson(SyncCallTaskDto instance) =>
    <String, dynamic>{
      'id': instance.id,
      'campaignId': instance.campaignId,
      'prospectId': instance.prospectId,
      'position': instance.position,
      'dayIndex': instance.dayIndex,
      'status': _$CallTaskStatusEnumMap[instance.status]!,
      'isActive': instance.isActive,
      'updatedAt': instance.updatedAt.toIso8601String(),
    };

const _$CallTaskStatusEnumMap = {
  CallTaskStatus.OPEN: 'OPEN',
  CallTaskStatus.DONE: 'DONE',
  CallTaskStatus.CANCELLED: 'CANCELLED',
  CallTaskStatus.unknownDefaultOpenApi: 'unknown_default_open_api',
};

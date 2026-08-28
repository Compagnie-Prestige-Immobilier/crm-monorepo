// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'sync_rep_call_task_dto.dart';

// **************************************************************************
// CopyWithGenerator
// **************************************************************************

abstract class _$SyncRepCallTaskDtoCWProxy {
  SyncRepCallTaskDto id(String id);

  SyncRepCallTaskDto campaignId(String campaignId);

  SyncRepCallTaskDto representantId(String representantId);

  SyncRepCallTaskDto position(num position);

  SyncRepCallTaskDto dayIndex(num dayIndex);

  SyncRepCallTaskDto status(CallTaskStatus status);

  SyncRepCallTaskDto isActive(bool isActive);

  SyncRepCallTaskDto updatedAt(DateTime updatedAt);

  /// This function **does support** nullification of nullable fields. All `null` values passed to `non-nullable` fields will be ignored. You can also use `SyncRepCallTaskDto(...).copyWith.fieldName(...)` to override fields one at a time with nullification support.
  ///
  /// Usage
  /// ```dart
  /// SyncRepCallTaskDto(...).copyWith(id: 12, name: "My name")
  /// ````
  SyncRepCallTaskDto call({
    String id,
    String campaignId,
    String representantId,
    num position,
    num dayIndex,
    CallTaskStatus status,
    bool isActive,
    DateTime updatedAt,
  });
}

/// Proxy class for `copyWith` functionality. This is a callable class and can be used as follows: `instanceOfSyncRepCallTaskDto.copyWith(...)`. Additionally contains functions for specific fields e.g. `instanceOfSyncRepCallTaskDto.copyWith.fieldName(...)`
class _$SyncRepCallTaskDtoCWProxyImpl implements _$SyncRepCallTaskDtoCWProxy {
  const _$SyncRepCallTaskDtoCWProxyImpl(this._value);

  final SyncRepCallTaskDto _value;

  @override
  SyncRepCallTaskDto id(String id) => this(id: id);

  @override
  SyncRepCallTaskDto campaignId(String campaignId) =>
      this(campaignId: campaignId);

  @override
  SyncRepCallTaskDto representantId(String representantId) =>
      this(representantId: representantId);

  @override
  SyncRepCallTaskDto position(num position) => this(position: position);

  @override
  SyncRepCallTaskDto dayIndex(num dayIndex) => this(dayIndex: dayIndex);

  @override
  SyncRepCallTaskDto status(CallTaskStatus status) => this(status: status);

  @override
  SyncRepCallTaskDto isActive(bool isActive) => this(isActive: isActive);

  @override
  SyncRepCallTaskDto updatedAt(DateTime updatedAt) =>
      this(updatedAt: updatedAt);

  @override
  /// This function **does support** nullification of nullable fields. All `null` values passed to `non-nullable` fields will be ignored. You can also use `SyncRepCallTaskDto(...).copyWith.fieldName(...)` to override fields one at a time with nullification support.
  ///
  /// Usage
  /// ```dart
  /// SyncRepCallTaskDto(...).copyWith(id: 12, name: "My name")
  /// ````
  SyncRepCallTaskDto call({
    Object? id = const $CopyWithPlaceholder(),
    Object? campaignId = const $CopyWithPlaceholder(),
    Object? representantId = const $CopyWithPlaceholder(),
    Object? position = const $CopyWithPlaceholder(),
    Object? dayIndex = const $CopyWithPlaceholder(),
    Object? status = const $CopyWithPlaceholder(),
    Object? isActive = const $CopyWithPlaceholder(),
    Object? updatedAt = const $CopyWithPlaceholder(),
  }) {
    return SyncRepCallTaskDto(
      id: id == const $CopyWithPlaceholder()
          ? _value.id
          // ignore: cast_nullable_to_non_nullable
          : id as String,
      campaignId: campaignId == const $CopyWithPlaceholder()
          ? _value.campaignId
          // ignore: cast_nullable_to_non_nullable
          : campaignId as String,
      representantId: representantId == const $CopyWithPlaceholder()
          ? _value.representantId
          // ignore: cast_nullable_to_non_nullable
          : representantId as String,
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

extension $SyncRepCallTaskDtoCopyWith on SyncRepCallTaskDto {
  /// Returns a callable class that can be used as follows: `instanceOfSyncRepCallTaskDto.copyWith(...)` or like so:`instanceOfSyncRepCallTaskDto.copyWith.fieldName(...)`.
  // ignore: library_private_types_in_public_api
  _$SyncRepCallTaskDtoCWProxy get copyWith =>
      _$SyncRepCallTaskDtoCWProxyImpl(this);
}

// **************************************************************************
// JsonSerializableGenerator
// **************************************************************************

SyncRepCallTaskDto _$SyncRepCallTaskDtoFromJson(Map<String, dynamic> json) =>
    $checkedCreate('SyncRepCallTaskDto', json, ($checkedConvert) {
      $checkKeys(
        json,
        requiredKeys: const [
          'id',
          'campaignId',
          'representantId',
          'position',
          'dayIndex',
          'status',
          'isActive',
          'updatedAt',
        ],
      );
      final val = SyncRepCallTaskDto(
        id: $checkedConvert('id', (v) => v as String),
        campaignId: $checkedConvert('campaignId', (v) => v as String),
        representantId: $checkedConvert('representantId', (v) => v as String),
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

Map<String, dynamic> _$SyncRepCallTaskDtoToJson(SyncRepCallTaskDto instance) =>
    <String, dynamic>{
      'id': instance.id,
      'campaignId': instance.campaignId,
      'representantId': instance.representantId,
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

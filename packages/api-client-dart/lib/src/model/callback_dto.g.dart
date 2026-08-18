// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'callback_dto.dart';

// **************************************************************************
// CopyWithGenerator
// **************************************************************************

abstract class _$CallbackDtoCWProxy {
  CallbackDto id(String id);

  CallbackDto prospectId(String prospectId);

  CallbackDto shortCode(String shortCode);

  CallbackDto phoneE164(String phoneE164);

  CallbackDto scheduledAt(DateTime scheduledAt);

  CallbackDto comment(String? comment);

  CallbackDto assignedToId(String assignedToId);

  CallbackDto assignedToName(String assignedToName);

  CallbackDto campaignId(String? campaignId);

  CallbackDto taskId(String? taskId);

  CallbackDto overdue(bool overdue);

  /// This function **does support** nullification of nullable fields. All `null` values passed to `non-nullable` fields will be ignored. You can also use `CallbackDto(...).copyWith.fieldName(...)` to override fields one at a time with nullification support.
  ///
  /// Usage
  /// ```dart
  /// CallbackDto(...).copyWith(id: 12, name: "My name")
  /// ````
  CallbackDto call({
    String id,
    String prospectId,
    String shortCode,
    String phoneE164,
    DateTime scheduledAt,
    String? comment,
    String assignedToId,
    String assignedToName,
    String? campaignId,
    String? taskId,
    bool overdue,
  });
}

/// Proxy class for `copyWith` functionality. This is a callable class and can be used as follows: `instanceOfCallbackDto.copyWith(...)`. Additionally contains functions for specific fields e.g. `instanceOfCallbackDto.copyWith.fieldName(...)`
class _$CallbackDtoCWProxyImpl implements _$CallbackDtoCWProxy {
  const _$CallbackDtoCWProxyImpl(this._value);

  final CallbackDto _value;

  @override
  CallbackDto id(String id) => this(id: id);

  @override
  CallbackDto prospectId(String prospectId) => this(prospectId: prospectId);

  @override
  CallbackDto shortCode(String shortCode) => this(shortCode: shortCode);

  @override
  CallbackDto phoneE164(String phoneE164) => this(phoneE164: phoneE164);

  @override
  CallbackDto scheduledAt(DateTime scheduledAt) =>
      this(scheduledAt: scheduledAt);

  @override
  CallbackDto comment(String? comment) => this(comment: comment);

  @override
  CallbackDto assignedToId(String assignedToId) =>
      this(assignedToId: assignedToId);

  @override
  CallbackDto assignedToName(String assignedToName) =>
      this(assignedToName: assignedToName);

  @override
  CallbackDto campaignId(String? campaignId) => this(campaignId: campaignId);

  @override
  CallbackDto taskId(String? taskId) => this(taskId: taskId);

  @override
  CallbackDto overdue(bool overdue) => this(overdue: overdue);

  @override
  /// This function **does support** nullification of nullable fields. All `null` values passed to `non-nullable` fields will be ignored. You can also use `CallbackDto(...).copyWith.fieldName(...)` to override fields one at a time with nullification support.
  ///
  /// Usage
  /// ```dart
  /// CallbackDto(...).copyWith(id: 12, name: "My name")
  /// ````
  CallbackDto call({
    Object? id = const $CopyWithPlaceholder(),
    Object? prospectId = const $CopyWithPlaceholder(),
    Object? shortCode = const $CopyWithPlaceholder(),
    Object? phoneE164 = const $CopyWithPlaceholder(),
    Object? scheduledAt = const $CopyWithPlaceholder(),
    Object? comment = const $CopyWithPlaceholder(),
    Object? assignedToId = const $CopyWithPlaceholder(),
    Object? assignedToName = const $CopyWithPlaceholder(),
    Object? campaignId = const $CopyWithPlaceholder(),
    Object? taskId = const $CopyWithPlaceholder(),
    Object? overdue = const $CopyWithPlaceholder(),
  }) {
    return CallbackDto(
      id: id == const $CopyWithPlaceholder()
          ? _value.id
          // ignore: cast_nullable_to_non_nullable
          : id as String,
      prospectId: prospectId == const $CopyWithPlaceholder()
          ? _value.prospectId
          // ignore: cast_nullable_to_non_nullable
          : prospectId as String,
      shortCode: shortCode == const $CopyWithPlaceholder()
          ? _value.shortCode
          // ignore: cast_nullable_to_non_nullable
          : shortCode as String,
      phoneE164: phoneE164 == const $CopyWithPlaceholder()
          ? _value.phoneE164
          // ignore: cast_nullable_to_non_nullable
          : phoneE164 as String,
      scheduledAt: scheduledAt == const $CopyWithPlaceholder()
          ? _value.scheduledAt
          // ignore: cast_nullable_to_non_nullable
          : scheduledAt as DateTime,
      comment: comment == const $CopyWithPlaceholder()
          ? _value.comment
          // ignore: cast_nullable_to_non_nullable
          : comment as String?,
      assignedToId: assignedToId == const $CopyWithPlaceholder()
          ? _value.assignedToId
          // ignore: cast_nullable_to_non_nullable
          : assignedToId as String,
      assignedToName: assignedToName == const $CopyWithPlaceholder()
          ? _value.assignedToName
          // ignore: cast_nullable_to_non_nullable
          : assignedToName as String,
      campaignId: campaignId == const $CopyWithPlaceholder()
          ? _value.campaignId
          // ignore: cast_nullable_to_non_nullable
          : campaignId as String?,
      taskId: taskId == const $CopyWithPlaceholder()
          ? _value.taskId
          // ignore: cast_nullable_to_non_nullable
          : taskId as String?,
      overdue: overdue == const $CopyWithPlaceholder()
          ? _value.overdue
          // ignore: cast_nullable_to_non_nullable
          : overdue as bool,
    );
  }
}

extension $CallbackDtoCopyWith on CallbackDto {
  /// Returns a callable class that can be used as follows: `instanceOfCallbackDto.copyWith(...)` or like so:`instanceOfCallbackDto.copyWith.fieldName(...)`.
  // ignore: library_private_types_in_public_api
  _$CallbackDtoCWProxy get copyWith => _$CallbackDtoCWProxyImpl(this);
}

// **************************************************************************
// JsonSerializableGenerator
// **************************************************************************

CallbackDto _$CallbackDtoFromJson(Map<String, dynamic> json) =>
    $checkedCreate('CallbackDto', json, ($checkedConvert) {
      $checkKeys(
        json,
        requiredKeys: const [
          'id',
          'prospectId',
          'shortCode',
          'phoneE164',
          'scheduledAt',
          'comment',
          'assignedToId',
          'assignedToName',
          'campaignId',
          'taskId',
          'overdue',
        ],
      );
      final val = CallbackDto(
        id: $checkedConvert('id', (v) => v as String),
        prospectId: $checkedConvert('prospectId', (v) => v as String),
        shortCode: $checkedConvert('shortCode', (v) => v as String),
        phoneE164: $checkedConvert('phoneE164', (v) => v as String),
        scheduledAt: $checkedConvert(
          'scheduledAt',
          (v) => DateTime.parse(v as String),
        ),
        comment: $checkedConvert('comment', (v) => v as String?),
        assignedToId: $checkedConvert('assignedToId', (v) => v as String),
        assignedToName: $checkedConvert('assignedToName', (v) => v as String),
        campaignId: $checkedConvert('campaignId', (v) => v as String?),
        taskId: $checkedConvert('taskId', (v) => v as String?),
        overdue: $checkedConvert('overdue', (v) => v as bool),
      );
      return val;
    });

Map<String, dynamic> _$CallbackDtoToJson(CallbackDto instance) =>
    <String, dynamic>{
      'id': instance.id,
      'prospectId': instance.prospectId,
      'shortCode': instance.shortCode,
      'phoneE164': instance.phoneE164,
      'scheduledAt': instance.scheduledAt.toIso8601String(),
      'comment': instance.comment,
      'assignedToId': instance.assignedToId,
      'assignedToName': instance.assignedToName,
      'campaignId': instance.campaignId,
      'taskId': instance.taskId,
      'overdue': instance.overdue,
    };

// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'rep_call_attempt_result_dto.dart';

// **************************************************************************
// CopyWithGenerator
// **************************************************************************

abstract class _$RepCallAttemptResultDtoCWProxy {
  RepCallAttemptResultDto status(RepCallAttemptApplyStatus status);

  RepCallAttemptResultDto attemptId(String attemptId);

  RepCallAttemptResultDto taskId(String? taskId);

  RepCallAttemptResultDto taskClosed(bool taskClosed);

  RepCallAttemptResultDto suggestion(RepresentantLookupDto? suggestion);

  /// This function **does support** nullification of nullable fields. All `null` values passed to `non-nullable` fields will be ignored. You can also use `RepCallAttemptResultDto(...).copyWith.fieldName(...)` to override fields one at a time with nullification support.
  ///
  /// Usage
  /// ```dart
  /// RepCallAttemptResultDto(...).copyWith(id: 12, name: "My name")
  /// ````
  RepCallAttemptResultDto call({
    RepCallAttemptApplyStatus status,
    String attemptId,
    String? taskId,
    bool taskClosed,
    RepresentantLookupDto? suggestion,
  });
}

/// Proxy class for `copyWith` functionality. This is a callable class and can be used as follows: `instanceOfRepCallAttemptResultDto.copyWith(...)`. Additionally contains functions for specific fields e.g. `instanceOfRepCallAttemptResultDto.copyWith.fieldName(...)`
class _$RepCallAttemptResultDtoCWProxyImpl
    implements _$RepCallAttemptResultDtoCWProxy {
  const _$RepCallAttemptResultDtoCWProxyImpl(this._value);

  final RepCallAttemptResultDto _value;

  @override
  RepCallAttemptResultDto status(RepCallAttemptApplyStatus status) =>
      this(status: status);

  @override
  RepCallAttemptResultDto attemptId(String attemptId) =>
      this(attemptId: attemptId);

  @override
  RepCallAttemptResultDto taskId(String? taskId) => this(taskId: taskId);

  @override
  RepCallAttemptResultDto taskClosed(bool taskClosed) =>
      this(taskClosed: taskClosed);

  @override
  RepCallAttemptResultDto suggestion(RepresentantLookupDto? suggestion) =>
      this(suggestion: suggestion);

  @override
  /// This function **does support** nullification of nullable fields. All `null` values passed to `non-nullable` fields will be ignored. You can also use `RepCallAttemptResultDto(...).copyWith.fieldName(...)` to override fields one at a time with nullification support.
  ///
  /// Usage
  /// ```dart
  /// RepCallAttemptResultDto(...).copyWith(id: 12, name: "My name")
  /// ````
  RepCallAttemptResultDto call({
    Object? status = const $CopyWithPlaceholder(),
    Object? attemptId = const $CopyWithPlaceholder(),
    Object? taskId = const $CopyWithPlaceholder(),
    Object? taskClosed = const $CopyWithPlaceholder(),
    Object? suggestion = const $CopyWithPlaceholder(),
  }) {
    return RepCallAttemptResultDto(
      status: status == const $CopyWithPlaceholder()
          ? _value.status
          // ignore: cast_nullable_to_non_nullable
          : status as RepCallAttemptApplyStatus,
      attemptId: attemptId == const $CopyWithPlaceholder()
          ? _value.attemptId
          // ignore: cast_nullable_to_non_nullable
          : attemptId as String,
      taskId: taskId == const $CopyWithPlaceholder()
          ? _value.taskId
          // ignore: cast_nullable_to_non_nullable
          : taskId as String?,
      taskClosed: taskClosed == const $CopyWithPlaceholder()
          ? _value.taskClosed
          // ignore: cast_nullable_to_non_nullable
          : taskClosed as bool,
      suggestion: suggestion == const $CopyWithPlaceholder()
          ? _value.suggestion
          // ignore: cast_nullable_to_non_nullable
          : suggestion as RepresentantLookupDto?,
    );
  }
}

extension $RepCallAttemptResultDtoCopyWith on RepCallAttemptResultDto {
  /// Returns a callable class that can be used as follows: `instanceOfRepCallAttemptResultDto.copyWith(...)` or like so:`instanceOfRepCallAttemptResultDto.copyWith.fieldName(...)`.
  // ignore: library_private_types_in_public_api
  _$RepCallAttemptResultDtoCWProxy get copyWith =>
      _$RepCallAttemptResultDtoCWProxyImpl(this);
}

// **************************************************************************
// JsonSerializableGenerator
// **************************************************************************

RepCallAttemptResultDto _$RepCallAttemptResultDtoFromJson(
  Map<String, dynamic> json,
) => $checkedCreate('RepCallAttemptResultDto', json, ($checkedConvert) {
  $checkKeys(
    json,
    requiredKeys: const [
      'status',
      'attemptId',
      'taskId',
      'taskClosed',
      'suggestion',
    ],
  );
  final val = RepCallAttemptResultDto(
    status: $checkedConvert(
      'status',
      (v) => $enumDecode(
        _$RepCallAttemptApplyStatusEnumMap,
        v,
        unknownValue: RepCallAttemptApplyStatus.unknownDefaultOpenApi,
      ),
    ),
    attemptId: $checkedConvert('attemptId', (v) => v as String),
    taskId: $checkedConvert('taskId', (v) => v as String?),
    taskClosed: $checkedConvert('taskClosed', (v) => v as bool),
    suggestion: $checkedConvert(
      'suggestion',
      (v) => v == null
          ? null
          : RepresentantLookupDto.fromJson(v as Map<String, dynamic>),
    ),
  );
  return val;
});

Map<String, dynamic> _$RepCallAttemptResultDtoToJson(
  RepCallAttemptResultDto instance,
) => <String, dynamic>{
  'status': _$RepCallAttemptApplyStatusEnumMap[instance.status]!,
  'attemptId': instance.attemptId,
  'taskId': instance.taskId,
  'taskClosed': instance.taskClosed,
  'suggestion': instance.suggestion?.toJson(),
};

const _$RepCallAttemptApplyStatusEnumMap = {
  RepCallAttemptApplyStatus.applied: 'applied',
  RepCallAttemptApplyStatus.duplicate: 'duplicate',
  RepCallAttemptApplyStatus.unknownDefaultOpenApi: 'unknown_default_open_api',
};

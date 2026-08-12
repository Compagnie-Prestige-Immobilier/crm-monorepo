// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'sync_operation_result_dto.dart';

// **************************************************************************
// CopyWithGenerator
// **************************************************************************

abstract class _$SyncOperationResultDtoCWProxy {
  SyncOperationResultDto opId(String opId);

  SyncOperationResultDto status(SyncOpStatus status);

  SyncOperationResultDto entityId(String? entityId);

  SyncOperationResultDto rev(num? rev);

  SyncOperationResultDto serverUpdatedAt(DateTime? serverUpdatedAt);

  SyncOperationResultDto errorCode(String? errorCode);

  SyncOperationResultDto error(String? error);

  /// This function **does support** nullification of nullable fields. All `null` values passed to `non-nullable` fields will be ignored. You can also use `SyncOperationResultDto(...).copyWith.fieldName(...)` to override fields one at a time with nullification support.
  ///
  /// Usage
  /// ```dart
  /// SyncOperationResultDto(...).copyWith(id: 12, name: "My name")
  /// ````
  SyncOperationResultDto call({
    String opId,
    SyncOpStatus status,
    String? entityId,
    num? rev,
    DateTime? serverUpdatedAt,
    String? errorCode,
    String? error,
  });
}

/// Proxy class for `copyWith` functionality. This is a callable class and can be used as follows: `instanceOfSyncOperationResultDto.copyWith(...)`. Additionally contains functions for specific fields e.g. `instanceOfSyncOperationResultDto.copyWith.fieldName(...)`
class _$SyncOperationResultDtoCWProxyImpl
    implements _$SyncOperationResultDtoCWProxy {
  const _$SyncOperationResultDtoCWProxyImpl(this._value);

  final SyncOperationResultDto _value;

  @override
  SyncOperationResultDto opId(String opId) => this(opId: opId);

  @override
  SyncOperationResultDto status(SyncOpStatus status) => this(status: status);

  @override
  SyncOperationResultDto entityId(String? entityId) => this(entityId: entityId);

  @override
  SyncOperationResultDto rev(num? rev) => this(rev: rev);

  @override
  SyncOperationResultDto serverUpdatedAt(DateTime? serverUpdatedAt) =>
      this(serverUpdatedAt: serverUpdatedAt);

  @override
  SyncOperationResultDto errorCode(String? errorCode) =>
      this(errorCode: errorCode);

  @override
  SyncOperationResultDto error(String? error) => this(error: error);

  @override
  /// This function **does support** nullification of nullable fields. All `null` values passed to `non-nullable` fields will be ignored. You can also use `SyncOperationResultDto(...).copyWith.fieldName(...)` to override fields one at a time with nullification support.
  ///
  /// Usage
  /// ```dart
  /// SyncOperationResultDto(...).copyWith(id: 12, name: "My name")
  /// ````
  SyncOperationResultDto call({
    Object? opId = const $CopyWithPlaceholder(),
    Object? status = const $CopyWithPlaceholder(),
    Object? entityId = const $CopyWithPlaceholder(),
    Object? rev = const $CopyWithPlaceholder(),
    Object? serverUpdatedAt = const $CopyWithPlaceholder(),
    Object? errorCode = const $CopyWithPlaceholder(),
    Object? error = const $CopyWithPlaceholder(),
  }) {
    return SyncOperationResultDto(
      opId: opId == const $CopyWithPlaceholder()
          ? _value.opId
          // ignore: cast_nullable_to_non_nullable
          : opId as String,
      status: status == const $CopyWithPlaceholder()
          ? _value.status
          // ignore: cast_nullable_to_non_nullable
          : status as SyncOpStatus,
      entityId: entityId == const $CopyWithPlaceholder()
          ? _value.entityId
          // ignore: cast_nullable_to_non_nullable
          : entityId as String?,
      rev: rev == const $CopyWithPlaceholder()
          ? _value.rev
          // ignore: cast_nullable_to_non_nullable
          : rev as num?,
      serverUpdatedAt: serverUpdatedAt == const $CopyWithPlaceholder()
          ? _value.serverUpdatedAt
          // ignore: cast_nullable_to_non_nullable
          : serverUpdatedAt as DateTime?,
      errorCode: errorCode == const $CopyWithPlaceholder()
          ? _value.errorCode
          // ignore: cast_nullable_to_non_nullable
          : errorCode as String?,
      error: error == const $CopyWithPlaceholder()
          ? _value.error
          // ignore: cast_nullable_to_non_nullable
          : error as String?,
    );
  }
}

extension $SyncOperationResultDtoCopyWith on SyncOperationResultDto {
  /// Returns a callable class that can be used as follows: `instanceOfSyncOperationResultDto.copyWith(...)` or like so:`instanceOfSyncOperationResultDto.copyWith.fieldName(...)`.
  // ignore: library_private_types_in_public_api
  _$SyncOperationResultDtoCWProxy get copyWith =>
      _$SyncOperationResultDtoCWProxyImpl(this);
}

// **************************************************************************
// JsonSerializableGenerator
// **************************************************************************

SyncOperationResultDto _$SyncOperationResultDtoFromJson(
  Map<String, dynamic> json,
) => $checkedCreate('SyncOperationResultDto', json, ($checkedConvert) {
  $checkKeys(
    json,
    requiredKeys: const [
      'opId',
      'status',
      'entityId',
      'rev',
      'serverUpdatedAt',
      'errorCode',
      'error',
    ],
  );
  final val = SyncOperationResultDto(
    opId: $checkedConvert('opId', (v) => v as String),
    status: $checkedConvert(
      'status',
      (v) => $enumDecode(
        _$SyncOpStatusEnumMap,
        v,
        unknownValue: SyncOpStatus.unknownDefaultOpenApi,
      ),
    ),
    entityId: $checkedConvert('entityId', (v) => v as String?),
    rev: $checkedConvert('rev', (v) => v as num?),
    serverUpdatedAt: $checkedConvert(
      'serverUpdatedAt',
      (v) => v == null ? null : DateTime.parse(v as String),
    ),
    errorCode: $checkedConvert('errorCode', (v) => v as String?),
    error: $checkedConvert('error', (v) => v as String?),
  );
  return val;
});

Map<String, dynamic> _$SyncOperationResultDtoToJson(
  SyncOperationResultDto instance,
) => <String, dynamic>{
  'opId': instance.opId,
  'status': _$SyncOpStatusEnumMap[instance.status]!,
  'entityId': instance.entityId,
  'rev': instance.rev,
  'serverUpdatedAt': instance.serverUpdatedAt?.toIso8601String(),
  'errorCode': instance.errorCode,
  'error': instance.error,
};

const _$SyncOpStatusEnumMap = {
  SyncOpStatus.applied: 'applied',
  SyncOpStatus.duplicate: 'duplicate',
  SyncOpStatus.conflict: 'conflict',
  SyncOpStatus.invalid: 'invalid',
  SyncOpStatus.skippedDependencyFailed: 'skipped_dependency_failed',
  SyncOpStatus.unknownDefaultOpenApi: 'unknown_default_open_api',
};

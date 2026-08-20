// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'sync_operation_dto.dart';

// **************************************************************************
// CopyWithGenerator
// **************************************************************************

abstract class _$SyncOperationDtoCWProxy {
  SyncOperationDto opId(String opId);

  SyncOperationDto seq(num seq);

  SyncOperationDto entity(SyncEntity entity);

  SyncOperationDto op(SyncOp op);

  SyncOperationDto entityId(String entityId);

  SyncOperationDto clientUpdatedAt(DateTime clientUpdatedAt);

  SyncOperationDto baseRev(num? baseRev);

  SyncOperationDto data(SyncEntityDataDto? data);

  SyncOperationDto clearedFields(List<String>? clearedFields);

  /// This function **does support** nullification of nullable fields. All `null` values passed to `non-nullable` fields will be ignored. You can also use `SyncOperationDto(...).copyWith.fieldName(...)` to override fields one at a time with nullification support.
  ///
  /// Usage
  /// ```dart
  /// SyncOperationDto(...).copyWith(id: 12, name: "My name")
  /// ````
  SyncOperationDto call({
    String opId,
    num seq,
    SyncEntity entity,
    SyncOp op,
    String entityId,
    DateTime clientUpdatedAt,
    num? baseRev,
    SyncEntityDataDto? data,
    List<String>? clearedFields,
  });
}

/// Proxy class for `copyWith` functionality. This is a callable class and can be used as follows: `instanceOfSyncOperationDto.copyWith(...)`. Additionally contains functions for specific fields e.g. `instanceOfSyncOperationDto.copyWith.fieldName(...)`
class _$SyncOperationDtoCWProxyImpl implements _$SyncOperationDtoCWProxy {
  const _$SyncOperationDtoCWProxyImpl(this._value);

  final SyncOperationDto _value;

  @override
  SyncOperationDto opId(String opId) => this(opId: opId);

  @override
  SyncOperationDto seq(num seq) => this(seq: seq);

  @override
  SyncOperationDto entity(SyncEntity entity) => this(entity: entity);

  @override
  SyncOperationDto op(SyncOp op) => this(op: op);

  @override
  SyncOperationDto entityId(String entityId) => this(entityId: entityId);

  @override
  SyncOperationDto clientUpdatedAt(DateTime clientUpdatedAt) =>
      this(clientUpdatedAt: clientUpdatedAt);

  @override
  SyncOperationDto baseRev(num? baseRev) => this(baseRev: baseRev);

  @override
  SyncOperationDto data(SyncEntityDataDto? data) => this(data: data);

  @override
  SyncOperationDto clearedFields(List<String>? clearedFields) =>
      this(clearedFields: clearedFields);

  @override
  /// This function **does support** nullification of nullable fields. All `null` values passed to `non-nullable` fields will be ignored. You can also use `SyncOperationDto(...).copyWith.fieldName(...)` to override fields one at a time with nullification support.
  ///
  /// Usage
  /// ```dart
  /// SyncOperationDto(...).copyWith(id: 12, name: "My name")
  /// ````
  SyncOperationDto call({
    Object? opId = const $CopyWithPlaceholder(),
    Object? seq = const $CopyWithPlaceholder(),
    Object? entity = const $CopyWithPlaceholder(),
    Object? op = const $CopyWithPlaceholder(),
    Object? entityId = const $CopyWithPlaceholder(),
    Object? clientUpdatedAt = const $CopyWithPlaceholder(),
    Object? baseRev = const $CopyWithPlaceholder(),
    Object? data = const $CopyWithPlaceholder(),
    Object? clearedFields = const $CopyWithPlaceholder(),
  }) {
    return SyncOperationDto(
      opId: opId == const $CopyWithPlaceholder()
          ? _value.opId
          // ignore: cast_nullable_to_non_nullable
          : opId as String,
      seq: seq == const $CopyWithPlaceholder()
          ? _value.seq
          // ignore: cast_nullable_to_non_nullable
          : seq as num,
      entity: entity == const $CopyWithPlaceholder()
          ? _value.entity
          // ignore: cast_nullable_to_non_nullable
          : entity as SyncEntity,
      op: op == const $CopyWithPlaceholder()
          ? _value.op
          // ignore: cast_nullable_to_non_nullable
          : op as SyncOp,
      entityId: entityId == const $CopyWithPlaceholder()
          ? _value.entityId
          // ignore: cast_nullable_to_non_nullable
          : entityId as String,
      clientUpdatedAt: clientUpdatedAt == const $CopyWithPlaceholder()
          ? _value.clientUpdatedAt
          // ignore: cast_nullable_to_non_nullable
          : clientUpdatedAt as DateTime,
      baseRev: baseRev == const $CopyWithPlaceholder()
          ? _value.baseRev
          // ignore: cast_nullable_to_non_nullable
          : baseRev as num?,
      data: data == const $CopyWithPlaceholder()
          ? _value.data
          // ignore: cast_nullable_to_non_nullable
          : data as SyncEntityDataDto?,
      clearedFields: clearedFields == const $CopyWithPlaceholder()
          ? _value.clearedFields
          // ignore: cast_nullable_to_non_nullable
          : clearedFields as List<String>?,
    );
  }
}

extension $SyncOperationDtoCopyWith on SyncOperationDto {
  /// Returns a callable class that can be used as follows: `instanceOfSyncOperationDto.copyWith(...)` or like so:`instanceOfSyncOperationDto.copyWith.fieldName(...)`.
  // ignore: library_private_types_in_public_api
  _$SyncOperationDtoCWProxy get copyWith => _$SyncOperationDtoCWProxyImpl(this);
}

// **************************************************************************
// JsonSerializableGenerator
// **************************************************************************

SyncOperationDto _$SyncOperationDtoFromJson(Map<String, dynamic> json) =>
    $checkedCreate('SyncOperationDto', json, ($checkedConvert) {
      $checkKeys(
        json,
        requiredKeys: const [
          'opId',
          'seq',
          'entity',
          'op',
          'entityId',
          'clientUpdatedAt',
        ],
      );
      final val = SyncOperationDto(
        opId: $checkedConvert('opId', (v) => v as String),
        seq: $checkedConvert('seq', (v) => v as num),
        entity: $checkedConvert(
          'entity',
          (v) => $enumDecode(
            _$SyncEntityEnumMap,
            v,
            unknownValue: SyncEntity.unknownDefaultOpenApi,
          ),
        ),
        op: $checkedConvert(
          'op',
          (v) => $enumDecode(
            _$SyncOpEnumMap,
            v,
            unknownValue: SyncOp.unknownDefaultOpenApi,
          ),
        ),
        entityId: $checkedConvert('entityId', (v) => v as String),
        clientUpdatedAt: $checkedConvert(
          'clientUpdatedAt',
          (v) => DateTime.parse(v as String),
        ),
        baseRev: $checkedConvert('baseRev', (v) => v as num?),
        data: $checkedConvert(
          'data',
          (v) => v == null
              ? null
              : SyncEntityDataDto.fromJson(v as Map<String, dynamic>),
        ),
        clearedFields: $checkedConvert(
          'clearedFields',
          (v) => (v as List<dynamic>?)?.map((e) => e as String).toList(),
        ),
      );
      return val;
    });

Map<String, dynamic> _$SyncOperationDtoToJson(SyncOperationDto instance) =>
    <String, dynamic>{
      'opId': instance.opId,
      'seq': instance.seq,
      'entity': _$SyncEntityEnumMap[instance.entity]!,
      'op': _$SyncOpEnumMap[instance.op]!,
      'entityId': instance.entityId,
      'clientUpdatedAt': instance.clientUpdatedAt.toIso8601String(),
      if (instance.baseRev case final value?) 'baseRev': value,
      if (instance.data?.toJson() case final value?) 'data': value,
      if (instance.clearedFields case final value?) 'clearedFields': value,
    };

const _$SyncEntityEnumMap = {
  SyncEntity.representant: 'representant',
  SyncEntity.representantComment: 'representant_comment',
  SyncEntity.prospect: 'prospect',
  SyncEntity.callAttempt: 'call_attempt',
  SyncEntity.visite: 'visite',
  SyncEntity.unknownDefaultOpenApi: 'unknown_default_open_api',
};

const _$SyncOpEnumMap = {
  SyncOp.create: 'create',
  SyncOp.update: 'update',
  SyncOp.delete: 'delete',
  SyncOp.unknownDefaultOpenApi: 'unknown_default_open_api',
};

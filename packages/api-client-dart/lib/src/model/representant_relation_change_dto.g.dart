// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'representant_relation_change_dto.dart';

// **************************************************************************
// CopyWithGenerator
// **************************************************************************

abstract class _$RepresentantRelationChangeDtoCWProxy {
  RepresentantRelationChangeDto id(String id);

  RepresentantRelationChangeDto representantId(String representantId);

  RepresentantRelationChangeDto fromStatus(RepresentantRelation fromStatus);

  RepresentantRelationChangeDto toStatus(RepresentantRelation toStatus);

  RepresentantRelationChangeDto reason(String? reason);

  RepresentantRelationChangeDto changedById(String changedById);

  RepresentantRelationChangeDto changedByName(String changedByName);

  RepresentantRelationChangeDto source_(ChangeSource source_);

  RepresentantRelationChangeDto changedAt(DateTime changedAt);

  /// This function **does support** nullification of nullable fields. All `null` values passed to `non-nullable` fields will be ignored. You can also use `RepresentantRelationChangeDto(...).copyWith.fieldName(...)` to override fields one at a time with nullification support.
  ///
  /// Usage
  /// ```dart
  /// RepresentantRelationChangeDto(...).copyWith(id: 12, name: "My name")
  /// ````
  RepresentantRelationChangeDto call({
    String id,
    String representantId,
    RepresentantRelation fromStatus,
    RepresentantRelation toStatus,
    String? reason,
    String changedById,
    String changedByName,
    ChangeSource source_,
    DateTime changedAt,
  });
}

/// Proxy class for `copyWith` functionality. This is a callable class and can be used as follows: `instanceOfRepresentantRelationChangeDto.copyWith(...)`. Additionally contains functions for specific fields e.g. `instanceOfRepresentantRelationChangeDto.copyWith.fieldName(...)`
class _$RepresentantRelationChangeDtoCWProxyImpl
    implements _$RepresentantRelationChangeDtoCWProxy {
  const _$RepresentantRelationChangeDtoCWProxyImpl(this._value);

  final RepresentantRelationChangeDto _value;

  @override
  RepresentantRelationChangeDto id(String id) => this(id: id);

  @override
  RepresentantRelationChangeDto representantId(String representantId) =>
      this(representantId: representantId);

  @override
  RepresentantRelationChangeDto fromStatus(RepresentantRelation fromStatus) =>
      this(fromStatus: fromStatus);

  @override
  RepresentantRelationChangeDto toStatus(RepresentantRelation toStatus) =>
      this(toStatus: toStatus);

  @override
  RepresentantRelationChangeDto reason(String? reason) => this(reason: reason);

  @override
  RepresentantRelationChangeDto changedById(String changedById) =>
      this(changedById: changedById);

  @override
  RepresentantRelationChangeDto changedByName(String changedByName) =>
      this(changedByName: changedByName);

  @override
  RepresentantRelationChangeDto source_(ChangeSource source_) =>
      this(source_: source_);

  @override
  RepresentantRelationChangeDto changedAt(DateTime changedAt) =>
      this(changedAt: changedAt);

  @override
  /// This function **does support** nullification of nullable fields. All `null` values passed to `non-nullable` fields will be ignored. You can also use `RepresentantRelationChangeDto(...).copyWith.fieldName(...)` to override fields one at a time with nullification support.
  ///
  /// Usage
  /// ```dart
  /// RepresentantRelationChangeDto(...).copyWith(id: 12, name: "My name")
  /// ````
  RepresentantRelationChangeDto call({
    Object? id = const $CopyWithPlaceholder(),
    Object? representantId = const $CopyWithPlaceholder(),
    Object? fromStatus = const $CopyWithPlaceholder(),
    Object? toStatus = const $CopyWithPlaceholder(),
    Object? reason = const $CopyWithPlaceholder(),
    Object? changedById = const $CopyWithPlaceholder(),
    Object? changedByName = const $CopyWithPlaceholder(),
    Object? source_ = const $CopyWithPlaceholder(),
    Object? changedAt = const $CopyWithPlaceholder(),
  }) {
    return RepresentantRelationChangeDto(
      id: id == const $CopyWithPlaceholder()
          ? _value.id
          // ignore: cast_nullable_to_non_nullable
          : id as String,
      representantId: representantId == const $CopyWithPlaceholder()
          ? _value.representantId
          // ignore: cast_nullable_to_non_nullable
          : representantId as String,
      fromStatus: fromStatus == const $CopyWithPlaceholder()
          ? _value.fromStatus
          // ignore: cast_nullable_to_non_nullable
          : fromStatus as RepresentantRelation,
      toStatus: toStatus == const $CopyWithPlaceholder()
          ? _value.toStatus
          // ignore: cast_nullable_to_non_nullable
          : toStatus as RepresentantRelation,
      reason: reason == const $CopyWithPlaceholder()
          ? _value.reason
          // ignore: cast_nullable_to_non_nullable
          : reason as String?,
      changedById: changedById == const $CopyWithPlaceholder()
          ? _value.changedById
          // ignore: cast_nullable_to_non_nullable
          : changedById as String,
      changedByName: changedByName == const $CopyWithPlaceholder()
          ? _value.changedByName
          // ignore: cast_nullable_to_non_nullable
          : changedByName as String,
      source_: source_ == const $CopyWithPlaceholder()
          ? _value.source_
          // ignore: cast_nullable_to_non_nullable
          : source_ as ChangeSource,
      changedAt: changedAt == const $CopyWithPlaceholder()
          ? _value.changedAt
          // ignore: cast_nullable_to_non_nullable
          : changedAt as DateTime,
    );
  }
}

extension $RepresentantRelationChangeDtoCopyWith
    on RepresentantRelationChangeDto {
  /// Returns a callable class that can be used as follows: `instanceOfRepresentantRelationChangeDto.copyWith(...)` or like so:`instanceOfRepresentantRelationChangeDto.copyWith.fieldName(...)`.
  // ignore: library_private_types_in_public_api
  _$RepresentantRelationChangeDtoCWProxy get copyWith =>
      _$RepresentantRelationChangeDtoCWProxyImpl(this);
}

// **************************************************************************
// JsonSerializableGenerator
// **************************************************************************

RepresentantRelationChangeDto _$RepresentantRelationChangeDtoFromJson(
  Map<String, dynamic> json,
) => $checkedCreate('RepresentantRelationChangeDto', json, ($checkedConvert) {
  $checkKeys(
    json,
    requiredKeys: const [
      'id',
      'representantId',
      'fromStatus',
      'toStatus',
      'reason',
      'changedById',
      'changedByName',
      'source',
      'changedAt',
    ],
  );
  final val = RepresentantRelationChangeDto(
    id: $checkedConvert('id', (v) => v as String),
    representantId: $checkedConvert('representantId', (v) => v as String),
    fromStatus: $checkedConvert(
      'fromStatus',
      (v) => $enumDecode(
        _$RepresentantRelationEnumMap,
        v,
        unknownValue: RepresentantRelation.unknownDefaultOpenApi,
      ),
    ),
    toStatus: $checkedConvert(
      'toStatus',
      (v) => $enumDecode(
        _$RepresentantRelationEnumMap,
        v,
        unknownValue: RepresentantRelation.unknownDefaultOpenApi,
      ),
    ),
    reason: $checkedConvert('reason', (v) => v as String?),
    changedById: $checkedConvert('changedById', (v) => v as String),
    changedByName: $checkedConvert('changedByName', (v) => v as String),
    source_: $checkedConvert(
      'source',
      (v) => $enumDecode(
        _$ChangeSourceEnumMap,
        v,
        unknownValue: ChangeSource.unknownDefaultOpenApi,
      ),
    ),
    changedAt: $checkedConvert('changedAt', (v) => DateTime.parse(v as String)),
  );
  return val;
}, fieldKeyMap: const {'source_': 'source'});

Map<String, dynamic> _$RepresentantRelationChangeDtoToJson(
  RepresentantRelationChangeDto instance,
) => <String, dynamic>{
  'id': instance.id,
  'representantId': instance.representantId,
  'fromStatus': _$RepresentantRelationEnumMap[instance.fromStatus]!,
  'toStatus': _$RepresentantRelationEnumMap[instance.toStatus]!,
  'reason': instance.reason,
  'changedById': instance.changedById,
  'changedByName': instance.changedByName,
  'source': _$ChangeSourceEnumMap[instance.source_]!,
  'changedAt': instance.changedAt.toIso8601String(),
};

const _$RepresentantRelationEnumMap = {
  RepresentantRelation.INCONNU: 'INCONNU',
  RepresentantRelation.CONTACTE: 'CONTACTE',
  RepresentantRelation.AMBASSADEUR: 'AMBASSADEUR',
  RepresentantRelation.REFUS: 'REFUS',
  RepresentantRelation.unknownDefaultOpenApi: 'unknown_default_open_api',
};

const _$ChangeSourceEnumMap = {
  ChangeSource.WEB: 'WEB',
  ChangeSource.MOBILE: 'MOBILE',
  ChangeSource.unknownDefaultOpenApi: 'unknown_default_open_api',
};

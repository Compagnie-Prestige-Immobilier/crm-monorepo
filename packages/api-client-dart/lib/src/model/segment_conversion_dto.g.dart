// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'segment_conversion_dto.dart';

// **************************************************************************
// CopyWithGenerator
// **************************************************************************

abstract class _$SegmentConversionDtoCWProxy {
  SegmentConversionDto id(String id);

  SegmentConversionDto prospectId(String prospectId);

  SegmentConversionDto prospectName(String prospectName);

  SegmentConversionDto fromSegment(BddSegment fromSegment);

  SegmentConversionDto toSegment(BddSegment toSegment);

  SegmentConversionDto reason(String? reason);

  SegmentConversionDto changedById(String changedById);

  SegmentConversionDto changedByName(String changedByName);

  SegmentConversionDto source_(ChangeSource source_);

  SegmentConversionDto changedAt(DateTime changedAt);

  /// This function **does support** nullification of nullable fields. All `null` values passed to `non-nullable` fields will be ignored. You can also use `SegmentConversionDto(...).copyWith.fieldName(...)` to override fields one at a time with nullification support.
  ///
  /// Usage
  /// ```dart
  /// SegmentConversionDto(...).copyWith(id: 12, name: "My name")
  /// ````
  SegmentConversionDto call({
    String id,
    String prospectId,
    String prospectName,
    BddSegment fromSegment,
    BddSegment toSegment,
    String? reason,
    String changedById,
    String changedByName,
    ChangeSource source_,
    DateTime changedAt,
  });
}

/// Proxy class for `copyWith` functionality. This is a callable class and can be used as follows: `instanceOfSegmentConversionDto.copyWith(...)`. Additionally contains functions for specific fields e.g. `instanceOfSegmentConversionDto.copyWith.fieldName(...)`
class _$SegmentConversionDtoCWProxyImpl
    implements _$SegmentConversionDtoCWProxy {
  const _$SegmentConversionDtoCWProxyImpl(this._value);

  final SegmentConversionDto _value;

  @override
  SegmentConversionDto id(String id) => this(id: id);

  @override
  SegmentConversionDto prospectId(String prospectId) =>
      this(prospectId: prospectId);

  @override
  SegmentConversionDto prospectName(String prospectName) =>
      this(prospectName: prospectName);

  @override
  SegmentConversionDto fromSegment(BddSegment fromSegment) =>
      this(fromSegment: fromSegment);

  @override
  SegmentConversionDto toSegment(BddSegment toSegment) =>
      this(toSegment: toSegment);

  @override
  SegmentConversionDto reason(String? reason) => this(reason: reason);

  @override
  SegmentConversionDto changedById(String changedById) =>
      this(changedById: changedById);

  @override
  SegmentConversionDto changedByName(String changedByName) =>
      this(changedByName: changedByName);

  @override
  SegmentConversionDto source_(ChangeSource source_) => this(source_: source_);

  @override
  SegmentConversionDto changedAt(DateTime changedAt) =>
      this(changedAt: changedAt);

  @override
  /// This function **does support** nullification of nullable fields. All `null` values passed to `non-nullable` fields will be ignored. You can also use `SegmentConversionDto(...).copyWith.fieldName(...)` to override fields one at a time with nullification support.
  ///
  /// Usage
  /// ```dart
  /// SegmentConversionDto(...).copyWith(id: 12, name: "My name")
  /// ````
  SegmentConversionDto call({
    Object? id = const $CopyWithPlaceholder(),
    Object? prospectId = const $CopyWithPlaceholder(),
    Object? prospectName = const $CopyWithPlaceholder(),
    Object? fromSegment = const $CopyWithPlaceholder(),
    Object? toSegment = const $CopyWithPlaceholder(),
    Object? reason = const $CopyWithPlaceholder(),
    Object? changedById = const $CopyWithPlaceholder(),
    Object? changedByName = const $CopyWithPlaceholder(),
    Object? source_ = const $CopyWithPlaceholder(),
    Object? changedAt = const $CopyWithPlaceholder(),
  }) {
    return SegmentConversionDto(
      id: id == const $CopyWithPlaceholder()
          ? _value.id
          // ignore: cast_nullable_to_non_nullable
          : id as String,
      prospectId: prospectId == const $CopyWithPlaceholder()
          ? _value.prospectId
          // ignore: cast_nullable_to_non_nullable
          : prospectId as String,
      prospectName: prospectName == const $CopyWithPlaceholder()
          ? _value.prospectName
          // ignore: cast_nullable_to_non_nullable
          : prospectName as String,
      fromSegment: fromSegment == const $CopyWithPlaceholder()
          ? _value.fromSegment
          // ignore: cast_nullable_to_non_nullable
          : fromSegment as BddSegment,
      toSegment: toSegment == const $CopyWithPlaceholder()
          ? _value.toSegment
          // ignore: cast_nullable_to_non_nullable
          : toSegment as BddSegment,
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

extension $SegmentConversionDtoCopyWith on SegmentConversionDto {
  /// Returns a callable class that can be used as follows: `instanceOfSegmentConversionDto.copyWith(...)` or like so:`instanceOfSegmentConversionDto.copyWith.fieldName(...)`.
  // ignore: library_private_types_in_public_api
  _$SegmentConversionDtoCWProxy get copyWith =>
      _$SegmentConversionDtoCWProxyImpl(this);
}

// **************************************************************************
// JsonSerializableGenerator
// **************************************************************************

SegmentConversionDto _$SegmentConversionDtoFromJson(
  Map<String, dynamic> json,
) => $checkedCreate('SegmentConversionDto', json, ($checkedConvert) {
  $checkKeys(
    json,
    requiredKeys: const [
      'id',
      'prospectId',
      'prospectName',
      'fromSegment',
      'toSegment',
      'reason',
      'changedById',
      'changedByName',
      'source',
      'changedAt',
    ],
  );
  final val = SegmentConversionDto(
    id: $checkedConvert('id', (v) => v as String),
    prospectId: $checkedConvert('prospectId', (v) => v as String),
    prospectName: $checkedConvert('prospectName', (v) => v as String),
    fromSegment: $checkedConvert(
      'fromSegment',
      (v) => $enumDecode(
        _$BddSegmentEnumMap,
        v,
        unknownValue: BddSegment.unknownDefaultOpenApi,
      ),
    ),
    toSegment: $checkedConvert(
      'toSegment',
      (v) => $enumDecode(
        _$BddSegmentEnumMap,
        v,
        unknownValue: BddSegment.unknownDefaultOpenApi,
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

Map<String, dynamic> _$SegmentConversionDtoToJson(
  SegmentConversionDto instance,
) => <String, dynamic>{
  'id': instance.id,
  'prospectId': instance.prospectId,
  'prospectName': instance.prospectName,
  'fromSegment': _$BddSegmentEnumMap[instance.fromSegment]!,
  'toSegment': _$BddSegmentEnumMap[instance.toSegment]!,
  'reason': instance.reason,
  'changedById': instance.changedById,
  'changedByName': instance.changedByName,
  'source': _$ChangeSourceEnumMap[instance.source_]!,
  'changedAt': instance.changedAt.toIso8601String(),
};

const _$BddSegmentEnumMap = {
  BddSegment.BDD1: 'BDD1',
  BddSegment.BDD2: 'BDD2',
  BddSegment.BDD3: 'BDD3',
  BddSegment.BDD4: 'BDD4',
  BddSegment.unknownDefaultOpenApi: 'unknown_default_open_api',
};

const _$ChangeSourceEnumMap = {
  ChangeSource.WEB: 'WEB',
  ChangeSource.MOBILE: 'MOBILE',
  ChangeSource.unknownDefaultOpenApi: 'unknown_default_open_api',
};

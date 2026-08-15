// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'campaign_summary_dto.dart';

// **************************************************************************
// CopyWithGenerator
// **************************************************************************

abstract class _$CampaignSummaryDtoCWProxy {
  CampaignSummaryDto id(String id);

  CampaignSummaryDto name(String name);

  CampaignSummaryDto scope(CampaignScope scope);

  CampaignSummaryDto scopeLabel(String scopeLabel);

  CampaignSummaryDto status(CampaignStatus status);

  CampaignSummaryDto seed(String seed);

  CampaignSummaryDto createdById(String createdById);

  CampaignSummaryDto createdByName(String createdByName);

  CampaignSummaryDto commercialCount(num commercialCount);

  CampaignSummaryDto spreadDays(num spreadDays);

  CampaignSummaryDto progress(CampaignProgressDto progress);

  CampaignSummaryDto createdAt(DateTime createdAt);

  CampaignSummaryDto closedAt(DateTime? closedAt);

  /// This function **does support** nullification of nullable fields. All `null` values passed to `non-nullable` fields will be ignored. You can also use `CampaignSummaryDto(...).copyWith.fieldName(...)` to override fields one at a time with nullification support.
  ///
  /// Usage
  /// ```dart
  /// CampaignSummaryDto(...).copyWith(id: 12, name: "My name")
  /// ````
  CampaignSummaryDto call({
    String id,
    String name,
    CampaignScope scope,
    String scopeLabel,
    CampaignStatus status,
    String seed,
    String createdById,
    String createdByName,
    num commercialCount,
    num spreadDays,
    CampaignProgressDto progress,
    DateTime createdAt,
    DateTime? closedAt,
  });
}

/// Proxy class for `copyWith` functionality. This is a callable class and can be used as follows: `instanceOfCampaignSummaryDto.copyWith(...)`. Additionally contains functions for specific fields e.g. `instanceOfCampaignSummaryDto.copyWith.fieldName(...)`
class _$CampaignSummaryDtoCWProxyImpl implements _$CampaignSummaryDtoCWProxy {
  const _$CampaignSummaryDtoCWProxyImpl(this._value);

  final CampaignSummaryDto _value;

  @override
  CampaignSummaryDto id(String id) => this(id: id);

  @override
  CampaignSummaryDto name(String name) => this(name: name);

  @override
  CampaignSummaryDto scope(CampaignScope scope) => this(scope: scope);

  @override
  CampaignSummaryDto scopeLabel(String scopeLabel) =>
      this(scopeLabel: scopeLabel);

  @override
  CampaignSummaryDto status(CampaignStatus status) => this(status: status);

  @override
  CampaignSummaryDto seed(String seed) => this(seed: seed);

  @override
  CampaignSummaryDto createdById(String createdById) =>
      this(createdById: createdById);

  @override
  CampaignSummaryDto createdByName(String createdByName) =>
      this(createdByName: createdByName);

  @override
  CampaignSummaryDto commercialCount(num commercialCount) =>
      this(commercialCount: commercialCount);

  @override
  CampaignSummaryDto spreadDays(num spreadDays) => this(spreadDays: spreadDays);

  @override
  CampaignSummaryDto progress(CampaignProgressDto progress) =>
      this(progress: progress);

  @override
  CampaignSummaryDto createdAt(DateTime createdAt) =>
      this(createdAt: createdAt);

  @override
  CampaignSummaryDto closedAt(DateTime? closedAt) => this(closedAt: closedAt);

  @override
  /// This function **does support** nullification of nullable fields. All `null` values passed to `non-nullable` fields will be ignored. You can also use `CampaignSummaryDto(...).copyWith.fieldName(...)` to override fields one at a time with nullification support.
  ///
  /// Usage
  /// ```dart
  /// CampaignSummaryDto(...).copyWith(id: 12, name: "My name")
  /// ````
  CampaignSummaryDto call({
    Object? id = const $CopyWithPlaceholder(),
    Object? name = const $CopyWithPlaceholder(),
    Object? scope = const $CopyWithPlaceholder(),
    Object? scopeLabel = const $CopyWithPlaceholder(),
    Object? status = const $CopyWithPlaceholder(),
    Object? seed = const $CopyWithPlaceholder(),
    Object? createdById = const $CopyWithPlaceholder(),
    Object? createdByName = const $CopyWithPlaceholder(),
    Object? commercialCount = const $CopyWithPlaceholder(),
    Object? spreadDays = const $CopyWithPlaceholder(),
    Object? progress = const $CopyWithPlaceholder(),
    Object? createdAt = const $CopyWithPlaceholder(),
    Object? closedAt = const $CopyWithPlaceholder(),
  }) {
    return CampaignSummaryDto(
      id: id == const $CopyWithPlaceholder()
          ? _value.id
          // ignore: cast_nullable_to_non_nullable
          : id as String,
      name: name == const $CopyWithPlaceholder()
          ? _value.name
          // ignore: cast_nullable_to_non_nullable
          : name as String,
      scope: scope == const $CopyWithPlaceholder()
          ? _value.scope
          // ignore: cast_nullable_to_non_nullable
          : scope as CampaignScope,
      scopeLabel: scopeLabel == const $CopyWithPlaceholder()
          ? _value.scopeLabel
          // ignore: cast_nullable_to_non_nullable
          : scopeLabel as String,
      status: status == const $CopyWithPlaceholder()
          ? _value.status
          // ignore: cast_nullable_to_non_nullable
          : status as CampaignStatus,
      seed: seed == const $CopyWithPlaceholder()
          ? _value.seed
          // ignore: cast_nullable_to_non_nullable
          : seed as String,
      createdById: createdById == const $CopyWithPlaceholder()
          ? _value.createdById
          // ignore: cast_nullable_to_non_nullable
          : createdById as String,
      createdByName: createdByName == const $CopyWithPlaceholder()
          ? _value.createdByName
          // ignore: cast_nullable_to_non_nullable
          : createdByName as String,
      commercialCount: commercialCount == const $CopyWithPlaceholder()
          ? _value.commercialCount
          // ignore: cast_nullable_to_non_nullable
          : commercialCount as num,
      spreadDays: spreadDays == const $CopyWithPlaceholder()
          ? _value.spreadDays
          // ignore: cast_nullable_to_non_nullable
          : spreadDays as num,
      progress: progress == const $CopyWithPlaceholder()
          ? _value.progress
          // ignore: cast_nullable_to_non_nullable
          : progress as CampaignProgressDto,
      createdAt: createdAt == const $CopyWithPlaceholder()
          ? _value.createdAt
          // ignore: cast_nullable_to_non_nullable
          : createdAt as DateTime,
      closedAt: closedAt == const $CopyWithPlaceholder()
          ? _value.closedAt
          // ignore: cast_nullable_to_non_nullable
          : closedAt as DateTime?,
    );
  }
}

extension $CampaignSummaryDtoCopyWith on CampaignSummaryDto {
  /// Returns a callable class that can be used as follows: `instanceOfCampaignSummaryDto.copyWith(...)` or like so:`instanceOfCampaignSummaryDto.copyWith.fieldName(...)`.
  // ignore: library_private_types_in_public_api
  _$CampaignSummaryDtoCWProxy get copyWith =>
      _$CampaignSummaryDtoCWProxyImpl(this);
}

// **************************************************************************
// JsonSerializableGenerator
// **************************************************************************

CampaignSummaryDto _$CampaignSummaryDtoFromJson(Map<String, dynamic> json) =>
    $checkedCreate('CampaignSummaryDto', json, ($checkedConvert) {
      $checkKeys(
        json,
        requiredKeys: const [
          'id',
          'name',
          'scope',
          'scopeLabel',
          'status',
          'seed',
          'createdById',
          'createdByName',
          'commercialCount',
          'spreadDays',
          'progress',
          'createdAt',
          'closedAt',
        ],
      );
      final val = CampaignSummaryDto(
        id: $checkedConvert('id', (v) => v as String),
        name: $checkedConvert('name', (v) => v as String),
        scope: $checkedConvert(
          'scope',
          (v) => $enumDecode(
            _$CampaignScopeEnumMap,
            v,
            unknownValue: CampaignScope.unknownDefaultOpenApi,
          ),
        ),
        scopeLabel: $checkedConvert('scopeLabel', (v) => v as String),
        status: $checkedConvert(
          'status',
          (v) => $enumDecode(
            _$CampaignStatusEnumMap,
            v,
            unknownValue: CampaignStatus.unknownDefaultOpenApi,
          ),
        ),
        seed: $checkedConvert('seed', (v) => v as String),
        createdById: $checkedConvert('createdById', (v) => v as String),
        createdByName: $checkedConvert('createdByName', (v) => v as String),
        commercialCount: $checkedConvert('commercialCount', (v) => v as num),
        spreadDays: $checkedConvert('spreadDays', (v) => v as num),
        progress: $checkedConvert(
          'progress',
          (v) => CampaignProgressDto.fromJson(v as Map<String, dynamic>),
        ),
        createdAt: $checkedConvert(
          'createdAt',
          (v) => DateTime.parse(v as String),
        ),
        closedAt: $checkedConvert(
          'closedAt',
          (v) => v == null ? null : DateTime.parse(v as String),
        ),
      );
      return val;
    });

Map<String, dynamic> _$CampaignSummaryDtoToJson(CampaignSummaryDto instance) =>
    <String, dynamic>{
      'id': instance.id,
      'name': instance.name,
      'scope': _$CampaignScopeEnumMap[instance.scope]!,
      'scopeLabel': instance.scopeLabel,
      'status': _$CampaignStatusEnumMap[instance.status]!,
      'seed': instance.seed,
      'createdById': instance.createdById,
      'createdByName': instance.createdByName,
      'commercialCount': instance.commercialCount,
      'spreadDays': instance.spreadDays,
      'progress': instance.progress.toJson(),
      'createdAt': instance.createdAt.toIso8601String(),
      'closedAt': instance.closedAt?.toIso8601String(),
    };

const _$CampaignScopeEnumMap = {
  CampaignScope.BDD1: 'BDD1',
  CampaignScope.BDD2: 'BDD2',
  CampaignScope.BDD3: 'BDD3',
  CampaignScope.BDD4: 'BDD4',
  CampaignScope.ALL: 'ALL',
  CampaignScope.unknownDefaultOpenApi: 'unknown_default_open_api',
};

const _$CampaignStatusEnumMap = {
  CampaignStatus.ACTIVE: 'ACTIVE',
  CampaignStatus.CLOSED: 'CLOSED',
  CampaignStatus.unknownDefaultOpenApi: 'unknown_default_open_api',
};

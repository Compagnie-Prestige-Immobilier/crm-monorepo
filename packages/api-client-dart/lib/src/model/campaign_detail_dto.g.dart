// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'campaign_detail_dto.dart';

// **************************************************************************
// CopyWithGenerator
// **************************************************************************

abstract class _$CampaignDetailDtoCWProxy {
  CampaignDetailDto id(String id);

  CampaignDetailDto name(String name);

  CampaignDetailDto scope(CampaignScope scope);

  CampaignDetailDto scopeLabel(String scopeLabel);

  CampaignDetailDto status(CampaignStatus status);

  CampaignDetailDto seed(String seed);

  CampaignDetailDto createdById(String createdById);

  CampaignDetailDto createdByName(String createdByName);

  CampaignDetailDto commercialCount(num commercialCount);

  CampaignDetailDto progress(CampaignProgressDto progress);

  CampaignDetailDto createdAt(DateTime createdAt);

  CampaignDetailDto closedAt(DateTime? closedAt);

  CampaignDetailDto commerciaux(List<CampaignCommercialDto> commerciaux);

  CampaignDetailDto recentAttempts(List<CampaignAttemptDto> recentAttempts);

  /// This function **does support** nullification of nullable fields. All `null` values passed to `non-nullable` fields will be ignored. You can also use `CampaignDetailDto(...).copyWith.fieldName(...)` to override fields one at a time with nullification support.
  ///
  /// Usage
  /// ```dart
  /// CampaignDetailDto(...).copyWith(id: 12, name: "My name")
  /// ````
  CampaignDetailDto call({
    String id,
    String name,
    CampaignScope scope,
    String scopeLabel,
    CampaignStatus status,
    String seed,
    String createdById,
    String createdByName,
    num commercialCount,
    CampaignProgressDto progress,
    DateTime createdAt,
    DateTime? closedAt,
    List<CampaignCommercialDto> commerciaux,
    List<CampaignAttemptDto> recentAttempts,
  });
}

/// Proxy class for `copyWith` functionality. This is a callable class and can be used as follows: `instanceOfCampaignDetailDto.copyWith(...)`. Additionally contains functions for specific fields e.g. `instanceOfCampaignDetailDto.copyWith.fieldName(...)`
class _$CampaignDetailDtoCWProxyImpl implements _$CampaignDetailDtoCWProxy {
  const _$CampaignDetailDtoCWProxyImpl(this._value);

  final CampaignDetailDto _value;

  @override
  CampaignDetailDto id(String id) => this(id: id);

  @override
  CampaignDetailDto name(String name) => this(name: name);

  @override
  CampaignDetailDto scope(CampaignScope scope) => this(scope: scope);

  @override
  CampaignDetailDto scopeLabel(String scopeLabel) =>
      this(scopeLabel: scopeLabel);

  @override
  CampaignDetailDto status(CampaignStatus status) => this(status: status);

  @override
  CampaignDetailDto seed(String seed) => this(seed: seed);

  @override
  CampaignDetailDto createdById(String createdById) =>
      this(createdById: createdById);

  @override
  CampaignDetailDto createdByName(String createdByName) =>
      this(createdByName: createdByName);

  @override
  CampaignDetailDto commercialCount(num commercialCount) =>
      this(commercialCount: commercialCount);

  @override
  CampaignDetailDto progress(CampaignProgressDto progress) =>
      this(progress: progress);

  @override
  CampaignDetailDto createdAt(DateTime createdAt) => this(createdAt: createdAt);

  @override
  CampaignDetailDto closedAt(DateTime? closedAt) => this(closedAt: closedAt);

  @override
  CampaignDetailDto commerciaux(List<CampaignCommercialDto> commerciaux) =>
      this(commerciaux: commerciaux);

  @override
  CampaignDetailDto recentAttempts(List<CampaignAttemptDto> recentAttempts) =>
      this(recentAttempts: recentAttempts);

  @override
  /// This function **does support** nullification of nullable fields. All `null` values passed to `non-nullable` fields will be ignored. You can also use `CampaignDetailDto(...).copyWith.fieldName(...)` to override fields one at a time with nullification support.
  ///
  /// Usage
  /// ```dart
  /// CampaignDetailDto(...).copyWith(id: 12, name: "My name")
  /// ````
  CampaignDetailDto call({
    Object? id = const $CopyWithPlaceholder(),
    Object? name = const $CopyWithPlaceholder(),
    Object? scope = const $CopyWithPlaceholder(),
    Object? scopeLabel = const $CopyWithPlaceholder(),
    Object? status = const $CopyWithPlaceholder(),
    Object? seed = const $CopyWithPlaceholder(),
    Object? createdById = const $CopyWithPlaceholder(),
    Object? createdByName = const $CopyWithPlaceholder(),
    Object? commercialCount = const $CopyWithPlaceholder(),
    Object? progress = const $CopyWithPlaceholder(),
    Object? createdAt = const $CopyWithPlaceholder(),
    Object? closedAt = const $CopyWithPlaceholder(),
    Object? commerciaux = const $CopyWithPlaceholder(),
    Object? recentAttempts = const $CopyWithPlaceholder(),
  }) {
    return CampaignDetailDto(
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
      commerciaux: commerciaux == const $CopyWithPlaceholder()
          ? _value.commerciaux
          // ignore: cast_nullable_to_non_nullable
          : commerciaux as List<CampaignCommercialDto>,
      recentAttempts: recentAttempts == const $CopyWithPlaceholder()
          ? _value.recentAttempts
          // ignore: cast_nullable_to_non_nullable
          : recentAttempts as List<CampaignAttemptDto>,
    );
  }
}

extension $CampaignDetailDtoCopyWith on CampaignDetailDto {
  /// Returns a callable class that can be used as follows: `instanceOfCampaignDetailDto.copyWith(...)` or like so:`instanceOfCampaignDetailDto.copyWith.fieldName(...)`.
  // ignore: library_private_types_in_public_api
  _$CampaignDetailDtoCWProxy get copyWith =>
      _$CampaignDetailDtoCWProxyImpl(this);
}

// **************************************************************************
// JsonSerializableGenerator
// **************************************************************************

CampaignDetailDto _$CampaignDetailDtoFromJson(
  Map<String, dynamic> json,
) => $checkedCreate('CampaignDetailDto', json, ($checkedConvert) {
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
      'progress',
      'createdAt',
      'closedAt',
      'commerciaux',
      'recentAttempts',
    ],
  );
  final val = CampaignDetailDto(
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
    progress: $checkedConvert(
      'progress',
      (v) => CampaignProgressDto.fromJson(v as Map<String, dynamic>),
    ),
    createdAt: $checkedConvert('createdAt', (v) => DateTime.parse(v as String)),
    closedAt: $checkedConvert(
      'closedAt',
      (v) => v == null ? null : DateTime.parse(v as String),
    ),
    commerciaux: $checkedConvert(
      'commerciaux',
      (v) => (v as List<dynamic>)
          .map((e) => CampaignCommercialDto.fromJson(e as Map<String, dynamic>))
          .toList(),
    ),
    recentAttempts: $checkedConvert(
      'recentAttempts',
      (v) => (v as List<dynamic>)
          .map((e) => CampaignAttemptDto.fromJson(e as Map<String, dynamic>))
          .toList(),
    ),
  );
  return val;
});

Map<String, dynamic> _$CampaignDetailDtoToJson(CampaignDetailDto instance) =>
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
      'progress': instance.progress.toJson(),
      'createdAt': instance.createdAt.toIso8601String(),
      'closedAt': instance.closedAt?.toIso8601String(),
      'commerciaux': instance.commerciaux.map((e) => e.toJson()).toList(),
      'recentAttempts': instance.recentAttempts.map((e) => e.toJson()).toList(),
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

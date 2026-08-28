// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'rep_campaign_summary_dto.dart';

// **************************************************************************
// CopyWithGenerator
// **************************************************************************

abstract class _$RepCampaignSummaryDtoCWProxy {
  RepCampaignSummaryDto id(String id);

  RepCampaignSummaryDto name(String name);

  RepCampaignSummaryDto status(CampaignStatus status);

  RepCampaignSummaryDto seed(String seed);

  RepCampaignSummaryDto scopeLabel(String scopeLabel);

  RepCampaignSummaryDto departementId(String? departementId);

  RepCampaignSummaryDto iefId(String? iefId);

  RepCampaignSummaryDto onlyWithoutProspects(bool onlyWithoutProspects);

  RepCampaignSummaryDto relationStatuses(
    List<RepresentantRelation> relationStatuses,
  );

  RepCampaignSummaryDto createdById(String createdById);

  RepCampaignSummaryDto createdByName(String createdByName);

  RepCampaignSummaryDto commercialCount(num commercialCount);

  RepCampaignSummaryDto spreadDays(num spreadDays);

  RepCampaignSummaryDto progress(RepCampaignProgressDto progress);

  RepCampaignSummaryDto createdAt(DateTime createdAt);

  RepCampaignSummaryDto closedAt(DateTime? closedAt);

  /// This function **does support** nullification of nullable fields. All `null` values passed to `non-nullable` fields will be ignored. You can also use `RepCampaignSummaryDto(...).copyWith.fieldName(...)` to override fields one at a time with nullification support.
  ///
  /// Usage
  /// ```dart
  /// RepCampaignSummaryDto(...).copyWith(id: 12, name: "My name")
  /// ````
  RepCampaignSummaryDto call({
    String id,
    String name,
    CampaignStatus status,
    String seed,
    String scopeLabel,
    String? departementId,
    String? iefId,
    bool onlyWithoutProspects,
    List<RepresentantRelation> relationStatuses,
    String createdById,
    String createdByName,
    num commercialCount,
    num spreadDays,
    RepCampaignProgressDto progress,
    DateTime createdAt,
    DateTime? closedAt,
  });
}

/// Proxy class for `copyWith` functionality. This is a callable class and can be used as follows: `instanceOfRepCampaignSummaryDto.copyWith(...)`. Additionally contains functions for specific fields e.g. `instanceOfRepCampaignSummaryDto.copyWith.fieldName(...)`
class _$RepCampaignSummaryDtoCWProxyImpl
    implements _$RepCampaignSummaryDtoCWProxy {
  const _$RepCampaignSummaryDtoCWProxyImpl(this._value);

  final RepCampaignSummaryDto _value;

  @override
  RepCampaignSummaryDto id(String id) => this(id: id);

  @override
  RepCampaignSummaryDto name(String name) => this(name: name);

  @override
  RepCampaignSummaryDto status(CampaignStatus status) => this(status: status);

  @override
  RepCampaignSummaryDto seed(String seed) => this(seed: seed);

  @override
  RepCampaignSummaryDto scopeLabel(String scopeLabel) =>
      this(scopeLabel: scopeLabel);

  @override
  RepCampaignSummaryDto departementId(String? departementId) =>
      this(departementId: departementId);

  @override
  RepCampaignSummaryDto iefId(String? iefId) => this(iefId: iefId);

  @override
  RepCampaignSummaryDto onlyWithoutProspects(bool onlyWithoutProspects) =>
      this(onlyWithoutProspects: onlyWithoutProspects);

  @override
  RepCampaignSummaryDto relationStatuses(
    List<RepresentantRelation> relationStatuses,
  ) => this(relationStatuses: relationStatuses);

  @override
  RepCampaignSummaryDto createdById(String createdById) =>
      this(createdById: createdById);

  @override
  RepCampaignSummaryDto createdByName(String createdByName) =>
      this(createdByName: createdByName);

  @override
  RepCampaignSummaryDto commercialCount(num commercialCount) =>
      this(commercialCount: commercialCount);

  @override
  RepCampaignSummaryDto spreadDays(num spreadDays) =>
      this(spreadDays: spreadDays);

  @override
  RepCampaignSummaryDto progress(RepCampaignProgressDto progress) =>
      this(progress: progress);

  @override
  RepCampaignSummaryDto createdAt(DateTime createdAt) =>
      this(createdAt: createdAt);

  @override
  RepCampaignSummaryDto closedAt(DateTime? closedAt) =>
      this(closedAt: closedAt);

  @override
  /// This function **does support** nullification of nullable fields. All `null` values passed to `non-nullable` fields will be ignored. You can also use `RepCampaignSummaryDto(...).copyWith.fieldName(...)` to override fields one at a time with nullification support.
  ///
  /// Usage
  /// ```dart
  /// RepCampaignSummaryDto(...).copyWith(id: 12, name: "My name")
  /// ````
  RepCampaignSummaryDto call({
    Object? id = const $CopyWithPlaceholder(),
    Object? name = const $CopyWithPlaceholder(),
    Object? status = const $CopyWithPlaceholder(),
    Object? seed = const $CopyWithPlaceholder(),
    Object? scopeLabel = const $CopyWithPlaceholder(),
    Object? departementId = const $CopyWithPlaceholder(),
    Object? iefId = const $CopyWithPlaceholder(),
    Object? onlyWithoutProspects = const $CopyWithPlaceholder(),
    Object? relationStatuses = const $CopyWithPlaceholder(),
    Object? createdById = const $CopyWithPlaceholder(),
    Object? createdByName = const $CopyWithPlaceholder(),
    Object? commercialCount = const $CopyWithPlaceholder(),
    Object? spreadDays = const $CopyWithPlaceholder(),
    Object? progress = const $CopyWithPlaceholder(),
    Object? createdAt = const $CopyWithPlaceholder(),
    Object? closedAt = const $CopyWithPlaceholder(),
  }) {
    return RepCampaignSummaryDto(
      id: id == const $CopyWithPlaceholder()
          ? _value.id
          // ignore: cast_nullable_to_non_nullable
          : id as String,
      name: name == const $CopyWithPlaceholder()
          ? _value.name
          // ignore: cast_nullable_to_non_nullable
          : name as String,
      status: status == const $CopyWithPlaceholder()
          ? _value.status
          // ignore: cast_nullable_to_non_nullable
          : status as CampaignStatus,
      seed: seed == const $CopyWithPlaceholder()
          ? _value.seed
          // ignore: cast_nullable_to_non_nullable
          : seed as String,
      scopeLabel: scopeLabel == const $CopyWithPlaceholder()
          ? _value.scopeLabel
          // ignore: cast_nullable_to_non_nullable
          : scopeLabel as String,
      departementId: departementId == const $CopyWithPlaceholder()
          ? _value.departementId
          // ignore: cast_nullable_to_non_nullable
          : departementId as String?,
      iefId: iefId == const $CopyWithPlaceholder()
          ? _value.iefId
          // ignore: cast_nullable_to_non_nullable
          : iefId as String?,
      onlyWithoutProspects: onlyWithoutProspects == const $CopyWithPlaceholder()
          ? _value.onlyWithoutProspects
          // ignore: cast_nullable_to_non_nullable
          : onlyWithoutProspects as bool,
      relationStatuses: relationStatuses == const $CopyWithPlaceholder()
          ? _value.relationStatuses
          // ignore: cast_nullable_to_non_nullable
          : relationStatuses as List<RepresentantRelation>,
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
          : progress as RepCampaignProgressDto,
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

extension $RepCampaignSummaryDtoCopyWith on RepCampaignSummaryDto {
  /// Returns a callable class that can be used as follows: `instanceOfRepCampaignSummaryDto.copyWith(...)` or like so:`instanceOfRepCampaignSummaryDto.copyWith.fieldName(...)`.
  // ignore: library_private_types_in_public_api
  _$RepCampaignSummaryDtoCWProxy get copyWith =>
      _$RepCampaignSummaryDtoCWProxyImpl(this);
}

// **************************************************************************
// JsonSerializableGenerator
// **************************************************************************

RepCampaignSummaryDto _$RepCampaignSummaryDtoFromJson(
  Map<String, dynamic> json,
) => $checkedCreate('RepCampaignSummaryDto', json, ($checkedConvert) {
  $checkKeys(
    json,
    requiredKeys: const [
      'id',
      'name',
      'status',
      'seed',
      'scopeLabel',
      'departementId',
      'iefId',
      'onlyWithoutProspects',
      'relationStatuses',
      'createdById',
      'createdByName',
      'commercialCount',
      'spreadDays',
      'progress',
      'createdAt',
      'closedAt',
    ],
  );
  final val = RepCampaignSummaryDto(
    id: $checkedConvert('id', (v) => v as String),
    name: $checkedConvert('name', (v) => v as String),
    status: $checkedConvert(
      'status',
      (v) => $enumDecode(
        _$CampaignStatusEnumMap,
        v,
        unknownValue: CampaignStatus.unknownDefaultOpenApi,
      ),
    ),
    seed: $checkedConvert('seed', (v) => v as String),
    scopeLabel: $checkedConvert('scopeLabel', (v) => v as String),
    departementId: $checkedConvert('departementId', (v) => v as String?),
    iefId: $checkedConvert('iefId', (v) => v as String?),
    onlyWithoutProspects: $checkedConvert(
      'onlyWithoutProspects',
      (v) => v as bool,
    ),
    relationStatuses: $checkedConvert(
      'relationStatuses',
      (v) => (v as List<dynamic>)
          .map((e) => $enumDecode(_$RepresentantRelationEnumMap, e))
          .toList(),
    ),
    createdById: $checkedConvert('createdById', (v) => v as String),
    createdByName: $checkedConvert('createdByName', (v) => v as String),
    commercialCount: $checkedConvert('commercialCount', (v) => v as num),
    spreadDays: $checkedConvert('spreadDays', (v) => v as num),
    progress: $checkedConvert(
      'progress',
      (v) => RepCampaignProgressDto.fromJson(v as Map<String, dynamic>),
    ),
    createdAt: $checkedConvert('createdAt', (v) => DateTime.parse(v as String)),
    closedAt: $checkedConvert(
      'closedAt',
      (v) => v == null ? null : DateTime.parse(v as String),
    ),
  );
  return val;
});

Map<String, dynamic> _$RepCampaignSummaryDtoToJson(
  RepCampaignSummaryDto instance,
) => <String, dynamic>{
  'id': instance.id,
  'name': instance.name,
  'status': _$CampaignStatusEnumMap[instance.status]!,
  'seed': instance.seed,
  'scopeLabel': instance.scopeLabel,
  'departementId': instance.departementId,
  'iefId': instance.iefId,
  'onlyWithoutProspects': instance.onlyWithoutProspects,
  'relationStatuses': instance.relationStatuses
      .map((e) => _$RepresentantRelationEnumMap[e]!)
      .toList(),
  'createdById': instance.createdById,
  'createdByName': instance.createdByName,
  'commercialCount': instance.commercialCount,
  'spreadDays': instance.spreadDays,
  'progress': instance.progress.toJson(),
  'createdAt': instance.createdAt.toIso8601String(),
  'closedAt': instance.closedAt?.toIso8601String(),
};

const _$CampaignStatusEnumMap = {
  CampaignStatus.DRAFT: 'DRAFT',
  CampaignStatus.ACTIVE: 'ACTIVE',
  CampaignStatus.PAUSED: 'PAUSED',
  CampaignStatus.CLOSED: 'CLOSED',
  CampaignStatus.unknownDefaultOpenApi: 'unknown_default_open_api',
};

const _$RepresentantRelationEnumMap = {
  RepresentantRelation.INCONNU: 'INCONNU',
  RepresentantRelation.CONTACTE: 'CONTACTE',
  RepresentantRelation.AMBASSADEUR: 'AMBASSADEUR',
  RepresentantRelation.REFUS: 'REFUS',
  RepresentantRelation.unknownDefaultOpenApi: 'unknown_default_open_api',
};

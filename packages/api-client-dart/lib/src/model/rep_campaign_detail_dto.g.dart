// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'rep_campaign_detail_dto.dart';

// **************************************************************************
// CopyWithGenerator
// **************************************************************************

abstract class _$RepCampaignDetailDtoCWProxy {
  RepCampaignDetailDto id(String id);

  RepCampaignDetailDto name(String name);

  RepCampaignDetailDto status(CampaignStatus status);

  RepCampaignDetailDto seed(String seed);

  RepCampaignDetailDto scopeLabel(String scopeLabel);

  RepCampaignDetailDto departementId(String? departementId);

  RepCampaignDetailDto iefId(String? iefId);

  RepCampaignDetailDto onlyWithoutProspects(bool onlyWithoutProspects);

  RepCampaignDetailDto createdById(String createdById);

  RepCampaignDetailDto createdByName(String createdByName);

  RepCampaignDetailDto commercialCount(num commercialCount);

  RepCampaignDetailDto spreadDays(num spreadDays);

  RepCampaignDetailDto progress(RepCampaignProgressDto progress);

  RepCampaignDetailDto createdAt(DateTime createdAt);

  RepCampaignDetailDto closedAt(DateTime? closedAt);

  RepCampaignDetailDto perDay(List<num> perDay);

  RepCampaignDetailDto commerciaux(List<RepCampaignCommercialDto> commerciaux);

  RepCampaignDetailDto recentAttempts(
    List<RepCampaignAttemptDto> recentAttempts,
  );

  /// This function **does support** nullification of nullable fields. All `null` values passed to `non-nullable` fields will be ignored. You can also use `RepCampaignDetailDto(...).copyWith.fieldName(...)` to override fields one at a time with nullification support.
  ///
  /// Usage
  /// ```dart
  /// RepCampaignDetailDto(...).copyWith(id: 12, name: "My name")
  /// ````
  RepCampaignDetailDto call({
    String id,
    String name,
    CampaignStatus status,
    String seed,
    String scopeLabel,
    String? departementId,
    String? iefId,
    bool onlyWithoutProspects,
    String createdById,
    String createdByName,
    num commercialCount,
    num spreadDays,
    RepCampaignProgressDto progress,
    DateTime createdAt,
    DateTime? closedAt,
    List<num> perDay,
    List<RepCampaignCommercialDto> commerciaux,
    List<RepCampaignAttemptDto> recentAttempts,
  });
}

/// Proxy class for `copyWith` functionality. This is a callable class and can be used as follows: `instanceOfRepCampaignDetailDto.copyWith(...)`. Additionally contains functions for specific fields e.g. `instanceOfRepCampaignDetailDto.copyWith.fieldName(...)`
class _$RepCampaignDetailDtoCWProxyImpl
    implements _$RepCampaignDetailDtoCWProxy {
  const _$RepCampaignDetailDtoCWProxyImpl(this._value);

  final RepCampaignDetailDto _value;

  @override
  RepCampaignDetailDto id(String id) => this(id: id);

  @override
  RepCampaignDetailDto name(String name) => this(name: name);

  @override
  RepCampaignDetailDto status(CampaignStatus status) => this(status: status);

  @override
  RepCampaignDetailDto seed(String seed) => this(seed: seed);

  @override
  RepCampaignDetailDto scopeLabel(String scopeLabel) =>
      this(scopeLabel: scopeLabel);

  @override
  RepCampaignDetailDto departementId(String? departementId) =>
      this(departementId: departementId);

  @override
  RepCampaignDetailDto iefId(String? iefId) => this(iefId: iefId);

  @override
  RepCampaignDetailDto onlyWithoutProspects(bool onlyWithoutProspects) =>
      this(onlyWithoutProspects: onlyWithoutProspects);

  @override
  RepCampaignDetailDto createdById(String createdById) =>
      this(createdById: createdById);

  @override
  RepCampaignDetailDto createdByName(String createdByName) =>
      this(createdByName: createdByName);

  @override
  RepCampaignDetailDto commercialCount(num commercialCount) =>
      this(commercialCount: commercialCount);

  @override
  RepCampaignDetailDto spreadDays(num spreadDays) =>
      this(spreadDays: spreadDays);

  @override
  RepCampaignDetailDto progress(RepCampaignProgressDto progress) =>
      this(progress: progress);

  @override
  RepCampaignDetailDto createdAt(DateTime createdAt) =>
      this(createdAt: createdAt);

  @override
  RepCampaignDetailDto closedAt(DateTime? closedAt) => this(closedAt: closedAt);

  @override
  RepCampaignDetailDto perDay(List<num> perDay) => this(perDay: perDay);

  @override
  RepCampaignDetailDto commerciaux(
    List<RepCampaignCommercialDto> commerciaux,
  ) => this(commerciaux: commerciaux);

  @override
  RepCampaignDetailDto recentAttempts(
    List<RepCampaignAttemptDto> recentAttempts,
  ) => this(recentAttempts: recentAttempts);

  @override
  /// This function **does support** nullification of nullable fields. All `null` values passed to `non-nullable` fields will be ignored. You can also use `RepCampaignDetailDto(...).copyWith.fieldName(...)` to override fields one at a time with nullification support.
  ///
  /// Usage
  /// ```dart
  /// RepCampaignDetailDto(...).copyWith(id: 12, name: "My name")
  /// ````
  RepCampaignDetailDto call({
    Object? id = const $CopyWithPlaceholder(),
    Object? name = const $CopyWithPlaceholder(),
    Object? status = const $CopyWithPlaceholder(),
    Object? seed = const $CopyWithPlaceholder(),
    Object? scopeLabel = const $CopyWithPlaceholder(),
    Object? departementId = const $CopyWithPlaceholder(),
    Object? iefId = const $CopyWithPlaceholder(),
    Object? onlyWithoutProspects = const $CopyWithPlaceholder(),
    Object? createdById = const $CopyWithPlaceholder(),
    Object? createdByName = const $CopyWithPlaceholder(),
    Object? commercialCount = const $CopyWithPlaceholder(),
    Object? spreadDays = const $CopyWithPlaceholder(),
    Object? progress = const $CopyWithPlaceholder(),
    Object? createdAt = const $CopyWithPlaceholder(),
    Object? closedAt = const $CopyWithPlaceholder(),
    Object? perDay = const $CopyWithPlaceholder(),
    Object? commerciaux = const $CopyWithPlaceholder(),
    Object? recentAttempts = const $CopyWithPlaceholder(),
  }) {
    return RepCampaignDetailDto(
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
      perDay: perDay == const $CopyWithPlaceholder()
          ? _value.perDay
          // ignore: cast_nullable_to_non_nullable
          : perDay as List<num>,
      commerciaux: commerciaux == const $CopyWithPlaceholder()
          ? _value.commerciaux
          // ignore: cast_nullable_to_non_nullable
          : commerciaux as List<RepCampaignCommercialDto>,
      recentAttempts: recentAttempts == const $CopyWithPlaceholder()
          ? _value.recentAttempts
          // ignore: cast_nullable_to_non_nullable
          : recentAttempts as List<RepCampaignAttemptDto>,
    );
  }
}

extension $RepCampaignDetailDtoCopyWith on RepCampaignDetailDto {
  /// Returns a callable class that can be used as follows: `instanceOfRepCampaignDetailDto.copyWith(...)` or like so:`instanceOfRepCampaignDetailDto.copyWith.fieldName(...)`.
  // ignore: library_private_types_in_public_api
  _$RepCampaignDetailDtoCWProxy get copyWith =>
      _$RepCampaignDetailDtoCWProxyImpl(this);
}

// **************************************************************************
// JsonSerializableGenerator
// **************************************************************************

RepCampaignDetailDto _$RepCampaignDetailDtoFromJson(
  Map<String, dynamic> json,
) => $checkedCreate('RepCampaignDetailDto', json, ($checkedConvert) {
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
      'createdById',
      'createdByName',
      'commercialCount',
      'spreadDays',
      'progress',
      'createdAt',
      'closedAt',
      'perDay',
      'commerciaux',
      'recentAttempts',
    ],
  );
  final val = RepCampaignDetailDto(
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
    perDay: $checkedConvert(
      'perDay',
      (v) => (v as List<dynamic>).map((e) => e as num).toList(),
    ),
    commerciaux: $checkedConvert(
      'commerciaux',
      (v) => (v as List<dynamic>)
          .map(
            (e) => RepCampaignCommercialDto.fromJson(e as Map<String, dynamic>),
          )
          .toList(),
    ),
    recentAttempts: $checkedConvert(
      'recentAttempts',
      (v) => (v as List<dynamic>)
          .map((e) => RepCampaignAttemptDto.fromJson(e as Map<String, dynamic>))
          .toList(),
    ),
  );
  return val;
});

Map<String, dynamic> _$RepCampaignDetailDtoToJson(
  RepCampaignDetailDto instance,
) => <String, dynamic>{
  'id': instance.id,
  'name': instance.name,
  'status': _$CampaignStatusEnumMap[instance.status]!,
  'seed': instance.seed,
  'scopeLabel': instance.scopeLabel,
  'departementId': instance.departementId,
  'iefId': instance.iefId,
  'onlyWithoutProspects': instance.onlyWithoutProspects,
  'createdById': instance.createdById,
  'createdByName': instance.createdByName,
  'commercialCount': instance.commercialCount,
  'spreadDays': instance.spreadDays,
  'progress': instance.progress.toJson(),
  'createdAt': instance.createdAt.toIso8601String(),
  'closedAt': instance.closedAt?.toIso8601String(),
  'perDay': instance.perDay,
  'commerciaux': instance.commerciaux.map((e) => e.toJson()).toList(),
  'recentAttempts': instance.recentAttempts.map((e) => e.toJson()).toList(),
};

const _$CampaignStatusEnumMap = {
  CampaignStatus.ACTIVE: 'ACTIVE',
  CampaignStatus.CLOSED: 'CLOSED',
  CampaignStatus.unknownDefaultOpenApi: 'unknown_default_open_api',
};

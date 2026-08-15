// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'rep_campaign_attempt_dto.dart';

// **************************************************************************
// CopyWithGenerator
// **************************************************************************

abstract class _$RepCampaignAttemptDtoCWProxy {
  RepCampaignAttemptDto id(String id);

  RepCampaignAttemptDto representantId(String representantId);

  RepCampaignAttemptDto shortCode(String shortCode);

  RepCampaignAttemptDto phoneE164(String phoneE164);

  RepCampaignAttemptDto outcome(RepCallOutcome outcome);

  RepCampaignAttemptDto promisedProspects(num? promisedProspects);

  RepCampaignAttemptDto comment(String? comment);

  RepCampaignAttemptDto performedById(String performedById);

  RepCampaignAttemptDto performedByName(String performedByName);

  RepCampaignAttemptDto assignedToId(String? assignedToId);

  RepCampaignAttemptDto createdAt(DateTime createdAt);

  /// This function **does support** nullification of nullable fields. All `null` values passed to `non-nullable` fields will be ignored. You can also use `RepCampaignAttemptDto(...).copyWith.fieldName(...)` to override fields one at a time with nullification support.
  ///
  /// Usage
  /// ```dart
  /// RepCampaignAttemptDto(...).copyWith(id: 12, name: "My name")
  /// ````
  RepCampaignAttemptDto call({
    String id,
    String representantId,
    String shortCode,
    String phoneE164,
    RepCallOutcome outcome,
    num? promisedProspects,
    String? comment,
    String performedById,
    String performedByName,
    String? assignedToId,
    DateTime createdAt,
  });
}

/// Proxy class for `copyWith` functionality. This is a callable class and can be used as follows: `instanceOfRepCampaignAttemptDto.copyWith(...)`. Additionally contains functions for specific fields e.g. `instanceOfRepCampaignAttemptDto.copyWith.fieldName(...)`
class _$RepCampaignAttemptDtoCWProxyImpl
    implements _$RepCampaignAttemptDtoCWProxy {
  const _$RepCampaignAttemptDtoCWProxyImpl(this._value);

  final RepCampaignAttemptDto _value;

  @override
  RepCampaignAttemptDto id(String id) => this(id: id);

  @override
  RepCampaignAttemptDto representantId(String representantId) =>
      this(representantId: representantId);

  @override
  RepCampaignAttemptDto shortCode(String shortCode) =>
      this(shortCode: shortCode);

  @override
  RepCampaignAttemptDto phoneE164(String phoneE164) =>
      this(phoneE164: phoneE164);

  @override
  RepCampaignAttemptDto outcome(RepCallOutcome outcome) =>
      this(outcome: outcome);

  @override
  RepCampaignAttemptDto promisedProspects(num? promisedProspects) =>
      this(promisedProspects: promisedProspects);

  @override
  RepCampaignAttemptDto comment(String? comment) => this(comment: comment);

  @override
  RepCampaignAttemptDto performedById(String performedById) =>
      this(performedById: performedById);

  @override
  RepCampaignAttemptDto performedByName(String performedByName) =>
      this(performedByName: performedByName);

  @override
  RepCampaignAttemptDto assignedToId(String? assignedToId) =>
      this(assignedToId: assignedToId);

  @override
  RepCampaignAttemptDto createdAt(DateTime createdAt) =>
      this(createdAt: createdAt);

  @override
  /// This function **does support** nullification of nullable fields. All `null` values passed to `non-nullable` fields will be ignored. You can also use `RepCampaignAttemptDto(...).copyWith.fieldName(...)` to override fields one at a time with nullification support.
  ///
  /// Usage
  /// ```dart
  /// RepCampaignAttemptDto(...).copyWith(id: 12, name: "My name")
  /// ````
  RepCampaignAttemptDto call({
    Object? id = const $CopyWithPlaceholder(),
    Object? representantId = const $CopyWithPlaceholder(),
    Object? shortCode = const $CopyWithPlaceholder(),
    Object? phoneE164 = const $CopyWithPlaceholder(),
    Object? outcome = const $CopyWithPlaceholder(),
    Object? promisedProspects = const $CopyWithPlaceholder(),
    Object? comment = const $CopyWithPlaceholder(),
    Object? performedById = const $CopyWithPlaceholder(),
    Object? performedByName = const $CopyWithPlaceholder(),
    Object? assignedToId = const $CopyWithPlaceholder(),
    Object? createdAt = const $CopyWithPlaceholder(),
  }) {
    return RepCampaignAttemptDto(
      id: id == const $CopyWithPlaceholder()
          ? _value.id
          // ignore: cast_nullable_to_non_nullable
          : id as String,
      representantId: representantId == const $CopyWithPlaceholder()
          ? _value.representantId
          // ignore: cast_nullable_to_non_nullable
          : representantId as String,
      shortCode: shortCode == const $CopyWithPlaceholder()
          ? _value.shortCode
          // ignore: cast_nullable_to_non_nullable
          : shortCode as String,
      phoneE164: phoneE164 == const $CopyWithPlaceholder()
          ? _value.phoneE164
          // ignore: cast_nullable_to_non_nullable
          : phoneE164 as String,
      outcome: outcome == const $CopyWithPlaceholder()
          ? _value.outcome
          // ignore: cast_nullable_to_non_nullable
          : outcome as RepCallOutcome,
      promisedProspects: promisedProspects == const $CopyWithPlaceholder()
          ? _value.promisedProspects
          // ignore: cast_nullable_to_non_nullable
          : promisedProspects as num?,
      comment: comment == const $CopyWithPlaceholder()
          ? _value.comment
          // ignore: cast_nullable_to_non_nullable
          : comment as String?,
      performedById: performedById == const $CopyWithPlaceholder()
          ? _value.performedById
          // ignore: cast_nullable_to_non_nullable
          : performedById as String,
      performedByName: performedByName == const $CopyWithPlaceholder()
          ? _value.performedByName
          // ignore: cast_nullable_to_non_nullable
          : performedByName as String,
      assignedToId: assignedToId == const $CopyWithPlaceholder()
          ? _value.assignedToId
          // ignore: cast_nullable_to_non_nullable
          : assignedToId as String?,
      createdAt: createdAt == const $CopyWithPlaceholder()
          ? _value.createdAt
          // ignore: cast_nullable_to_non_nullable
          : createdAt as DateTime,
    );
  }
}

extension $RepCampaignAttemptDtoCopyWith on RepCampaignAttemptDto {
  /// Returns a callable class that can be used as follows: `instanceOfRepCampaignAttemptDto.copyWith(...)` or like so:`instanceOfRepCampaignAttemptDto.copyWith.fieldName(...)`.
  // ignore: library_private_types_in_public_api
  _$RepCampaignAttemptDtoCWProxy get copyWith =>
      _$RepCampaignAttemptDtoCWProxyImpl(this);
}

// **************************************************************************
// JsonSerializableGenerator
// **************************************************************************

RepCampaignAttemptDto _$RepCampaignAttemptDtoFromJson(
  Map<String, dynamic> json,
) => $checkedCreate('RepCampaignAttemptDto', json, ($checkedConvert) {
  $checkKeys(
    json,
    requiredKeys: const [
      'id',
      'representantId',
      'shortCode',
      'phoneE164',
      'outcome',
      'promisedProspects',
      'comment',
      'performedById',
      'performedByName',
      'assignedToId',
      'createdAt',
    ],
  );
  final val = RepCampaignAttemptDto(
    id: $checkedConvert('id', (v) => v as String),
    representantId: $checkedConvert('representantId', (v) => v as String),
    shortCode: $checkedConvert('shortCode', (v) => v as String),
    phoneE164: $checkedConvert('phoneE164', (v) => v as String),
    outcome: $checkedConvert(
      'outcome',
      (v) => $enumDecode(
        _$RepCallOutcomeEnumMap,
        v,
        unknownValue: RepCallOutcome.unknownDefaultOpenApi,
      ),
    ),
    promisedProspects: $checkedConvert('promisedProspects', (v) => v as num?),
    comment: $checkedConvert('comment', (v) => v as String?),
    performedById: $checkedConvert('performedById', (v) => v as String),
    performedByName: $checkedConvert('performedByName', (v) => v as String),
    assignedToId: $checkedConvert('assignedToId', (v) => v as String?),
    createdAt: $checkedConvert('createdAt', (v) => DateTime.parse(v as String)),
  );
  return val;
});

Map<String, dynamic> _$RepCampaignAttemptDtoToJson(
  RepCampaignAttemptDto instance,
) => <String, dynamic>{
  'id': instance.id,
  'representantId': instance.representantId,
  'shortCode': instance.shortCode,
  'phoneE164': instance.phoneE164,
  'outcome': _$RepCallOutcomeEnumMap[instance.outcome]!,
  'promisedProspects': instance.promisedProspects,
  'comment': instance.comment,
  'performedById': instance.performedById,
  'performedByName': instance.performedByName,
  'assignedToId': instance.assignedToId,
  'createdAt': instance.createdAt.toIso8601String(),
};

const _$RepCallOutcomeEnumMap = {
  RepCallOutcome.REACHED: 'REACHED',
  RepCallOutcome.PROSPECTS_PROMISED: 'PROSPECTS_PROMISED',
  RepCallOutcome.UNREACHABLE: 'UNREACHABLE',
  RepCallOutcome.CALLBACK: 'CALLBACK',
  RepCallOutcome.REFUSED: 'REFUSED',
  RepCallOutcome.WRONG_NUMBER: 'WRONG_NUMBER',
  RepCallOutcome.OTHER: 'OTHER',
  RepCallOutcome.unknownDefaultOpenApi: 'unknown_default_open_api',
};

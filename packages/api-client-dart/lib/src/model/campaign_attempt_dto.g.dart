// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'campaign_attempt_dto.dart';

// **************************************************************************
// CopyWithGenerator
// **************************************************************************

abstract class _$CampaignAttemptDtoCWProxy {
  CampaignAttemptDto id(String id);

  CampaignAttemptDto prospectId(String prospectId);

  CampaignAttemptDto shortCode(String shortCode);

  CampaignAttemptDto phoneE164(String phoneE164);

  CampaignAttemptDto outcome(CallOutcome outcome);

  CampaignAttemptDto method(EnrollmentMethod? method);

  CampaignAttemptDto comment(String? comment);

  CampaignAttemptDto performedById(String performedById);

  CampaignAttemptDto performedByName(String performedByName);

  CampaignAttemptDto assignedToId(String? assignedToId);

  CampaignAttemptDto createdAt(DateTime createdAt);

  /// This function **does support** nullification of nullable fields. All `null` values passed to `non-nullable` fields will be ignored. You can also use `CampaignAttemptDto(...).copyWith.fieldName(...)` to override fields one at a time with nullification support.
  ///
  /// Usage
  /// ```dart
  /// CampaignAttemptDto(...).copyWith(id: 12, name: "My name")
  /// ````
  CampaignAttemptDto call({
    String id,
    String prospectId,
    String shortCode,
    String phoneE164,
    CallOutcome outcome,
    EnrollmentMethod? method,
    String? comment,
    String performedById,
    String performedByName,
    String? assignedToId,
    DateTime createdAt,
  });
}

/// Proxy class for `copyWith` functionality. This is a callable class and can be used as follows: `instanceOfCampaignAttemptDto.copyWith(...)`. Additionally contains functions for specific fields e.g. `instanceOfCampaignAttemptDto.copyWith.fieldName(...)`
class _$CampaignAttemptDtoCWProxyImpl implements _$CampaignAttemptDtoCWProxy {
  const _$CampaignAttemptDtoCWProxyImpl(this._value);

  final CampaignAttemptDto _value;

  @override
  CampaignAttemptDto id(String id) => this(id: id);

  @override
  CampaignAttemptDto prospectId(String prospectId) =>
      this(prospectId: prospectId);

  @override
  CampaignAttemptDto shortCode(String shortCode) => this(shortCode: shortCode);

  @override
  CampaignAttemptDto phoneE164(String phoneE164) => this(phoneE164: phoneE164);

  @override
  CampaignAttemptDto outcome(CallOutcome outcome) => this(outcome: outcome);

  @override
  CampaignAttemptDto method(EnrollmentMethod? method) => this(method: method);

  @override
  CampaignAttemptDto comment(String? comment) => this(comment: comment);

  @override
  CampaignAttemptDto performedById(String performedById) =>
      this(performedById: performedById);

  @override
  CampaignAttemptDto performedByName(String performedByName) =>
      this(performedByName: performedByName);

  @override
  CampaignAttemptDto assignedToId(String? assignedToId) =>
      this(assignedToId: assignedToId);

  @override
  CampaignAttemptDto createdAt(DateTime createdAt) =>
      this(createdAt: createdAt);

  @override
  /// This function **does support** nullification of nullable fields. All `null` values passed to `non-nullable` fields will be ignored. You can also use `CampaignAttemptDto(...).copyWith.fieldName(...)` to override fields one at a time with nullification support.
  ///
  /// Usage
  /// ```dart
  /// CampaignAttemptDto(...).copyWith(id: 12, name: "My name")
  /// ````
  CampaignAttemptDto call({
    Object? id = const $CopyWithPlaceholder(),
    Object? prospectId = const $CopyWithPlaceholder(),
    Object? shortCode = const $CopyWithPlaceholder(),
    Object? phoneE164 = const $CopyWithPlaceholder(),
    Object? outcome = const $CopyWithPlaceholder(),
    Object? method = const $CopyWithPlaceholder(),
    Object? comment = const $CopyWithPlaceholder(),
    Object? performedById = const $CopyWithPlaceholder(),
    Object? performedByName = const $CopyWithPlaceholder(),
    Object? assignedToId = const $CopyWithPlaceholder(),
    Object? createdAt = const $CopyWithPlaceholder(),
  }) {
    return CampaignAttemptDto(
      id: id == const $CopyWithPlaceholder()
          ? _value.id
          // ignore: cast_nullable_to_non_nullable
          : id as String,
      prospectId: prospectId == const $CopyWithPlaceholder()
          ? _value.prospectId
          // ignore: cast_nullable_to_non_nullable
          : prospectId as String,
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
          : outcome as CallOutcome,
      method: method == const $CopyWithPlaceholder()
          ? _value.method
          // ignore: cast_nullable_to_non_nullable
          : method as EnrollmentMethod?,
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

extension $CampaignAttemptDtoCopyWith on CampaignAttemptDto {
  /// Returns a callable class that can be used as follows: `instanceOfCampaignAttemptDto.copyWith(...)` or like so:`instanceOfCampaignAttemptDto.copyWith.fieldName(...)`.
  // ignore: library_private_types_in_public_api
  _$CampaignAttemptDtoCWProxy get copyWith =>
      _$CampaignAttemptDtoCWProxyImpl(this);
}

// **************************************************************************
// JsonSerializableGenerator
// **************************************************************************

CampaignAttemptDto _$CampaignAttemptDtoFromJson(Map<String, dynamic> json) =>
    $checkedCreate('CampaignAttemptDto', json, ($checkedConvert) {
      $checkKeys(
        json,
        requiredKeys: const [
          'id',
          'prospectId',
          'shortCode',
          'phoneE164',
          'outcome',
          'method',
          'comment',
          'performedById',
          'performedByName',
          'assignedToId',
          'createdAt',
        ],
      );
      final val = CampaignAttemptDto(
        id: $checkedConvert('id', (v) => v as String),
        prospectId: $checkedConvert('prospectId', (v) => v as String),
        shortCode: $checkedConvert('shortCode', (v) => v as String),
        phoneE164: $checkedConvert('phoneE164', (v) => v as String),
        outcome: $checkedConvert(
          'outcome',
          (v) => $enumDecode(
            _$CallOutcomeEnumMap,
            v,
            unknownValue: CallOutcome.unknownDefaultOpenApi,
          ),
        ),
        method: $checkedConvert(
          'method',
          (v) => $enumDecodeNullable(
            _$EnrollmentMethodEnumMap,
            v,
            unknownValue: EnrollmentMethod.unknownDefaultOpenApi,
          ),
        ),
        comment: $checkedConvert('comment', (v) => v as String?),
        performedById: $checkedConvert('performedById', (v) => v as String),
        performedByName: $checkedConvert('performedByName', (v) => v as String),
        assignedToId: $checkedConvert('assignedToId', (v) => v as String?),
        createdAt: $checkedConvert(
          'createdAt',
          (v) => DateTime.parse(v as String),
        ),
      );
      return val;
    });

Map<String, dynamic> _$CampaignAttemptDtoToJson(CampaignAttemptDto instance) =>
    <String, dynamic>{
      'id': instance.id,
      'prospectId': instance.prospectId,
      'shortCode': instance.shortCode,
      'phoneE164': instance.phoneE164,
      'outcome': _$CallOutcomeEnumMap[instance.outcome]!,
      'method': _$EnrollmentMethodEnumMap[instance.method],
      'comment': instance.comment,
      'performedById': instance.performedById,
      'performedByName': instance.performedByName,
      'assignedToId': instance.assignedToId,
      'createdAt': instance.createdAt.toIso8601String(),
    };

const _$CallOutcomeEnumMap = {
  CallOutcome.METHOD_OBTAINED: 'METHOD_OBTAINED',
  CallOutcome.UNREACHABLE: 'UNREACHABLE',
  CallOutcome.CALLBACK: 'CALLBACK',
  CallOutcome.REFUSED: 'REFUSED',
  CallOutcome.WRONG_NUMBER: 'WRONG_NUMBER',
  CallOutcome.OTHER: 'OTHER',
  CallOutcome.unknownDefaultOpenApi: 'unknown_default_open_api',
};

const _$EnrollmentMethodEnumMap = {
  EnrollmentMethod.PLATFORM: 'PLATFORM',
  EnrollmentMethod.PHYSICAL: 'PHYSICAL',
  EnrollmentMethod.VOICE_OR_ELECTRONIC_MESSAGING:
      'VOICE_OR_ELECTRONIC_MESSAGING',
  EnrollmentMethod.unknownDefaultOpenApi: 'unknown_default_open_api',
};

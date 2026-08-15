// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'create_rep_call_attempt_dto.dart';

// **************************************************************************
// CopyWithGenerator
// **************************************************************************

abstract class _$CreateRepCallAttemptDtoCWProxy {
  CreateRepCallAttemptDto id(String id);

  CreateRepCallAttemptDto representantId(String representantId);

  CreateRepCallAttemptDto outcome(RepCallOutcome outcome);

  CreateRepCallAttemptDto promisedProspects(num? promisedProspects);

  CreateRepCallAttemptDto comment(String? comment);

  CreateRepCallAttemptDto clientCreatedAt(DateTime clientCreatedAt);

  /// This function **does support** nullification of nullable fields. All `null` values passed to `non-nullable` fields will be ignored. You can also use `CreateRepCallAttemptDto(...).copyWith.fieldName(...)` to override fields one at a time with nullification support.
  ///
  /// Usage
  /// ```dart
  /// CreateRepCallAttemptDto(...).copyWith(id: 12, name: "My name")
  /// ````
  CreateRepCallAttemptDto call({
    String id,
    String representantId,
    RepCallOutcome outcome,
    num? promisedProspects,
    String? comment,
    DateTime clientCreatedAt,
  });
}

/// Proxy class for `copyWith` functionality. This is a callable class and can be used as follows: `instanceOfCreateRepCallAttemptDto.copyWith(...)`. Additionally contains functions for specific fields e.g. `instanceOfCreateRepCallAttemptDto.copyWith.fieldName(...)`
class _$CreateRepCallAttemptDtoCWProxyImpl
    implements _$CreateRepCallAttemptDtoCWProxy {
  const _$CreateRepCallAttemptDtoCWProxyImpl(this._value);

  final CreateRepCallAttemptDto _value;

  @override
  CreateRepCallAttemptDto id(String id) => this(id: id);

  @override
  CreateRepCallAttemptDto representantId(String representantId) =>
      this(representantId: representantId);

  @override
  CreateRepCallAttemptDto outcome(RepCallOutcome outcome) =>
      this(outcome: outcome);

  @override
  CreateRepCallAttemptDto promisedProspects(num? promisedProspects) =>
      this(promisedProspects: promisedProspects);

  @override
  CreateRepCallAttemptDto comment(String? comment) => this(comment: comment);

  @override
  CreateRepCallAttemptDto clientCreatedAt(DateTime clientCreatedAt) =>
      this(clientCreatedAt: clientCreatedAt);

  @override
  /// This function **does support** nullification of nullable fields. All `null` values passed to `non-nullable` fields will be ignored. You can also use `CreateRepCallAttemptDto(...).copyWith.fieldName(...)` to override fields one at a time with nullification support.
  ///
  /// Usage
  /// ```dart
  /// CreateRepCallAttemptDto(...).copyWith(id: 12, name: "My name")
  /// ````
  CreateRepCallAttemptDto call({
    Object? id = const $CopyWithPlaceholder(),
    Object? representantId = const $CopyWithPlaceholder(),
    Object? outcome = const $CopyWithPlaceholder(),
    Object? promisedProspects = const $CopyWithPlaceholder(),
    Object? comment = const $CopyWithPlaceholder(),
    Object? clientCreatedAt = const $CopyWithPlaceholder(),
  }) {
    return CreateRepCallAttemptDto(
      id: id == const $CopyWithPlaceholder()
          ? _value.id
          // ignore: cast_nullable_to_non_nullable
          : id as String,
      representantId: representantId == const $CopyWithPlaceholder()
          ? _value.representantId
          // ignore: cast_nullable_to_non_nullable
          : representantId as String,
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
      clientCreatedAt: clientCreatedAt == const $CopyWithPlaceholder()
          ? _value.clientCreatedAt
          // ignore: cast_nullable_to_non_nullable
          : clientCreatedAt as DateTime,
    );
  }
}

extension $CreateRepCallAttemptDtoCopyWith on CreateRepCallAttemptDto {
  /// Returns a callable class that can be used as follows: `instanceOfCreateRepCallAttemptDto.copyWith(...)` or like so:`instanceOfCreateRepCallAttemptDto.copyWith.fieldName(...)`.
  // ignore: library_private_types_in_public_api
  _$CreateRepCallAttemptDtoCWProxy get copyWith =>
      _$CreateRepCallAttemptDtoCWProxyImpl(this);
}

// **************************************************************************
// JsonSerializableGenerator
// **************************************************************************

CreateRepCallAttemptDto _$CreateRepCallAttemptDtoFromJson(
  Map<String, dynamic> json,
) => $checkedCreate('CreateRepCallAttemptDto', json, ($checkedConvert) {
  $checkKeys(
    json,
    requiredKeys: const ['id', 'representantId', 'outcome', 'clientCreatedAt'],
  );
  final val = CreateRepCallAttemptDto(
    id: $checkedConvert('id', (v) => v as String),
    representantId: $checkedConvert('representantId', (v) => v as String),
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
    clientCreatedAt: $checkedConvert(
      'clientCreatedAt',
      (v) => DateTime.parse(v as String),
    ),
  );
  return val;
});

Map<String, dynamic> _$CreateRepCallAttemptDtoToJson(
  CreateRepCallAttemptDto instance,
) => <String, dynamic>{
  'id': instance.id,
  'representantId': instance.representantId,
  'outcome': _$RepCallOutcomeEnumMap[instance.outcome]!,
  if (instance.promisedProspects case final value?) 'promisedProspects': value,
  if (instance.comment case final value?) 'comment': value,
  'clientCreatedAt': instance.clientCreatedAt.toIso8601String(),
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

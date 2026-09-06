// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'create_statut_qualification_dto.dart';

// **************************************************************************
// CopyWithGenerator
// **************************************************************************

abstract class _$CreateStatutQualificationDtoCWProxy {
  CreateStatutQualificationDto label(String label);

  CreateStatutQualificationDto effect(StatutQualificationEffect effect);

  CreateStatutQualificationDto requiresCallback(bool? requiresCallback);

  CreateStatutQualificationDto requiresComment(bool? requiresComment);

  CreateStatutQualificationDto retryAfterMinutes(num? retryAfterMinutes);

  CreateStatutQualificationDto priorite(PrioriteTraitement? priorite);

  CreateStatutQualificationDto relationStatus(
    RepresentantRelation? relationStatus,
  );

  /// This function **does support** nullification of nullable fields. All `null` values passed to `non-nullable` fields will be ignored. You can also use `CreateStatutQualificationDto(...).copyWith.fieldName(...)` to override fields one at a time with nullification support.
  ///
  /// Usage
  /// ```dart
  /// CreateStatutQualificationDto(...).copyWith(id: 12, name: "My name")
  /// ````
  CreateStatutQualificationDto call({
    String label,
    StatutQualificationEffect effect,
    bool? requiresCallback,
    bool? requiresComment,
    num? retryAfterMinutes,
    PrioriteTraitement? priorite,
    RepresentantRelation? relationStatus,
  });
}

/// Proxy class for `copyWith` functionality. This is a callable class and can be used as follows: `instanceOfCreateStatutQualificationDto.copyWith(...)`. Additionally contains functions for specific fields e.g. `instanceOfCreateStatutQualificationDto.copyWith.fieldName(...)`
class _$CreateStatutQualificationDtoCWProxyImpl
    implements _$CreateStatutQualificationDtoCWProxy {
  const _$CreateStatutQualificationDtoCWProxyImpl(this._value);

  final CreateStatutQualificationDto _value;

  @override
  CreateStatutQualificationDto label(String label) => this(label: label);

  @override
  CreateStatutQualificationDto effect(StatutQualificationEffect effect) =>
      this(effect: effect);

  @override
  CreateStatutQualificationDto requiresCallback(bool? requiresCallback) =>
      this(requiresCallback: requiresCallback);

  @override
  CreateStatutQualificationDto requiresComment(bool? requiresComment) =>
      this(requiresComment: requiresComment);

  @override
  CreateStatutQualificationDto retryAfterMinutes(num? retryAfterMinutes) =>
      this(retryAfterMinutes: retryAfterMinutes);

  @override
  CreateStatutQualificationDto priorite(PrioriteTraitement? priorite) =>
      this(priorite: priorite);

  @override
  CreateStatutQualificationDto relationStatus(
    RepresentantRelation? relationStatus,
  ) => this(relationStatus: relationStatus);

  @override
  /// This function **does support** nullification of nullable fields. All `null` values passed to `non-nullable` fields will be ignored. You can also use `CreateStatutQualificationDto(...).copyWith.fieldName(...)` to override fields one at a time with nullification support.
  ///
  /// Usage
  /// ```dart
  /// CreateStatutQualificationDto(...).copyWith(id: 12, name: "My name")
  /// ````
  CreateStatutQualificationDto call({
    Object? label = const $CopyWithPlaceholder(),
    Object? effect = const $CopyWithPlaceholder(),
    Object? requiresCallback = const $CopyWithPlaceholder(),
    Object? requiresComment = const $CopyWithPlaceholder(),
    Object? retryAfterMinutes = const $CopyWithPlaceholder(),
    Object? priorite = const $CopyWithPlaceholder(),
    Object? relationStatus = const $CopyWithPlaceholder(),
  }) {
    return CreateStatutQualificationDto(
      label: label == const $CopyWithPlaceholder()
          ? _value.label
          // ignore: cast_nullable_to_non_nullable
          : label as String,
      effect: effect == const $CopyWithPlaceholder()
          ? _value.effect
          // ignore: cast_nullable_to_non_nullable
          : effect as StatutQualificationEffect,
      requiresCallback: requiresCallback == const $CopyWithPlaceholder()
          ? _value.requiresCallback
          // ignore: cast_nullable_to_non_nullable
          : requiresCallback as bool?,
      requiresComment: requiresComment == const $CopyWithPlaceholder()
          ? _value.requiresComment
          // ignore: cast_nullable_to_non_nullable
          : requiresComment as bool?,
      retryAfterMinutes: retryAfterMinutes == const $CopyWithPlaceholder()
          ? _value.retryAfterMinutes
          // ignore: cast_nullable_to_non_nullable
          : retryAfterMinutes as num?,
      priorite: priorite == const $CopyWithPlaceholder()
          ? _value.priorite
          // ignore: cast_nullable_to_non_nullable
          : priorite as PrioriteTraitement?,
      relationStatus: relationStatus == const $CopyWithPlaceholder()
          ? _value.relationStatus
          // ignore: cast_nullable_to_non_nullable
          : relationStatus as RepresentantRelation?,
    );
  }
}

extension $CreateStatutQualificationDtoCopyWith
    on CreateStatutQualificationDto {
  /// Returns a callable class that can be used as follows: `instanceOfCreateStatutQualificationDto.copyWith(...)` or like so:`instanceOfCreateStatutQualificationDto.copyWith.fieldName(...)`.
  // ignore: library_private_types_in_public_api
  _$CreateStatutQualificationDtoCWProxy get copyWith =>
      _$CreateStatutQualificationDtoCWProxyImpl(this);
}

// **************************************************************************
// JsonSerializableGenerator
// **************************************************************************

CreateStatutQualificationDto _$CreateStatutQualificationDtoFromJson(
  Map<String, dynamic> json,
) => $checkedCreate('CreateStatutQualificationDto', json, ($checkedConvert) {
  $checkKeys(json, requiredKeys: const ['label', 'effect']);
  final val = CreateStatutQualificationDto(
    label: $checkedConvert('label', (v) => v as String),
    effect: $checkedConvert(
      'effect',
      (v) => $enumDecode(
        _$StatutQualificationEffectEnumMap,
        v,
        unknownValue: StatutQualificationEffect.unknownDefaultOpenApi,
      ),
    ),
    requiresCallback: $checkedConvert(
      'requiresCallback',
      (v) => v as bool? ?? false,
    ),
    requiresComment: $checkedConvert(
      'requiresComment',
      (v) => v as bool? ?? false,
    ),
    retryAfterMinutes: $checkedConvert('retryAfterMinutes', (v) => v as num?),
    priorite: $checkedConvert(
      'priorite',
      (v) =>
          $enumDecodeNullable(
            _$PrioriteTraitementEnumMap,
            v,
            unknownValue: PrioriteTraitement.unknownDefaultOpenApi,
          ) ??
          PrioriteTraitement.NORMALE,
    ),
    relationStatus: $checkedConvert(
      'relationStatus',
      (v) => $enumDecodeNullable(
        _$RepresentantRelationEnumMap,
        v,
        unknownValue: RepresentantRelation.unknownDefaultOpenApi,
      ),
    ),
  );
  return val;
});

Map<String, dynamic> _$CreateStatutQualificationDtoToJson(
  CreateStatutQualificationDto instance,
) => <String, dynamic>{
  'label': instance.label,
  'effect': _$StatutQualificationEffectEnumMap[instance.effect]!,
  if (instance.requiresCallback case final value?) 'requiresCallback': value,
  if (instance.requiresComment case final value?) 'requiresComment': value,
  if (instance.retryAfterMinutes case final value?) 'retryAfterMinutes': value,
  if (_$PrioriteTraitementEnumMap[instance.priorite] case final value?)
    'priorite': value,
  if (_$RepresentantRelationEnumMap[instance.relationStatus] case final value?)
    'relationStatus': value,
};

const _$StatutQualificationEffectEnumMap = {
  StatutQualificationEffect.REACHED: 'REACHED',
  StatutQualificationEffect.REFUSED: 'REFUSED',
  StatutQualificationEffect.SCHEDULE_CALLBACK: 'SCHEDULE_CALLBACK',
  StatutQualificationEffect.UNREACHABLE: 'UNREACHABLE',
  StatutQualificationEffect.WRONG_NUMBER: 'WRONG_NUMBER',
  StatutQualificationEffect.unknownDefaultOpenApi: 'unknown_default_open_api',
};

const _$PrioriteTraitementEnumMap = {
  PrioriteTraitement.HAUTE: 'HAUTE',
  PrioriteTraitement.NORMALE: 'NORMALE',
  PrioriteTraitement.BASSE: 'BASSE',
  PrioriteTraitement.unknownDefaultOpenApi: 'unknown_default_open_api',
};

const _$RepresentantRelationEnumMap = {
  RepresentantRelation.INCONNU: 'INCONNU',
  RepresentantRelation.CONTACTE: 'CONTACTE',
  RepresentantRelation.AMBASSADEUR: 'AMBASSADEUR',
  RepresentantRelation.REFUS: 'REFUS',
  RepresentantRelation.unknownDefaultOpenApi: 'unknown_default_open_api',
};

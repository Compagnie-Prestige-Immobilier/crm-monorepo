// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'statut_qualification_dto.dart';

// **************************************************************************
// CopyWithGenerator
// **************************************************************************

abstract class _$StatutQualificationDtoCWProxy {
  StatutQualificationDto id(String id);

  StatutQualificationDto code(String code);

  StatutQualificationDto label(String label);

  StatutQualificationDto effect(StatutQualificationEffect effect);

  StatutQualificationDto requiresCallback(bool requiresCallback);

  StatutQualificationDto priorite(PrioriteTraitement priorite);

  StatutQualificationDto relationStatus(RepresentantRelation? relationStatus);

  StatutQualificationDto isActive(bool isActive);

  StatutQualificationDto isSystem(bool isSystem);

  StatutQualificationDto minPayloadVersion(num minPayloadVersion);

  StatutQualificationDto updatedAt(DateTime updatedAt);

  /// This function **does support** nullification of nullable fields. All `null` values passed to `non-nullable` fields will be ignored. You can also use `StatutQualificationDto(...).copyWith.fieldName(...)` to override fields one at a time with nullification support.
  ///
  /// Usage
  /// ```dart
  /// StatutQualificationDto(...).copyWith(id: 12, name: "My name")
  /// ````
  StatutQualificationDto call({
    String id,
    String code,
    String label,
    StatutQualificationEffect effect,
    bool requiresCallback,
    PrioriteTraitement priorite,
    RepresentantRelation? relationStatus,
    bool isActive,
    bool isSystem,
    num minPayloadVersion,
    DateTime updatedAt,
  });
}

/// Proxy class for `copyWith` functionality. This is a callable class and can be used as follows: `instanceOfStatutQualificationDto.copyWith(...)`. Additionally contains functions for specific fields e.g. `instanceOfStatutQualificationDto.copyWith.fieldName(...)`
class _$StatutQualificationDtoCWProxyImpl
    implements _$StatutQualificationDtoCWProxy {
  const _$StatutQualificationDtoCWProxyImpl(this._value);

  final StatutQualificationDto _value;

  @override
  StatutQualificationDto id(String id) => this(id: id);

  @override
  StatutQualificationDto code(String code) => this(code: code);

  @override
  StatutQualificationDto label(String label) => this(label: label);

  @override
  StatutQualificationDto effect(StatutQualificationEffect effect) =>
      this(effect: effect);

  @override
  StatutQualificationDto requiresCallback(bool requiresCallback) =>
      this(requiresCallback: requiresCallback);

  @override
  StatutQualificationDto priorite(PrioriteTraitement priorite) =>
      this(priorite: priorite);

  @override
  StatutQualificationDto relationStatus(RepresentantRelation? relationStatus) =>
      this(relationStatus: relationStatus);

  @override
  StatutQualificationDto isActive(bool isActive) => this(isActive: isActive);

  @override
  StatutQualificationDto isSystem(bool isSystem) => this(isSystem: isSystem);

  @override
  StatutQualificationDto minPayloadVersion(num minPayloadVersion) =>
      this(minPayloadVersion: minPayloadVersion);

  @override
  StatutQualificationDto updatedAt(DateTime updatedAt) =>
      this(updatedAt: updatedAt);

  @override
  /// This function **does support** nullification of nullable fields. All `null` values passed to `non-nullable` fields will be ignored. You can also use `StatutQualificationDto(...).copyWith.fieldName(...)` to override fields one at a time with nullification support.
  ///
  /// Usage
  /// ```dart
  /// StatutQualificationDto(...).copyWith(id: 12, name: "My name")
  /// ````
  StatutQualificationDto call({
    Object? id = const $CopyWithPlaceholder(),
    Object? code = const $CopyWithPlaceholder(),
    Object? label = const $CopyWithPlaceholder(),
    Object? effect = const $CopyWithPlaceholder(),
    Object? requiresCallback = const $CopyWithPlaceholder(),
    Object? priorite = const $CopyWithPlaceholder(),
    Object? relationStatus = const $CopyWithPlaceholder(),
    Object? isActive = const $CopyWithPlaceholder(),
    Object? isSystem = const $CopyWithPlaceholder(),
    Object? minPayloadVersion = const $CopyWithPlaceholder(),
    Object? updatedAt = const $CopyWithPlaceholder(),
  }) {
    return StatutQualificationDto(
      id: id == const $CopyWithPlaceholder()
          ? _value.id
          // ignore: cast_nullable_to_non_nullable
          : id as String,
      code: code == const $CopyWithPlaceholder()
          ? _value.code
          // ignore: cast_nullable_to_non_nullable
          : code as String,
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
          : requiresCallback as bool,
      priorite: priorite == const $CopyWithPlaceholder()
          ? _value.priorite
          // ignore: cast_nullable_to_non_nullable
          : priorite as PrioriteTraitement,
      relationStatus: relationStatus == const $CopyWithPlaceholder()
          ? _value.relationStatus
          // ignore: cast_nullable_to_non_nullable
          : relationStatus as RepresentantRelation?,
      isActive: isActive == const $CopyWithPlaceholder()
          ? _value.isActive
          // ignore: cast_nullable_to_non_nullable
          : isActive as bool,
      isSystem: isSystem == const $CopyWithPlaceholder()
          ? _value.isSystem
          // ignore: cast_nullable_to_non_nullable
          : isSystem as bool,
      minPayloadVersion: minPayloadVersion == const $CopyWithPlaceholder()
          ? _value.minPayloadVersion
          // ignore: cast_nullable_to_non_nullable
          : minPayloadVersion as num,
      updatedAt: updatedAt == const $CopyWithPlaceholder()
          ? _value.updatedAt
          // ignore: cast_nullable_to_non_nullable
          : updatedAt as DateTime,
    );
  }
}

extension $StatutQualificationDtoCopyWith on StatutQualificationDto {
  /// Returns a callable class that can be used as follows: `instanceOfStatutQualificationDto.copyWith(...)` or like so:`instanceOfStatutQualificationDto.copyWith.fieldName(...)`.
  // ignore: library_private_types_in_public_api
  _$StatutQualificationDtoCWProxy get copyWith =>
      _$StatutQualificationDtoCWProxyImpl(this);
}

// **************************************************************************
// JsonSerializableGenerator
// **************************************************************************

StatutQualificationDto _$StatutQualificationDtoFromJson(
  Map<String, dynamic> json,
) => $checkedCreate('StatutQualificationDto', json, ($checkedConvert) {
  $checkKeys(
    json,
    requiredKeys: const [
      'id',
      'code',
      'label',
      'effect',
      'requiresCallback',
      'priorite',
      'relationStatus',
      'isActive',
      'isSystem',
      'minPayloadVersion',
      'updatedAt',
    ],
  );
  final val = StatutQualificationDto(
    id: $checkedConvert('id', (v) => v as String),
    code: $checkedConvert('code', (v) => v as String),
    label: $checkedConvert('label', (v) => v as String),
    effect: $checkedConvert(
      'effect',
      (v) => $enumDecode(
        _$StatutQualificationEffectEnumMap,
        v,
        unknownValue: StatutQualificationEffect.unknownDefaultOpenApi,
      ),
    ),
    requiresCallback: $checkedConvert('requiresCallback', (v) => v as bool),
    priorite: $checkedConvert(
      'priorite',
      (v) => $enumDecode(
        _$PrioriteTraitementEnumMap,
        v,
        unknownValue: PrioriteTraitement.unknownDefaultOpenApi,
      ),
    ),
    relationStatus: $checkedConvert(
      'relationStatus',
      (v) => $enumDecodeNullable(
        _$RepresentantRelationEnumMap,
        v,
        unknownValue: RepresentantRelation.unknownDefaultOpenApi,
      ),
    ),
    isActive: $checkedConvert('isActive', (v) => v as bool),
    isSystem: $checkedConvert('isSystem', (v) => v as bool),
    minPayloadVersion: $checkedConvert('minPayloadVersion', (v) => v as num),
    updatedAt: $checkedConvert('updatedAt', (v) => DateTime.parse(v as String)),
  );
  return val;
});

Map<String, dynamic> _$StatutQualificationDtoToJson(
  StatutQualificationDto instance,
) => <String, dynamic>{
  'id': instance.id,
  'code': instance.code,
  'label': instance.label,
  'effect': _$StatutQualificationEffectEnumMap[instance.effect]!,
  'requiresCallback': instance.requiresCallback,
  'priorite': _$PrioriteTraitementEnumMap[instance.priorite]!,
  'relationStatus': _$RepresentantRelationEnumMap[instance.relationStatus],
  'isActive': instance.isActive,
  'isSystem': instance.isSystem,
  'minPayloadVersion': instance.minPayloadVersion,
  'updatedAt': instance.updatedAt.toIso8601String(),
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

// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'create_statut_qualification_dto.dart';

// **************************************************************************
// CopyWithGenerator
// **************************************************************************

abstract class _$CreateStatutQualificationDtoCWProxy {
  CreateStatutQualificationDto code(String code);

  CreateStatutQualificationDto label(String label);

  CreateStatutQualificationDto effect(StatutQualificationEffect effect);

  CreateStatutQualificationDto requiresCallback(bool? requiresCallback);

  CreateStatutQualificationDto sortOrder(num? sortOrder);

  /// This function **does support** nullification of nullable fields. All `null` values passed to `non-nullable` fields will be ignored. You can also use `CreateStatutQualificationDto(...).copyWith.fieldName(...)` to override fields one at a time with nullification support.
  ///
  /// Usage
  /// ```dart
  /// CreateStatutQualificationDto(...).copyWith(id: 12, name: "My name")
  /// ````
  CreateStatutQualificationDto call({
    String code,
    String label,
    StatutQualificationEffect effect,
    bool? requiresCallback,
    num? sortOrder,
  });
}

/// Proxy class for `copyWith` functionality. This is a callable class and can be used as follows: `instanceOfCreateStatutQualificationDto.copyWith(...)`. Additionally contains functions for specific fields e.g. `instanceOfCreateStatutQualificationDto.copyWith.fieldName(...)`
class _$CreateStatutQualificationDtoCWProxyImpl
    implements _$CreateStatutQualificationDtoCWProxy {
  const _$CreateStatutQualificationDtoCWProxyImpl(this._value);

  final CreateStatutQualificationDto _value;

  @override
  CreateStatutQualificationDto code(String code) => this(code: code);

  @override
  CreateStatutQualificationDto label(String label) => this(label: label);

  @override
  CreateStatutQualificationDto effect(StatutQualificationEffect effect) =>
      this(effect: effect);

  @override
  CreateStatutQualificationDto requiresCallback(bool? requiresCallback) =>
      this(requiresCallback: requiresCallback);

  @override
  CreateStatutQualificationDto sortOrder(num? sortOrder) =>
      this(sortOrder: sortOrder);

  @override
  /// This function **does support** nullification of nullable fields. All `null` values passed to `non-nullable` fields will be ignored. You can also use `CreateStatutQualificationDto(...).copyWith.fieldName(...)` to override fields one at a time with nullification support.
  ///
  /// Usage
  /// ```dart
  /// CreateStatutQualificationDto(...).copyWith(id: 12, name: "My name")
  /// ````
  CreateStatutQualificationDto call({
    Object? code = const $CopyWithPlaceholder(),
    Object? label = const $CopyWithPlaceholder(),
    Object? effect = const $CopyWithPlaceholder(),
    Object? requiresCallback = const $CopyWithPlaceholder(),
    Object? sortOrder = const $CopyWithPlaceholder(),
  }) {
    return CreateStatutQualificationDto(
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
          : requiresCallback as bool?,
      sortOrder: sortOrder == const $CopyWithPlaceholder()
          ? _value.sortOrder
          // ignore: cast_nullable_to_non_nullable
          : sortOrder as num?,
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
  $checkKeys(json, requiredKeys: const ['code', 'label', 'effect']);
  final val = CreateStatutQualificationDto(
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
    requiresCallback: $checkedConvert(
      'requiresCallback',
      (v) => v as bool? ?? false,
    ),
    sortOrder: $checkedConvert('sortOrder', (v) => v as num? ?? 100),
  );
  return val;
});

Map<String, dynamic> _$CreateStatutQualificationDtoToJson(
  CreateStatutQualificationDto instance,
) => <String, dynamic>{
  'code': instance.code,
  'label': instance.label,
  'effect': _$StatutQualificationEffectEnumMap[instance.effect]!,
  if (instance.requiresCallback case final value?) 'requiresCallback': value,
  if (instance.sortOrder case final value?) 'sortOrder': value,
};

const _$StatutQualificationEffectEnumMap = {
  StatutQualificationEffect.REACHED: 'REACHED',
  StatutQualificationEffect.REFUSED: 'REFUSED',
  StatutQualificationEffect.SCHEDULE_CALLBACK: 'SCHEDULE_CALLBACK',
  StatutQualificationEffect.UNREACHABLE: 'UNREACHABLE',
  StatutQualificationEffect.WRONG_NUMBER: 'WRONG_NUMBER',
  StatutQualificationEffect.unknownDefaultOpenApi: 'unknown_default_open_api',
};

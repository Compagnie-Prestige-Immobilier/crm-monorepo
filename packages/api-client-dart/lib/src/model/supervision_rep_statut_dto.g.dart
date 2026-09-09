// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'supervision_rep_statut_dto.dart';

// **************************************************************************
// CopyWithGenerator
// **************************************************************************

abstract class _$SupervisionRepStatutDtoCWProxy {
  SupervisionRepStatutDto id(String id);

  SupervisionRepStatutDto code(String code);

  SupervisionRepStatutDto label(String label);

  SupervisionRepStatutDto isActive(bool isActive);

  SupervisionRepStatutDto famille(FamilleStatut famille);

  SupervisionRepStatutDto count(num count);

  /// This function **does support** nullification of nullable fields. All `null` values passed to `non-nullable` fields will be ignored. You can also use `SupervisionRepStatutDto(...).copyWith.fieldName(...)` to override fields one at a time with nullification support.
  ///
  /// Usage
  /// ```dart
  /// SupervisionRepStatutDto(...).copyWith(id: 12, name: "My name")
  /// ````
  SupervisionRepStatutDto call({
    String id,
    String code,
    String label,
    bool isActive,
    FamilleStatut famille,
    num count,
  });
}

/// Proxy class for `copyWith` functionality. This is a callable class and can be used as follows: `instanceOfSupervisionRepStatutDto.copyWith(...)`. Additionally contains functions for specific fields e.g. `instanceOfSupervisionRepStatutDto.copyWith.fieldName(...)`
class _$SupervisionRepStatutDtoCWProxyImpl
    implements _$SupervisionRepStatutDtoCWProxy {
  const _$SupervisionRepStatutDtoCWProxyImpl(this._value);

  final SupervisionRepStatutDto _value;

  @override
  SupervisionRepStatutDto id(String id) => this(id: id);

  @override
  SupervisionRepStatutDto code(String code) => this(code: code);

  @override
  SupervisionRepStatutDto label(String label) => this(label: label);

  @override
  SupervisionRepStatutDto isActive(bool isActive) => this(isActive: isActive);

  @override
  SupervisionRepStatutDto famille(FamilleStatut famille) =>
      this(famille: famille);

  @override
  SupervisionRepStatutDto count(num count) => this(count: count);

  @override
  /// This function **does support** nullification of nullable fields. All `null` values passed to `non-nullable` fields will be ignored. You can also use `SupervisionRepStatutDto(...).copyWith.fieldName(...)` to override fields one at a time with nullification support.
  ///
  /// Usage
  /// ```dart
  /// SupervisionRepStatutDto(...).copyWith(id: 12, name: "My name")
  /// ````
  SupervisionRepStatutDto call({
    Object? id = const $CopyWithPlaceholder(),
    Object? code = const $CopyWithPlaceholder(),
    Object? label = const $CopyWithPlaceholder(),
    Object? isActive = const $CopyWithPlaceholder(),
    Object? famille = const $CopyWithPlaceholder(),
    Object? count = const $CopyWithPlaceholder(),
  }) {
    return SupervisionRepStatutDto(
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
      isActive: isActive == const $CopyWithPlaceholder()
          ? _value.isActive
          // ignore: cast_nullable_to_non_nullable
          : isActive as bool,
      famille: famille == const $CopyWithPlaceholder()
          ? _value.famille
          // ignore: cast_nullable_to_non_nullable
          : famille as FamilleStatut,
      count: count == const $CopyWithPlaceholder()
          ? _value.count
          // ignore: cast_nullable_to_non_nullable
          : count as num,
    );
  }
}

extension $SupervisionRepStatutDtoCopyWith on SupervisionRepStatutDto {
  /// Returns a callable class that can be used as follows: `instanceOfSupervisionRepStatutDto.copyWith(...)` or like so:`instanceOfSupervisionRepStatutDto.copyWith.fieldName(...)`.
  // ignore: library_private_types_in_public_api
  _$SupervisionRepStatutDtoCWProxy get copyWith =>
      _$SupervisionRepStatutDtoCWProxyImpl(this);
}

// **************************************************************************
// JsonSerializableGenerator
// **************************************************************************

SupervisionRepStatutDto _$SupervisionRepStatutDtoFromJson(
  Map<String, dynamic> json,
) => $checkedCreate('SupervisionRepStatutDto', json, ($checkedConvert) {
  $checkKeys(
    json,
    requiredKeys: const ['id', 'code', 'label', 'isActive', 'famille', 'count'],
  );
  final val = SupervisionRepStatutDto(
    id: $checkedConvert('id', (v) => v as String),
    code: $checkedConvert('code', (v) => v as String),
    label: $checkedConvert('label', (v) => v as String),
    isActive: $checkedConvert('isActive', (v) => v as bool),
    famille: $checkedConvert(
      'famille',
      (v) => $enumDecode(
        _$FamilleStatutEnumMap,
        v,
        unknownValue: FamilleStatut.unknownDefaultOpenApi,
      ),
    ),
    count: $checkedConvert('count', (v) => v as num),
  );
  return val;
});

Map<String, dynamic> _$SupervisionRepStatutDtoToJson(
  SupervisionRepStatutDto instance,
) => <String, dynamic>{
  'id': instance.id,
  'code': instance.code,
  'label': instance.label,
  'isActive': instance.isActive,
  'famille': _$FamilleStatutEnumMap[instance.famille]!,
  'count': instance.count,
};

const _$FamilleStatutEnumMap = {
  FamilleStatut.JOINT: 'JOINT',
  FamilleStatut.NON_JOINT: 'NON_JOINT',
  FamilleStatut.unknownDefaultOpenApi: 'unknown_default_open_api',
};

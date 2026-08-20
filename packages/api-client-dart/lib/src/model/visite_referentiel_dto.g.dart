// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'visite_referentiel_dto.dart';

// **************************************************************************
// CopyWithGenerator
// **************************************************************************

abstract class _$VisiteReferentielDtoCWProxy {
  VisiteReferentielDto id(String id);

  VisiteReferentielDto code(String code);

  VisiteReferentielDto label(String label);

  VisiteReferentielDto isActive(bool isActive);

  VisiteReferentielDto isSystem(bool isSystem);

  VisiteReferentielDto sortOrder(num sortOrder);

  VisiteReferentielDto updatedAt(DateTime updatedAt);

  /// This function **does support** nullification of nullable fields. All `null` values passed to `non-nullable` fields will be ignored. You can also use `VisiteReferentielDto(...).copyWith.fieldName(...)` to override fields one at a time with nullification support.
  ///
  /// Usage
  /// ```dart
  /// VisiteReferentielDto(...).copyWith(id: 12, name: "My name")
  /// ````
  VisiteReferentielDto call({
    String id,
    String code,
    String label,
    bool isActive,
    bool isSystem,
    num sortOrder,
    DateTime updatedAt,
  });
}

/// Proxy class for `copyWith` functionality. This is a callable class and can be used as follows: `instanceOfVisiteReferentielDto.copyWith(...)`. Additionally contains functions for specific fields e.g. `instanceOfVisiteReferentielDto.copyWith.fieldName(...)`
class _$VisiteReferentielDtoCWProxyImpl
    implements _$VisiteReferentielDtoCWProxy {
  const _$VisiteReferentielDtoCWProxyImpl(this._value);

  final VisiteReferentielDto _value;

  @override
  VisiteReferentielDto id(String id) => this(id: id);

  @override
  VisiteReferentielDto code(String code) => this(code: code);

  @override
  VisiteReferentielDto label(String label) => this(label: label);

  @override
  VisiteReferentielDto isActive(bool isActive) => this(isActive: isActive);

  @override
  VisiteReferentielDto isSystem(bool isSystem) => this(isSystem: isSystem);

  @override
  VisiteReferentielDto sortOrder(num sortOrder) => this(sortOrder: sortOrder);

  @override
  VisiteReferentielDto updatedAt(DateTime updatedAt) =>
      this(updatedAt: updatedAt);

  @override
  /// This function **does support** nullification of nullable fields. All `null` values passed to `non-nullable` fields will be ignored. You can also use `VisiteReferentielDto(...).copyWith.fieldName(...)` to override fields one at a time with nullification support.
  ///
  /// Usage
  /// ```dart
  /// VisiteReferentielDto(...).copyWith(id: 12, name: "My name")
  /// ````
  VisiteReferentielDto call({
    Object? id = const $CopyWithPlaceholder(),
    Object? code = const $CopyWithPlaceholder(),
    Object? label = const $CopyWithPlaceholder(),
    Object? isActive = const $CopyWithPlaceholder(),
    Object? isSystem = const $CopyWithPlaceholder(),
    Object? sortOrder = const $CopyWithPlaceholder(),
    Object? updatedAt = const $CopyWithPlaceholder(),
  }) {
    return VisiteReferentielDto(
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
      isSystem: isSystem == const $CopyWithPlaceholder()
          ? _value.isSystem
          // ignore: cast_nullable_to_non_nullable
          : isSystem as bool,
      sortOrder: sortOrder == const $CopyWithPlaceholder()
          ? _value.sortOrder
          // ignore: cast_nullable_to_non_nullable
          : sortOrder as num,
      updatedAt: updatedAt == const $CopyWithPlaceholder()
          ? _value.updatedAt
          // ignore: cast_nullable_to_non_nullable
          : updatedAt as DateTime,
    );
  }
}

extension $VisiteReferentielDtoCopyWith on VisiteReferentielDto {
  /// Returns a callable class that can be used as follows: `instanceOfVisiteReferentielDto.copyWith(...)` or like so:`instanceOfVisiteReferentielDto.copyWith.fieldName(...)`.
  // ignore: library_private_types_in_public_api
  _$VisiteReferentielDtoCWProxy get copyWith =>
      _$VisiteReferentielDtoCWProxyImpl(this);
}

// **************************************************************************
// JsonSerializableGenerator
// **************************************************************************

VisiteReferentielDto _$VisiteReferentielDtoFromJson(
  Map<String, dynamic> json,
) => $checkedCreate('VisiteReferentielDto', json, ($checkedConvert) {
  $checkKeys(
    json,
    requiredKeys: const [
      'id',
      'code',
      'label',
      'isActive',
      'isSystem',
      'sortOrder',
      'updatedAt',
    ],
  );
  final val = VisiteReferentielDto(
    id: $checkedConvert('id', (v) => v as String),
    code: $checkedConvert('code', (v) => v as String),
    label: $checkedConvert('label', (v) => v as String),
    isActive: $checkedConvert('isActive', (v) => v as bool),
    isSystem: $checkedConvert('isSystem', (v) => v as bool),
    sortOrder: $checkedConvert('sortOrder', (v) => v as num),
    updatedAt: $checkedConvert('updatedAt', (v) => DateTime.parse(v as String)),
  );
  return val;
});

Map<String, dynamic> _$VisiteReferentielDtoToJson(
  VisiteReferentielDto instance,
) => <String, dynamic>{
  'id': instance.id,
  'code': instance.code,
  'label': instance.label,
  'isActive': instance.isActive,
  'isSystem': instance.isSystem,
  'sortOrder': instance.sortOrder,
  'updatedAt': instance.updatedAt.toIso8601String(),
};

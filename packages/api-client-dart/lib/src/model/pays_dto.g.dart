// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'pays_dto.dart';

// **************************************************************************
// CopyWithGenerator
// **************************************************************************

abstract class _$PaysDtoCWProxy {
  PaysDto id(String id);

  PaysDto code(String code);

  PaysDto label(String label);

  PaysDto indicatif(String indicatif);

  PaysDto position(num position);

  PaysDto isActive(bool isActive);

  PaysDto updatedAt(DateTime updatedAt);

  /// This function **does support** nullification of nullable fields. All `null` values passed to `non-nullable` fields will be ignored. You can also use `PaysDto(...).copyWith.fieldName(...)` to override fields one at a time with nullification support.
  ///
  /// Usage
  /// ```dart
  /// PaysDto(...).copyWith(id: 12, name: "My name")
  /// ````
  PaysDto call({
    String id,
    String code,
    String label,
    String indicatif,
    num position,
    bool isActive,
    DateTime updatedAt,
  });
}

/// Proxy class for `copyWith` functionality. This is a callable class and can be used as follows: `instanceOfPaysDto.copyWith(...)`. Additionally contains functions for specific fields e.g. `instanceOfPaysDto.copyWith.fieldName(...)`
class _$PaysDtoCWProxyImpl implements _$PaysDtoCWProxy {
  const _$PaysDtoCWProxyImpl(this._value);

  final PaysDto _value;

  @override
  PaysDto id(String id) => this(id: id);

  @override
  PaysDto code(String code) => this(code: code);

  @override
  PaysDto label(String label) => this(label: label);

  @override
  PaysDto indicatif(String indicatif) => this(indicatif: indicatif);

  @override
  PaysDto position(num position) => this(position: position);

  @override
  PaysDto isActive(bool isActive) => this(isActive: isActive);

  @override
  PaysDto updatedAt(DateTime updatedAt) => this(updatedAt: updatedAt);

  @override
  /// This function **does support** nullification of nullable fields. All `null` values passed to `non-nullable` fields will be ignored. You can also use `PaysDto(...).copyWith.fieldName(...)` to override fields one at a time with nullification support.
  ///
  /// Usage
  /// ```dart
  /// PaysDto(...).copyWith(id: 12, name: "My name")
  /// ````
  PaysDto call({
    Object? id = const $CopyWithPlaceholder(),
    Object? code = const $CopyWithPlaceholder(),
    Object? label = const $CopyWithPlaceholder(),
    Object? indicatif = const $CopyWithPlaceholder(),
    Object? position = const $CopyWithPlaceholder(),
    Object? isActive = const $CopyWithPlaceholder(),
    Object? updatedAt = const $CopyWithPlaceholder(),
  }) {
    return PaysDto(
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
      indicatif: indicatif == const $CopyWithPlaceholder()
          ? _value.indicatif
          // ignore: cast_nullable_to_non_nullable
          : indicatif as String,
      position: position == const $CopyWithPlaceholder()
          ? _value.position
          // ignore: cast_nullable_to_non_nullable
          : position as num,
      isActive: isActive == const $CopyWithPlaceholder()
          ? _value.isActive
          // ignore: cast_nullable_to_non_nullable
          : isActive as bool,
      updatedAt: updatedAt == const $CopyWithPlaceholder()
          ? _value.updatedAt
          // ignore: cast_nullable_to_non_nullable
          : updatedAt as DateTime,
    );
  }
}

extension $PaysDtoCopyWith on PaysDto {
  /// Returns a callable class that can be used as follows: `instanceOfPaysDto.copyWith(...)` or like so:`instanceOfPaysDto.copyWith.fieldName(...)`.
  // ignore: library_private_types_in_public_api
  _$PaysDtoCWProxy get copyWith => _$PaysDtoCWProxyImpl(this);
}

// **************************************************************************
// JsonSerializableGenerator
// **************************************************************************

PaysDto _$PaysDtoFromJson(Map<String, dynamic> json) =>
    $checkedCreate('PaysDto', json, ($checkedConvert) {
      $checkKeys(
        json,
        requiredKeys: const [
          'id',
          'code',
          'label',
          'indicatif',
          'position',
          'isActive',
          'updatedAt',
        ],
      );
      final val = PaysDto(
        id: $checkedConvert('id', (v) => v as String),
        code: $checkedConvert('code', (v) => v as String),
        label: $checkedConvert('label', (v) => v as String),
        indicatif: $checkedConvert('indicatif', (v) => v as String),
        position: $checkedConvert('position', (v) => v as num),
        isActive: $checkedConvert('isActive', (v) => v as bool),
        updatedAt: $checkedConvert(
          'updatedAt',
          (v) => DateTime.parse(v as String),
        ),
      );
      return val;
    });

Map<String, dynamic> _$PaysDtoToJson(PaysDto instance) => <String, dynamic>{
  'id': instance.id,
  'code': instance.code,
  'label': instance.label,
  'indicatif': instance.indicatif,
  'position': instance.position,
  'isActive': instance.isActive,
  'updatedAt': instance.updatedAt.toIso8601String(),
};

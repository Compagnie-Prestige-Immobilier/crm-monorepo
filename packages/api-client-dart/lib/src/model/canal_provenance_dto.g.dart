// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'canal_provenance_dto.dart';

// **************************************************************************
// CopyWithGenerator
// **************************************************************************

abstract class _$CanalProvenanceDtoCWProxy {
  CanalProvenanceDto id(String id);

  CanalProvenanceDto code(String code);

  CanalProvenanceDto label(String label);

  CanalProvenanceDto position(num position);

  CanalProvenanceDto isActive(bool isActive);

  CanalProvenanceDto updatedAt(DateTime updatedAt);

  /// This function **does support** nullification of nullable fields. All `null` values passed to `non-nullable` fields will be ignored. You can also use `CanalProvenanceDto(...).copyWith.fieldName(...)` to override fields one at a time with nullification support.
  ///
  /// Usage
  /// ```dart
  /// CanalProvenanceDto(...).copyWith(id: 12, name: "My name")
  /// ````
  CanalProvenanceDto call({
    String id,
    String code,
    String label,
    num position,
    bool isActive,
    DateTime updatedAt,
  });
}

/// Proxy class for `copyWith` functionality. This is a callable class and can be used as follows: `instanceOfCanalProvenanceDto.copyWith(...)`. Additionally contains functions for specific fields e.g. `instanceOfCanalProvenanceDto.copyWith.fieldName(...)`
class _$CanalProvenanceDtoCWProxyImpl implements _$CanalProvenanceDtoCWProxy {
  const _$CanalProvenanceDtoCWProxyImpl(this._value);

  final CanalProvenanceDto _value;

  @override
  CanalProvenanceDto id(String id) => this(id: id);

  @override
  CanalProvenanceDto code(String code) => this(code: code);

  @override
  CanalProvenanceDto label(String label) => this(label: label);

  @override
  CanalProvenanceDto position(num position) => this(position: position);

  @override
  CanalProvenanceDto isActive(bool isActive) => this(isActive: isActive);

  @override
  CanalProvenanceDto updatedAt(DateTime updatedAt) =>
      this(updatedAt: updatedAt);

  @override
  /// This function **does support** nullification of nullable fields. All `null` values passed to `non-nullable` fields will be ignored. You can also use `CanalProvenanceDto(...).copyWith.fieldName(...)` to override fields one at a time with nullification support.
  ///
  /// Usage
  /// ```dart
  /// CanalProvenanceDto(...).copyWith(id: 12, name: "My name")
  /// ````
  CanalProvenanceDto call({
    Object? id = const $CopyWithPlaceholder(),
    Object? code = const $CopyWithPlaceholder(),
    Object? label = const $CopyWithPlaceholder(),
    Object? position = const $CopyWithPlaceholder(),
    Object? isActive = const $CopyWithPlaceholder(),
    Object? updatedAt = const $CopyWithPlaceholder(),
  }) {
    return CanalProvenanceDto(
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

extension $CanalProvenanceDtoCopyWith on CanalProvenanceDto {
  /// Returns a callable class that can be used as follows: `instanceOfCanalProvenanceDto.copyWith(...)` or like so:`instanceOfCanalProvenanceDto.copyWith.fieldName(...)`.
  // ignore: library_private_types_in_public_api
  _$CanalProvenanceDtoCWProxy get copyWith =>
      _$CanalProvenanceDtoCWProxyImpl(this);
}

// **************************************************************************
// JsonSerializableGenerator
// **************************************************************************

CanalProvenanceDto _$CanalProvenanceDtoFromJson(Map<String, dynamic> json) =>
    $checkedCreate('CanalProvenanceDto', json, ($checkedConvert) {
      $checkKeys(
        json,
        requiredKeys: const [
          'id',
          'code',
          'label',
          'position',
          'isActive',
          'updatedAt',
        ],
      );
      final val = CanalProvenanceDto(
        id: $checkedConvert('id', (v) => v as String),
        code: $checkedConvert('code', (v) => v as String),
        label: $checkedConvert('label', (v) => v as String),
        position: $checkedConvert('position', (v) => v as num),
        isActive: $checkedConvert('isActive', (v) => v as bool),
        updatedAt: $checkedConvert(
          'updatedAt',
          (v) => DateTime.parse(v as String),
        ),
      );
      return val;
    });

Map<String, dynamic> _$CanalProvenanceDtoToJson(CanalProvenanceDto instance) =>
    <String, dynamic>{
      'id': instance.id,
      'code': instance.code,
      'label': instance.label,
      'position': instance.position,
      'isActive': instance.isActive,
      'updatedAt': instance.updatedAt.toIso8601String(),
    };

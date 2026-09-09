// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'employeur_dto.dart';

// **************************************************************************
// CopyWithGenerator
// **************************************************************************

abstract class _$EmployeurDtoCWProxy {
  EmployeurDto id(String id);

  EmployeurDto code(String code);

  EmployeurDto label(String label);

  EmployeurDto type(EmployeurType type);

  EmployeurDto position(num position);

  EmployeurDto isActive(bool isActive);

  EmployeurDto updatedAt(DateTime updatedAt);

  /// This function **does support** nullification of nullable fields. All `null` values passed to `non-nullable` fields will be ignored. You can also use `EmployeurDto(...).copyWith.fieldName(...)` to override fields one at a time with nullification support.
  ///
  /// Usage
  /// ```dart
  /// EmployeurDto(...).copyWith(id: 12, name: "My name")
  /// ````
  EmployeurDto call({
    String id,
    String code,
    String label,
    EmployeurType type,
    num position,
    bool isActive,
    DateTime updatedAt,
  });
}

/// Proxy class for `copyWith` functionality. This is a callable class and can be used as follows: `instanceOfEmployeurDto.copyWith(...)`. Additionally contains functions for specific fields e.g. `instanceOfEmployeurDto.copyWith.fieldName(...)`
class _$EmployeurDtoCWProxyImpl implements _$EmployeurDtoCWProxy {
  const _$EmployeurDtoCWProxyImpl(this._value);

  final EmployeurDto _value;

  @override
  EmployeurDto id(String id) => this(id: id);

  @override
  EmployeurDto code(String code) => this(code: code);

  @override
  EmployeurDto label(String label) => this(label: label);

  @override
  EmployeurDto type(EmployeurType type) => this(type: type);

  @override
  EmployeurDto position(num position) => this(position: position);

  @override
  EmployeurDto isActive(bool isActive) => this(isActive: isActive);

  @override
  EmployeurDto updatedAt(DateTime updatedAt) => this(updatedAt: updatedAt);

  @override
  /// This function **does support** nullification of nullable fields. All `null` values passed to `non-nullable` fields will be ignored. You can also use `EmployeurDto(...).copyWith.fieldName(...)` to override fields one at a time with nullification support.
  ///
  /// Usage
  /// ```dart
  /// EmployeurDto(...).copyWith(id: 12, name: "My name")
  /// ````
  EmployeurDto call({
    Object? id = const $CopyWithPlaceholder(),
    Object? code = const $CopyWithPlaceholder(),
    Object? label = const $CopyWithPlaceholder(),
    Object? type = const $CopyWithPlaceholder(),
    Object? position = const $CopyWithPlaceholder(),
    Object? isActive = const $CopyWithPlaceholder(),
    Object? updatedAt = const $CopyWithPlaceholder(),
  }) {
    return EmployeurDto(
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
      type: type == const $CopyWithPlaceholder()
          ? _value.type
          // ignore: cast_nullable_to_non_nullable
          : type as EmployeurType,
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

extension $EmployeurDtoCopyWith on EmployeurDto {
  /// Returns a callable class that can be used as follows: `instanceOfEmployeurDto.copyWith(...)` or like so:`instanceOfEmployeurDto.copyWith.fieldName(...)`.
  // ignore: library_private_types_in_public_api
  _$EmployeurDtoCWProxy get copyWith => _$EmployeurDtoCWProxyImpl(this);
}

// **************************************************************************
// JsonSerializableGenerator
// **************************************************************************

EmployeurDto _$EmployeurDtoFromJson(Map<String, dynamic> json) =>
    $checkedCreate('EmployeurDto', json, ($checkedConvert) {
      $checkKeys(
        json,
        requiredKeys: const [
          'id',
          'code',
          'label',
          'type',
          'position',
          'isActive',
          'updatedAt',
        ],
      );
      final val = EmployeurDto(
        id: $checkedConvert('id', (v) => v as String),
        code: $checkedConvert('code', (v) => v as String),
        label: $checkedConvert('label', (v) => v as String),
        type: $checkedConvert(
          'type',
          (v) => $enumDecode(
            _$EmployeurTypeEnumMap,
            v,
            unknownValue: EmployeurType.unknownDefaultOpenApi,
          ),
        ),
        position: $checkedConvert('position', (v) => v as num),
        isActive: $checkedConvert('isActive', (v) => v as bool),
        updatedAt: $checkedConvert(
          'updatedAt',
          (v) => DateTime.parse(v as String),
        ),
      );
      return val;
    });

Map<String, dynamic> _$EmployeurDtoToJson(EmployeurDto instance) =>
    <String, dynamic>{
      'id': instance.id,
      'code': instance.code,
      'label': instance.label,
      'type': _$EmployeurTypeEnumMap[instance.type]!,
      'position': instance.position,
      'isActive': instance.isActive,
      'updatedAt': instance.updatedAt.toIso8601String(),
    };

const _$EmployeurTypeEnumMap = {
  EmployeurType.MINISTERE: 'MINISTERE',
  EmployeurType.ENTREPRISE: 'ENTREPRISE',
  EmployeurType.AUTRE: 'AUTRE',
  EmployeurType.unknownDefaultOpenApi: 'unknown_default_open_api',
};

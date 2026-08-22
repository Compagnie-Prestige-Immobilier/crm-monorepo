// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'profession_dto.dart';

// **************************************************************************
// CopyWithGenerator
// **************************************************************************

abstract class _$ProfessionDtoCWProxy {
  ProfessionDto id(String id);

  ProfessionDto code(String code);

  ProfessionDto label(String label);

  ProfessionDto isTeaching(bool isTeaching);

  ProfessionDto position(num position);

  ProfessionDto isActive(bool isActive);

  ProfessionDto updatedAt(DateTime updatedAt);

  /// This function **does support** nullification of nullable fields. All `null` values passed to `non-nullable` fields will be ignored. You can also use `ProfessionDto(...).copyWith.fieldName(...)` to override fields one at a time with nullification support.
  ///
  /// Usage
  /// ```dart
  /// ProfessionDto(...).copyWith(id: 12, name: "My name")
  /// ````
  ProfessionDto call({
    String id,
    String code,
    String label,
    bool isTeaching,
    num position,
    bool isActive,
    DateTime updatedAt,
  });
}

/// Proxy class for `copyWith` functionality. This is a callable class and can be used as follows: `instanceOfProfessionDto.copyWith(...)`. Additionally contains functions for specific fields e.g. `instanceOfProfessionDto.copyWith.fieldName(...)`
class _$ProfessionDtoCWProxyImpl implements _$ProfessionDtoCWProxy {
  const _$ProfessionDtoCWProxyImpl(this._value);

  final ProfessionDto _value;

  @override
  ProfessionDto id(String id) => this(id: id);

  @override
  ProfessionDto code(String code) => this(code: code);

  @override
  ProfessionDto label(String label) => this(label: label);

  @override
  ProfessionDto isTeaching(bool isTeaching) => this(isTeaching: isTeaching);

  @override
  ProfessionDto position(num position) => this(position: position);

  @override
  ProfessionDto isActive(bool isActive) => this(isActive: isActive);

  @override
  ProfessionDto updatedAt(DateTime updatedAt) => this(updatedAt: updatedAt);

  @override
  /// This function **does support** nullification of nullable fields. All `null` values passed to `non-nullable` fields will be ignored. You can also use `ProfessionDto(...).copyWith.fieldName(...)` to override fields one at a time with nullification support.
  ///
  /// Usage
  /// ```dart
  /// ProfessionDto(...).copyWith(id: 12, name: "My name")
  /// ````
  ProfessionDto call({
    Object? id = const $CopyWithPlaceholder(),
    Object? code = const $CopyWithPlaceholder(),
    Object? label = const $CopyWithPlaceholder(),
    Object? isTeaching = const $CopyWithPlaceholder(),
    Object? position = const $CopyWithPlaceholder(),
    Object? isActive = const $CopyWithPlaceholder(),
    Object? updatedAt = const $CopyWithPlaceholder(),
  }) {
    return ProfessionDto(
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
      isTeaching: isTeaching == const $CopyWithPlaceholder()
          ? _value.isTeaching
          // ignore: cast_nullable_to_non_nullable
          : isTeaching as bool,
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

extension $ProfessionDtoCopyWith on ProfessionDto {
  /// Returns a callable class that can be used as follows: `instanceOfProfessionDto.copyWith(...)` or like so:`instanceOfProfessionDto.copyWith.fieldName(...)`.
  // ignore: library_private_types_in_public_api
  _$ProfessionDtoCWProxy get copyWith => _$ProfessionDtoCWProxyImpl(this);
}

// **************************************************************************
// JsonSerializableGenerator
// **************************************************************************

ProfessionDto _$ProfessionDtoFromJson(Map<String, dynamic> json) =>
    $checkedCreate('ProfessionDto', json, ($checkedConvert) {
      $checkKeys(
        json,
        requiredKeys: const [
          'id',
          'code',
          'label',
          'isTeaching',
          'position',
          'isActive',
          'updatedAt',
        ],
      );
      final val = ProfessionDto(
        id: $checkedConvert('id', (v) => v as String),
        code: $checkedConvert('code', (v) => v as String),
        label: $checkedConvert('label', (v) => v as String),
        isTeaching: $checkedConvert('isTeaching', (v) => v as bool),
        position: $checkedConvert('position', (v) => v as num),
        isActive: $checkedConvert('isActive', (v) => v as bool),
        updatedAt: $checkedConvert(
          'updatedAt',
          (v) => DateTime.parse(v as String),
        ),
      );
      return val;
    });

Map<String, dynamic> _$ProfessionDtoToJson(ProfessionDto instance) =>
    <String, dynamic>{
      'id': instance.id,
      'code': instance.code,
      'label': instance.label,
      'isTeaching': instance.isTeaching,
      'position': instance.position,
      'isActive': instance.isActive,
      'updatedAt': instance.updatedAt.toIso8601String(),
    };

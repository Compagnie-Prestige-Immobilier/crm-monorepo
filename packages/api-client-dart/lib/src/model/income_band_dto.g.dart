// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'income_band_dto.dart';

// **************************************************************************
// CopyWithGenerator
// **************************************************************************

abstract class _$IncomeBandDtoCWProxy {
  IncomeBandDto id(String id);

  IncomeBandDto code(String code);

  IncomeBandDto label(String label);

  IncomeBandDto minXof(num? minXof);

  IncomeBandDto maxXof(num? maxXof);

  IncomeBandDto position(num position);

  IncomeBandDto isActive(bool isActive);

  IncomeBandDto updatedAt(DateTime updatedAt);

  /// This function **does support** nullification of nullable fields. All `null` values passed to `non-nullable` fields will be ignored. You can also use `IncomeBandDto(...).copyWith.fieldName(...)` to override fields one at a time with nullification support.
  ///
  /// Usage
  /// ```dart
  /// IncomeBandDto(...).copyWith(id: 12, name: "My name")
  /// ````
  IncomeBandDto call({
    String id,
    String code,
    String label,
    num? minXof,
    num? maxXof,
    num position,
    bool isActive,
    DateTime updatedAt,
  });
}

/// Proxy class for `copyWith` functionality. This is a callable class and can be used as follows: `instanceOfIncomeBandDto.copyWith(...)`. Additionally contains functions for specific fields e.g. `instanceOfIncomeBandDto.copyWith.fieldName(...)`
class _$IncomeBandDtoCWProxyImpl implements _$IncomeBandDtoCWProxy {
  const _$IncomeBandDtoCWProxyImpl(this._value);

  final IncomeBandDto _value;

  @override
  IncomeBandDto id(String id) => this(id: id);

  @override
  IncomeBandDto code(String code) => this(code: code);

  @override
  IncomeBandDto label(String label) => this(label: label);

  @override
  IncomeBandDto minXof(num? minXof) => this(minXof: minXof);

  @override
  IncomeBandDto maxXof(num? maxXof) => this(maxXof: maxXof);

  @override
  IncomeBandDto position(num position) => this(position: position);

  @override
  IncomeBandDto isActive(bool isActive) => this(isActive: isActive);

  @override
  IncomeBandDto updatedAt(DateTime updatedAt) => this(updatedAt: updatedAt);

  @override
  /// This function **does support** nullification of nullable fields. All `null` values passed to `non-nullable` fields will be ignored. You can also use `IncomeBandDto(...).copyWith.fieldName(...)` to override fields one at a time with nullification support.
  ///
  /// Usage
  /// ```dart
  /// IncomeBandDto(...).copyWith(id: 12, name: "My name")
  /// ````
  IncomeBandDto call({
    Object? id = const $CopyWithPlaceholder(),
    Object? code = const $CopyWithPlaceholder(),
    Object? label = const $CopyWithPlaceholder(),
    Object? minXof = const $CopyWithPlaceholder(),
    Object? maxXof = const $CopyWithPlaceholder(),
    Object? position = const $CopyWithPlaceholder(),
    Object? isActive = const $CopyWithPlaceholder(),
    Object? updatedAt = const $CopyWithPlaceholder(),
  }) {
    return IncomeBandDto(
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
      minXof: minXof == const $CopyWithPlaceholder()
          ? _value.minXof
          // ignore: cast_nullable_to_non_nullable
          : minXof as num?,
      maxXof: maxXof == const $CopyWithPlaceholder()
          ? _value.maxXof
          // ignore: cast_nullable_to_non_nullable
          : maxXof as num?,
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

extension $IncomeBandDtoCopyWith on IncomeBandDto {
  /// Returns a callable class that can be used as follows: `instanceOfIncomeBandDto.copyWith(...)` or like so:`instanceOfIncomeBandDto.copyWith.fieldName(...)`.
  // ignore: library_private_types_in_public_api
  _$IncomeBandDtoCWProxy get copyWith => _$IncomeBandDtoCWProxyImpl(this);
}

// **************************************************************************
// JsonSerializableGenerator
// **************************************************************************

IncomeBandDto _$IncomeBandDtoFromJson(Map<String, dynamic> json) =>
    $checkedCreate('IncomeBandDto', json, ($checkedConvert) {
      $checkKeys(
        json,
        requiredKeys: const [
          'id',
          'code',
          'label',
          'minXof',
          'maxXof',
          'position',
          'isActive',
          'updatedAt',
        ],
      );
      final val = IncomeBandDto(
        id: $checkedConvert('id', (v) => v as String),
        code: $checkedConvert('code', (v) => v as String),
        label: $checkedConvert('label', (v) => v as String),
        minXof: $checkedConvert('minXof', (v) => v as num?),
        maxXof: $checkedConvert('maxXof', (v) => v as num?),
        position: $checkedConvert('position', (v) => v as num),
        isActive: $checkedConvert('isActive', (v) => v as bool),
        updatedAt: $checkedConvert(
          'updatedAt',
          (v) => DateTime.parse(v as String),
        ),
      );
      return val;
    });

Map<String, dynamic> _$IncomeBandDtoToJson(IncomeBandDto instance) =>
    <String, dynamic>{
      'id': instance.id,
      'code': instance.code,
      'label': instance.label,
      'minXof': instance.minXof,
      'maxXof': instance.maxXof,
      'position': instance.position,
      'isActive': instance.isActive,
      'updatedAt': instance.updatedAt.toIso8601String(),
    };

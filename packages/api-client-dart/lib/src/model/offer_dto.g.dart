// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'offer_dto.dart';

// **************************************************************************
// CopyWithGenerator
// **************************************************************************

abstract class _$OfferDtoCWProxy {
  OfferDto id(String id);

  OfferDto code(String code);

  OfferDto label(String label);

  OfferDto description(String? description);

  OfferDto position(num position);

  OfferDto isActive(bool isActive);

  OfferDto updatedAt(DateTime updatedAt);

  /// This function **does support** nullification of nullable fields. All `null` values passed to `non-nullable` fields will be ignored. You can also use `OfferDto(...).copyWith.fieldName(...)` to override fields one at a time with nullification support.
  ///
  /// Usage
  /// ```dart
  /// OfferDto(...).copyWith(id: 12, name: "My name")
  /// ````
  OfferDto call({
    String id,
    String code,
    String label,
    String? description,
    num position,
    bool isActive,
    DateTime updatedAt,
  });
}

/// Proxy class for `copyWith` functionality. This is a callable class and can be used as follows: `instanceOfOfferDto.copyWith(...)`. Additionally contains functions for specific fields e.g. `instanceOfOfferDto.copyWith.fieldName(...)`
class _$OfferDtoCWProxyImpl implements _$OfferDtoCWProxy {
  const _$OfferDtoCWProxyImpl(this._value);

  final OfferDto _value;

  @override
  OfferDto id(String id) => this(id: id);

  @override
  OfferDto code(String code) => this(code: code);

  @override
  OfferDto label(String label) => this(label: label);

  @override
  OfferDto description(String? description) => this(description: description);

  @override
  OfferDto position(num position) => this(position: position);

  @override
  OfferDto isActive(bool isActive) => this(isActive: isActive);

  @override
  OfferDto updatedAt(DateTime updatedAt) => this(updatedAt: updatedAt);

  @override
  /// This function **does support** nullification of nullable fields. All `null` values passed to `non-nullable` fields will be ignored. You can also use `OfferDto(...).copyWith.fieldName(...)` to override fields one at a time with nullification support.
  ///
  /// Usage
  /// ```dart
  /// OfferDto(...).copyWith(id: 12, name: "My name")
  /// ````
  OfferDto call({
    Object? id = const $CopyWithPlaceholder(),
    Object? code = const $CopyWithPlaceholder(),
    Object? label = const $CopyWithPlaceholder(),
    Object? description = const $CopyWithPlaceholder(),
    Object? position = const $CopyWithPlaceholder(),
    Object? isActive = const $CopyWithPlaceholder(),
    Object? updatedAt = const $CopyWithPlaceholder(),
  }) {
    return OfferDto(
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
      description: description == const $CopyWithPlaceholder()
          ? _value.description
          // ignore: cast_nullable_to_non_nullable
          : description as String?,
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

extension $OfferDtoCopyWith on OfferDto {
  /// Returns a callable class that can be used as follows: `instanceOfOfferDto.copyWith(...)` or like so:`instanceOfOfferDto.copyWith.fieldName(...)`.
  // ignore: library_private_types_in_public_api
  _$OfferDtoCWProxy get copyWith => _$OfferDtoCWProxyImpl(this);
}

// **************************************************************************
// JsonSerializableGenerator
// **************************************************************************

OfferDto _$OfferDtoFromJson(Map<String, dynamic> json) =>
    $checkedCreate('OfferDto', json, ($checkedConvert) {
      $checkKeys(
        json,
        requiredKeys: const [
          'id',
          'code',
          'label',
          'description',
          'position',
          'isActive',
          'updatedAt',
        ],
      );
      final val = OfferDto(
        id: $checkedConvert('id', (v) => v as String),
        code: $checkedConvert('code', (v) => v as String),
        label: $checkedConvert('label', (v) => v as String),
        description: $checkedConvert('description', (v) => v as String?),
        position: $checkedConvert('position', (v) => v as num),
        isActive: $checkedConvert('isActive', (v) => v as bool),
        updatedAt: $checkedConvert(
          'updatedAt',
          (v) => DateTime.parse(v as String),
        ),
      );
      return val;
    });

Map<String, dynamic> _$OfferDtoToJson(OfferDto instance) => <String, dynamic>{
  'id': instance.id,
  'code': instance.code,
  'label': instance.label,
  'description': instance.description,
  'position': instance.position,
  'isActive': instance.isActive,
  'updatedAt': instance.updatedAt.toIso8601String(),
};

// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'create_offer_dto.dart';

// **************************************************************************
// CopyWithGenerator
// **************************************************************************

abstract class _$CreateOfferDtoCWProxy {
  CreateOfferDto code(String code);

  CreateOfferDto label(String label);

  CreateOfferDto description(String? description);

  CreateOfferDto position(num? position);

  CreateOfferDto isActive(bool? isActive);

  /// This function **does support** nullification of nullable fields. All `null` values passed to `non-nullable` fields will be ignored. You can also use `CreateOfferDto(...).copyWith.fieldName(...)` to override fields one at a time with nullification support.
  ///
  /// Usage
  /// ```dart
  /// CreateOfferDto(...).copyWith(id: 12, name: "My name")
  /// ````
  CreateOfferDto call({
    String code,
    String label,
    String? description,
    num? position,
    bool? isActive,
  });
}

/// Proxy class for `copyWith` functionality. This is a callable class and can be used as follows: `instanceOfCreateOfferDto.copyWith(...)`. Additionally contains functions for specific fields e.g. `instanceOfCreateOfferDto.copyWith.fieldName(...)`
class _$CreateOfferDtoCWProxyImpl implements _$CreateOfferDtoCWProxy {
  const _$CreateOfferDtoCWProxyImpl(this._value);

  final CreateOfferDto _value;

  @override
  CreateOfferDto code(String code) => this(code: code);

  @override
  CreateOfferDto label(String label) => this(label: label);

  @override
  CreateOfferDto description(String? description) =>
      this(description: description);

  @override
  CreateOfferDto position(num? position) => this(position: position);

  @override
  CreateOfferDto isActive(bool? isActive) => this(isActive: isActive);

  @override
  /// This function **does support** nullification of nullable fields. All `null` values passed to `non-nullable` fields will be ignored. You can also use `CreateOfferDto(...).copyWith.fieldName(...)` to override fields one at a time with nullification support.
  ///
  /// Usage
  /// ```dart
  /// CreateOfferDto(...).copyWith(id: 12, name: "My name")
  /// ````
  CreateOfferDto call({
    Object? code = const $CopyWithPlaceholder(),
    Object? label = const $CopyWithPlaceholder(),
    Object? description = const $CopyWithPlaceholder(),
    Object? position = const $CopyWithPlaceholder(),
    Object? isActive = const $CopyWithPlaceholder(),
  }) {
    return CreateOfferDto(
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
          : position as num?,
      isActive: isActive == const $CopyWithPlaceholder()
          ? _value.isActive
          // ignore: cast_nullable_to_non_nullable
          : isActive as bool?,
    );
  }
}

extension $CreateOfferDtoCopyWith on CreateOfferDto {
  /// Returns a callable class that can be used as follows: `instanceOfCreateOfferDto.copyWith(...)` or like so:`instanceOfCreateOfferDto.copyWith.fieldName(...)`.
  // ignore: library_private_types_in_public_api
  _$CreateOfferDtoCWProxy get copyWith => _$CreateOfferDtoCWProxyImpl(this);
}

// **************************************************************************
// JsonSerializableGenerator
// **************************************************************************

CreateOfferDto _$CreateOfferDtoFromJson(Map<String, dynamic> json) =>
    $checkedCreate('CreateOfferDto', json, ($checkedConvert) {
      $checkKeys(json, requiredKeys: const ['code', 'label']);
      final val = CreateOfferDto(
        code: $checkedConvert('code', (v) => v as String),
        label: $checkedConvert('label', (v) => v as String),
        description: $checkedConvert('description', (v) => v as String?),
        position: $checkedConvert('position', (v) => v as num?),
        isActive: $checkedConvert('isActive', (v) => v as bool? ?? true),
      );
      return val;
    });

Map<String, dynamic> _$CreateOfferDtoToJson(CreateOfferDto instance) =>
    <String, dynamic>{
      'code': instance.code,
      'label': instance.label,
      if (instance.description case final value?) 'description': value,
      if (instance.position case final value?) 'position': value,
      if (instance.isActive case final value?) 'isActive': value,
    };

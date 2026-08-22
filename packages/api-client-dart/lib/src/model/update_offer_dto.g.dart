// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'update_offer_dto.dart';

// **************************************************************************
// CopyWithGenerator
// **************************************************************************

abstract class _$UpdateOfferDtoCWProxy {
  UpdateOfferDto code(String? code);

  UpdateOfferDto label(String? label);

  UpdateOfferDto description(String? description);

  UpdateOfferDto position(num? position);

  UpdateOfferDto isActive(bool? isActive);

  /// This function **does support** nullification of nullable fields. All `null` values passed to `non-nullable` fields will be ignored. You can also use `UpdateOfferDto(...).copyWith.fieldName(...)` to override fields one at a time with nullification support.
  ///
  /// Usage
  /// ```dart
  /// UpdateOfferDto(...).copyWith(id: 12, name: "My name")
  /// ````
  UpdateOfferDto call({
    String? code,
    String? label,
    String? description,
    num? position,
    bool? isActive,
  });
}

/// Proxy class for `copyWith` functionality. This is a callable class and can be used as follows: `instanceOfUpdateOfferDto.copyWith(...)`. Additionally contains functions for specific fields e.g. `instanceOfUpdateOfferDto.copyWith.fieldName(...)`
class _$UpdateOfferDtoCWProxyImpl implements _$UpdateOfferDtoCWProxy {
  const _$UpdateOfferDtoCWProxyImpl(this._value);

  final UpdateOfferDto _value;

  @override
  UpdateOfferDto code(String? code) => this(code: code);

  @override
  UpdateOfferDto label(String? label) => this(label: label);

  @override
  UpdateOfferDto description(String? description) =>
      this(description: description);

  @override
  UpdateOfferDto position(num? position) => this(position: position);

  @override
  UpdateOfferDto isActive(bool? isActive) => this(isActive: isActive);

  @override
  /// This function **does support** nullification of nullable fields. All `null` values passed to `non-nullable` fields will be ignored. You can also use `UpdateOfferDto(...).copyWith.fieldName(...)` to override fields one at a time with nullification support.
  ///
  /// Usage
  /// ```dart
  /// UpdateOfferDto(...).copyWith(id: 12, name: "My name")
  /// ````
  UpdateOfferDto call({
    Object? code = const $CopyWithPlaceholder(),
    Object? label = const $CopyWithPlaceholder(),
    Object? description = const $CopyWithPlaceholder(),
    Object? position = const $CopyWithPlaceholder(),
    Object? isActive = const $CopyWithPlaceholder(),
  }) {
    return UpdateOfferDto(
      code: code == const $CopyWithPlaceholder()
          ? _value.code
          // ignore: cast_nullable_to_non_nullable
          : code as String?,
      label: label == const $CopyWithPlaceholder()
          ? _value.label
          // ignore: cast_nullable_to_non_nullable
          : label as String?,
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

extension $UpdateOfferDtoCopyWith on UpdateOfferDto {
  /// Returns a callable class that can be used as follows: `instanceOfUpdateOfferDto.copyWith(...)` or like so:`instanceOfUpdateOfferDto.copyWith.fieldName(...)`.
  // ignore: library_private_types_in_public_api
  _$UpdateOfferDtoCWProxy get copyWith => _$UpdateOfferDtoCWProxyImpl(this);
}

// **************************************************************************
// JsonSerializableGenerator
// **************************************************************************

UpdateOfferDto _$UpdateOfferDtoFromJson(Map<String, dynamic> json) =>
    $checkedCreate('UpdateOfferDto', json, ($checkedConvert) {
      final val = UpdateOfferDto(
        code: $checkedConvert('code', (v) => v as String?),
        label: $checkedConvert('label', (v) => v as String?),
        description: $checkedConvert('description', (v) => v as String?),
        position: $checkedConvert('position', (v) => v as num?),
        isActive: $checkedConvert('isActive', (v) => v as bool? ?? true),
      );
      return val;
    });

Map<String, dynamic> _$UpdateOfferDtoToJson(UpdateOfferDto instance) =>
    <String, dynamic>{
      if (instance.code case final value?) 'code': value,
      if (instance.label case final value?) 'label': value,
      if (instance.description case final value?) 'description': value,
      if (instance.position case final value?) 'position': value,
      if (instance.isActive case final value?) 'isActive': value,
    };

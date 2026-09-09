// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'create_banque_dto.dart';

// **************************************************************************
// CopyWithGenerator
// **************************************************************************

abstract class _$CreateBanqueDtoCWProxy {
  CreateBanqueDto name(String name);

  CreateBanqueDto shortName(String shortName);

  CreateBanqueDto isActive(bool? isActive);

  CreateBanqueDto sortOrder(num? sortOrder);

  /// This function **does support** nullification of nullable fields. All `null` values passed to `non-nullable` fields will be ignored. You can also use `CreateBanqueDto(...).copyWith.fieldName(...)` to override fields one at a time with nullification support.
  ///
  /// Usage
  /// ```dart
  /// CreateBanqueDto(...).copyWith(id: 12, name: "My name")
  /// ````
  CreateBanqueDto call({
    String name,
    String shortName,
    bool? isActive,
    num? sortOrder,
  });
}

/// Proxy class for `copyWith` functionality. This is a callable class and can be used as follows: `instanceOfCreateBanqueDto.copyWith(...)`. Additionally contains functions for specific fields e.g. `instanceOfCreateBanqueDto.copyWith.fieldName(...)`
class _$CreateBanqueDtoCWProxyImpl implements _$CreateBanqueDtoCWProxy {
  const _$CreateBanqueDtoCWProxyImpl(this._value);

  final CreateBanqueDto _value;

  @override
  CreateBanqueDto name(String name) => this(name: name);

  @override
  CreateBanqueDto shortName(String shortName) => this(shortName: shortName);

  @override
  CreateBanqueDto isActive(bool? isActive) => this(isActive: isActive);

  @override
  CreateBanqueDto sortOrder(num? sortOrder) => this(sortOrder: sortOrder);

  @override
  /// This function **does support** nullification of nullable fields. All `null` values passed to `non-nullable` fields will be ignored. You can also use `CreateBanqueDto(...).copyWith.fieldName(...)` to override fields one at a time with nullification support.
  ///
  /// Usage
  /// ```dart
  /// CreateBanqueDto(...).copyWith(id: 12, name: "My name")
  /// ````
  CreateBanqueDto call({
    Object? name = const $CopyWithPlaceholder(),
    Object? shortName = const $CopyWithPlaceholder(),
    Object? isActive = const $CopyWithPlaceholder(),
    Object? sortOrder = const $CopyWithPlaceholder(),
  }) {
    return CreateBanqueDto(
      name: name == const $CopyWithPlaceholder()
          ? _value.name
          // ignore: cast_nullable_to_non_nullable
          : name as String,
      shortName: shortName == const $CopyWithPlaceholder()
          ? _value.shortName
          // ignore: cast_nullable_to_non_nullable
          : shortName as String,
      isActive: isActive == const $CopyWithPlaceholder()
          ? _value.isActive
          // ignore: cast_nullable_to_non_nullable
          : isActive as bool?,
      sortOrder: sortOrder == const $CopyWithPlaceholder()
          ? _value.sortOrder
          // ignore: cast_nullable_to_non_nullable
          : sortOrder as num?,
    );
  }
}

extension $CreateBanqueDtoCopyWith on CreateBanqueDto {
  /// Returns a callable class that can be used as follows: `instanceOfCreateBanqueDto.copyWith(...)` or like so:`instanceOfCreateBanqueDto.copyWith.fieldName(...)`.
  // ignore: library_private_types_in_public_api
  _$CreateBanqueDtoCWProxy get copyWith => _$CreateBanqueDtoCWProxyImpl(this);
}

// **************************************************************************
// JsonSerializableGenerator
// **************************************************************************

CreateBanqueDto _$CreateBanqueDtoFromJson(Map<String, dynamic> json) =>
    $checkedCreate('CreateBanqueDto', json, ($checkedConvert) {
      $checkKeys(json, requiredKeys: const ['name', 'shortName']);
      final val = CreateBanqueDto(
        name: $checkedConvert('name', (v) => v as String),
        shortName: $checkedConvert('shortName', (v) => v as String),
        isActive: $checkedConvert('isActive', (v) => v as bool? ?? true),
        sortOrder: $checkedConvert('sortOrder', (v) => v as num? ?? 100),
      );
      return val;
    });

Map<String, dynamic> _$CreateBanqueDtoToJson(CreateBanqueDto instance) =>
    <String, dynamic>{
      'name': instance.name,
      'shortName': instance.shortName,
      if (instance.isActive case final value?) 'isActive': value,
      if (instance.sortOrder case final value?) 'sortOrder': value,
    };

// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'update_banque_dto.dart';

// **************************************************************************
// CopyWithGenerator
// **************************************************************************

abstract class _$UpdateBanqueDtoCWProxy {
  UpdateBanqueDto name(String? name);

  UpdateBanqueDto shortName(String? shortName);

  UpdateBanqueDto isActive(bool? isActive);

  UpdateBanqueDto sortOrder(num? sortOrder);

  /// This function **does support** nullification of nullable fields. All `null` values passed to `non-nullable` fields will be ignored. You can also use `UpdateBanqueDto(...).copyWith.fieldName(...)` to override fields one at a time with nullification support.
  ///
  /// Usage
  /// ```dart
  /// UpdateBanqueDto(...).copyWith(id: 12, name: "My name")
  /// ````
  UpdateBanqueDto call({
    String? name,
    String? shortName,
    bool? isActive,
    num? sortOrder,
  });
}

/// Proxy class for `copyWith` functionality. This is a callable class and can be used as follows: `instanceOfUpdateBanqueDto.copyWith(...)`. Additionally contains functions for specific fields e.g. `instanceOfUpdateBanqueDto.copyWith.fieldName(...)`
class _$UpdateBanqueDtoCWProxyImpl implements _$UpdateBanqueDtoCWProxy {
  const _$UpdateBanqueDtoCWProxyImpl(this._value);

  final UpdateBanqueDto _value;

  @override
  UpdateBanqueDto name(String? name) => this(name: name);

  @override
  UpdateBanqueDto shortName(String? shortName) => this(shortName: shortName);

  @override
  UpdateBanqueDto isActive(bool? isActive) => this(isActive: isActive);

  @override
  UpdateBanqueDto sortOrder(num? sortOrder) => this(sortOrder: sortOrder);

  @override
  /// This function **does support** nullification of nullable fields. All `null` values passed to `non-nullable` fields will be ignored. You can also use `UpdateBanqueDto(...).copyWith.fieldName(...)` to override fields one at a time with nullification support.
  ///
  /// Usage
  /// ```dart
  /// UpdateBanqueDto(...).copyWith(id: 12, name: "My name")
  /// ````
  UpdateBanqueDto call({
    Object? name = const $CopyWithPlaceholder(),
    Object? shortName = const $CopyWithPlaceholder(),
    Object? isActive = const $CopyWithPlaceholder(),
    Object? sortOrder = const $CopyWithPlaceholder(),
  }) {
    return UpdateBanqueDto(
      name: name == const $CopyWithPlaceholder()
          ? _value.name
          // ignore: cast_nullable_to_non_nullable
          : name as String?,
      shortName: shortName == const $CopyWithPlaceholder()
          ? _value.shortName
          // ignore: cast_nullable_to_non_nullable
          : shortName as String?,
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

extension $UpdateBanqueDtoCopyWith on UpdateBanqueDto {
  /// Returns a callable class that can be used as follows: `instanceOfUpdateBanqueDto.copyWith(...)` or like so:`instanceOfUpdateBanqueDto.copyWith.fieldName(...)`.
  // ignore: library_private_types_in_public_api
  _$UpdateBanqueDtoCWProxy get copyWith => _$UpdateBanqueDtoCWProxyImpl(this);
}

// **************************************************************************
// JsonSerializableGenerator
// **************************************************************************

UpdateBanqueDto _$UpdateBanqueDtoFromJson(Map<String, dynamic> json) =>
    $checkedCreate('UpdateBanqueDto', json, ($checkedConvert) {
      final val = UpdateBanqueDto(
        name: $checkedConvert('name', (v) => v as String?),
        shortName: $checkedConvert('shortName', (v) => v as String?),
        isActive: $checkedConvert('isActive', (v) => v as bool? ?? true),
        sortOrder: $checkedConvert('sortOrder', (v) => v as num? ?? 100),
      );
      return val;
    });

Map<String, dynamic> _$UpdateBanqueDtoToJson(UpdateBanqueDto instance) =>
    <String, dynamic>{
      if (instance.name case final value?) 'name': value,
      if (instance.shortName case final value?) 'shortName': value,
      if (instance.isActive case final value?) 'isActive': value,
      if (instance.sortOrder case final value?) 'sortOrder': value,
    };

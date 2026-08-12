// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'banque_dto.dart';

// **************************************************************************
// CopyWithGenerator
// **************************************************************************

abstract class _$BanqueDtoCWProxy {
  BanqueDto id(String id);

  BanqueDto name(String name);

  BanqueDto shortName(String shortName);

  BanqueDto isActive(bool isActive);

  BanqueDto sortOrder(num sortOrder);

  BanqueDto updatedAt(DateTime updatedAt);

  /// This function **does support** nullification of nullable fields. All `null` values passed to `non-nullable` fields will be ignored. You can also use `BanqueDto(...).copyWith.fieldName(...)` to override fields one at a time with nullification support.
  ///
  /// Usage
  /// ```dart
  /// BanqueDto(...).copyWith(id: 12, name: "My name")
  /// ````
  BanqueDto call({
    String id,
    String name,
    String shortName,
    bool isActive,
    num sortOrder,
    DateTime updatedAt,
  });
}

/// Proxy class for `copyWith` functionality. This is a callable class and can be used as follows: `instanceOfBanqueDto.copyWith(...)`. Additionally contains functions for specific fields e.g. `instanceOfBanqueDto.copyWith.fieldName(...)`
class _$BanqueDtoCWProxyImpl implements _$BanqueDtoCWProxy {
  const _$BanqueDtoCWProxyImpl(this._value);

  final BanqueDto _value;

  @override
  BanqueDto id(String id) => this(id: id);

  @override
  BanqueDto name(String name) => this(name: name);

  @override
  BanqueDto shortName(String shortName) => this(shortName: shortName);

  @override
  BanqueDto isActive(bool isActive) => this(isActive: isActive);

  @override
  BanqueDto sortOrder(num sortOrder) => this(sortOrder: sortOrder);

  @override
  BanqueDto updatedAt(DateTime updatedAt) => this(updatedAt: updatedAt);

  @override
  /// This function **does support** nullification of nullable fields. All `null` values passed to `non-nullable` fields will be ignored. You can also use `BanqueDto(...).copyWith.fieldName(...)` to override fields one at a time with nullification support.
  ///
  /// Usage
  /// ```dart
  /// BanqueDto(...).copyWith(id: 12, name: "My name")
  /// ````
  BanqueDto call({
    Object? id = const $CopyWithPlaceholder(),
    Object? name = const $CopyWithPlaceholder(),
    Object? shortName = const $CopyWithPlaceholder(),
    Object? isActive = const $CopyWithPlaceholder(),
    Object? sortOrder = const $CopyWithPlaceholder(),
    Object? updatedAt = const $CopyWithPlaceholder(),
  }) {
    return BanqueDto(
      id: id == const $CopyWithPlaceholder()
          ? _value.id
          // ignore: cast_nullable_to_non_nullable
          : id as String,
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
          : isActive as bool,
      sortOrder: sortOrder == const $CopyWithPlaceholder()
          ? _value.sortOrder
          // ignore: cast_nullable_to_non_nullable
          : sortOrder as num,
      updatedAt: updatedAt == const $CopyWithPlaceholder()
          ? _value.updatedAt
          // ignore: cast_nullable_to_non_nullable
          : updatedAt as DateTime,
    );
  }
}

extension $BanqueDtoCopyWith on BanqueDto {
  /// Returns a callable class that can be used as follows: `instanceOfBanqueDto.copyWith(...)` or like so:`instanceOfBanqueDto.copyWith.fieldName(...)`.
  // ignore: library_private_types_in_public_api
  _$BanqueDtoCWProxy get copyWith => _$BanqueDtoCWProxyImpl(this);
}

// **************************************************************************
// JsonSerializableGenerator
// **************************************************************************

BanqueDto _$BanqueDtoFromJson(Map<String, dynamic> json) =>
    $checkedCreate('BanqueDto', json, ($checkedConvert) {
      $checkKeys(
        json,
        requiredKeys: const [
          'id',
          'name',
          'shortName',
          'isActive',
          'sortOrder',
          'updatedAt',
        ],
      );
      final val = BanqueDto(
        id: $checkedConvert('id', (v) => v as String),
        name: $checkedConvert('name', (v) => v as String),
        shortName: $checkedConvert('shortName', (v) => v as String),
        isActive: $checkedConvert('isActive', (v) => v as bool),
        sortOrder: $checkedConvert('sortOrder', (v) => v as num),
        updatedAt: $checkedConvert(
          'updatedAt',
          (v) => DateTime.parse(v as String),
        ),
      );
      return val;
    });

Map<String, dynamic> _$BanqueDtoToJson(BanqueDto instance) => <String, dynamic>{
  'id': instance.id,
  'name': instance.name,
  'shortName': instance.shortName,
  'isActive': instance.isActive,
  'sortOrder': instance.sortOrder,
  'updatedAt': instance.updatedAt.toIso8601String(),
};

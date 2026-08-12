// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'syndicat_dto.dart';

// **************************************************************************
// CopyWithGenerator
// **************************************************************************

abstract class _$SyndicatDtoCWProxy {
  SyndicatDto id(String id);

  SyndicatDto name(String name);

  SyndicatDto sigle(String sigle);

  SyndicatDto secteur(String? secteur);

  SyndicatDto isActive(bool isActive);

  SyndicatDto sortOrder(num sortOrder);

  SyndicatDto updatedAt(DateTime updatedAt);

  /// This function **does support** nullification of nullable fields. All `null` values passed to `non-nullable` fields will be ignored. You can also use `SyndicatDto(...).copyWith.fieldName(...)` to override fields one at a time with nullification support.
  ///
  /// Usage
  /// ```dart
  /// SyndicatDto(...).copyWith(id: 12, name: "My name")
  /// ````
  SyndicatDto call({
    String id,
    String name,
    String sigle,
    String? secteur,
    bool isActive,
    num sortOrder,
    DateTime updatedAt,
  });
}

/// Proxy class for `copyWith` functionality. This is a callable class and can be used as follows: `instanceOfSyndicatDto.copyWith(...)`. Additionally contains functions for specific fields e.g. `instanceOfSyndicatDto.copyWith.fieldName(...)`
class _$SyndicatDtoCWProxyImpl implements _$SyndicatDtoCWProxy {
  const _$SyndicatDtoCWProxyImpl(this._value);

  final SyndicatDto _value;

  @override
  SyndicatDto id(String id) => this(id: id);

  @override
  SyndicatDto name(String name) => this(name: name);

  @override
  SyndicatDto sigle(String sigle) => this(sigle: sigle);

  @override
  SyndicatDto secteur(String? secteur) => this(secteur: secteur);

  @override
  SyndicatDto isActive(bool isActive) => this(isActive: isActive);

  @override
  SyndicatDto sortOrder(num sortOrder) => this(sortOrder: sortOrder);

  @override
  SyndicatDto updatedAt(DateTime updatedAt) => this(updatedAt: updatedAt);

  @override
  /// This function **does support** nullification of nullable fields. All `null` values passed to `non-nullable` fields will be ignored. You can also use `SyndicatDto(...).copyWith.fieldName(...)` to override fields one at a time with nullification support.
  ///
  /// Usage
  /// ```dart
  /// SyndicatDto(...).copyWith(id: 12, name: "My name")
  /// ````
  SyndicatDto call({
    Object? id = const $CopyWithPlaceholder(),
    Object? name = const $CopyWithPlaceholder(),
    Object? sigle = const $CopyWithPlaceholder(),
    Object? secteur = const $CopyWithPlaceholder(),
    Object? isActive = const $CopyWithPlaceholder(),
    Object? sortOrder = const $CopyWithPlaceholder(),
    Object? updatedAt = const $CopyWithPlaceholder(),
  }) {
    return SyndicatDto(
      id: id == const $CopyWithPlaceholder()
          ? _value.id
          // ignore: cast_nullable_to_non_nullable
          : id as String,
      name: name == const $CopyWithPlaceholder()
          ? _value.name
          // ignore: cast_nullable_to_non_nullable
          : name as String,
      sigle: sigle == const $CopyWithPlaceholder()
          ? _value.sigle
          // ignore: cast_nullable_to_non_nullable
          : sigle as String,
      secteur: secteur == const $CopyWithPlaceholder()
          ? _value.secteur
          // ignore: cast_nullable_to_non_nullable
          : secteur as String?,
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

extension $SyndicatDtoCopyWith on SyndicatDto {
  /// Returns a callable class that can be used as follows: `instanceOfSyndicatDto.copyWith(...)` or like so:`instanceOfSyndicatDto.copyWith.fieldName(...)`.
  // ignore: library_private_types_in_public_api
  _$SyndicatDtoCWProxy get copyWith => _$SyndicatDtoCWProxyImpl(this);
}

// **************************************************************************
// JsonSerializableGenerator
// **************************************************************************

SyndicatDto _$SyndicatDtoFromJson(Map<String, dynamic> json) =>
    $checkedCreate('SyndicatDto', json, ($checkedConvert) {
      $checkKeys(
        json,
        requiredKeys: const [
          'id',
          'name',
          'sigle',
          'secteur',
          'isActive',
          'sortOrder',
          'updatedAt',
        ],
      );
      final val = SyndicatDto(
        id: $checkedConvert('id', (v) => v as String),
        name: $checkedConvert('name', (v) => v as String),
        sigle: $checkedConvert('sigle', (v) => v as String),
        secteur: $checkedConvert('secteur', (v) => v as String?),
        isActive: $checkedConvert('isActive', (v) => v as bool),
        sortOrder: $checkedConvert('sortOrder', (v) => v as num),
        updatedAt: $checkedConvert(
          'updatedAt',
          (v) => DateTime.parse(v as String),
        ),
      );
      return val;
    });

Map<String, dynamic> _$SyndicatDtoToJson(SyndicatDto instance) =>
    <String, dynamic>{
      'id': instance.id,
      'name': instance.name,
      'sigle': instance.sigle,
      'secteur': instance.secteur,
      'isActive': instance.isActive,
      'sortOrder': instance.sortOrder,
      'updatedAt': instance.updatedAt.toIso8601String(),
    };

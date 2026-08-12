// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'create_syndicat_dto.dart';

// **************************************************************************
// CopyWithGenerator
// **************************************************************************

abstract class _$CreateSyndicatDtoCWProxy {
  CreateSyndicatDto name(String name);

  CreateSyndicatDto sigle(String sigle);

  CreateSyndicatDto secteur(String? secteur);

  CreateSyndicatDto isActive(bool? isActive);

  CreateSyndicatDto sortOrder(num? sortOrder);

  /// This function **does support** nullification of nullable fields. All `null` values passed to `non-nullable` fields will be ignored. You can also use `CreateSyndicatDto(...).copyWith.fieldName(...)` to override fields one at a time with nullification support.
  ///
  /// Usage
  /// ```dart
  /// CreateSyndicatDto(...).copyWith(id: 12, name: "My name")
  /// ````
  CreateSyndicatDto call({
    String name,
    String sigle,
    String? secteur,
    bool? isActive,
    num? sortOrder,
  });
}

/// Proxy class for `copyWith` functionality. This is a callable class and can be used as follows: `instanceOfCreateSyndicatDto.copyWith(...)`. Additionally contains functions for specific fields e.g. `instanceOfCreateSyndicatDto.copyWith.fieldName(...)`
class _$CreateSyndicatDtoCWProxyImpl implements _$CreateSyndicatDtoCWProxy {
  const _$CreateSyndicatDtoCWProxyImpl(this._value);

  final CreateSyndicatDto _value;

  @override
  CreateSyndicatDto name(String name) => this(name: name);

  @override
  CreateSyndicatDto sigle(String sigle) => this(sigle: sigle);

  @override
  CreateSyndicatDto secteur(String? secteur) => this(secteur: secteur);

  @override
  CreateSyndicatDto isActive(bool? isActive) => this(isActive: isActive);

  @override
  CreateSyndicatDto sortOrder(num? sortOrder) => this(sortOrder: sortOrder);

  @override
  /// This function **does support** nullification of nullable fields. All `null` values passed to `non-nullable` fields will be ignored. You can also use `CreateSyndicatDto(...).copyWith.fieldName(...)` to override fields one at a time with nullification support.
  ///
  /// Usage
  /// ```dart
  /// CreateSyndicatDto(...).copyWith(id: 12, name: "My name")
  /// ````
  CreateSyndicatDto call({
    Object? name = const $CopyWithPlaceholder(),
    Object? sigle = const $CopyWithPlaceholder(),
    Object? secteur = const $CopyWithPlaceholder(),
    Object? isActive = const $CopyWithPlaceholder(),
    Object? sortOrder = const $CopyWithPlaceholder(),
  }) {
    return CreateSyndicatDto(
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
          : isActive as bool?,
      sortOrder: sortOrder == const $CopyWithPlaceholder()
          ? _value.sortOrder
          // ignore: cast_nullable_to_non_nullable
          : sortOrder as num?,
    );
  }
}

extension $CreateSyndicatDtoCopyWith on CreateSyndicatDto {
  /// Returns a callable class that can be used as follows: `instanceOfCreateSyndicatDto.copyWith(...)` or like so:`instanceOfCreateSyndicatDto.copyWith.fieldName(...)`.
  // ignore: library_private_types_in_public_api
  _$CreateSyndicatDtoCWProxy get copyWith =>
      _$CreateSyndicatDtoCWProxyImpl(this);
}

// **************************************************************************
// JsonSerializableGenerator
// **************************************************************************

CreateSyndicatDto _$CreateSyndicatDtoFromJson(Map<String, dynamic> json) =>
    $checkedCreate('CreateSyndicatDto', json, ($checkedConvert) {
      $checkKeys(json, requiredKeys: const ['name', 'sigle']);
      final val = CreateSyndicatDto(
        name: $checkedConvert('name', (v) => v as String),
        sigle: $checkedConvert('sigle', (v) => v as String),
        secteur: $checkedConvert('secteur', (v) => v as String?),
        isActive: $checkedConvert('isActive', (v) => v as bool? ?? true),
        sortOrder: $checkedConvert('sortOrder', (v) => v as num? ?? 100),
      );
      return val;
    });

Map<String, dynamic> _$CreateSyndicatDtoToJson(CreateSyndicatDto instance) =>
    <String, dynamic>{
      'name': instance.name,
      'sigle': instance.sigle,
      if (instance.secteur case final value?) 'secteur': value,
      if (instance.isActive case final value?) 'isActive': value,
      if (instance.sortOrder case final value?) 'sortOrder': value,
    };

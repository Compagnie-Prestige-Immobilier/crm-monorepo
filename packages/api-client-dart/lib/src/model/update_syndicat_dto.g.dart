// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'update_syndicat_dto.dart';

// **************************************************************************
// CopyWithGenerator
// **************************************************************************

abstract class _$UpdateSyndicatDtoCWProxy {
  UpdateSyndicatDto name(String? name);

  UpdateSyndicatDto sigle(String? sigle);

  UpdateSyndicatDto secteur(String? secteur);

  UpdateSyndicatDto isActive(bool? isActive);

  UpdateSyndicatDto sortOrder(num? sortOrder);

  /// This function **does support** nullification of nullable fields. All `null` values passed to `non-nullable` fields will be ignored. You can also use `UpdateSyndicatDto(...).copyWith.fieldName(...)` to override fields one at a time with nullification support.
  ///
  /// Usage
  /// ```dart
  /// UpdateSyndicatDto(...).copyWith(id: 12, name: "My name")
  /// ````
  UpdateSyndicatDto call({
    String? name,
    String? sigle,
    String? secteur,
    bool? isActive,
    num? sortOrder,
  });
}

/// Proxy class for `copyWith` functionality. This is a callable class and can be used as follows: `instanceOfUpdateSyndicatDto.copyWith(...)`. Additionally contains functions for specific fields e.g. `instanceOfUpdateSyndicatDto.copyWith.fieldName(...)`
class _$UpdateSyndicatDtoCWProxyImpl implements _$UpdateSyndicatDtoCWProxy {
  const _$UpdateSyndicatDtoCWProxyImpl(this._value);

  final UpdateSyndicatDto _value;

  @override
  UpdateSyndicatDto name(String? name) => this(name: name);

  @override
  UpdateSyndicatDto sigle(String? sigle) => this(sigle: sigle);

  @override
  UpdateSyndicatDto secteur(String? secteur) => this(secteur: secteur);

  @override
  UpdateSyndicatDto isActive(bool? isActive) => this(isActive: isActive);

  @override
  UpdateSyndicatDto sortOrder(num? sortOrder) => this(sortOrder: sortOrder);

  @override
  /// This function **does support** nullification of nullable fields. All `null` values passed to `non-nullable` fields will be ignored. You can also use `UpdateSyndicatDto(...).copyWith.fieldName(...)` to override fields one at a time with nullification support.
  ///
  /// Usage
  /// ```dart
  /// UpdateSyndicatDto(...).copyWith(id: 12, name: "My name")
  /// ````
  UpdateSyndicatDto call({
    Object? name = const $CopyWithPlaceholder(),
    Object? sigle = const $CopyWithPlaceholder(),
    Object? secteur = const $CopyWithPlaceholder(),
    Object? isActive = const $CopyWithPlaceholder(),
    Object? sortOrder = const $CopyWithPlaceholder(),
  }) {
    return UpdateSyndicatDto(
      name: name == const $CopyWithPlaceholder()
          ? _value.name
          // ignore: cast_nullable_to_non_nullable
          : name as String?,
      sigle: sigle == const $CopyWithPlaceholder()
          ? _value.sigle
          // ignore: cast_nullable_to_non_nullable
          : sigle as String?,
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

extension $UpdateSyndicatDtoCopyWith on UpdateSyndicatDto {
  /// Returns a callable class that can be used as follows: `instanceOfUpdateSyndicatDto.copyWith(...)` or like so:`instanceOfUpdateSyndicatDto.copyWith.fieldName(...)`.
  // ignore: library_private_types_in_public_api
  _$UpdateSyndicatDtoCWProxy get copyWith =>
      _$UpdateSyndicatDtoCWProxyImpl(this);
}

// **************************************************************************
// JsonSerializableGenerator
// **************************************************************************

UpdateSyndicatDto _$UpdateSyndicatDtoFromJson(Map<String, dynamic> json) =>
    $checkedCreate('UpdateSyndicatDto', json, ($checkedConvert) {
      final val = UpdateSyndicatDto(
        name: $checkedConvert('name', (v) => v as String?),
        sigle: $checkedConvert('sigle', (v) => v as String?),
        secteur: $checkedConvert('secteur', (v) => v as String?),
        isActive: $checkedConvert('isActive', (v) => v as bool? ?? true),
        sortOrder: $checkedConvert('sortOrder', (v) => v as num? ?? 100),
      );
      return val;
    });

Map<String, dynamic> _$UpdateSyndicatDtoToJson(UpdateSyndicatDto instance) =>
    <String, dynamic>{
      if (instance.name case final value?) 'name': value,
      if (instance.sigle case final value?) 'sigle': value,
      if (instance.secteur case final value?) 'secteur': value,
      if (instance.isActive case final value?) 'isActive': value,
      if (instance.sortOrder case final value?) 'sortOrder': value,
    };

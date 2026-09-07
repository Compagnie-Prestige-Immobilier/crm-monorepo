// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'tranche_duree_dto.dart';

// **************************************************************************
// CopyWithGenerator
// **************************************************************************

abstract class _$TrancheDureeDtoCWProxy {
  TrancheDureeDto mois(num mois);

  TrancheDureeDto libelle(String libelle);

  /// This function **does support** nullification of nullable fields. All `null` values passed to `non-nullable` fields will be ignored. You can also use `TrancheDureeDto(...).copyWith.fieldName(...)` to override fields one at a time with nullification support.
  ///
  /// Usage
  /// ```dart
  /// TrancheDureeDto(...).copyWith(id: 12, name: "My name")
  /// ````
  TrancheDureeDto call({num mois, String libelle});
}

/// Proxy class for `copyWith` functionality. This is a callable class and can be used as follows: `instanceOfTrancheDureeDto.copyWith(...)`. Additionally contains functions for specific fields e.g. `instanceOfTrancheDureeDto.copyWith.fieldName(...)`
class _$TrancheDureeDtoCWProxyImpl implements _$TrancheDureeDtoCWProxy {
  const _$TrancheDureeDtoCWProxyImpl(this._value);

  final TrancheDureeDto _value;

  @override
  TrancheDureeDto mois(num mois) => this(mois: mois);

  @override
  TrancheDureeDto libelle(String libelle) => this(libelle: libelle);

  @override
  /// This function **does support** nullification of nullable fields. All `null` values passed to `non-nullable` fields will be ignored. You can also use `TrancheDureeDto(...).copyWith.fieldName(...)` to override fields one at a time with nullification support.
  ///
  /// Usage
  /// ```dart
  /// TrancheDureeDto(...).copyWith(id: 12, name: "My name")
  /// ````
  TrancheDureeDto call({
    Object? mois = const $CopyWithPlaceholder(),
    Object? libelle = const $CopyWithPlaceholder(),
  }) {
    return TrancheDureeDto(
      mois: mois == const $CopyWithPlaceholder()
          ? _value.mois
          // ignore: cast_nullable_to_non_nullable
          : mois as num,
      libelle: libelle == const $CopyWithPlaceholder()
          ? _value.libelle
          // ignore: cast_nullable_to_non_nullable
          : libelle as String,
    );
  }
}

extension $TrancheDureeDtoCopyWith on TrancheDureeDto {
  /// Returns a callable class that can be used as follows: `instanceOfTrancheDureeDto.copyWith(...)` or like so:`instanceOfTrancheDureeDto.copyWith.fieldName(...)`.
  // ignore: library_private_types_in_public_api
  _$TrancheDureeDtoCWProxy get copyWith => _$TrancheDureeDtoCWProxyImpl(this);
}

// **************************************************************************
// JsonSerializableGenerator
// **************************************************************************

TrancheDureeDto _$TrancheDureeDtoFromJson(Map<String, dynamic> json) =>
    $checkedCreate('TrancheDureeDto', json, ($checkedConvert) {
      $checkKeys(json, requiredKeys: const ['mois', 'libelle']);
      final val = TrancheDureeDto(
        mois: $checkedConvert('mois', (v) => v as num),
        libelle: $checkedConvert('libelle', (v) => v as String),
      );
      return val;
    });

Map<String, dynamic> _$TrancheDureeDtoToJson(TrancheDureeDto instance) =>
    <String, dynamic>{'mois': instance.mois, 'libelle': instance.libelle};

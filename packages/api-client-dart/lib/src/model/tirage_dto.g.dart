// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'tirage_dto.dart';

// **************************************************************************
// CopyWithGenerator
// **************************************************************************

abstract class _$TirageDtoCWProxy {
  TirageDto projet(Projet projet);

  TirageDto dureeMs(num dureeMs);

  TirageDto lus(num lus);

  TirageDto crees(num crees);

  TirageDto misAJour(num misAJour);

  TirageDto rapproches(num rapproches);

  TirageDto disparues(num disparues);

  TirageDto erreur(String? erreur);

  /// This function **does support** nullification of nullable fields. All `null` values passed to `non-nullable` fields will be ignored. You can also use `TirageDto(...).copyWith.fieldName(...)` to override fields one at a time with nullification support.
  ///
  /// Usage
  /// ```dart
  /// TirageDto(...).copyWith(id: 12, name: "My name")
  /// ````
  TirageDto call({
    Projet projet,
    num dureeMs,
    num lus,
    num crees,
    num misAJour,
    num rapproches,
    num disparues,
    String? erreur,
  });
}

/// Proxy class for `copyWith` functionality. This is a callable class and can be used as follows: `instanceOfTirageDto.copyWith(...)`. Additionally contains functions for specific fields e.g. `instanceOfTirageDto.copyWith.fieldName(...)`
class _$TirageDtoCWProxyImpl implements _$TirageDtoCWProxy {
  const _$TirageDtoCWProxyImpl(this._value);

  final TirageDto _value;

  @override
  TirageDto projet(Projet projet) => this(projet: projet);

  @override
  TirageDto dureeMs(num dureeMs) => this(dureeMs: dureeMs);

  @override
  TirageDto lus(num lus) => this(lus: lus);

  @override
  TirageDto crees(num crees) => this(crees: crees);

  @override
  TirageDto misAJour(num misAJour) => this(misAJour: misAJour);

  @override
  TirageDto rapproches(num rapproches) => this(rapproches: rapproches);

  @override
  TirageDto disparues(num disparues) => this(disparues: disparues);

  @override
  TirageDto erreur(String? erreur) => this(erreur: erreur);

  @override
  /// This function **does support** nullification of nullable fields. All `null` values passed to `non-nullable` fields will be ignored. You can also use `TirageDto(...).copyWith.fieldName(...)` to override fields one at a time with nullification support.
  ///
  /// Usage
  /// ```dart
  /// TirageDto(...).copyWith(id: 12, name: "My name")
  /// ````
  TirageDto call({
    Object? projet = const $CopyWithPlaceholder(),
    Object? dureeMs = const $CopyWithPlaceholder(),
    Object? lus = const $CopyWithPlaceholder(),
    Object? crees = const $CopyWithPlaceholder(),
    Object? misAJour = const $CopyWithPlaceholder(),
    Object? rapproches = const $CopyWithPlaceholder(),
    Object? disparues = const $CopyWithPlaceholder(),
    Object? erreur = const $CopyWithPlaceholder(),
  }) {
    return TirageDto(
      projet: projet == const $CopyWithPlaceholder()
          ? _value.projet
          // ignore: cast_nullable_to_non_nullable
          : projet as Projet,
      dureeMs: dureeMs == const $CopyWithPlaceholder()
          ? _value.dureeMs
          // ignore: cast_nullable_to_non_nullable
          : dureeMs as num,
      lus: lus == const $CopyWithPlaceholder()
          ? _value.lus
          // ignore: cast_nullable_to_non_nullable
          : lus as num,
      crees: crees == const $CopyWithPlaceholder()
          ? _value.crees
          // ignore: cast_nullable_to_non_nullable
          : crees as num,
      misAJour: misAJour == const $CopyWithPlaceholder()
          ? _value.misAJour
          // ignore: cast_nullable_to_non_nullable
          : misAJour as num,
      rapproches: rapproches == const $CopyWithPlaceholder()
          ? _value.rapproches
          // ignore: cast_nullable_to_non_nullable
          : rapproches as num,
      disparues: disparues == const $CopyWithPlaceholder()
          ? _value.disparues
          // ignore: cast_nullable_to_non_nullable
          : disparues as num,
      erreur: erreur == const $CopyWithPlaceholder()
          ? _value.erreur
          // ignore: cast_nullable_to_non_nullable
          : erreur as String?,
    );
  }
}

extension $TirageDtoCopyWith on TirageDto {
  /// Returns a callable class that can be used as follows: `instanceOfTirageDto.copyWith(...)` or like so:`instanceOfTirageDto.copyWith.fieldName(...)`.
  // ignore: library_private_types_in_public_api
  _$TirageDtoCWProxy get copyWith => _$TirageDtoCWProxyImpl(this);
}

// **************************************************************************
// JsonSerializableGenerator
// **************************************************************************

TirageDto _$TirageDtoFromJson(Map<String, dynamic> json) =>
    $checkedCreate('TirageDto', json, ($checkedConvert) {
      $checkKeys(
        json,
        requiredKeys: const [
          'projet',
          'dureeMs',
          'lus',
          'crees',
          'misAJour',
          'rapproches',
          'disparues',
          'erreur',
        ],
      );
      final val = TirageDto(
        projet: $checkedConvert(
          'projet',
          (v) => $enumDecode(
            _$ProjetEnumMap,
            v,
            unknownValue: Projet.unknownDefaultOpenApi,
          ),
        ),
        dureeMs: $checkedConvert('dureeMs', (v) => v as num),
        lus: $checkedConvert('lus', (v) => v as num),
        crees: $checkedConvert('crees', (v) => v as num),
        misAJour: $checkedConvert('misAJour', (v) => v as num),
        rapproches: $checkedConvert('rapproches', (v) => v as num),
        disparues: $checkedConvert('disparues', (v) => v as num),
        erreur: $checkedConvert('erreur', (v) => v as String?),
      );
      return val;
    });

Map<String, dynamic> _$TirageDtoToJson(TirageDto instance) => <String, dynamic>{
  'projet': _$ProjetEnumMap[instance.projet]!,
  'dureeMs': instance.dureeMs,
  'lus': instance.lus,
  'crees': instance.crees,
  'misAJour': instance.misAJour,
  'rapproches': instance.rapproches,
  'disparues': instance.disparues,
  'erreur': instance.erreur,
};

const _$ProjetEnumMap = {
  Projet.CHUES: 'CHUES',
  Projet.GRAND_PUBLIC: 'GRAND_PUBLIC',
  Projet.unknownDefaultOpenApi: 'unknown_default_open_api',
};

// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'dernier_tirage_dto.dart';

// **************************************************************************
// CopyWithGenerator
// **************************************************************************

abstract class _$DernierTirageDtoCWProxy {
  DernierTirageDto termineLe(DateTime termineLe);

  DernierTirageDto dureeMs(num dureeMs);

  DernierTirageDto lus(num lus);

  DernierTirageDto crees(num crees);

  DernierTirageDto misAJour(num misAJour);

  DernierTirageDto rapproches(num rapproches);

  DernierTirageDto disparues(num disparues);

  DernierTirageDto erreur(String? erreur);

  /// This function **does support** nullification of nullable fields. All `null` values passed to `non-nullable` fields will be ignored. You can also use `DernierTirageDto(...).copyWith.fieldName(...)` to override fields one at a time with nullification support.
  ///
  /// Usage
  /// ```dart
  /// DernierTirageDto(...).copyWith(id: 12, name: "My name")
  /// ````
  DernierTirageDto call({
    DateTime termineLe,
    num dureeMs,
    num lus,
    num crees,
    num misAJour,
    num rapproches,
    num disparues,
    String? erreur,
  });
}

/// Proxy class for `copyWith` functionality. This is a callable class and can be used as follows: `instanceOfDernierTirageDto.copyWith(...)`. Additionally contains functions for specific fields e.g. `instanceOfDernierTirageDto.copyWith.fieldName(...)`
class _$DernierTirageDtoCWProxyImpl implements _$DernierTirageDtoCWProxy {
  const _$DernierTirageDtoCWProxyImpl(this._value);

  final DernierTirageDto _value;

  @override
  DernierTirageDto termineLe(DateTime termineLe) => this(termineLe: termineLe);

  @override
  DernierTirageDto dureeMs(num dureeMs) => this(dureeMs: dureeMs);

  @override
  DernierTirageDto lus(num lus) => this(lus: lus);

  @override
  DernierTirageDto crees(num crees) => this(crees: crees);

  @override
  DernierTirageDto misAJour(num misAJour) => this(misAJour: misAJour);

  @override
  DernierTirageDto rapproches(num rapproches) => this(rapproches: rapproches);

  @override
  DernierTirageDto disparues(num disparues) => this(disparues: disparues);

  @override
  DernierTirageDto erreur(String? erreur) => this(erreur: erreur);

  @override
  /// This function **does support** nullification of nullable fields. All `null` values passed to `non-nullable` fields will be ignored. You can also use `DernierTirageDto(...).copyWith.fieldName(...)` to override fields one at a time with nullification support.
  ///
  /// Usage
  /// ```dart
  /// DernierTirageDto(...).copyWith(id: 12, name: "My name")
  /// ````
  DernierTirageDto call({
    Object? termineLe = const $CopyWithPlaceholder(),
    Object? dureeMs = const $CopyWithPlaceholder(),
    Object? lus = const $CopyWithPlaceholder(),
    Object? crees = const $CopyWithPlaceholder(),
    Object? misAJour = const $CopyWithPlaceholder(),
    Object? rapproches = const $CopyWithPlaceholder(),
    Object? disparues = const $CopyWithPlaceholder(),
    Object? erreur = const $CopyWithPlaceholder(),
  }) {
    return DernierTirageDto(
      termineLe: termineLe == const $CopyWithPlaceholder()
          ? _value.termineLe
          // ignore: cast_nullable_to_non_nullable
          : termineLe as DateTime,
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

extension $DernierTirageDtoCopyWith on DernierTirageDto {
  /// Returns a callable class that can be used as follows: `instanceOfDernierTirageDto.copyWith(...)` or like so:`instanceOfDernierTirageDto.copyWith.fieldName(...)`.
  // ignore: library_private_types_in_public_api
  _$DernierTirageDtoCWProxy get copyWith => _$DernierTirageDtoCWProxyImpl(this);
}

// **************************************************************************
// JsonSerializableGenerator
// **************************************************************************

DernierTirageDto _$DernierTirageDtoFromJson(Map<String, dynamic> json) =>
    $checkedCreate('DernierTirageDto', json, ($checkedConvert) {
      $checkKeys(
        json,
        requiredKeys: const [
          'termineLe',
          'dureeMs',
          'lus',
          'crees',
          'misAJour',
          'rapproches',
          'disparues',
          'erreur',
        ],
      );
      final val = DernierTirageDto(
        termineLe: $checkedConvert(
          'termineLe',
          (v) => DateTime.parse(v as String),
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

Map<String, dynamic> _$DernierTirageDtoToJson(DernierTirageDto instance) =>
    <String, dynamic>{
      'termineLe': instance.termineLe.toIso8601String(),
      'dureeMs': instance.dureeMs,
      'lus': instance.lus,
      'crees': instance.crees,
      'misAJour': instance.misAJour,
      'rapproches': instance.rapproches,
      'disparues': instance.disparues,
      'erreur': instance.erreur,
    };

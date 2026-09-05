// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'enrolement_indicateurs_dto.dart';

// **************************************************************************
// CopyWithGenerator
// **************************************************************************

abstract class _$EnrolementIndicateursDtoCWProxy {
  EnrolementIndicateursDto projet(Projet projet);

  EnrolementIndicateursDto inscriptions(num inscriptions);

  EnrolementIndicateursDto rapprochees(num rapprochees);

  EnrolementIndicateursDto tauxConversion(num? tauxConversion);

  EnrolementIndicateursDto tauxRapprochement(num? tauxRapprochement);

  EnrolementIndicateursDto parJour(List<SerieJourDto> parJour);

  EnrolementIndicateursDto parEtape(List<RepartitionDto> parEtape);

  EnrolementIndicateursDto delais(List<DelaiMedianDto> delais);

  EnrolementIndicateursDto parTeleconseiller(
    List<RepartitionDto> parTeleconseiller,
  );

  EnrolementIndicateursDto parCampagne(List<RepartitionDto> parCampagne);

  EnrolementIndicateursDto parMethode(List<RepartitionDto> parMethode);

  /// This function **does support** nullification of nullable fields. All `null` values passed to `non-nullable` fields will be ignored. You can also use `EnrolementIndicateursDto(...).copyWith.fieldName(...)` to override fields one at a time with nullification support.
  ///
  /// Usage
  /// ```dart
  /// EnrolementIndicateursDto(...).copyWith(id: 12, name: "My name")
  /// ````
  EnrolementIndicateursDto call({
    Projet projet,
    num inscriptions,
    num rapprochees,
    num? tauxConversion,
    num? tauxRapprochement,
    List<SerieJourDto> parJour,
    List<RepartitionDto> parEtape,
    List<DelaiMedianDto> delais,
    List<RepartitionDto> parTeleconseiller,
    List<RepartitionDto> parCampagne,
    List<RepartitionDto> parMethode,
  });
}

/// Proxy class for `copyWith` functionality. This is a callable class and can be used as follows: `instanceOfEnrolementIndicateursDto.copyWith(...)`. Additionally contains functions for specific fields e.g. `instanceOfEnrolementIndicateursDto.copyWith.fieldName(...)`
class _$EnrolementIndicateursDtoCWProxyImpl
    implements _$EnrolementIndicateursDtoCWProxy {
  const _$EnrolementIndicateursDtoCWProxyImpl(this._value);

  final EnrolementIndicateursDto _value;

  @override
  EnrolementIndicateursDto projet(Projet projet) => this(projet: projet);

  @override
  EnrolementIndicateursDto inscriptions(num inscriptions) =>
      this(inscriptions: inscriptions);

  @override
  EnrolementIndicateursDto rapprochees(num rapprochees) =>
      this(rapprochees: rapprochees);

  @override
  EnrolementIndicateursDto tauxConversion(num? tauxConversion) =>
      this(tauxConversion: tauxConversion);

  @override
  EnrolementIndicateursDto tauxRapprochement(num? tauxRapprochement) =>
      this(tauxRapprochement: tauxRapprochement);

  @override
  EnrolementIndicateursDto parJour(List<SerieJourDto> parJour) =>
      this(parJour: parJour);

  @override
  EnrolementIndicateursDto parEtape(List<RepartitionDto> parEtape) =>
      this(parEtape: parEtape);

  @override
  EnrolementIndicateursDto delais(List<DelaiMedianDto> delais) =>
      this(delais: delais);

  @override
  EnrolementIndicateursDto parTeleconseiller(
    List<RepartitionDto> parTeleconseiller,
  ) => this(parTeleconseiller: parTeleconseiller);

  @override
  EnrolementIndicateursDto parCampagne(List<RepartitionDto> parCampagne) =>
      this(parCampagne: parCampagne);

  @override
  EnrolementIndicateursDto parMethode(List<RepartitionDto> parMethode) =>
      this(parMethode: parMethode);

  @override
  /// This function **does support** nullification of nullable fields. All `null` values passed to `non-nullable` fields will be ignored. You can also use `EnrolementIndicateursDto(...).copyWith.fieldName(...)` to override fields one at a time with nullification support.
  ///
  /// Usage
  /// ```dart
  /// EnrolementIndicateursDto(...).copyWith(id: 12, name: "My name")
  /// ````
  EnrolementIndicateursDto call({
    Object? projet = const $CopyWithPlaceholder(),
    Object? inscriptions = const $CopyWithPlaceholder(),
    Object? rapprochees = const $CopyWithPlaceholder(),
    Object? tauxConversion = const $CopyWithPlaceholder(),
    Object? tauxRapprochement = const $CopyWithPlaceholder(),
    Object? parJour = const $CopyWithPlaceholder(),
    Object? parEtape = const $CopyWithPlaceholder(),
    Object? delais = const $CopyWithPlaceholder(),
    Object? parTeleconseiller = const $CopyWithPlaceholder(),
    Object? parCampagne = const $CopyWithPlaceholder(),
    Object? parMethode = const $CopyWithPlaceholder(),
  }) {
    return EnrolementIndicateursDto(
      projet: projet == const $CopyWithPlaceholder()
          ? _value.projet
          // ignore: cast_nullable_to_non_nullable
          : projet as Projet,
      inscriptions: inscriptions == const $CopyWithPlaceholder()
          ? _value.inscriptions
          // ignore: cast_nullable_to_non_nullable
          : inscriptions as num,
      rapprochees: rapprochees == const $CopyWithPlaceholder()
          ? _value.rapprochees
          // ignore: cast_nullable_to_non_nullable
          : rapprochees as num,
      tauxConversion: tauxConversion == const $CopyWithPlaceholder()
          ? _value.tauxConversion
          // ignore: cast_nullable_to_non_nullable
          : tauxConversion as num?,
      tauxRapprochement: tauxRapprochement == const $CopyWithPlaceholder()
          ? _value.tauxRapprochement
          // ignore: cast_nullable_to_non_nullable
          : tauxRapprochement as num?,
      parJour: parJour == const $CopyWithPlaceholder()
          ? _value.parJour
          // ignore: cast_nullable_to_non_nullable
          : parJour as List<SerieJourDto>,
      parEtape: parEtape == const $CopyWithPlaceholder()
          ? _value.parEtape
          // ignore: cast_nullable_to_non_nullable
          : parEtape as List<RepartitionDto>,
      delais: delais == const $CopyWithPlaceholder()
          ? _value.delais
          // ignore: cast_nullable_to_non_nullable
          : delais as List<DelaiMedianDto>,
      parTeleconseiller: parTeleconseiller == const $CopyWithPlaceholder()
          ? _value.parTeleconseiller
          // ignore: cast_nullable_to_non_nullable
          : parTeleconseiller as List<RepartitionDto>,
      parCampagne: parCampagne == const $CopyWithPlaceholder()
          ? _value.parCampagne
          // ignore: cast_nullable_to_non_nullable
          : parCampagne as List<RepartitionDto>,
      parMethode: parMethode == const $CopyWithPlaceholder()
          ? _value.parMethode
          // ignore: cast_nullable_to_non_nullable
          : parMethode as List<RepartitionDto>,
    );
  }
}

extension $EnrolementIndicateursDtoCopyWith on EnrolementIndicateursDto {
  /// Returns a callable class that can be used as follows: `instanceOfEnrolementIndicateursDto.copyWith(...)` or like so:`instanceOfEnrolementIndicateursDto.copyWith.fieldName(...)`.
  // ignore: library_private_types_in_public_api
  _$EnrolementIndicateursDtoCWProxy get copyWith =>
      _$EnrolementIndicateursDtoCWProxyImpl(this);
}

// **************************************************************************
// JsonSerializableGenerator
// **************************************************************************

EnrolementIndicateursDto _$EnrolementIndicateursDtoFromJson(
  Map<String, dynamic> json,
) => $checkedCreate('EnrolementIndicateursDto', json, ($checkedConvert) {
  $checkKeys(
    json,
    requiredKeys: const [
      'projet',
      'inscriptions',
      'rapprochees',
      'tauxConversion',
      'tauxRapprochement',
      'parJour',
      'parEtape',
      'delais',
      'parTeleconseiller',
      'parCampagne',
      'parMethode',
    ],
  );
  final val = EnrolementIndicateursDto(
    projet: $checkedConvert(
      'projet',
      (v) => $enumDecode(
        _$ProjetEnumMap,
        v,
        unknownValue: Projet.unknownDefaultOpenApi,
      ),
    ),
    inscriptions: $checkedConvert('inscriptions', (v) => v as num),
    rapprochees: $checkedConvert('rapprochees', (v) => v as num),
    tauxConversion: $checkedConvert('tauxConversion', (v) => v as num?),
    tauxRapprochement: $checkedConvert('tauxRapprochement', (v) => v as num?),
    parJour: $checkedConvert(
      'parJour',
      (v) => (v as List<dynamic>)
          .map((e) => SerieJourDto.fromJson(e as Map<String, dynamic>))
          .toList(),
    ),
    parEtape: $checkedConvert(
      'parEtape',
      (v) => (v as List<dynamic>)
          .map((e) => RepartitionDto.fromJson(e as Map<String, dynamic>))
          .toList(),
    ),
    delais: $checkedConvert(
      'delais',
      (v) => (v as List<dynamic>)
          .map((e) => DelaiMedianDto.fromJson(e as Map<String, dynamic>))
          .toList(),
    ),
    parTeleconseiller: $checkedConvert(
      'parTeleconseiller',
      (v) => (v as List<dynamic>)
          .map((e) => RepartitionDto.fromJson(e as Map<String, dynamic>))
          .toList(),
    ),
    parCampagne: $checkedConvert(
      'parCampagne',
      (v) => (v as List<dynamic>)
          .map((e) => RepartitionDto.fromJson(e as Map<String, dynamic>))
          .toList(),
    ),
    parMethode: $checkedConvert(
      'parMethode',
      (v) => (v as List<dynamic>)
          .map((e) => RepartitionDto.fromJson(e as Map<String, dynamic>))
          .toList(),
    ),
  );
  return val;
});

Map<String, dynamic> _$EnrolementIndicateursDtoToJson(
  EnrolementIndicateursDto instance,
) => <String, dynamic>{
  'projet': _$ProjetEnumMap[instance.projet]!,
  'inscriptions': instance.inscriptions,
  'rapprochees': instance.rapprochees,
  'tauxConversion': instance.tauxConversion,
  'tauxRapprochement': instance.tauxRapprochement,
  'parJour': instance.parJour.map((e) => e.toJson()).toList(),
  'parEtape': instance.parEtape.map((e) => e.toJson()).toList(),
  'delais': instance.delais.map((e) => e.toJson()).toList(),
  'parTeleconseiller': instance.parTeleconseiller
      .map((e) => e.toJson())
      .toList(),
  'parCampagne': instance.parCampagne.map((e) => e.toJson()).toList(),
  'parMethode': instance.parMethode.map((e) => e.toJson()).toList(),
};

const _$ProjetEnumMap = {
  Projet.CHUES: 'CHUES',
  Projet.GRAND_PUBLIC: 'GRAND_PUBLIC',
  Projet.unknownDefaultOpenApi: 'unknown_default_open_api',
};

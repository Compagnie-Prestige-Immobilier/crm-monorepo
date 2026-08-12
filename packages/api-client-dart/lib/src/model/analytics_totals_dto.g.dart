// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'analytics_totals_dto.dart';

// **************************************************************************
// CopyWithGenerator
// **************************************************************************

abstract class _$AnalyticsTotalsDtoCWProxy {
  AnalyticsTotalsDto prospects(num prospects);

  AnalyticsTotalsDto representants(num representants);

  AnalyticsTotalsDto commerciauxActifs(num commerciauxActifs);

  AnalyticsTotalsDto departementsCouverts(num departementsCouverts);

  AnalyticsTotalsDto nouveau(num nouveau);

  AnalyticsTotalsDto contacte(num contacte);

  AnalyticsTotalsDto converti(num converti);

  AnalyticsTotalsDto perdu(num perdu);

  AnalyticsTotalsDto prospects7Jours(num prospects7Jours);

  AnalyticsTotalsDto prospects30Jours(num prospects30Jours);

  /// This function **does support** nullification of nullable fields. All `null` values passed to `non-nullable` fields will be ignored. You can also use `AnalyticsTotalsDto(...).copyWith.fieldName(...)` to override fields one at a time with nullification support.
  ///
  /// Usage
  /// ```dart
  /// AnalyticsTotalsDto(...).copyWith(id: 12, name: "My name")
  /// ````
  AnalyticsTotalsDto call({
    num prospects,
    num representants,
    num commerciauxActifs,
    num departementsCouverts,
    num nouveau,
    num contacte,
    num converti,
    num perdu,
    num prospects7Jours,
    num prospects30Jours,
  });
}

/// Proxy class for `copyWith` functionality. This is a callable class and can be used as follows: `instanceOfAnalyticsTotalsDto.copyWith(...)`. Additionally contains functions for specific fields e.g. `instanceOfAnalyticsTotalsDto.copyWith.fieldName(...)`
class _$AnalyticsTotalsDtoCWProxyImpl implements _$AnalyticsTotalsDtoCWProxy {
  const _$AnalyticsTotalsDtoCWProxyImpl(this._value);

  final AnalyticsTotalsDto _value;

  @override
  AnalyticsTotalsDto prospects(num prospects) => this(prospects: prospects);

  @override
  AnalyticsTotalsDto representants(num representants) =>
      this(representants: representants);

  @override
  AnalyticsTotalsDto commerciauxActifs(num commerciauxActifs) =>
      this(commerciauxActifs: commerciauxActifs);

  @override
  AnalyticsTotalsDto departementsCouverts(num departementsCouverts) =>
      this(departementsCouverts: departementsCouverts);

  @override
  AnalyticsTotalsDto nouveau(num nouveau) => this(nouveau: nouveau);

  @override
  AnalyticsTotalsDto contacte(num contacte) => this(contacte: contacte);

  @override
  AnalyticsTotalsDto converti(num converti) => this(converti: converti);

  @override
  AnalyticsTotalsDto perdu(num perdu) => this(perdu: perdu);

  @override
  AnalyticsTotalsDto prospects7Jours(num prospects7Jours) =>
      this(prospects7Jours: prospects7Jours);

  @override
  AnalyticsTotalsDto prospects30Jours(num prospects30Jours) =>
      this(prospects30Jours: prospects30Jours);

  @override
  /// This function **does support** nullification of nullable fields. All `null` values passed to `non-nullable` fields will be ignored. You can also use `AnalyticsTotalsDto(...).copyWith.fieldName(...)` to override fields one at a time with nullification support.
  ///
  /// Usage
  /// ```dart
  /// AnalyticsTotalsDto(...).copyWith(id: 12, name: "My name")
  /// ````
  AnalyticsTotalsDto call({
    Object? prospects = const $CopyWithPlaceholder(),
    Object? representants = const $CopyWithPlaceholder(),
    Object? commerciauxActifs = const $CopyWithPlaceholder(),
    Object? departementsCouverts = const $CopyWithPlaceholder(),
    Object? nouveau = const $CopyWithPlaceholder(),
    Object? contacte = const $CopyWithPlaceholder(),
    Object? converti = const $CopyWithPlaceholder(),
    Object? perdu = const $CopyWithPlaceholder(),
    Object? prospects7Jours = const $CopyWithPlaceholder(),
    Object? prospects30Jours = const $CopyWithPlaceholder(),
  }) {
    return AnalyticsTotalsDto(
      prospects: prospects == const $CopyWithPlaceholder()
          ? _value.prospects
          // ignore: cast_nullable_to_non_nullable
          : prospects as num,
      representants: representants == const $CopyWithPlaceholder()
          ? _value.representants
          // ignore: cast_nullable_to_non_nullable
          : representants as num,
      commerciauxActifs: commerciauxActifs == const $CopyWithPlaceholder()
          ? _value.commerciauxActifs
          // ignore: cast_nullable_to_non_nullable
          : commerciauxActifs as num,
      departementsCouverts: departementsCouverts == const $CopyWithPlaceholder()
          ? _value.departementsCouverts
          // ignore: cast_nullable_to_non_nullable
          : departementsCouverts as num,
      nouveau: nouveau == const $CopyWithPlaceholder()
          ? _value.nouveau
          // ignore: cast_nullable_to_non_nullable
          : nouveau as num,
      contacte: contacte == const $CopyWithPlaceholder()
          ? _value.contacte
          // ignore: cast_nullable_to_non_nullable
          : contacte as num,
      converti: converti == const $CopyWithPlaceholder()
          ? _value.converti
          // ignore: cast_nullable_to_non_nullable
          : converti as num,
      perdu: perdu == const $CopyWithPlaceholder()
          ? _value.perdu
          // ignore: cast_nullable_to_non_nullable
          : perdu as num,
      prospects7Jours: prospects7Jours == const $CopyWithPlaceholder()
          ? _value.prospects7Jours
          // ignore: cast_nullable_to_non_nullable
          : prospects7Jours as num,
      prospects30Jours: prospects30Jours == const $CopyWithPlaceholder()
          ? _value.prospects30Jours
          // ignore: cast_nullable_to_non_nullable
          : prospects30Jours as num,
    );
  }
}

extension $AnalyticsTotalsDtoCopyWith on AnalyticsTotalsDto {
  /// Returns a callable class that can be used as follows: `instanceOfAnalyticsTotalsDto.copyWith(...)` or like so:`instanceOfAnalyticsTotalsDto.copyWith.fieldName(...)`.
  // ignore: library_private_types_in_public_api
  _$AnalyticsTotalsDtoCWProxy get copyWith =>
      _$AnalyticsTotalsDtoCWProxyImpl(this);
}

// **************************************************************************
// JsonSerializableGenerator
// **************************************************************************

AnalyticsTotalsDto _$AnalyticsTotalsDtoFromJson(Map<String, dynamic> json) =>
    $checkedCreate('AnalyticsTotalsDto', json, ($checkedConvert) {
      $checkKeys(
        json,
        requiredKeys: const [
          'prospects',
          'representants',
          'commerciauxActifs',
          'departementsCouverts',
          'nouveau',
          'contacte',
          'converti',
          'perdu',
          'prospects7Jours',
          'prospects30Jours',
        ],
      );
      final val = AnalyticsTotalsDto(
        prospects: $checkedConvert('prospects', (v) => v as num),
        representants: $checkedConvert('representants', (v) => v as num),
        commerciauxActifs: $checkedConvert(
          'commerciauxActifs',
          (v) => v as num,
        ),
        departementsCouverts: $checkedConvert(
          'departementsCouverts',
          (v) => v as num,
        ),
        nouveau: $checkedConvert('nouveau', (v) => v as num),
        contacte: $checkedConvert('contacte', (v) => v as num),
        converti: $checkedConvert('converti', (v) => v as num),
        perdu: $checkedConvert('perdu', (v) => v as num),
        prospects7Jours: $checkedConvert('prospects7Jours', (v) => v as num),
        prospects30Jours: $checkedConvert('prospects30Jours', (v) => v as num),
      );
      return val;
    });

Map<String, dynamic> _$AnalyticsTotalsDtoToJson(AnalyticsTotalsDto instance) =>
    <String, dynamic>{
      'prospects': instance.prospects,
      'representants': instance.representants,
      'commerciauxActifs': instance.commerciauxActifs,
      'departementsCouverts': instance.departementsCouverts,
      'nouveau': instance.nouveau,
      'contacte': instance.contacte,
      'converti': instance.converti,
      'perdu': instance.perdu,
      'prospects7Jours': instance.prospects7Jours,
      'prospects30Jours': instance.prospects30Jours,
    };

// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'prospect_journey_dto.dart';

// **************************************************************************
// CopyWithGenerator
// **************************************************************************

abstract class _$ProspectJourneyDtoCWProxy {
  ProspectJourneyDto id(String id);

  ProspectJourneyDto projet(Projet projet);

  ProspectJourneyDto statut(ProspectStatut statut);

  ProspectJourneyDto consent(GrandPublicConsent consent);

  ProspectJourneyDto consentAt(DateTime? consentAt);

  ProspectJourneyDto convertedAt(DateTime? convertedAt);

  /// This function **does support** nullification of nullable fields. All `null` values passed to `non-nullable` fields will be ignored. You can also use `ProspectJourneyDto(...).copyWith.fieldName(...)` to override fields one at a time with nullification support.
  ///
  /// Usage
  /// ```dart
  /// ProspectJourneyDto(...).copyWith(id: 12, name: "My name")
  /// ````
  ProspectJourneyDto call({
    String id,
    Projet projet,
    ProspectStatut statut,
    GrandPublicConsent consent,
    DateTime? consentAt,
    DateTime? convertedAt,
  });
}

/// Proxy class for `copyWith` functionality. This is a callable class and can be used as follows: `instanceOfProspectJourneyDto.copyWith(...)`. Additionally contains functions for specific fields e.g. `instanceOfProspectJourneyDto.copyWith.fieldName(...)`
class _$ProspectJourneyDtoCWProxyImpl implements _$ProspectJourneyDtoCWProxy {
  const _$ProspectJourneyDtoCWProxyImpl(this._value);

  final ProspectJourneyDto _value;

  @override
  ProspectJourneyDto id(String id) => this(id: id);

  @override
  ProspectJourneyDto projet(Projet projet) => this(projet: projet);

  @override
  ProspectJourneyDto statut(ProspectStatut statut) => this(statut: statut);

  @override
  ProspectJourneyDto consent(GrandPublicConsent consent) =>
      this(consent: consent);

  @override
  ProspectJourneyDto consentAt(DateTime? consentAt) =>
      this(consentAt: consentAt);

  @override
  ProspectJourneyDto convertedAt(DateTime? convertedAt) =>
      this(convertedAt: convertedAt);

  @override
  /// This function **does support** nullification of nullable fields. All `null` values passed to `non-nullable` fields will be ignored. You can also use `ProspectJourneyDto(...).copyWith.fieldName(...)` to override fields one at a time with nullification support.
  ///
  /// Usage
  /// ```dart
  /// ProspectJourneyDto(...).copyWith(id: 12, name: "My name")
  /// ````
  ProspectJourneyDto call({
    Object? id = const $CopyWithPlaceholder(),
    Object? projet = const $CopyWithPlaceholder(),
    Object? statut = const $CopyWithPlaceholder(),
    Object? consent = const $CopyWithPlaceholder(),
    Object? consentAt = const $CopyWithPlaceholder(),
    Object? convertedAt = const $CopyWithPlaceholder(),
  }) {
    return ProspectJourneyDto(
      id: id == const $CopyWithPlaceholder()
          ? _value.id
          // ignore: cast_nullable_to_non_nullable
          : id as String,
      projet: projet == const $CopyWithPlaceholder()
          ? _value.projet
          // ignore: cast_nullable_to_non_nullable
          : projet as Projet,
      statut: statut == const $CopyWithPlaceholder()
          ? _value.statut
          // ignore: cast_nullable_to_non_nullable
          : statut as ProspectStatut,
      consent: consent == const $CopyWithPlaceholder()
          ? _value.consent
          // ignore: cast_nullable_to_non_nullable
          : consent as GrandPublicConsent,
      consentAt: consentAt == const $CopyWithPlaceholder()
          ? _value.consentAt
          // ignore: cast_nullable_to_non_nullable
          : consentAt as DateTime?,
      convertedAt: convertedAt == const $CopyWithPlaceholder()
          ? _value.convertedAt
          // ignore: cast_nullable_to_non_nullable
          : convertedAt as DateTime?,
    );
  }
}

extension $ProspectJourneyDtoCopyWith on ProspectJourneyDto {
  /// Returns a callable class that can be used as follows: `instanceOfProspectJourneyDto.copyWith(...)` or like so:`instanceOfProspectJourneyDto.copyWith.fieldName(...)`.
  // ignore: library_private_types_in_public_api
  _$ProspectJourneyDtoCWProxy get copyWith =>
      _$ProspectJourneyDtoCWProxyImpl(this);
}

// **************************************************************************
// JsonSerializableGenerator
// **************************************************************************

ProspectJourneyDto _$ProspectJourneyDtoFromJson(Map<String, dynamic> json) =>
    $checkedCreate('ProspectJourneyDto', json, ($checkedConvert) {
      $checkKeys(
        json,
        requiredKeys: const [
          'id',
          'projet',
          'statut',
          'consent',
          'consentAt',
          'convertedAt',
        ],
      );
      final val = ProspectJourneyDto(
        id: $checkedConvert('id', (v) => v as String),
        projet: $checkedConvert(
          'projet',
          (v) => $enumDecode(
            _$ProjetEnumMap,
            v,
            unknownValue: Projet.unknownDefaultOpenApi,
          ),
        ),
        statut: $checkedConvert(
          'statut',
          (v) => $enumDecode(
            _$ProspectStatutEnumMap,
            v,
            unknownValue: ProspectStatut.unknownDefaultOpenApi,
          ),
        ),
        consent: $checkedConvert(
          'consent',
          (v) => $enumDecode(
            _$GrandPublicConsentEnumMap,
            v,
            unknownValue: GrandPublicConsent.unknownDefaultOpenApi,
          ),
        ),
        consentAt: $checkedConvert(
          'consentAt',
          (v) => v == null ? null : DateTime.parse(v as String),
        ),
        convertedAt: $checkedConvert(
          'convertedAt',
          (v) => v == null ? null : DateTime.parse(v as String),
        ),
      );
      return val;
    });

Map<String, dynamic> _$ProspectJourneyDtoToJson(ProspectJourneyDto instance) =>
    <String, dynamic>{
      'id': instance.id,
      'projet': _$ProjetEnumMap[instance.projet]!,
      'statut': _$ProspectStatutEnumMap[instance.statut]!,
      'consent': _$GrandPublicConsentEnumMap[instance.consent]!,
      'consentAt': instance.consentAt?.toIso8601String(),
      'convertedAt': instance.convertedAt?.toIso8601String(),
    };

const _$ProjetEnumMap = {
  Projet.CHUES: 'CHUES',
  Projet.GRAND_PUBLIC: 'GRAND_PUBLIC',
  Projet.unknownDefaultOpenApi: 'unknown_default_open_api',
};

const _$ProspectStatutEnumMap = {
  ProspectStatut.NOUVEAU: 'NOUVEAU',
  ProspectStatut.CONTACTE: 'CONTACTE',
  ProspectStatut.CONVERTI: 'CONVERTI',
  ProspectStatut.PERDU: 'PERDU',
  ProspectStatut.unknownDefaultOpenApi: 'unknown_default_open_api',
};

const _$GrandPublicConsentEnumMap = {
  GrandPublicConsent.NON_DEMANDE: 'NON_DEMANDE',
  GrandPublicConsent.INTERESSE: 'INTERESSE',
  GrandPublicConsent.REFUSE: 'REFUSE',
  GrandPublicConsent.unknownDefaultOpenApi: 'unknown_default_open_api',
};

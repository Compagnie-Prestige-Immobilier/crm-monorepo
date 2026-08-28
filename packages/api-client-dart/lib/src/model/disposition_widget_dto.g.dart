// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'disposition_widget_dto.dart';

// **************************************************************************
// CopyWithGenerator
// **************************************************************************

abstract class _$DispositionWidgetDtoCWProxy {
  DispositionWidgetDto source_(DashboardSource source_);

  DispositionWidgetDto marque(DashboardMarque? marque);

  DispositionWidgetDto taille(DashboardTaille? taille);

  DispositionWidgetDto presentation(DispositionPresentationDto? presentation);

  /// This function **does support** nullification of nullable fields. All `null` values passed to `non-nullable` fields will be ignored. You can also use `DispositionWidgetDto(...).copyWith.fieldName(...)` to override fields one at a time with nullification support.
  ///
  /// Usage
  /// ```dart
  /// DispositionWidgetDto(...).copyWith(id: 12, name: "My name")
  /// ````
  DispositionWidgetDto call({
    DashboardSource source_,
    DashboardMarque? marque,
    DashboardTaille? taille,
    DispositionPresentationDto? presentation,
  });
}

/// Proxy class for `copyWith` functionality. This is a callable class and can be used as follows: `instanceOfDispositionWidgetDto.copyWith(...)`. Additionally contains functions for specific fields e.g. `instanceOfDispositionWidgetDto.copyWith.fieldName(...)`
class _$DispositionWidgetDtoCWProxyImpl
    implements _$DispositionWidgetDtoCWProxy {
  const _$DispositionWidgetDtoCWProxyImpl(this._value);

  final DispositionWidgetDto _value;

  @override
  DispositionWidgetDto source_(DashboardSource source_) =>
      this(source_: source_);

  @override
  DispositionWidgetDto marque(DashboardMarque? marque) => this(marque: marque);

  @override
  DispositionWidgetDto taille(DashboardTaille? taille) => this(taille: taille);

  @override
  DispositionWidgetDto presentation(DispositionPresentationDto? presentation) =>
      this(presentation: presentation);

  @override
  /// This function **does support** nullification of nullable fields. All `null` values passed to `non-nullable` fields will be ignored. You can also use `DispositionWidgetDto(...).copyWith.fieldName(...)` to override fields one at a time with nullification support.
  ///
  /// Usage
  /// ```dart
  /// DispositionWidgetDto(...).copyWith(id: 12, name: "My name")
  /// ````
  DispositionWidgetDto call({
    Object? source_ = const $CopyWithPlaceholder(),
    Object? marque = const $CopyWithPlaceholder(),
    Object? taille = const $CopyWithPlaceholder(),
    Object? presentation = const $CopyWithPlaceholder(),
  }) {
    return DispositionWidgetDto(
      source_: source_ == const $CopyWithPlaceholder()
          ? _value.source_
          // ignore: cast_nullable_to_non_nullable
          : source_ as DashboardSource,
      marque: marque == const $CopyWithPlaceholder()
          ? _value.marque
          // ignore: cast_nullable_to_non_nullable
          : marque as DashboardMarque?,
      taille: taille == const $CopyWithPlaceholder()
          ? _value.taille
          // ignore: cast_nullable_to_non_nullable
          : taille as DashboardTaille?,
      presentation: presentation == const $CopyWithPlaceholder()
          ? _value.presentation
          // ignore: cast_nullable_to_non_nullable
          : presentation as DispositionPresentationDto?,
    );
  }
}

extension $DispositionWidgetDtoCopyWith on DispositionWidgetDto {
  /// Returns a callable class that can be used as follows: `instanceOfDispositionWidgetDto.copyWith(...)` or like so:`instanceOfDispositionWidgetDto.copyWith.fieldName(...)`.
  // ignore: library_private_types_in_public_api
  _$DispositionWidgetDtoCWProxy get copyWith =>
      _$DispositionWidgetDtoCWProxyImpl(this);
}

// **************************************************************************
// JsonSerializableGenerator
// **************************************************************************

DispositionWidgetDto _$DispositionWidgetDtoFromJson(
  Map<String, dynamic> json,
) => $checkedCreate('DispositionWidgetDto', json, ($checkedConvert) {
  $checkKeys(json, requiredKeys: const ['source']);
  final val = DispositionWidgetDto(
    source_: $checkedConvert(
      'source',
      (v) => $enumDecode(
        _$DashboardSourceEnumMap,
        v,
        unknownValue: DashboardSource.unknownDefaultOpenApi,
      ),
    ),
    marque: $checkedConvert(
      'marque',
      (v) => $enumDecodeNullable(
        _$DashboardMarqueEnumMap,
        v,
        unknownValue: DashboardMarque.unknownDefaultOpenApi,
      ),
    ),
    taille: $checkedConvert(
      'taille',
      (v) => $enumDecodeNullable(
        _$DashboardTailleEnumMap,
        v,
        unknownValue: DashboardTaille.unknownDefaultOpenApi,
      ),
    ),
    presentation: $checkedConvert(
      'presentation',
      (v) => v == null
          ? null
          : DispositionPresentationDto.fromJson(v as Map<String, dynamic>),
    ),
  );
  return val;
}, fieldKeyMap: const {'source_': 'source'});

Map<String, dynamic> _$DispositionWidgetDtoToJson(
  DispositionWidgetDto instance,
) => <String, dynamic>{
  'source': _$DashboardSourceEnumMap[instance.source_]!,
  if (_$DashboardMarqueEnumMap[instance.marque] case final value?)
    'marque': value,
  if (_$DashboardTailleEnumMap[instance.taille] case final value?)
    'taille': value,
  if (instance.presentation?.toJson() case final value?) 'presentation': value,
};

const _$DashboardSourceEnumMap = {
  DashboardSource.totalVisites: 'total-visites',
  DashboardSource.moyenneJournaliere: 'moyenne-journaliere',
  DashboardSource.jourLePlusCharge: 'jour-le-plus-charge',
  DashboardSource.parEntreprise: 'par-entreprise',
  DashboardSource.parObjet: 'par-objet',
  DashboardSource.parDirection: 'par-direction',
  DashboardSource.parDestinataire: 'par-destinataire',
  DashboardSource.parJour: 'par-jour',
  DashboardSource.parMois: 'par-mois',
  DashboardSource.parHeure: 'par-heure',
  DashboardSource.parJourSemaine: 'par-jour-semaine',
  DashboardSource.parHeureJourSemaine: 'par-heure-jour-semaine',
  DashboardSource.parAgent: 'par-agent',
  DashboardSource.parEntrepriseObjet: 'par-entreprise-objet',
  DashboardSource.parDestinataireDirection: 'par-destinataire-direction',
  DashboardSource.parObjetMois: 'par-objet-mois',
  DashboardSource.visiteursRecurrents: 'visiteurs-recurrents',
  DashboardSource.avecTelephone: 'avec-telephone',
  DashboardSource.qualiteDeSaisie: 'qualite-de-saisie',
  DashboardSource.unknownDefaultOpenApi: 'unknown_default_open_api',
};

const _$DashboardMarqueEnumMap = {
  DashboardMarque.barresVerticales: 'barres-verticales',
  DashboardMarque.barresHorizontales: 'barres-horizontales',
  DashboardMarque.barresEmpilees: 'barres-empilees',
  DashboardMarque.barres100: 'barres-100',
  DashboardMarque.barresGroupees: 'barres-groupees',
  DashboardMarque.courbe: 'courbe',
  DashboardMarque.aire: 'aire',
  DashboardMarque.escalier: 'escalier',
  DashboardMarque.anneau: 'anneau',
  DashboardMarque.camembert: 'camembert',
  DashboardMarque.airePolaire: 'aire-polaire',
  DashboardMarque.radar: 'radar',
  DashboardMarque.nuage: 'nuage',
  DashboardMarque.bulles: 'bulles',
  DashboardMarque.mixte: 'mixte',
  DashboardMarque.jauge: 'jauge',
  DashboardMarque.carteDeChaleur: 'carte-de-chaleur',
  DashboardMarque.tableau: 'tableau',
  DashboardMarque.tuile: 'tuile',
  DashboardMarque.tuileCourbe: 'tuile-courbe',
  DashboardMarque.unknownDefaultOpenApi: 'unknown_default_open_api',
};

const _$DashboardTailleEnumMap = {
  DashboardTaille.demi: 'demi',
  DashboardTaille.pleine: 'pleine',
  DashboardTaille.unknownDefaultOpenApi: 'unknown_default_open_api',
};

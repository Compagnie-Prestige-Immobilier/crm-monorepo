// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'visite_stats_dto.dart';

// **************************************************************************
// CopyWithGenerator
// **************************************************************************

abstract class _$VisiteStatsDtoCWProxy {
  VisiteStatsDto from(String from);

  VisiteStatsDto to(String to);

  VisiteStatsDto total(num total);

  VisiteStatsDto parEntreprise(List<VisiteStatBucketDto> parEntreprise);

  VisiteStatsDto parDirection(List<VisiteStatBucketDto> parDirection);

  VisiteStatsDto parDestinataire(List<VisiteStatBucketDto> parDestinataire);

  VisiteStatsDto parObjet(List<VisiteStatBucketDto> parObjet);

  VisiteStatsDto parMois(List<VisiteStatMoisDto> parMois);

  VisiteStatsDto parJour(List<VisiteStatJourDto> parJour);

  VisiteStatsDto sansDirection(num sansDirection);

  VisiteStatsDto sansDestinataire(num sansDestinataire);

  /// This function **does support** nullification of nullable fields. All `null` values passed to `non-nullable` fields will be ignored. You can also use `VisiteStatsDto(...).copyWith.fieldName(...)` to override fields one at a time with nullification support.
  ///
  /// Usage
  /// ```dart
  /// VisiteStatsDto(...).copyWith(id: 12, name: "My name")
  /// ````
  VisiteStatsDto call({
    String from,
    String to,
    num total,
    List<VisiteStatBucketDto> parEntreprise,
    List<VisiteStatBucketDto> parDirection,
    List<VisiteStatBucketDto> parDestinataire,
    List<VisiteStatBucketDto> parObjet,
    List<VisiteStatMoisDto> parMois,
    List<VisiteStatJourDto> parJour,
    num sansDirection,
    num sansDestinataire,
  });
}

/// Proxy class for `copyWith` functionality. This is a callable class and can be used as follows: `instanceOfVisiteStatsDto.copyWith(...)`. Additionally contains functions for specific fields e.g. `instanceOfVisiteStatsDto.copyWith.fieldName(...)`
class _$VisiteStatsDtoCWProxyImpl implements _$VisiteStatsDtoCWProxy {
  const _$VisiteStatsDtoCWProxyImpl(this._value);

  final VisiteStatsDto _value;

  @override
  VisiteStatsDto from(String from) => this(from: from);

  @override
  VisiteStatsDto to(String to) => this(to: to);

  @override
  VisiteStatsDto total(num total) => this(total: total);

  @override
  VisiteStatsDto parEntreprise(List<VisiteStatBucketDto> parEntreprise) =>
      this(parEntreprise: parEntreprise);

  @override
  VisiteStatsDto parDirection(List<VisiteStatBucketDto> parDirection) =>
      this(parDirection: parDirection);

  @override
  VisiteStatsDto parDestinataire(List<VisiteStatBucketDto> parDestinataire) =>
      this(parDestinataire: parDestinataire);

  @override
  VisiteStatsDto parObjet(List<VisiteStatBucketDto> parObjet) =>
      this(parObjet: parObjet);

  @override
  VisiteStatsDto parMois(List<VisiteStatMoisDto> parMois) =>
      this(parMois: parMois);

  @override
  VisiteStatsDto parJour(List<VisiteStatJourDto> parJour) =>
      this(parJour: parJour);

  @override
  VisiteStatsDto sansDirection(num sansDirection) =>
      this(sansDirection: sansDirection);

  @override
  VisiteStatsDto sansDestinataire(num sansDestinataire) =>
      this(sansDestinataire: sansDestinataire);

  @override
  /// This function **does support** nullification of nullable fields. All `null` values passed to `non-nullable` fields will be ignored. You can also use `VisiteStatsDto(...).copyWith.fieldName(...)` to override fields one at a time with nullification support.
  ///
  /// Usage
  /// ```dart
  /// VisiteStatsDto(...).copyWith(id: 12, name: "My name")
  /// ````
  VisiteStatsDto call({
    Object? from = const $CopyWithPlaceholder(),
    Object? to = const $CopyWithPlaceholder(),
    Object? total = const $CopyWithPlaceholder(),
    Object? parEntreprise = const $CopyWithPlaceholder(),
    Object? parDirection = const $CopyWithPlaceholder(),
    Object? parDestinataire = const $CopyWithPlaceholder(),
    Object? parObjet = const $CopyWithPlaceholder(),
    Object? parMois = const $CopyWithPlaceholder(),
    Object? parJour = const $CopyWithPlaceholder(),
    Object? sansDirection = const $CopyWithPlaceholder(),
    Object? sansDestinataire = const $CopyWithPlaceholder(),
  }) {
    return VisiteStatsDto(
      from: from == const $CopyWithPlaceholder()
          ? _value.from
          // ignore: cast_nullable_to_non_nullable
          : from as String,
      to: to == const $CopyWithPlaceholder()
          ? _value.to
          // ignore: cast_nullable_to_non_nullable
          : to as String,
      total: total == const $CopyWithPlaceholder()
          ? _value.total
          // ignore: cast_nullable_to_non_nullable
          : total as num,
      parEntreprise: parEntreprise == const $CopyWithPlaceholder()
          ? _value.parEntreprise
          // ignore: cast_nullable_to_non_nullable
          : parEntreprise as List<VisiteStatBucketDto>,
      parDirection: parDirection == const $CopyWithPlaceholder()
          ? _value.parDirection
          // ignore: cast_nullable_to_non_nullable
          : parDirection as List<VisiteStatBucketDto>,
      parDestinataire: parDestinataire == const $CopyWithPlaceholder()
          ? _value.parDestinataire
          // ignore: cast_nullable_to_non_nullable
          : parDestinataire as List<VisiteStatBucketDto>,
      parObjet: parObjet == const $CopyWithPlaceholder()
          ? _value.parObjet
          // ignore: cast_nullable_to_non_nullable
          : parObjet as List<VisiteStatBucketDto>,
      parMois: parMois == const $CopyWithPlaceholder()
          ? _value.parMois
          // ignore: cast_nullable_to_non_nullable
          : parMois as List<VisiteStatMoisDto>,
      parJour: parJour == const $CopyWithPlaceholder()
          ? _value.parJour
          // ignore: cast_nullable_to_non_nullable
          : parJour as List<VisiteStatJourDto>,
      sansDirection: sansDirection == const $CopyWithPlaceholder()
          ? _value.sansDirection
          // ignore: cast_nullable_to_non_nullable
          : sansDirection as num,
      sansDestinataire: sansDestinataire == const $CopyWithPlaceholder()
          ? _value.sansDestinataire
          // ignore: cast_nullable_to_non_nullable
          : sansDestinataire as num,
    );
  }
}

extension $VisiteStatsDtoCopyWith on VisiteStatsDto {
  /// Returns a callable class that can be used as follows: `instanceOfVisiteStatsDto.copyWith(...)` or like so:`instanceOfVisiteStatsDto.copyWith.fieldName(...)`.
  // ignore: library_private_types_in_public_api
  _$VisiteStatsDtoCWProxy get copyWith => _$VisiteStatsDtoCWProxyImpl(this);
}

// **************************************************************************
// JsonSerializableGenerator
// **************************************************************************

VisiteStatsDto _$VisiteStatsDtoFromJson(
  Map<String, dynamic> json,
) => $checkedCreate('VisiteStatsDto', json, ($checkedConvert) {
  $checkKeys(
    json,
    requiredKeys: const [
      'from',
      'to',
      'total',
      'parEntreprise',
      'parDirection',
      'parDestinataire',
      'parObjet',
      'parMois',
      'parJour',
      'sansDirection',
      'sansDestinataire',
    ],
  );
  final val = VisiteStatsDto(
    from: $checkedConvert('from', (v) => v as String),
    to: $checkedConvert('to', (v) => v as String),
    total: $checkedConvert('total', (v) => v as num),
    parEntreprise: $checkedConvert(
      'parEntreprise',
      (v) => (v as List<dynamic>)
          .map((e) => VisiteStatBucketDto.fromJson(e as Map<String, dynamic>))
          .toList(),
    ),
    parDirection: $checkedConvert(
      'parDirection',
      (v) => (v as List<dynamic>)
          .map((e) => VisiteStatBucketDto.fromJson(e as Map<String, dynamic>))
          .toList(),
    ),
    parDestinataire: $checkedConvert(
      'parDestinataire',
      (v) => (v as List<dynamic>)
          .map((e) => VisiteStatBucketDto.fromJson(e as Map<String, dynamic>))
          .toList(),
    ),
    parObjet: $checkedConvert(
      'parObjet',
      (v) => (v as List<dynamic>)
          .map((e) => VisiteStatBucketDto.fromJson(e as Map<String, dynamic>))
          .toList(),
    ),
    parMois: $checkedConvert(
      'parMois',
      (v) => (v as List<dynamic>)
          .map((e) => VisiteStatMoisDto.fromJson(e as Map<String, dynamic>))
          .toList(),
    ),
    parJour: $checkedConvert(
      'parJour',
      (v) => (v as List<dynamic>)
          .map((e) => VisiteStatJourDto.fromJson(e as Map<String, dynamic>))
          .toList(),
    ),
    sansDirection: $checkedConvert('sansDirection', (v) => v as num),
    sansDestinataire: $checkedConvert('sansDestinataire', (v) => v as num),
  );
  return val;
});

Map<String, dynamic> _$VisiteStatsDtoToJson(
  VisiteStatsDto instance,
) => <String, dynamic>{
  'from': instance.from,
  'to': instance.to,
  'total': instance.total,
  'parEntreprise': instance.parEntreprise.map((e) => e.toJson()).toList(),
  'parDirection': instance.parDirection.map((e) => e.toJson()).toList(),
  'parDestinataire': instance.parDestinataire.map((e) => e.toJson()).toList(),
  'parObjet': instance.parObjet.map((e) => e.toJson()).toList(),
  'parMois': instance.parMois.map((e) => e.toJson()).toList(),
  'parJour': instance.parJour.map((e) => e.toJson()).toList(),
  'sansDirection': instance.sansDirection,
  'sansDestinataire': instance.sansDestinataire,
};

// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'sync_changes_dto.dart';

// **************************************************************************
// CopyWithGenerator
// **************************************************************************

abstract class _$SyncChangesDtoCWProxy {
  SyncChangesDto departements(List<DepartementDto> departements);

  SyncChangesDto iefs(List<IefDto> iefs);

  SyncChangesDto banques(List<BanqueDto> banques);

  SyncChangesDto syndicats(List<SyndicatDto> syndicats);

  SyncChangesDto canauxProvenance(List<CanalProvenanceDto> canauxProvenance);

  SyncChangesDto visiteReferentiels(
    List<SyncVisiteReferentielDto> visiteReferentiels,
  );

  SyncChangesDto representants(List<RepresentantDto> representants);

  SyncChangesDto prospects(List<ProspectDto> prospects);

  SyncChangesDto visites(List<SyncVisiteDto> visites);

  /// This function **does support** nullification of nullable fields. All `null` values passed to `non-nullable` fields will be ignored. You can also use `SyncChangesDto(...).copyWith.fieldName(...)` to override fields one at a time with nullification support.
  ///
  /// Usage
  /// ```dart
  /// SyncChangesDto(...).copyWith(id: 12, name: "My name")
  /// ````
  SyncChangesDto call({
    List<DepartementDto> departements,
    List<IefDto> iefs,
    List<BanqueDto> banques,
    List<SyndicatDto> syndicats,
    List<CanalProvenanceDto> canauxProvenance,
    List<SyncVisiteReferentielDto> visiteReferentiels,
    List<RepresentantDto> representants,
    List<ProspectDto> prospects,
    List<SyncVisiteDto> visites,
  });
}

/// Proxy class for `copyWith` functionality. This is a callable class and can be used as follows: `instanceOfSyncChangesDto.copyWith(...)`. Additionally contains functions for specific fields e.g. `instanceOfSyncChangesDto.copyWith.fieldName(...)`
class _$SyncChangesDtoCWProxyImpl implements _$SyncChangesDtoCWProxy {
  const _$SyncChangesDtoCWProxyImpl(this._value);

  final SyncChangesDto _value;

  @override
  SyncChangesDto departements(List<DepartementDto> departements) =>
      this(departements: departements);

  @override
  SyncChangesDto iefs(List<IefDto> iefs) => this(iefs: iefs);

  @override
  SyncChangesDto banques(List<BanqueDto> banques) => this(banques: banques);

  @override
  SyncChangesDto syndicats(List<SyndicatDto> syndicats) =>
      this(syndicats: syndicats);

  @override
  SyncChangesDto canauxProvenance(List<CanalProvenanceDto> canauxProvenance) =>
      this(canauxProvenance: canauxProvenance);

  @override
  SyncChangesDto visiteReferentiels(
    List<SyncVisiteReferentielDto> visiteReferentiels,
  ) => this(visiteReferentiels: visiteReferentiels);

  @override
  SyncChangesDto representants(List<RepresentantDto> representants) =>
      this(representants: representants);

  @override
  SyncChangesDto prospects(List<ProspectDto> prospects) =>
      this(prospects: prospects);

  @override
  SyncChangesDto visites(List<SyncVisiteDto> visites) => this(visites: visites);

  @override
  /// This function **does support** nullification of nullable fields. All `null` values passed to `non-nullable` fields will be ignored. You can also use `SyncChangesDto(...).copyWith.fieldName(...)` to override fields one at a time with nullification support.
  ///
  /// Usage
  /// ```dart
  /// SyncChangesDto(...).copyWith(id: 12, name: "My name")
  /// ````
  SyncChangesDto call({
    Object? departements = const $CopyWithPlaceholder(),
    Object? iefs = const $CopyWithPlaceholder(),
    Object? banques = const $CopyWithPlaceholder(),
    Object? syndicats = const $CopyWithPlaceholder(),
    Object? canauxProvenance = const $CopyWithPlaceholder(),
    Object? visiteReferentiels = const $CopyWithPlaceholder(),
    Object? representants = const $CopyWithPlaceholder(),
    Object? prospects = const $CopyWithPlaceholder(),
    Object? visites = const $CopyWithPlaceholder(),
  }) {
    return SyncChangesDto(
      departements: departements == const $CopyWithPlaceholder()
          ? _value.departements
          // ignore: cast_nullable_to_non_nullable
          : departements as List<DepartementDto>,
      iefs: iefs == const $CopyWithPlaceholder()
          ? _value.iefs
          // ignore: cast_nullable_to_non_nullable
          : iefs as List<IefDto>,
      banques: banques == const $CopyWithPlaceholder()
          ? _value.banques
          // ignore: cast_nullable_to_non_nullable
          : banques as List<BanqueDto>,
      syndicats: syndicats == const $CopyWithPlaceholder()
          ? _value.syndicats
          // ignore: cast_nullable_to_non_nullable
          : syndicats as List<SyndicatDto>,
      canauxProvenance: canauxProvenance == const $CopyWithPlaceholder()
          ? _value.canauxProvenance
          // ignore: cast_nullable_to_non_nullable
          : canauxProvenance as List<CanalProvenanceDto>,
      visiteReferentiels: visiteReferentiels == const $CopyWithPlaceholder()
          ? _value.visiteReferentiels
          // ignore: cast_nullable_to_non_nullable
          : visiteReferentiels as List<SyncVisiteReferentielDto>,
      representants: representants == const $CopyWithPlaceholder()
          ? _value.representants
          // ignore: cast_nullable_to_non_nullable
          : representants as List<RepresentantDto>,
      prospects: prospects == const $CopyWithPlaceholder()
          ? _value.prospects
          // ignore: cast_nullable_to_non_nullable
          : prospects as List<ProspectDto>,
      visites: visites == const $CopyWithPlaceholder()
          ? _value.visites
          // ignore: cast_nullable_to_non_nullable
          : visites as List<SyncVisiteDto>,
    );
  }
}

extension $SyncChangesDtoCopyWith on SyncChangesDto {
  /// Returns a callable class that can be used as follows: `instanceOfSyncChangesDto.copyWith(...)` or like so:`instanceOfSyncChangesDto.copyWith.fieldName(...)`.
  // ignore: library_private_types_in_public_api
  _$SyncChangesDtoCWProxy get copyWith => _$SyncChangesDtoCWProxyImpl(this);
}

// **************************************************************************
// JsonSerializableGenerator
// **************************************************************************

SyncChangesDto _$SyncChangesDtoFromJson(
  Map<String, dynamic> json,
) => $checkedCreate('SyncChangesDto', json, ($checkedConvert) {
  $checkKeys(
    json,
    requiredKeys: const [
      'departements',
      'iefs',
      'banques',
      'syndicats',
      'canauxProvenance',
      'visiteReferentiels',
      'representants',
      'prospects',
      'visites',
    ],
  );
  final val = SyncChangesDto(
    departements: $checkedConvert(
      'departements',
      (v) => (v as List<dynamic>)
          .map((e) => DepartementDto.fromJson(e as Map<String, dynamic>))
          .toList(),
    ),
    iefs: $checkedConvert(
      'iefs',
      (v) => (v as List<dynamic>)
          .map((e) => IefDto.fromJson(e as Map<String, dynamic>))
          .toList(),
    ),
    banques: $checkedConvert(
      'banques',
      (v) => (v as List<dynamic>)
          .map((e) => BanqueDto.fromJson(e as Map<String, dynamic>))
          .toList(),
    ),
    syndicats: $checkedConvert(
      'syndicats',
      (v) => (v as List<dynamic>)
          .map((e) => SyndicatDto.fromJson(e as Map<String, dynamic>))
          .toList(),
    ),
    canauxProvenance: $checkedConvert(
      'canauxProvenance',
      (v) => (v as List<dynamic>)
          .map((e) => CanalProvenanceDto.fromJson(e as Map<String, dynamic>))
          .toList(),
    ),
    visiteReferentiels: $checkedConvert(
      'visiteReferentiels',
      (v) => (v as List<dynamic>)
          .map(
            (e) => SyncVisiteReferentielDto.fromJson(e as Map<String, dynamic>),
          )
          .toList(),
    ),
    representants: $checkedConvert(
      'representants',
      (v) => (v as List<dynamic>)
          .map((e) => RepresentantDto.fromJson(e as Map<String, dynamic>))
          .toList(),
    ),
    prospects: $checkedConvert(
      'prospects',
      (v) => (v as List<dynamic>)
          .map((e) => ProspectDto.fromJson(e as Map<String, dynamic>))
          .toList(),
    ),
    visites: $checkedConvert(
      'visites',
      (v) => (v as List<dynamic>)
          .map((e) => SyncVisiteDto.fromJson(e as Map<String, dynamic>))
          .toList(),
    ),
  );
  return val;
});

Map<String, dynamic> _$SyncChangesDtoToJson(
  SyncChangesDto instance,
) => <String, dynamic>{
  'departements': instance.departements.map((e) => e.toJson()).toList(),
  'iefs': instance.iefs.map((e) => e.toJson()).toList(),
  'banques': instance.banques.map((e) => e.toJson()).toList(),
  'syndicats': instance.syndicats.map((e) => e.toJson()).toList(),
  'canauxProvenance': instance.canauxProvenance.map((e) => e.toJson()).toList(),
  'visiteReferentiels': instance.visiteReferentiels
      .map((e) => e.toJson())
      .toList(),
  'representants': instance.representants.map((e) => e.toJson()).toList(),
  'prospects': instance.prospects.map((e) => e.toJson()).toList(),
  'visites': instance.visites.map((e) => e.toJson()).toList(),
};

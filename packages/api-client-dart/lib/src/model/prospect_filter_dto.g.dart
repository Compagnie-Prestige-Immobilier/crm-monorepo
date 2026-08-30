// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'prospect_filter_dto.dart';

// **************************************************************************
// CopyWithGenerator
// **************************************************************************

abstract class _$ProspectFilterDtoCWProxy {
  ProspectFilterDto search(String? search);

  ProspectFilterDto representantId(String? representantId);

  ProspectFilterDto banqueId(String? banqueId);

  ProspectFilterDto syndicatId(String? syndicatId);

  ProspectFilterDto departementId(String? departementId);

  ProspectFilterDto commercialId(String? commercialId);

  ProspectFilterDto projet(Projet? projet);

  ProspectFilterDto type(ProspectType? type);

  ProspectFilterDto canalProvenanceId(String? canalProvenanceId);

  ProspectFilterDto statut(ProspectStatut? statut);

  ProspectFilterDto segment(BddSegment? segment);

  ProspectFilterDto phase2Status(Phase2Status? phase2Status);

  ProspectFilterDto enrollmentMethod(EnrollmentMethod? enrollmentMethod);

  ProspectFilterDto appelePar(String? appelePar);

  ProspectFilterDto enrollmentCapturedById(String? enrollmentCapturedById);

  ProspectFilterDto origin(ProspectFilterDtoOriginEnum? origin);

  ProspectFilterDto dateFrom(DateTime? dateFrom);

  ProspectFilterDto dateTo(DateTime? dateTo);

  ProspectFilterDto includeDeleted(bool? includeDeleted);

  /// This function **does support** nullification of nullable fields. All `null` values passed to `non-nullable` fields will be ignored. You can also use `ProspectFilterDto(...).copyWith.fieldName(...)` to override fields one at a time with nullification support.
  ///
  /// Usage
  /// ```dart
  /// ProspectFilterDto(...).copyWith(id: 12, name: "My name")
  /// ````
  ProspectFilterDto call({
    String? search,
    String? representantId,
    String? banqueId,
    String? syndicatId,
    String? departementId,
    String? commercialId,
    Projet? projet,
    ProspectType? type,
    String? canalProvenanceId,
    ProspectStatut? statut,
    BddSegment? segment,
    Phase2Status? phase2Status,
    EnrollmentMethod? enrollmentMethod,
    String? appelePar,
    String? enrollmentCapturedById,
    ProspectFilterDtoOriginEnum? origin,
    DateTime? dateFrom,
    DateTime? dateTo,
    bool? includeDeleted,
  });
}

/// Proxy class for `copyWith` functionality. This is a callable class and can be used as follows: `instanceOfProspectFilterDto.copyWith(...)`. Additionally contains functions for specific fields e.g. `instanceOfProspectFilterDto.copyWith.fieldName(...)`
class _$ProspectFilterDtoCWProxyImpl implements _$ProspectFilterDtoCWProxy {
  const _$ProspectFilterDtoCWProxyImpl(this._value);

  final ProspectFilterDto _value;

  @override
  ProspectFilterDto search(String? search) => this(search: search);

  @override
  ProspectFilterDto representantId(String? representantId) =>
      this(representantId: representantId);

  @override
  ProspectFilterDto banqueId(String? banqueId) => this(banqueId: banqueId);

  @override
  ProspectFilterDto syndicatId(String? syndicatId) =>
      this(syndicatId: syndicatId);

  @override
  ProspectFilterDto departementId(String? departementId) =>
      this(departementId: departementId);

  @override
  ProspectFilterDto commercialId(String? commercialId) =>
      this(commercialId: commercialId);

  @override
  ProspectFilterDto projet(Projet? projet) => this(projet: projet);

  @override
  ProspectFilterDto type(ProspectType? type) => this(type: type);

  @override
  ProspectFilterDto canalProvenanceId(String? canalProvenanceId) =>
      this(canalProvenanceId: canalProvenanceId);

  @override
  ProspectFilterDto statut(ProspectStatut? statut) => this(statut: statut);

  @override
  ProspectFilterDto segment(BddSegment? segment) => this(segment: segment);

  @override
  ProspectFilterDto phase2Status(Phase2Status? phase2Status) =>
      this(phase2Status: phase2Status);

  @override
  ProspectFilterDto enrollmentMethod(EnrollmentMethod? enrollmentMethod) =>
      this(enrollmentMethod: enrollmentMethod);

  @override
  ProspectFilterDto appelePar(String? appelePar) => this(appelePar: appelePar);

  @override
  ProspectFilterDto enrollmentCapturedById(String? enrollmentCapturedById) =>
      this(enrollmentCapturedById: enrollmentCapturedById);

  @override
  ProspectFilterDto origin(ProspectFilterDtoOriginEnum? origin) =>
      this(origin: origin);

  @override
  ProspectFilterDto dateFrom(DateTime? dateFrom) => this(dateFrom: dateFrom);

  @override
  ProspectFilterDto dateTo(DateTime? dateTo) => this(dateTo: dateTo);

  @override
  ProspectFilterDto includeDeleted(bool? includeDeleted) =>
      this(includeDeleted: includeDeleted);

  @override
  /// This function **does support** nullification of nullable fields. All `null` values passed to `non-nullable` fields will be ignored. You can also use `ProspectFilterDto(...).copyWith.fieldName(...)` to override fields one at a time with nullification support.
  ///
  /// Usage
  /// ```dart
  /// ProspectFilterDto(...).copyWith(id: 12, name: "My name")
  /// ````
  ProspectFilterDto call({
    Object? search = const $CopyWithPlaceholder(),
    Object? representantId = const $CopyWithPlaceholder(),
    Object? banqueId = const $CopyWithPlaceholder(),
    Object? syndicatId = const $CopyWithPlaceholder(),
    Object? departementId = const $CopyWithPlaceholder(),
    Object? commercialId = const $CopyWithPlaceholder(),
    Object? projet = const $CopyWithPlaceholder(),
    Object? type = const $CopyWithPlaceholder(),
    Object? canalProvenanceId = const $CopyWithPlaceholder(),
    Object? statut = const $CopyWithPlaceholder(),
    Object? segment = const $CopyWithPlaceholder(),
    Object? phase2Status = const $CopyWithPlaceholder(),
    Object? enrollmentMethod = const $CopyWithPlaceholder(),
    Object? appelePar = const $CopyWithPlaceholder(),
    Object? enrollmentCapturedById = const $CopyWithPlaceholder(),
    Object? origin = const $CopyWithPlaceholder(),
    Object? dateFrom = const $CopyWithPlaceholder(),
    Object? dateTo = const $CopyWithPlaceholder(),
    Object? includeDeleted = const $CopyWithPlaceholder(),
  }) {
    return ProspectFilterDto(
      search: search == const $CopyWithPlaceholder()
          ? _value.search
          // ignore: cast_nullable_to_non_nullable
          : search as String?,
      representantId: representantId == const $CopyWithPlaceholder()
          ? _value.representantId
          // ignore: cast_nullable_to_non_nullable
          : representantId as String?,
      banqueId: banqueId == const $CopyWithPlaceholder()
          ? _value.banqueId
          // ignore: cast_nullable_to_non_nullable
          : banqueId as String?,
      syndicatId: syndicatId == const $CopyWithPlaceholder()
          ? _value.syndicatId
          // ignore: cast_nullable_to_non_nullable
          : syndicatId as String?,
      departementId: departementId == const $CopyWithPlaceholder()
          ? _value.departementId
          // ignore: cast_nullable_to_non_nullable
          : departementId as String?,
      commercialId: commercialId == const $CopyWithPlaceholder()
          ? _value.commercialId
          // ignore: cast_nullable_to_non_nullable
          : commercialId as String?,
      projet: projet == const $CopyWithPlaceholder()
          ? _value.projet
          // ignore: cast_nullable_to_non_nullable
          : projet as Projet?,
      type: type == const $CopyWithPlaceholder()
          ? _value.type
          // ignore: cast_nullable_to_non_nullable
          : type as ProspectType?,
      canalProvenanceId: canalProvenanceId == const $CopyWithPlaceholder()
          ? _value.canalProvenanceId
          // ignore: cast_nullable_to_non_nullable
          : canalProvenanceId as String?,
      statut: statut == const $CopyWithPlaceholder()
          ? _value.statut
          // ignore: cast_nullable_to_non_nullable
          : statut as ProspectStatut?,
      segment: segment == const $CopyWithPlaceholder()
          ? _value.segment
          // ignore: cast_nullable_to_non_nullable
          : segment as BddSegment?,
      phase2Status: phase2Status == const $CopyWithPlaceholder()
          ? _value.phase2Status
          // ignore: cast_nullable_to_non_nullable
          : phase2Status as Phase2Status?,
      enrollmentMethod: enrollmentMethod == const $CopyWithPlaceholder()
          ? _value.enrollmentMethod
          // ignore: cast_nullable_to_non_nullable
          : enrollmentMethod as EnrollmentMethod?,
      appelePar: appelePar == const $CopyWithPlaceholder()
          ? _value.appelePar
          // ignore: cast_nullable_to_non_nullable
          : appelePar as String?,
      enrollmentCapturedById:
          enrollmentCapturedById == const $CopyWithPlaceholder()
          ? _value.enrollmentCapturedById
          // ignore: cast_nullable_to_non_nullable
          : enrollmentCapturedById as String?,
      origin: origin == const $CopyWithPlaceholder()
          ? _value.origin
          // ignore: cast_nullable_to_non_nullable
          : origin as ProspectFilterDtoOriginEnum?,
      dateFrom: dateFrom == const $CopyWithPlaceholder()
          ? _value.dateFrom
          // ignore: cast_nullable_to_non_nullable
          : dateFrom as DateTime?,
      dateTo: dateTo == const $CopyWithPlaceholder()
          ? _value.dateTo
          // ignore: cast_nullable_to_non_nullable
          : dateTo as DateTime?,
      includeDeleted: includeDeleted == const $CopyWithPlaceholder()
          ? _value.includeDeleted
          // ignore: cast_nullable_to_non_nullable
          : includeDeleted as bool?,
    );
  }
}

extension $ProspectFilterDtoCopyWith on ProspectFilterDto {
  /// Returns a callable class that can be used as follows: `instanceOfProspectFilterDto.copyWith(...)` or like so:`instanceOfProspectFilterDto.copyWith.fieldName(...)`.
  // ignore: library_private_types_in_public_api
  _$ProspectFilterDtoCWProxy get copyWith =>
      _$ProspectFilterDtoCWProxyImpl(this);
}

// **************************************************************************
// JsonSerializableGenerator
// **************************************************************************

ProspectFilterDto _$ProspectFilterDtoFromJson(Map<String, dynamic> json) =>
    $checkedCreate('ProspectFilterDto', json, ($checkedConvert) {
      final val = ProspectFilterDto(
        search: $checkedConvert('search', (v) => v as String?),
        representantId: $checkedConvert('representantId', (v) => v as String?),
        banqueId: $checkedConvert('banqueId', (v) => v as String?),
        syndicatId: $checkedConvert('syndicatId', (v) => v as String?),
        departementId: $checkedConvert('departementId', (v) => v as String?),
        commercialId: $checkedConvert('commercialId', (v) => v as String?),
        projet: $checkedConvert(
          'projet',
          (v) => $enumDecodeNullable(
            _$ProjetEnumMap,
            v,
            unknownValue: Projet.unknownDefaultOpenApi,
          ),
        ),
        type: $checkedConvert(
          'type',
          (v) => $enumDecodeNullable(
            _$ProspectTypeEnumMap,
            v,
            unknownValue: ProspectType.unknownDefaultOpenApi,
          ),
        ),
        canalProvenanceId: $checkedConvert(
          'canalProvenanceId',
          (v) => v as String?,
        ),
        statut: $checkedConvert(
          'statut',
          (v) => $enumDecodeNullable(
            _$ProspectStatutEnumMap,
            v,
            unknownValue: ProspectStatut.unknownDefaultOpenApi,
          ),
        ),
        segment: $checkedConvert(
          'segment',
          (v) => $enumDecodeNullable(
            _$BddSegmentEnumMap,
            v,
            unknownValue: BddSegment.unknownDefaultOpenApi,
          ),
        ),
        phase2Status: $checkedConvert(
          'phase2Status',
          (v) => $enumDecodeNullable(
            _$Phase2StatusEnumMap,
            v,
            unknownValue: Phase2Status.unknownDefaultOpenApi,
          ),
        ),
        enrollmentMethod: $checkedConvert(
          'enrollmentMethod',
          (v) => $enumDecodeNullable(
            _$EnrollmentMethodEnumMap,
            v,
            unknownValue: EnrollmentMethod.unknownDefaultOpenApi,
          ),
        ),
        appelePar: $checkedConvert('appelePar', (v) => v as String?),
        enrollmentCapturedById: $checkedConvert(
          'enrollmentCapturedById',
          (v) => v as String?,
        ),
        origin: $checkedConvert(
          'origin',
          (v) => $enumDecodeNullable(
            _$ProspectFilterDtoOriginEnumEnumMap,
            v,
            unknownValue: ProspectFilterDtoOriginEnum.unknownDefaultOpenApi,
          ),
        ),
        dateFrom: $checkedConvert(
          'dateFrom',
          (v) => v == null ? null : DateTime.parse(v as String),
        ),
        dateTo: $checkedConvert(
          'dateTo',
          (v) => v == null ? null : DateTime.parse(v as String),
        ),
        includeDeleted: $checkedConvert(
          'includeDeleted',
          (v) => v as bool? ?? false,
        ),
      );
      return val;
    });

Map<String, dynamic> _$ProspectFilterDtoToJson(
  ProspectFilterDto instance,
) => <String, dynamic>{
  if (instance.search case final value?) 'search': value,
  if (instance.representantId case final value?) 'representantId': value,
  if (instance.banqueId case final value?) 'banqueId': value,
  if (instance.syndicatId case final value?) 'syndicatId': value,
  if (instance.departementId case final value?) 'departementId': value,
  if (instance.commercialId case final value?) 'commercialId': value,
  if (_$ProjetEnumMap[instance.projet] case final value?) 'projet': value,
  if (_$ProspectTypeEnumMap[instance.type] case final value?) 'type': value,
  if (instance.canalProvenanceId case final value?) 'canalProvenanceId': value,
  if (_$ProspectStatutEnumMap[instance.statut] case final value?)
    'statut': value,
  if (_$BddSegmentEnumMap[instance.segment] case final value?) 'segment': value,
  if (_$Phase2StatusEnumMap[instance.phase2Status] case final value?)
    'phase2Status': value,
  if (_$EnrollmentMethodEnumMap[instance.enrollmentMethod] case final value?)
    'enrollmentMethod': value,
  if (instance.appelePar case final value?) 'appelePar': value,
  if (instance.enrollmentCapturedById case final value?)
    'enrollmentCapturedById': value,
  if (_$ProspectFilterDtoOriginEnumEnumMap[instance.origin] case final value?)
    'origin': value,
  if (instance.dateFrom?.toIso8601String() case final value?) 'dateFrom': value,
  if (instance.dateTo?.toIso8601String() case final value?) 'dateTo': value,
  if (instance.includeDeleted case final value?) 'includeDeleted': value,
};

const _$ProjetEnumMap = {
  Projet.CHUES: 'CHUES',
  Projet.GRAND_PUBLIC: 'GRAND_PUBLIC',
  Projet.unknownDefaultOpenApi: 'unknown_default_open_api',
};

const _$ProspectTypeEnumMap = {
  ProspectType.FONCTIONNAIRE: 'FONCTIONNAIRE',
  ProspectType.SECTEUR_PRIVE: 'SECTEUR_PRIVE',
  ProspectType.INFORMEL: 'INFORMEL',
  ProspectType.DIASPORA: 'DIASPORA',
  ProspectType.unknownDefaultOpenApi: 'unknown_default_open_api',
};

const _$ProspectStatutEnumMap = {
  ProspectStatut.NOUVEAU: 'NOUVEAU',
  ProspectStatut.CONTACTE: 'CONTACTE',
  ProspectStatut.CONVERTI: 'CONVERTI',
  ProspectStatut.PERDU: 'PERDU',
  ProspectStatut.unknownDefaultOpenApi: 'unknown_default_open_api',
};

const _$BddSegmentEnumMap = {
  BddSegment.BDD1: 'BDD1',
  BddSegment.BDD2: 'BDD2',
  BddSegment.BDD3: 'BDD3',
  BddSegment.BDD4: 'BDD4',
  BddSegment.unknownDefaultOpenApi: 'unknown_default_open_api',
};

const _$Phase2StatusEnumMap = {
  Phase2Status.PENDING: 'PENDING',
  Phase2Status.METHOD_OBTAINED: 'METHOD_OBTAINED',
  Phase2Status.REFUSED: 'REFUSED',
  Phase2Status.WRONG_NUMBER: 'WRONG_NUMBER',
  Phase2Status.unknownDefaultOpenApi: 'unknown_default_open_api',
};

const _$EnrollmentMethodEnumMap = {
  EnrollmentMethod.PLATFORM: 'PLATFORM',
  EnrollmentMethod.PHYSICAL: 'PHYSICAL',
  EnrollmentMethod.VOICE_OR_ELECTRONIC_MESSAGING:
      'VOICE_OR_ELECTRONIC_MESSAGING',
  EnrollmentMethod.APPOINTMENT: 'APPOINTMENT',
  EnrollmentMethod.unknownDefaultOpenApi: 'unknown_default_open_api',
};

const _$ProspectFilterDtoOriginEnumEnumMap = {
  ProspectFilterDtoOriginEnum.BANQUE: 'BANQUE',
  ProspectFilterDtoOriginEnum.unknownDefaultOpenApi: 'unknown_default_open_api',
};

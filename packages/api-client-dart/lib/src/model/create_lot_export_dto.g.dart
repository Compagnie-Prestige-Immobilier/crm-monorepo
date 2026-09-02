// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'create_lot_export_dto.dart';

// **************************************************************************
// CopyWithGenerator
// **************************************************************************

abstract class _$CreateLotExportDtoCWProxy {
  CreateLotExportDto name(String name);

  CreateLotExportDto cible(LotExportCible cible);

  CreateLotExportDto representants(RepresentantExportQueryDto? representants);

  CreateLotExportDto prospects(LotExportProspectFilterDto? prospects);

  CreateLotExportDto distribution(LotExportDistributionInputDto distribution);

  /// This function **does support** nullification of nullable fields. All `null` values passed to `non-nullable` fields will be ignored. You can also use `CreateLotExportDto(...).copyWith.fieldName(...)` to override fields one at a time with nullification support.
  ///
  /// Usage
  /// ```dart
  /// CreateLotExportDto(...).copyWith(id: 12, name: "My name")
  /// ````
  CreateLotExportDto call({
    String name,
    LotExportCible cible,
    RepresentantExportQueryDto? representants,
    LotExportProspectFilterDto? prospects,
    LotExportDistributionInputDto distribution,
  });
}

/// Proxy class for `copyWith` functionality. This is a callable class and can be used as follows: `instanceOfCreateLotExportDto.copyWith(...)`. Additionally contains functions for specific fields e.g. `instanceOfCreateLotExportDto.copyWith.fieldName(...)`
class _$CreateLotExportDtoCWProxyImpl implements _$CreateLotExportDtoCWProxy {
  const _$CreateLotExportDtoCWProxyImpl(this._value);

  final CreateLotExportDto _value;

  @override
  CreateLotExportDto name(String name) => this(name: name);

  @override
  CreateLotExportDto cible(LotExportCible cible) => this(cible: cible);

  @override
  CreateLotExportDto representants(RepresentantExportQueryDto? representants) =>
      this(representants: representants);

  @override
  CreateLotExportDto prospects(LotExportProspectFilterDto? prospects) =>
      this(prospects: prospects);

  @override
  CreateLotExportDto distribution(LotExportDistributionInputDto distribution) =>
      this(distribution: distribution);

  @override
  /// This function **does support** nullification of nullable fields. All `null` values passed to `non-nullable` fields will be ignored. You can also use `CreateLotExportDto(...).copyWith.fieldName(...)` to override fields one at a time with nullification support.
  ///
  /// Usage
  /// ```dart
  /// CreateLotExportDto(...).copyWith(id: 12, name: "My name")
  /// ````
  CreateLotExportDto call({
    Object? name = const $CopyWithPlaceholder(),
    Object? cible = const $CopyWithPlaceholder(),
    Object? representants = const $CopyWithPlaceholder(),
    Object? prospects = const $CopyWithPlaceholder(),
    Object? distribution = const $CopyWithPlaceholder(),
  }) {
    return CreateLotExportDto(
      name: name == const $CopyWithPlaceholder()
          ? _value.name
          // ignore: cast_nullable_to_non_nullable
          : name as String,
      cible: cible == const $CopyWithPlaceholder()
          ? _value.cible
          // ignore: cast_nullable_to_non_nullable
          : cible as LotExportCible,
      representants: representants == const $CopyWithPlaceholder()
          ? _value.representants
          // ignore: cast_nullable_to_non_nullable
          : representants as RepresentantExportQueryDto?,
      prospects: prospects == const $CopyWithPlaceholder()
          ? _value.prospects
          // ignore: cast_nullable_to_non_nullable
          : prospects as LotExportProspectFilterDto?,
      distribution: distribution == const $CopyWithPlaceholder()
          ? _value.distribution
          // ignore: cast_nullable_to_non_nullable
          : distribution as LotExportDistributionInputDto,
    );
  }
}

extension $CreateLotExportDtoCopyWith on CreateLotExportDto {
  /// Returns a callable class that can be used as follows: `instanceOfCreateLotExportDto.copyWith(...)` or like so:`instanceOfCreateLotExportDto.copyWith.fieldName(...)`.
  // ignore: library_private_types_in_public_api
  _$CreateLotExportDtoCWProxy get copyWith =>
      _$CreateLotExportDtoCWProxyImpl(this);
}

// **************************************************************************
// JsonSerializableGenerator
// **************************************************************************

CreateLotExportDto _$CreateLotExportDtoFromJson(Map<String, dynamic> json) =>
    $checkedCreate('CreateLotExportDto', json, ($checkedConvert) {
      $checkKeys(json, requiredKeys: const ['name', 'cible', 'distribution']);
      final val = CreateLotExportDto(
        name: $checkedConvert('name', (v) => v as String),
        cible: $checkedConvert(
          'cible',
          (v) => $enumDecode(
            _$LotExportCibleEnumMap,
            v,
            unknownValue: LotExportCible.unknownDefaultOpenApi,
          ),
        ),
        representants: $checkedConvert(
          'representants',
          (v) => v == null
              ? null
              : RepresentantExportQueryDto.fromJson(v as Map<String, dynamic>),
        ),
        prospects: $checkedConvert(
          'prospects',
          (v) => v == null
              ? null
              : LotExportProspectFilterDto.fromJson(v as Map<String, dynamic>),
        ),
        distribution: $checkedConvert(
          'distribution',
          (v) =>
              LotExportDistributionInputDto.fromJson(v as Map<String, dynamic>),
        ),
      );
      return val;
    });

Map<String, dynamic> _$CreateLotExportDtoToJson(CreateLotExportDto instance) =>
    <String, dynamic>{
      'name': instance.name,
      'cible': _$LotExportCibleEnumMap[instance.cible]!,
      if (instance.representants?.toJson() case final value?)
        'representants': value,
      if (instance.prospects?.toJson() case final value?) 'prospects': value,
      'distribution': instance.distribution.toJson(),
    };

const _$LotExportCibleEnumMap = {
  LotExportCible.REPRESENTANTS: 'REPRESENTANTS',
  LotExportCible.PROSPECTS: 'PROSPECTS',
  LotExportCible.unknownDefaultOpenApi: 'unknown_default_open_api',
};

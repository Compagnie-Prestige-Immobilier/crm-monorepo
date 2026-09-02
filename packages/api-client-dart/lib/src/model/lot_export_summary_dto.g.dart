// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'lot_export_summary_dto.dart';

// **************************************************************************
// CopyWithGenerator
// **************************************************************************

abstract class _$LotExportSummaryDtoCWProxy {
  LotExportSummaryDto id(String id);

  LotExportSummaryDto name(String name);

  LotExportSummaryDto cible(LotExportCible cible);

  LotExportSummaryDto projet(Projet projet);

  LotExportSummaryDto scopeLabel(String scopeLabel);

  LotExportSummaryDto itemCount(num itemCount);

  LotExportSummaryDto createdById(String createdById);

  LotExportSummaryDto createdByName(String createdByName);

  LotExportSummaryDto createdAt(String createdAt);

  LotExportSummaryDto callsSince(num callsSince);

  LotExportSummaryDto fichesAppelees(num fichesAppelees);

  /// This function **does support** nullification of nullable fields. All `null` values passed to `non-nullable` fields will be ignored. You can also use `LotExportSummaryDto(...).copyWith.fieldName(...)` to override fields one at a time with nullification support.
  ///
  /// Usage
  /// ```dart
  /// LotExportSummaryDto(...).copyWith(id: 12, name: "My name")
  /// ````
  LotExportSummaryDto call({
    String id,
    String name,
    LotExportCible cible,
    Projet projet,
    String scopeLabel,
    num itemCount,
    String createdById,
    String createdByName,
    String createdAt,
    num callsSince,
    num fichesAppelees,
  });
}

/// Proxy class for `copyWith` functionality. This is a callable class and can be used as follows: `instanceOfLotExportSummaryDto.copyWith(...)`. Additionally contains functions for specific fields e.g. `instanceOfLotExportSummaryDto.copyWith.fieldName(...)`
class _$LotExportSummaryDtoCWProxyImpl implements _$LotExportSummaryDtoCWProxy {
  const _$LotExportSummaryDtoCWProxyImpl(this._value);

  final LotExportSummaryDto _value;

  @override
  LotExportSummaryDto id(String id) => this(id: id);

  @override
  LotExportSummaryDto name(String name) => this(name: name);

  @override
  LotExportSummaryDto cible(LotExportCible cible) => this(cible: cible);

  @override
  LotExportSummaryDto projet(Projet projet) => this(projet: projet);

  @override
  LotExportSummaryDto scopeLabel(String scopeLabel) =>
      this(scopeLabel: scopeLabel);

  @override
  LotExportSummaryDto itemCount(num itemCount) => this(itemCount: itemCount);

  @override
  LotExportSummaryDto createdById(String createdById) =>
      this(createdById: createdById);

  @override
  LotExportSummaryDto createdByName(String createdByName) =>
      this(createdByName: createdByName);

  @override
  LotExportSummaryDto createdAt(String createdAt) => this(createdAt: createdAt);

  @override
  LotExportSummaryDto callsSince(num callsSince) =>
      this(callsSince: callsSince);

  @override
  LotExportSummaryDto fichesAppelees(num fichesAppelees) =>
      this(fichesAppelees: fichesAppelees);

  @override
  /// This function **does support** nullification of nullable fields. All `null` values passed to `non-nullable` fields will be ignored. You can also use `LotExportSummaryDto(...).copyWith.fieldName(...)` to override fields one at a time with nullification support.
  ///
  /// Usage
  /// ```dart
  /// LotExportSummaryDto(...).copyWith(id: 12, name: "My name")
  /// ````
  LotExportSummaryDto call({
    Object? id = const $CopyWithPlaceholder(),
    Object? name = const $CopyWithPlaceholder(),
    Object? cible = const $CopyWithPlaceholder(),
    Object? projet = const $CopyWithPlaceholder(),
    Object? scopeLabel = const $CopyWithPlaceholder(),
    Object? itemCount = const $CopyWithPlaceholder(),
    Object? createdById = const $CopyWithPlaceholder(),
    Object? createdByName = const $CopyWithPlaceholder(),
    Object? createdAt = const $CopyWithPlaceholder(),
    Object? callsSince = const $CopyWithPlaceholder(),
    Object? fichesAppelees = const $CopyWithPlaceholder(),
  }) {
    return LotExportSummaryDto(
      id: id == const $CopyWithPlaceholder()
          ? _value.id
          // ignore: cast_nullable_to_non_nullable
          : id as String,
      name: name == const $CopyWithPlaceholder()
          ? _value.name
          // ignore: cast_nullable_to_non_nullable
          : name as String,
      cible: cible == const $CopyWithPlaceholder()
          ? _value.cible
          // ignore: cast_nullable_to_non_nullable
          : cible as LotExportCible,
      projet: projet == const $CopyWithPlaceholder()
          ? _value.projet
          // ignore: cast_nullable_to_non_nullable
          : projet as Projet,
      scopeLabel: scopeLabel == const $CopyWithPlaceholder()
          ? _value.scopeLabel
          // ignore: cast_nullable_to_non_nullable
          : scopeLabel as String,
      itemCount: itemCount == const $CopyWithPlaceholder()
          ? _value.itemCount
          // ignore: cast_nullable_to_non_nullable
          : itemCount as num,
      createdById: createdById == const $CopyWithPlaceholder()
          ? _value.createdById
          // ignore: cast_nullable_to_non_nullable
          : createdById as String,
      createdByName: createdByName == const $CopyWithPlaceholder()
          ? _value.createdByName
          // ignore: cast_nullable_to_non_nullable
          : createdByName as String,
      createdAt: createdAt == const $CopyWithPlaceholder()
          ? _value.createdAt
          // ignore: cast_nullable_to_non_nullable
          : createdAt as String,
      callsSince: callsSince == const $CopyWithPlaceholder()
          ? _value.callsSince
          // ignore: cast_nullable_to_non_nullable
          : callsSince as num,
      fichesAppelees: fichesAppelees == const $CopyWithPlaceholder()
          ? _value.fichesAppelees
          // ignore: cast_nullable_to_non_nullable
          : fichesAppelees as num,
    );
  }
}

extension $LotExportSummaryDtoCopyWith on LotExportSummaryDto {
  /// Returns a callable class that can be used as follows: `instanceOfLotExportSummaryDto.copyWith(...)` or like so:`instanceOfLotExportSummaryDto.copyWith.fieldName(...)`.
  // ignore: library_private_types_in_public_api
  _$LotExportSummaryDtoCWProxy get copyWith =>
      _$LotExportSummaryDtoCWProxyImpl(this);
}

// **************************************************************************
// JsonSerializableGenerator
// **************************************************************************

LotExportSummaryDto _$LotExportSummaryDtoFromJson(Map<String, dynamic> json) =>
    $checkedCreate('LotExportSummaryDto', json, ($checkedConvert) {
      $checkKeys(
        json,
        requiredKeys: const [
          'id',
          'name',
          'cible',
          'projet',
          'scopeLabel',
          'itemCount',
          'createdById',
          'createdByName',
          'createdAt',
          'callsSince',
          'fichesAppelees',
        ],
      );
      final val = LotExportSummaryDto(
        id: $checkedConvert('id', (v) => v as String),
        name: $checkedConvert('name', (v) => v as String),
        cible: $checkedConvert(
          'cible',
          (v) => $enumDecode(
            _$LotExportCibleEnumMap,
            v,
            unknownValue: LotExportCible.unknownDefaultOpenApi,
          ),
        ),
        projet: $checkedConvert(
          'projet',
          (v) => $enumDecode(
            _$ProjetEnumMap,
            v,
            unknownValue: Projet.unknownDefaultOpenApi,
          ),
        ),
        scopeLabel: $checkedConvert('scopeLabel', (v) => v as String),
        itemCount: $checkedConvert('itemCount', (v) => v as num),
        createdById: $checkedConvert('createdById', (v) => v as String),
        createdByName: $checkedConvert('createdByName', (v) => v as String),
        createdAt: $checkedConvert('createdAt', (v) => v as String),
        callsSince: $checkedConvert('callsSince', (v) => v as num),
        fichesAppelees: $checkedConvert('fichesAppelees', (v) => v as num),
      );
      return val;
    });

Map<String, dynamic> _$LotExportSummaryDtoToJson(
  LotExportSummaryDto instance,
) => <String, dynamic>{
  'id': instance.id,
  'name': instance.name,
  'cible': _$LotExportCibleEnumMap[instance.cible]!,
  'projet': _$ProjetEnumMap[instance.projet]!,
  'scopeLabel': instance.scopeLabel,
  'itemCount': instance.itemCount,
  'createdById': instance.createdById,
  'createdByName': instance.createdByName,
  'createdAt': instance.createdAt,
  'callsSince': instance.callsSince,
  'fichesAppelees': instance.fichesAppelees,
};

const _$LotExportCibleEnumMap = {
  LotExportCible.REPRESENTANTS: 'REPRESENTANTS',
  LotExportCible.PROSPECTS: 'PROSPECTS',
  LotExportCible.unknownDefaultOpenApi: 'unknown_default_open_api',
};

const _$ProjetEnumMap = {
  Projet.CHUES: 'CHUES',
  Projet.GRAND_PUBLIC: 'GRAND_PUBLIC',
  Projet.unknownDefaultOpenApi: 'unknown_default_open_api',
};

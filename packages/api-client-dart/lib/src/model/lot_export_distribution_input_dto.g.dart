// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'lot_export_distribution_input_dto.dart';

// **************************************************************************
// CopyWithGenerator
// **************************************************************************

abstract class _$LotExportDistributionInputDtoCWProxy {
  LotExportDistributionInputDto teleconseillerIds(
    List<String> teleconseillerIds,
  );

  LotExportDistributionInputDto fichesParJour(num? fichesParJour);

  LotExportDistributionInputDto jours(num? jours);

  LotExportDistributionInputDto objectifs(
    List<LotExportObjectifDto>? objectifs,
  );

  /// This function **does support** nullification of nullable fields. All `null` values passed to `non-nullable` fields will be ignored. You can also use `LotExportDistributionInputDto(...).copyWith.fieldName(...)` to override fields one at a time with nullification support.
  ///
  /// Usage
  /// ```dart
  /// LotExportDistributionInputDto(...).copyWith(id: 12, name: "My name")
  /// ````
  LotExportDistributionInputDto call({
    List<String> teleconseillerIds,
    num? fichesParJour,
    num? jours,
    List<LotExportObjectifDto>? objectifs,
  });
}

/// Proxy class for `copyWith` functionality. This is a callable class and can be used as follows: `instanceOfLotExportDistributionInputDto.copyWith(...)`. Additionally contains functions for specific fields e.g. `instanceOfLotExportDistributionInputDto.copyWith.fieldName(...)`
class _$LotExportDistributionInputDtoCWProxyImpl
    implements _$LotExportDistributionInputDtoCWProxy {
  const _$LotExportDistributionInputDtoCWProxyImpl(this._value);

  final LotExportDistributionInputDto _value;

  @override
  LotExportDistributionInputDto teleconseillerIds(
    List<String> teleconseillerIds,
  ) => this(teleconseillerIds: teleconseillerIds);

  @override
  LotExportDistributionInputDto fichesParJour(num? fichesParJour) =>
      this(fichesParJour: fichesParJour);

  @override
  LotExportDistributionInputDto jours(num? jours) => this(jours: jours);

  @override
  LotExportDistributionInputDto objectifs(
    List<LotExportObjectifDto>? objectifs,
  ) => this(objectifs: objectifs);

  @override
  /// This function **does support** nullification of nullable fields. All `null` values passed to `non-nullable` fields will be ignored. You can also use `LotExportDistributionInputDto(...).copyWith.fieldName(...)` to override fields one at a time with nullification support.
  ///
  /// Usage
  /// ```dart
  /// LotExportDistributionInputDto(...).copyWith(id: 12, name: "My name")
  /// ````
  LotExportDistributionInputDto call({
    Object? teleconseillerIds = const $CopyWithPlaceholder(),
    Object? fichesParJour = const $CopyWithPlaceholder(),
    Object? jours = const $CopyWithPlaceholder(),
    Object? objectifs = const $CopyWithPlaceholder(),
  }) {
    return LotExportDistributionInputDto(
      teleconseillerIds: teleconseillerIds == const $CopyWithPlaceholder()
          ? _value.teleconseillerIds
          // ignore: cast_nullable_to_non_nullable
          : teleconseillerIds as List<String>,
      fichesParJour: fichesParJour == const $CopyWithPlaceholder()
          ? _value.fichesParJour
          // ignore: cast_nullable_to_non_nullable
          : fichesParJour as num?,
      jours: jours == const $CopyWithPlaceholder()
          ? _value.jours
          // ignore: cast_nullable_to_non_nullable
          : jours as num?,
      objectifs: objectifs == const $CopyWithPlaceholder()
          ? _value.objectifs
          // ignore: cast_nullable_to_non_nullable
          : objectifs as List<LotExportObjectifDto>?,
    );
  }
}

extension $LotExportDistributionInputDtoCopyWith
    on LotExportDistributionInputDto {
  /// Returns a callable class that can be used as follows: `instanceOfLotExportDistributionInputDto.copyWith(...)` or like so:`instanceOfLotExportDistributionInputDto.copyWith.fieldName(...)`.
  // ignore: library_private_types_in_public_api
  _$LotExportDistributionInputDtoCWProxy get copyWith =>
      _$LotExportDistributionInputDtoCWProxyImpl(this);
}

// **************************************************************************
// JsonSerializableGenerator
// **************************************************************************

LotExportDistributionInputDto _$LotExportDistributionInputDtoFromJson(
  Map<String, dynamic> json,
) => $checkedCreate('LotExportDistributionInputDto', json, ($checkedConvert) {
  $checkKeys(json, requiredKeys: const ['teleconseillerIds']);
  final val = LotExportDistributionInputDto(
    teleconseillerIds: $checkedConvert(
      'teleconseillerIds',
      (v) => (v as List<dynamic>).map((e) => e as String).toList(),
    ),
    fichesParJour: $checkedConvert('fichesParJour', (v) => v as num? ?? 50),
    jours: $checkedConvert('jours', (v) => v as num? ?? 1),
    objectifs: $checkedConvert(
      'objectifs',
      (v) => (v as List<dynamic>?)
          ?.map((e) => LotExportObjectifDto.fromJson(e as Map<String, dynamic>))
          .toList(),
    ),
  );
  return val;
});

Map<String, dynamic> _$LotExportDistributionInputDtoToJson(
  LotExportDistributionInputDto instance,
) => <String, dynamic>{
  'teleconseillerIds': instance.teleconseillerIds,
  if (instance.fichesParJour case final value?) 'fichesParJour': value,
  if (instance.jours case final value?) 'jours': value,
  if (instance.objectifs?.map((e) => e.toJson()).toList() case final value?)
    'objectifs': value,
};

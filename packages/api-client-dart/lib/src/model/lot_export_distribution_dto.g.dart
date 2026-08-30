// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'lot_export_distribution_dto.dart';

// **************************************************************************
// CopyWithGenerator
// **************************************************************************

abstract class _$LotExportDistributionDtoCWProxy {
  LotExportDistributionDto fichesParJour(num fichesParJour);

  LotExportDistributionDto jours(num jours);

  /// This function **does support** nullification of nullable fields. All `null` values passed to `non-nullable` fields will be ignored. You can also use `LotExportDistributionDto(...).copyWith.fieldName(...)` to override fields one at a time with nullification support.
  ///
  /// Usage
  /// ```dart
  /// LotExportDistributionDto(...).copyWith(id: 12, name: "My name")
  /// ````
  LotExportDistributionDto call({num fichesParJour, num jours});
}

/// Proxy class for `copyWith` functionality. This is a callable class and can be used as follows: `instanceOfLotExportDistributionDto.copyWith(...)`. Additionally contains functions for specific fields e.g. `instanceOfLotExportDistributionDto.copyWith.fieldName(...)`
class _$LotExportDistributionDtoCWProxyImpl
    implements _$LotExportDistributionDtoCWProxy {
  const _$LotExportDistributionDtoCWProxyImpl(this._value);

  final LotExportDistributionDto _value;

  @override
  LotExportDistributionDto fichesParJour(num fichesParJour) =>
      this(fichesParJour: fichesParJour);

  @override
  LotExportDistributionDto jours(num jours) => this(jours: jours);

  @override
  /// This function **does support** nullification of nullable fields. All `null` values passed to `non-nullable` fields will be ignored. You can also use `LotExportDistributionDto(...).copyWith.fieldName(...)` to override fields one at a time with nullification support.
  ///
  /// Usage
  /// ```dart
  /// LotExportDistributionDto(...).copyWith(id: 12, name: "My name")
  /// ````
  LotExportDistributionDto call({
    Object? fichesParJour = const $CopyWithPlaceholder(),
    Object? jours = const $CopyWithPlaceholder(),
  }) {
    return LotExportDistributionDto(
      fichesParJour: fichesParJour == const $CopyWithPlaceholder()
          ? _value.fichesParJour
          // ignore: cast_nullable_to_non_nullable
          : fichesParJour as num,
      jours: jours == const $CopyWithPlaceholder()
          ? _value.jours
          // ignore: cast_nullable_to_non_nullable
          : jours as num,
    );
  }
}

extension $LotExportDistributionDtoCopyWith on LotExportDistributionDto {
  /// Returns a callable class that can be used as follows: `instanceOfLotExportDistributionDto.copyWith(...)` or like so:`instanceOfLotExportDistributionDto.copyWith.fieldName(...)`.
  // ignore: library_private_types_in_public_api
  _$LotExportDistributionDtoCWProxy get copyWith =>
      _$LotExportDistributionDtoCWProxyImpl(this);
}

// **************************************************************************
// JsonSerializableGenerator
// **************************************************************************

LotExportDistributionDto _$LotExportDistributionDtoFromJson(
  Map<String, dynamic> json,
) => $checkedCreate('LotExportDistributionDto', json, ($checkedConvert) {
  $checkKeys(json, requiredKeys: const ['fichesParJour', 'jours']);
  final val = LotExportDistributionDto(
    fichesParJour: $checkedConvert('fichesParJour', (v) => v as num),
    jours: $checkedConvert('jours', (v) => v as num),
  );
  return val;
});

Map<String, dynamic> _$LotExportDistributionDtoToJson(
  LotExportDistributionDto instance,
) => <String, dynamic>{
  'fichesParJour': instance.fichesParJour,
  'jours': instance.jours,
};

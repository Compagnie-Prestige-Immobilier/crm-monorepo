// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'lot_export_objectif_dto.dart';

// **************************************************************************
// CopyWithGenerator
// **************************************************************************

abstract class _$LotExportObjectifDtoCWProxy {
  LotExportObjectifDto teleconseillerId(String teleconseillerId);

  LotExportObjectifDto fichesParJour(num fichesParJour);

  /// This function **does support** nullification of nullable fields. All `null` values passed to `non-nullable` fields will be ignored. You can also use `LotExportObjectifDto(...).copyWith.fieldName(...)` to override fields one at a time with nullification support.
  ///
  /// Usage
  /// ```dart
  /// LotExportObjectifDto(...).copyWith(id: 12, name: "My name")
  /// ````
  LotExportObjectifDto call({String teleconseillerId, num fichesParJour});
}

/// Proxy class for `copyWith` functionality. This is a callable class and can be used as follows: `instanceOfLotExportObjectifDto.copyWith(...)`. Additionally contains functions for specific fields e.g. `instanceOfLotExportObjectifDto.copyWith.fieldName(...)`
class _$LotExportObjectifDtoCWProxyImpl
    implements _$LotExportObjectifDtoCWProxy {
  const _$LotExportObjectifDtoCWProxyImpl(this._value);

  final LotExportObjectifDto _value;

  @override
  LotExportObjectifDto teleconseillerId(String teleconseillerId) =>
      this(teleconseillerId: teleconseillerId);

  @override
  LotExportObjectifDto fichesParJour(num fichesParJour) =>
      this(fichesParJour: fichesParJour);

  @override
  /// This function **does support** nullification of nullable fields. All `null` values passed to `non-nullable` fields will be ignored. You can also use `LotExportObjectifDto(...).copyWith.fieldName(...)` to override fields one at a time with nullification support.
  ///
  /// Usage
  /// ```dart
  /// LotExportObjectifDto(...).copyWith(id: 12, name: "My name")
  /// ````
  LotExportObjectifDto call({
    Object? teleconseillerId = const $CopyWithPlaceholder(),
    Object? fichesParJour = const $CopyWithPlaceholder(),
  }) {
    return LotExportObjectifDto(
      teleconseillerId: teleconseillerId == const $CopyWithPlaceholder()
          ? _value.teleconseillerId
          // ignore: cast_nullable_to_non_nullable
          : teleconseillerId as String,
      fichesParJour: fichesParJour == const $CopyWithPlaceholder()
          ? _value.fichesParJour
          // ignore: cast_nullable_to_non_nullable
          : fichesParJour as num,
    );
  }
}

extension $LotExportObjectifDtoCopyWith on LotExportObjectifDto {
  /// Returns a callable class that can be used as follows: `instanceOfLotExportObjectifDto.copyWith(...)` or like so:`instanceOfLotExportObjectifDto.copyWith.fieldName(...)`.
  // ignore: library_private_types_in_public_api
  _$LotExportObjectifDtoCWProxy get copyWith =>
      _$LotExportObjectifDtoCWProxyImpl(this);
}

// **************************************************************************
// JsonSerializableGenerator
// **************************************************************************

LotExportObjectifDto _$LotExportObjectifDtoFromJson(
  Map<String, dynamic> json,
) => $checkedCreate('LotExportObjectifDto', json, ($checkedConvert) {
  $checkKeys(json, requiredKeys: const ['teleconseillerId', 'fichesParJour']);
  final val = LotExportObjectifDto(
    teleconseillerId: $checkedConvert('teleconseillerId', (v) => v as String),
    fichesParJour: $checkedConvert('fichesParJour', (v) => v as num),
  );
  return val;
});

Map<String, dynamic> _$LotExportObjectifDtoToJson(
  LotExportObjectifDto instance,
) => <String, dynamic>{
  'teleconseillerId': instance.teleconseillerId,
  'fichesParJour': instance.fichesParJour,
};

// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'reaffecter_lot_export_dto.dart';

// **************************************************************************
// CopyWithGenerator
// **************************************************************************

abstract class _$ReaffecterLotExportDtoCWProxy {
  ReaffecterLotExportDto positions(List<num> positions);

  ReaffecterLotExportDto versTeleconseillerId(String versTeleconseillerId);

  /// This function **does support** nullification of nullable fields. All `null` values passed to `non-nullable` fields will be ignored. You can also use `ReaffecterLotExportDto(...).copyWith.fieldName(...)` to override fields one at a time with nullification support.
  ///
  /// Usage
  /// ```dart
  /// ReaffecterLotExportDto(...).copyWith(id: 12, name: "My name")
  /// ````
  ReaffecterLotExportDto call({
    List<num> positions,
    String versTeleconseillerId,
  });
}

/// Proxy class for `copyWith` functionality. This is a callable class and can be used as follows: `instanceOfReaffecterLotExportDto.copyWith(...)`. Additionally contains functions for specific fields e.g. `instanceOfReaffecterLotExportDto.copyWith.fieldName(...)`
class _$ReaffecterLotExportDtoCWProxyImpl
    implements _$ReaffecterLotExportDtoCWProxy {
  const _$ReaffecterLotExportDtoCWProxyImpl(this._value);

  final ReaffecterLotExportDto _value;

  @override
  ReaffecterLotExportDto positions(List<num> positions) =>
      this(positions: positions);

  @override
  ReaffecterLotExportDto versTeleconseillerId(String versTeleconseillerId) =>
      this(versTeleconseillerId: versTeleconseillerId);

  @override
  /// This function **does support** nullification of nullable fields. All `null` values passed to `non-nullable` fields will be ignored. You can also use `ReaffecterLotExportDto(...).copyWith.fieldName(...)` to override fields one at a time with nullification support.
  ///
  /// Usage
  /// ```dart
  /// ReaffecterLotExportDto(...).copyWith(id: 12, name: "My name")
  /// ````
  ReaffecterLotExportDto call({
    Object? positions = const $CopyWithPlaceholder(),
    Object? versTeleconseillerId = const $CopyWithPlaceholder(),
  }) {
    return ReaffecterLotExportDto(
      positions: positions == const $CopyWithPlaceholder()
          ? _value.positions
          // ignore: cast_nullable_to_non_nullable
          : positions as List<num>,
      versTeleconseillerId: versTeleconseillerId == const $CopyWithPlaceholder()
          ? _value.versTeleconseillerId
          // ignore: cast_nullable_to_non_nullable
          : versTeleconseillerId as String,
    );
  }
}

extension $ReaffecterLotExportDtoCopyWith on ReaffecterLotExportDto {
  /// Returns a callable class that can be used as follows: `instanceOfReaffecterLotExportDto.copyWith(...)` or like so:`instanceOfReaffecterLotExportDto.copyWith.fieldName(...)`.
  // ignore: library_private_types_in_public_api
  _$ReaffecterLotExportDtoCWProxy get copyWith =>
      _$ReaffecterLotExportDtoCWProxyImpl(this);
}

// **************************************************************************
// JsonSerializableGenerator
// **************************************************************************

ReaffecterLotExportDto _$ReaffecterLotExportDtoFromJson(
  Map<String, dynamic> json,
) => $checkedCreate('ReaffecterLotExportDto', json, ($checkedConvert) {
  $checkKeys(json, requiredKeys: const ['positions', 'versTeleconseillerId']);
  final val = ReaffecterLotExportDto(
    positions: $checkedConvert(
      'positions',
      (v) => (v as List<dynamic>).map((e) => e as num).toList(),
    ),
    versTeleconseillerId: $checkedConvert(
      'versTeleconseillerId',
      (v) => v as String,
    ),
  );
  return val;
});

Map<String, dynamic> _$ReaffecterLotExportDtoToJson(
  ReaffecterLotExportDto instance,
) => <String, dynamic>{
  'positions': instance.positions,
  'versTeleconseillerId': instance.versTeleconseillerId,
};

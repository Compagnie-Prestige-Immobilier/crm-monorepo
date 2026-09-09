// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'lot_export_reaffectation_dto.dart';

// **************************************************************************
// CopyWithGenerator
// **************************************************************************

abstract class _$LotExportReaffectationDtoCWProxy {
  LotExportReaffectationDto id(String id);

  LotExportReaffectationDto fromName(String? fromName);

  LotExportReaffectationDto toTeleconseillerId(String toTeleconseillerId);

  LotExportReaffectationDto toName(String toName);

  LotExportReaffectationDto fiches(num fiches);

  LotExportReaffectationDto fichesEnMain(num fichesEnMain);

  LotExportReaffectationDto performedByName(String performedByName);

  LotExportReaffectationDto createdAt(String createdAt);

  /// This function **does support** nullification of nullable fields. All `null` values passed to `non-nullable` fields will be ignored. You can also use `LotExportReaffectationDto(...).copyWith.fieldName(...)` to override fields one at a time with nullification support.
  ///
  /// Usage
  /// ```dart
  /// LotExportReaffectationDto(...).copyWith(id: 12, name: "My name")
  /// ````
  LotExportReaffectationDto call({
    String id,
    String? fromName,
    String toTeleconseillerId,
    String toName,
    num fiches,
    num fichesEnMain,
    String performedByName,
    String createdAt,
  });
}

/// Proxy class for `copyWith` functionality. This is a callable class and can be used as follows: `instanceOfLotExportReaffectationDto.copyWith(...)`. Additionally contains functions for specific fields e.g. `instanceOfLotExportReaffectationDto.copyWith.fieldName(...)`
class _$LotExportReaffectationDtoCWProxyImpl
    implements _$LotExportReaffectationDtoCWProxy {
  const _$LotExportReaffectationDtoCWProxyImpl(this._value);

  final LotExportReaffectationDto _value;

  @override
  LotExportReaffectationDto id(String id) => this(id: id);

  @override
  LotExportReaffectationDto fromName(String? fromName) =>
      this(fromName: fromName);

  @override
  LotExportReaffectationDto toTeleconseillerId(String toTeleconseillerId) =>
      this(toTeleconseillerId: toTeleconseillerId);

  @override
  LotExportReaffectationDto toName(String toName) => this(toName: toName);

  @override
  LotExportReaffectationDto fiches(num fiches) => this(fiches: fiches);

  @override
  LotExportReaffectationDto fichesEnMain(num fichesEnMain) =>
      this(fichesEnMain: fichesEnMain);

  @override
  LotExportReaffectationDto performedByName(String performedByName) =>
      this(performedByName: performedByName);

  @override
  LotExportReaffectationDto createdAt(String createdAt) =>
      this(createdAt: createdAt);

  @override
  /// This function **does support** nullification of nullable fields. All `null` values passed to `non-nullable` fields will be ignored. You can also use `LotExportReaffectationDto(...).copyWith.fieldName(...)` to override fields one at a time with nullification support.
  ///
  /// Usage
  /// ```dart
  /// LotExportReaffectationDto(...).copyWith(id: 12, name: "My name")
  /// ````
  LotExportReaffectationDto call({
    Object? id = const $CopyWithPlaceholder(),
    Object? fromName = const $CopyWithPlaceholder(),
    Object? toTeleconseillerId = const $CopyWithPlaceholder(),
    Object? toName = const $CopyWithPlaceholder(),
    Object? fiches = const $CopyWithPlaceholder(),
    Object? fichesEnMain = const $CopyWithPlaceholder(),
    Object? performedByName = const $CopyWithPlaceholder(),
    Object? createdAt = const $CopyWithPlaceholder(),
  }) {
    return LotExportReaffectationDto(
      id: id == const $CopyWithPlaceholder()
          ? _value.id
          // ignore: cast_nullable_to_non_nullable
          : id as String,
      fromName: fromName == const $CopyWithPlaceholder()
          ? _value.fromName
          // ignore: cast_nullable_to_non_nullable
          : fromName as String?,
      toTeleconseillerId: toTeleconseillerId == const $CopyWithPlaceholder()
          ? _value.toTeleconseillerId
          // ignore: cast_nullable_to_non_nullable
          : toTeleconseillerId as String,
      toName: toName == const $CopyWithPlaceholder()
          ? _value.toName
          // ignore: cast_nullable_to_non_nullable
          : toName as String,
      fiches: fiches == const $CopyWithPlaceholder()
          ? _value.fiches
          // ignore: cast_nullable_to_non_nullable
          : fiches as num,
      fichesEnMain: fichesEnMain == const $CopyWithPlaceholder()
          ? _value.fichesEnMain
          // ignore: cast_nullable_to_non_nullable
          : fichesEnMain as num,
      performedByName: performedByName == const $CopyWithPlaceholder()
          ? _value.performedByName
          // ignore: cast_nullable_to_non_nullable
          : performedByName as String,
      createdAt: createdAt == const $CopyWithPlaceholder()
          ? _value.createdAt
          // ignore: cast_nullable_to_non_nullable
          : createdAt as String,
    );
  }
}

extension $LotExportReaffectationDtoCopyWith on LotExportReaffectationDto {
  /// Returns a callable class that can be used as follows: `instanceOfLotExportReaffectationDto.copyWith(...)` or like so:`instanceOfLotExportReaffectationDto.copyWith.fieldName(...)`.
  // ignore: library_private_types_in_public_api
  _$LotExportReaffectationDtoCWProxy get copyWith =>
      _$LotExportReaffectationDtoCWProxyImpl(this);
}

// **************************************************************************
// JsonSerializableGenerator
// **************************************************************************

LotExportReaffectationDto _$LotExportReaffectationDtoFromJson(
  Map<String, dynamic> json,
) => $checkedCreate('LotExportReaffectationDto', json, ($checkedConvert) {
  $checkKeys(
    json,
    requiredKeys: const [
      'id',
      'fromName',
      'toTeleconseillerId',
      'toName',
      'fiches',
      'fichesEnMain',
      'performedByName',
      'createdAt',
    ],
  );
  final val = LotExportReaffectationDto(
    id: $checkedConvert('id', (v) => v as String),
    fromName: $checkedConvert('fromName', (v) => v as String?),
    toTeleconseillerId: $checkedConvert(
      'toTeleconseillerId',
      (v) => v as String,
    ),
    toName: $checkedConvert('toName', (v) => v as String),
    fiches: $checkedConvert('fiches', (v) => v as num),
    fichesEnMain: $checkedConvert('fichesEnMain', (v) => v as num),
    performedByName: $checkedConvert('performedByName', (v) => v as String),
    createdAt: $checkedConvert('createdAt', (v) => v as String),
  );
  return val;
});

Map<String, dynamic> _$LotExportReaffectationDtoToJson(
  LotExportReaffectationDto instance,
) => <String, dynamic>{
  'id': instance.id,
  'fromName': instance.fromName,
  'toTeleconseillerId': instance.toTeleconseillerId,
  'toName': instance.toName,
  'fiches': instance.fiches,
  'fichesEnMain': instance.fichesEnMain,
  'performedByName': instance.performedByName,
  'createdAt': instance.createdAt,
};

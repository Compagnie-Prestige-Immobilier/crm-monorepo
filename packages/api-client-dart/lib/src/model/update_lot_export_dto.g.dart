// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'update_lot_export_dto.dart';

// **************************************************************************
// CopyWithGenerator
// **************************************************************************

abstract class _$UpdateLotExportDtoCWProxy {
  UpdateLotExportDto name(String? name);

  UpdateLotExportDto objectifs(List<LotExportObjectifDto>? objectifs);

  /// This function **does support** nullification of nullable fields. All `null` values passed to `non-nullable` fields will be ignored. You can also use `UpdateLotExportDto(...).copyWith.fieldName(...)` to override fields one at a time with nullification support.
  ///
  /// Usage
  /// ```dart
  /// UpdateLotExportDto(...).copyWith(id: 12, name: "My name")
  /// ````
  UpdateLotExportDto call({
    String? name,
    List<LotExportObjectifDto>? objectifs,
  });
}

/// Proxy class for `copyWith` functionality. This is a callable class and can be used as follows: `instanceOfUpdateLotExportDto.copyWith(...)`. Additionally contains functions for specific fields e.g. `instanceOfUpdateLotExportDto.copyWith.fieldName(...)`
class _$UpdateLotExportDtoCWProxyImpl implements _$UpdateLotExportDtoCWProxy {
  const _$UpdateLotExportDtoCWProxyImpl(this._value);

  final UpdateLotExportDto _value;

  @override
  UpdateLotExportDto name(String? name) => this(name: name);

  @override
  UpdateLotExportDto objectifs(List<LotExportObjectifDto>? objectifs) =>
      this(objectifs: objectifs);

  @override
  /// This function **does support** nullification of nullable fields. All `null` values passed to `non-nullable` fields will be ignored. You can also use `UpdateLotExportDto(...).copyWith.fieldName(...)` to override fields one at a time with nullification support.
  ///
  /// Usage
  /// ```dart
  /// UpdateLotExportDto(...).copyWith(id: 12, name: "My name")
  /// ````
  UpdateLotExportDto call({
    Object? name = const $CopyWithPlaceholder(),
    Object? objectifs = const $CopyWithPlaceholder(),
  }) {
    return UpdateLotExportDto(
      name: name == const $CopyWithPlaceholder()
          ? _value.name
          // ignore: cast_nullable_to_non_nullable
          : name as String?,
      objectifs: objectifs == const $CopyWithPlaceholder()
          ? _value.objectifs
          // ignore: cast_nullable_to_non_nullable
          : objectifs as List<LotExportObjectifDto>?,
    );
  }
}

extension $UpdateLotExportDtoCopyWith on UpdateLotExportDto {
  /// Returns a callable class that can be used as follows: `instanceOfUpdateLotExportDto.copyWith(...)` or like so:`instanceOfUpdateLotExportDto.copyWith.fieldName(...)`.
  // ignore: library_private_types_in_public_api
  _$UpdateLotExportDtoCWProxy get copyWith =>
      _$UpdateLotExportDtoCWProxyImpl(this);
}

// **************************************************************************
// JsonSerializableGenerator
// **************************************************************************

UpdateLotExportDto _$UpdateLotExportDtoFromJson(Map<String, dynamic> json) =>
    $checkedCreate('UpdateLotExportDto', json, ($checkedConvert) {
      final val = UpdateLotExportDto(
        name: $checkedConvert('name', (v) => v as String?),
        objectifs: $checkedConvert(
          'objectifs',
          (v) => (v as List<dynamic>?)
              ?.map(
                (e) => LotExportObjectifDto.fromJson(e as Map<String, dynamic>),
              )
              .toList(),
        ),
      );
      return val;
    });

Map<String, dynamic> _$UpdateLotExportDtoToJson(UpdateLotExportDto instance) =>
    <String, dynamic>{
      if (instance.name case final value?) 'name': value,
      if (instance.objectifs?.map((e) => e.toJson()).toList() case final value?)
        'objectifs': value,
    };

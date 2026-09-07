// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'lot_export_repartition_dto.dart';

// **************************************************************************
// CopyWithGenerator
// **************************************************************************

abstract class _$LotExportRepartitionDtoCWProxy {
  LotExportRepartitionDto teleconseillerId(String teleconseillerId);

  LotExportRepartitionDto teleconseillerName(String teleconseillerName);

  LotExportRepartitionDto jours(List<LotExportRepartitionJourDto> jours);

  LotExportRepartitionDto recues(num recues);

  /// This function **does support** nullification of nullable fields. All `null` values passed to `non-nullable` fields will be ignored. You can also use `LotExportRepartitionDto(...).copyWith.fieldName(...)` to override fields one at a time with nullification support.
  ///
  /// Usage
  /// ```dart
  /// LotExportRepartitionDto(...).copyWith(id: 12, name: "My name")
  /// ````
  LotExportRepartitionDto call({
    String teleconseillerId,
    String teleconseillerName,
    List<LotExportRepartitionJourDto> jours,
    num recues,
  });
}

/// Proxy class for `copyWith` functionality. This is a callable class and can be used as follows: `instanceOfLotExportRepartitionDto.copyWith(...)`. Additionally contains functions for specific fields e.g. `instanceOfLotExportRepartitionDto.copyWith.fieldName(...)`
class _$LotExportRepartitionDtoCWProxyImpl
    implements _$LotExportRepartitionDtoCWProxy {
  const _$LotExportRepartitionDtoCWProxyImpl(this._value);

  final LotExportRepartitionDto _value;

  @override
  LotExportRepartitionDto teleconseillerId(String teleconseillerId) =>
      this(teleconseillerId: teleconseillerId);

  @override
  LotExportRepartitionDto teleconseillerName(String teleconseillerName) =>
      this(teleconseillerName: teleconseillerName);

  @override
  LotExportRepartitionDto jours(List<LotExportRepartitionJourDto> jours) =>
      this(jours: jours);

  @override
  LotExportRepartitionDto recues(num recues) => this(recues: recues);

  @override
  /// This function **does support** nullification of nullable fields. All `null` values passed to `non-nullable` fields will be ignored. You can also use `LotExportRepartitionDto(...).copyWith.fieldName(...)` to override fields one at a time with nullification support.
  ///
  /// Usage
  /// ```dart
  /// LotExportRepartitionDto(...).copyWith(id: 12, name: "My name")
  /// ````
  LotExportRepartitionDto call({
    Object? teleconseillerId = const $CopyWithPlaceholder(),
    Object? teleconseillerName = const $CopyWithPlaceholder(),
    Object? jours = const $CopyWithPlaceholder(),
    Object? recues = const $CopyWithPlaceholder(),
  }) {
    return LotExportRepartitionDto(
      teleconseillerId: teleconseillerId == const $CopyWithPlaceholder()
          ? _value.teleconseillerId
          // ignore: cast_nullable_to_non_nullable
          : teleconseillerId as String,
      teleconseillerName: teleconseillerName == const $CopyWithPlaceholder()
          ? _value.teleconseillerName
          // ignore: cast_nullable_to_non_nullable
          : teleconseillerName as String,
      jours: jours == const $CopyWithPlaceholder()
          ? _value.jours
          // ignore: cast_nullable_to_non_nullable
          : jours as List<LotExportRepartitionJourDto>,
      recues: recues == const $CopyWithPlaceholder()
          ? _value.recues
          // ignore: cast_nullable_to_non_nullable
          : recues as num,
    );
  }
}

extension $LotExportRepartitionDtoCopyWith on LotExportRepartitionDto {
  /// Returns a callable class that can be used as follows: `instanceOfLotExportRepartitionDto.copyWith(...)` or like so:`instanceOfLotExportRepartitionDto.copyWith.fieldName(...)`.
  // ignore: library_private_types_in_public_api
  _$LotExportRepartitionDtoCWProxy get copyWith =>
      _$LotExportRepartitionDtoCWProxyImpl(this);
}

// **************************************************************************
// JsonSerializableGenerator
// **************************************************************************

LotExportRepartitionDto _$LotExportRepartitionDtoFromJson(
  Map<String, dynamic> json,
) => $checkedCreate('LotExportRepartitionDto', json, ($checkedConvert) {
  $checkKeys(
    json,
    requiredKeys: const [
      'teleconseillerId',
      'teleconseillerName',
      'jours',
      'recues',
    ],
  );
  final val = LotExportRepartitionDto(
    teleconseillerId: $checkedConvert('teleconseillerId', (v) => v as String),
    teleconseillerName: $checkedConvert(
      'teleconseillerName',
      (v) => v as String,
    ),
    jours: $checkedConvert(
      'jours',
      (v) => (v as List<dynamic>)
          .map(
            (e) =>
                LotExportRepartitionJourDto.fromJson(e as Map<String, dynamic>),
          )
          .toList(),
    ),
    recues: $checkedConvert('recues', (v) => v as num),
  );
  return val;
});

Map<String, dynamic> _$LotExportRepartitionDtoToJson(
  LotExportRepartitionDto instance,
) => <String, dynamic>{
  'teleconseillerId': instance.teleconseillerId,
  'teleconseillerName': instance.teleconseillerName,
  'jours': instance.jours.map((e) => e.toJson()).toList(),
  'recues': instance.recues,
};

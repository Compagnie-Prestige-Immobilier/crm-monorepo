// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'lot_export_fiche_dto.dart';

// **************************************************************************
// CopyWithGenerator
// **************************************************************************

abstract class _$LotExportFicheDtoCWProxy {
  LotExportFicheDto position(num position);

  LotExportFicheDto jour(num jour);

  LotExportFicheDto ficheId(String? ficheId);

  LotExportFicheDto fullName(String fullName);

  LotExportFicheDto phoneE164(String phoneE164);

  LotExportFicheDto teleconseillerId(String? teleconseillerId);

  LotExportFicheDto teleconseillerName(String teleconseillerName);

  LotExportFicheDto etat(LotExportFicheEtat etat);

  LotExportFicheDto statutLabel(String? statutLabel);

  /// This function **does support** nullification of nullable fields. All `null` values passed to `non-nullable` fields will be ignored. You can also use `LotExportFicheDto(...).copyWith.fieldName(...)` to override fields one at a time with nullification support.
  ///
  /// Usage
  /// ```dart
  /// LotExportFicheDto(...).copyWith(id: 12, name: "My name")
  /// ````
  LotExportFicheDto call({
    num position,
    num jour,
    String? ficheId,
    String fullName,
    String phoneE164,
    String? teleconseillerId,
    String teleconseillerName,
    LotExportFicheEtat etat,
    String? statutLabel,
  });
}

/// Proxy class for `copyWith` functionality. This is a callable class and can be used as follows: `instanceOfLotExportFicheDto.copyWith(...)`. Additionally contains functions for specific fields e.g. `instanceOfLotExportFicheDto.copyWith.fieldName(...)`
class _$LotExportFicheDtoCWProxyImpl implements _$LotExportFicheDtoCWProxy {
  const _$LotExportFicheDtoCWProxyImpl(this._value);

  final LotExportFicheDto _value;

  @override
  LotExportFicheDto position(num position) => this(position: position);

  @override
  LotExportFicheDto jour(num jour) => this(jour: jour);

  @override
  LotExportFicheDto ficheId(String? ficheId) => this(ficheId: ficheId);

  @override
  LotExportFicheDto fullName(String fullName) => this(fullName: fullName);

  @override
  LotExportFicheDto phoneE164(String phoneE164) => this(phoneE164: phoneE164);

  @override
  LotExportFicheDto teleconseillerId(String? teleconseillerId) =>
      this(teleconseillerId: teleconseillerId);

  @override
  LotExportFicheDto teleconseillerName(String teleconseillerName) =>
      this(teleconseillerName: teleconseillerName);

  @override
  LotExportFicheDto etat(LotExportFicheEtat etat) => this(etat: etat);

  @override
  LotExportFicheDto statutLabel(String? statutLabel) =>
      this(statutLabel: statutLabel);

  @override
  /// This function **does support** nullification of nullable fields. All `null` values passed to `non-nullable` fields will be ignored. You can also use `LotExportFicheDto(...).copyWith.fieldName(...)` to override fields one at a time with nullification support.
  ///
  /// Usage
  /// ```dart
  /// LotExportFicheDto(...).copyWith(id: 12, name: "My name")
  /// ````
  LotExportFicheDto call({
    Object? position = const $CopyWithPlaceholder(),
    Object? jour = const $CopyWithPlaceholder(),
    Object? ficheId = const $CopyWithPlaceholder(),
    Object? fullName = const $CopyWithPlaceholder(),
    Object? phoneE164 = const $CopyWithPlaceholder(),
    Object? teleconseillerId = const $CopyWithPlaceholder(),
    Object? teleconseillerName = const $CopyWithPlaceholder(),
    Object? etat = const $CopyWithPlaceholder(),
    Object? statutLabel = const $CopyWithPlaceholder(),
  }) {
    return LotExportFicheDto(
      position: position == const $CopyWithPlaceholder()
          ? _value.position
          // ignore: cast_nullable_to_non_nullable
          : position as num,
      jour: jour == const $CopyWithPlaceholder()
          ? _value.jour
          // ignore: cast_nullable_to_non_nullable
          : jour as num,
      ficheId: ficheId == const $CopyWithPlaceholder()
          ? _value.ficheId
          // ignore: cast_nullable_to_non_nullable
          : ficheId as String?,
      fullName: fullName == const $CopyWithPlaceholder()
          ? _value.fullName
          // ignore: cast_nullable_to_non_nullable
          : fullName as String,
      phoneE164: phoneE164 == const $CopyWithPlaceholder()
          ? _value.phoneE164
          // ignore: cast_nullable_to_non_nullable
          : phoneE164 as String,
      teleconseillerId: teleconseillerId == const $CopyWithPlaceholder()
          ? _value.teleconseillerId
          // ignore: cast_nullable_to_non_nullable
          : teleconseillerId as String?,
      teleconseillerName: teleconseillerName == const $CopyWithPlaceholder()
          ? _value.teleconseillerName
          // ignore: cast_nullable_to_non_nullable
          : teleconseillerName as String,
      etat: etat == const $CopyWithPlaceholder()
          ? _value.etat
          // ignore: cast_nullable_to_non_nullable
          : etat as LotExportFicheEtat,
      statutLabel: statutLabel == const $CopyWithPlaceholder()
          ? _value.statutLabel
          // ignore: cast_nullable_to_non_nullable
          : statutLabel as String?,
    );
  }
}

extension $LotExportFicheDtoCopyWith on LotExportFicheDto {
  /// Returns a callable class that can be used as follows: `instanceOfLotExportFicheDto.copyWith(...)` or like so:`instanceOfLotExportFicheDto.copyWith.fieldName(...)`.
  // ignore: library_private_types_in_public_api
  _$LotExportFicheDtoCWProxy get copyWith =>
      _$LotExportFicheDtoCWProxyImpl(this);
}

// **************************************************************************
// JsonSerializableGenerator
// **************************************************************************

LotExportFicheDto _$LotExportFicheDtoFromJson(Map<String, dynamic> json) =>
    $checkedCreate('LotExportFicheDto', json, ($checkedConvert) {
      $checkKeys(
        json,
        requiredKeys: const [
          'position',
          'jour',
          'ficheId',
          'fullName',
          'phoneE164',
          'teleconseillerId',
          'teleconseillerName',
          'etat',
          'statutLabel',
        ],
      );
      final val = LotExportFicheDto(
        position: $checkedConvert('position', (v) => v as num),
        jour: $checkedConvert('jour', (v) => v as num),
        ficheId: $checkedConvert('ficheId', (v) => v as String?),
        fullName: $checkedConvert('fullName', (v) => v as String),
        phoneE164: $checkedConvert('phoneE164', (v) => v as String),
        teleconseillerId: $checkedConvert(
          'teleconseillerId',
          (v) => v as String?,
        ),
        teleconseillerName: $checkedConvert(
          'teleconseillerName',
          (v) => v as String,
        ),
        etat: $checkedConvert(
          'etat',
          (v) => $enumDecode(
            _$LotExportFicheEtatEnumMap,
            v,
            unknownValue: LotExportFicheEtat.unknownDefaultOpenApi,
          ),
        ),
        statutLabel: $checkedConvert('statutLabel', (v) => v as String?),
      );
      return val;
    });

Map<String, dynamic> _$LotExportFicheDtoToJson(LotExportFicheDto instance) =>
    <String, dynamic>{
      'position': instance.position,
      'jour': instance.jour,
      'ficheId': instance.ficheId,
      'fullName': instance.fullName,
      'phoneE164': instance.phoneE164,
      'teleconseillerId': instance.teleconseillerId,
      'teleconseillerName': instance.teleconseillerName,
      'etat': _$LotExportFicheEtatEnumMap[instance.etat]!,
      'statutLabel': instance.statutLabel,
    };

const _$LotExportFicheEtatEnumMap = {
  LotExportFicheEtat.NON_TRAITEE: 'NON_TRAITEE',
  LotExportFicheEtat.TRAITEE: 'TRAITEE',
  LotExportFicheEtat.A_RAPPELER: 'A_RAPPELER',
  LotExportFicheEtat.unknownDefaultOpenApi: 'unknown_default_open_api',
};

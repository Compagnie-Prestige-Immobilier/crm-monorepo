// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'enrolement_reglages_dto.dart';

// **************************************************************************
// CopyWithGenerator
// **************************************************************************

abstract class _$EnrolementReglagesDtoCWProxy {
  EnrolementReglagesDto projet(Projet projet);

  EnrolementReglagesDto frequenceMinutes(num frequenceMinutes);

  EnrolementReglagesDto repriseDepuis(DateTime? repriseDepuis);

  EnrolementReglagesDto configuree(bool configuree);

  EnrolementReglagesDto dernierTirage(DernierTirageDto? dernierTirage);

  EnrolementReglagesDto updatedAt(DateTime? updatedAt);

  /// This function **does support** nullification of nullable fields. All `null` values passed to `non-nullable` fields will be ignored. You can also use `EnrolementReglagesDto(...).copyWith.fieldName(...)` to override fields one at a time with nullification support.
  ///
  /// Usage
  /// ```dart
  /// EnrolementReglagesDto(...).copyWith(id: 12, name: "My name")
  /// ````
  EnrolementReglagesDto call({
    Projet projet,
    num frequenceMinutes,
    DateTime? repriseDepuis,
    bool configuree,
    DernierTirageDto? dernierTirage,
    DateTime? updatedAt,
  });
}

/// Proxy class for `copyWith` functionality. This is a callable class and can be used as follows: `instanceOfEnrolementReglagesDto.copyWith(...)`. Additionally contains functions for specific fields e.g. `instanceOfEnrolementReglagesDto.copyWith.fieldName(...)`
class _$EnrolementReglagesDtoCWProxyImpl
    implements _$EnrolementReglagesDtoCWProxy {
  const _$EnrolementReglagesDtoCWProxyImpl(this._value);

  final EnrolementReglagesDto _value;

  @override
  EnrolementReglagesDto projet(Projet projet) => this(projet: projet);

  @override
  EnrolementReglagesDto frequenceMinutes(num frequenceMinutes) =>
      this(frequenceMinutes: frequenceMinutes);

  @override
  EnrolementReglagesDto repriseDepuis(DateTime? repriseDepuis) =>
      this(repriseDepuis: repriseDepuis);

  @override
  EnrolementReglagesDto configuree(bool configuree) =>
      this(configuree: configuree);

  @override
  EnrolementReglagesDto dernierTirage(DernierTirageDto? dernierTirage) =>
      this(dernierTirage: dernierTirage);

  @override
  EnrolementReglagesDto updatedAt(DateTime? updatedAt) =>
      this(updatedAt: updatedAt);

  @override
  /// This function **does support** nullification of nullable fields. All `null` values passed to `non-nullable` fields will be ignored. You can also use `EnrolementReglagesDto(...).copyWith.fieldName(...)` to override fields one at a time with nullification support.
  ///
  /// Usage
  /// ```dart
  /// EnrolementReglagesDto(...).copyWith(id: 12, name: "My name")
  /// ````
  EnrolementReglagesDto call({
    Object? projet = const $CopyWithPlaceholder(),
    Object? frequenceMinutes = const $CopyWithPlaceholder(),
    Object? repriseDepuis = const $CopyWithPlaceholder(),
    Object? configuree = const $CopyWithPlaceholder(),
    Object? dernierTirage = const $CopyWithPlaceholder(),
    Object? updatedAt = const $CopyWithPlaceholder(),
  }) {
    return EnrolementReglagesDto(
      projet: projet == const $CopyWithPlaceholder()
          ? _value.projet
          // ignore: cast_nullable_to_non_nullable
          : projet as Projet,
      frequenceMinutes: frequenceMinutes == const $CopyWithPlaceholder()
          ? _value.frequenceMinutes
          // ignore: cast_nullable_to_non_nullable
          : frequenceMinutes as num,
      repriseDepuis: repriseDepuis == const $CopyWithPlaceholder()
          ? _value.repriseDepuis
          // ignore: cast_nullable_to_non_nullable
          : repriseDepuis as DateTime?,
      configuree: configuree == const $CopyWithPlaceholder()
          ? _value.configuree
          // ignore: cast_nullable_to_non_nullable
          : configuree as bool,
      dernierTirage: dernierTirage == const $CopyWithPlaceholder()
          ? _value.dernierTirage
          // ignore: cast_nullable_to_non_nullable
          : dernierTirage as DernierTirageDto?,
      updatedAt: updatedAt == const $CopyWithPlaceholder()
          ? _value.updatedAt
          // ignore: cast_nullable_to_non_nullable
          : updatedAt as DateTime?,
    );
  }
}

extension $EnrolementReglagesDtoCopyWith on EnrolementReglagesDto {
  /// Returns a callable class that can be used as follows: `instanceOfEnrolementReglagesDto.copyWith(...)` or like so:`instanceOfEnrolementReglagesDto.copyWith.fieldName(...)`.
  // ignore: library_private_types_in_public_api
  _$EnrolementReglagesDtoCWProxy get copyWith =>
      _$EnrolementReglagesDtoCWProxyImpl(this);
}

// **************************************************************************
// JsonSerializableGenerator
// **************************************************************************

EnrolementReglagesDto _$EnrolementReglagesDtoFromJson(
  Map<String, dynamic> json,
) => $checkedCreate('EnrolementReglagesDto', json, ($checkedConvert) {
  $checkKeys(
    json,
    requiredKeys: const [
      'projet',
      'frequenceMinutes',
      'repriseDepuis',
      'configuree',
      'dernierTirage',
      'updatedAt',
    ],
  );
  final val = EnrolementReglagesDto(
    projet: $checkedConvert(
      'projet',
      (v) => $enumDecode(
        _$ProjetEnumMap,
        v,
        unknownValue: Projet.unknownDefaultOpenApi,
      ),
    ),
    frequenceMinutes: $checkedConvert('frequenceMinutes', (v) => v as num),
    repriseDepuis: $checkedConvert(
      'repriseDepuis',
      (v) => v == null ? null : DateTime.parse(v as String),
    ),
    configuree: $checkedConvert('configuree', (v) => v as bool),
    dernierTirage: $checkedConvert(
      'dernierTirage',
      (v) => v == null
          ? null
          : DernierTirageDto.fromJson(v as Map<String, dynamic>),
    ),
    updatedAt: $checkedConvert(
      'updatedAt',
      (v) => v == null ? null : DateTime.parse(v as String),
    ),
  );
  return val;
});

Map<String, dynamic> _$EnrolementReglagesDtoToJson(
  EnrolementReglagesDto instance,
) => <String, dynamic>{
  'projet': _$ProjetEnumMap[instance.projet]!,
  'frequenceMinutes': instance.frequenceMinutes,
  'repriseDepuis': instance.repriseDepuis?.toIso8601String(),
  'configuree': instance.configuree,
  'dernierTirage': instance.dernierTirage?.toJson(),
  'updatedAt': instance.updatedAt?.toIso8601String(),
};

const _$ProjetEnumMap = {
  Projet.CHUES: 'CHUES',
  Projet.GRAND_PUBLIC: 'GRAND_PUBLIC',
  Projet.unknownDefaultOpenApi: 'unknown_default_open_api',
};

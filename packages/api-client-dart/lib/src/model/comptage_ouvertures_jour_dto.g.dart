// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'comptage_ouvertures_jour_dto.dart';

// **************************************************************************
// CopyWithGenerator
// **************************************************************************

abstract class _$ComptageOuverturesJourDtoCWProxy {
  ComptageOuverturesJourDto openedById(String openedById);

  ComptageOuverturesJourDto openedByName(String openedByName);

  ComptageOuverturesJourDto jour(DateTime jour);

  ComptageOuverturesJourDto ouvertures(num ouvertures);

  ComptageOuverturesJourDto qualifiees(num qualifiees);

  ComptageOuverturesJourDto liberees(num liberees);

  ComptageOuverturesJourDto dureeMoyenneSecondes(num? dureeMoyenneSecondes);

  /// This function **does support** nullification of nullable fields. All `null` values passed to `non-nullable` fields will be ignored. You can also use `ComptageOuverturesJourDto(...).copyWith.fieldName(...)` to override fields one at a time with nullification support.
  ///
  /// Usage
  /// ```dart
  /// ComptageOuverturesJourDto(...).copyWith(id: 12, name: "My name")
  /// ````
  ComptageOuverturesJourDto call({
    String openedById,
    String openedByName,
    DateTime jour,
    num ouvertures,
    num qualifiees,
    num liberees,
    num? dureeMoyenneSecondes,
  });
}

/// Proxy class for `copyWith` functionality. This is a callable class and can be used as follows: `instanceOfComptageOuverturesJourDto.copyWith(...)`. Additionally contains functions for specific fields e.g. `instanceOfComptageOuverturesJourDto.copyWith.fieldName(...)`
class _$ComptageOuverturesJourDtoCWProxyImpl
    implements _$ComptageOuverturesJourDtoCWProxy {
  const _$ComptageOuverturesJourDtoCWProxyImpl(this._value);

  final ComptageOuverturesJourDto _value;

  @override
  ComptageOuverturesJourDto openedById(String openedById) =>
      this(openedById: openedById);

  @override
  ComptageOuverturesJourDto openedByName(String openedByName) =>
      this(openedByName: openedByName);

  @override
  ComptageOuverturesJourDto jour(DateTime jour) => this(jour: jour);

  @override
  ComptageOuverturesJourDto ouvertures(num ouvertures) =>
      this(ouvertures: ouvertures);

  @override
  ComptageOuverturesJourDto qualifiees(num qualifiees) =>
      this(qualifiees: qualifiees);

  @override
  ComptageOuverturesJourDto liberees(num liberees) => this(liberees: liberees);

  @override
  ComptageOuverturesJourDto dureeMoyenneSecondes(num? dureeMoyenneSecondes) =>
      this(dureeMoyenneSecondes: dureeMoyenneSecondes);

  @override
  /// This function **does support** nullification of nullable fields. All `null` values passed to `non-nullable` fields will be ignored. You can also use `ComptageOuverturesJourDto(...).copyWith.fieldName(...)` to override fields one at a time with nullification support.
  ///
  /// Usage
  /// ```dart
  /// ComptageOuverturesJourDto(...).copyWith(id: 12, name: "My name")
  /// ````
  ComptageOuverturesJourDto call({
    Object? openedById = const $CopyWithPlaceholder(),
    Object? openedByName = const $CopyWithPlaceholder(),
    Object? jour = const $CopyWithPlaceholder(),
    Object? ouvertures = const $CopyWithPlaceholder(),
    Object? qualifiees = const $CopyWithPlaceholder(),
    Object? liberees = const $CopyWithPlaceholder(),
    Object? dureeMoyenneSecondes = const $CopyWithPlaceholder(),
  }) {
    return ComptageOuverturesJourDto(
      openedById: openedById == const $CopyWithPlaceholder()
          ? _value.openedById
          // ignore: cast_nullable_to_non_nullable
          : openedById as String,
      openedByName: openedByName == const $CopyWithPlaceholder()
          ? _value.openedByName
          // ignore: cast_nullable_to_non_nullable
          : openedByName as String,
      jour: jour == const $CopyWithPlaceholder()
          ? _value.jour
          // ignore: cast_nullable_to_non_nullable
          : jour as DateTime,
      ouvertures: ouvertures == const $CopyWithPlaceholder()
          ? _value.ouvertures
          // ignore: cast_nullable_to_non_nullable
          : ouvertures as num,
      qualifiees: qualifiees == const $CopyWithPlaceholder()
          ? _value.qualifiees
          // ignore: cast_nullable_to_non_nullable
          : qualifiees as num,
      liberees: liberees == const $CopyWithPlaceholder()
          ? _value.liberees
          // ignore: cast_nullable_to_non_nullable
          : liberees as num,
      dureeMoyenneSecondes: dureeMoyenneSecondes == const $CopyWithPlaceholder()
          ? _value.dureeMoyenneSecondes
          // ignore: cast_nullable_to_non_nullable
          : dureeMoyenneSecondes as num?,
    );
  }
}

extension $ComptageOuverturesJourDtoCopyWith on ComptageOuverturesJourDto {
  /// Returns a callable class that can be used as follows: `instanceOfComptageOuverturesJourDto.copyWith(...)` or like so:`instanceOfComptageOuverturesJourDto.copyWith.fieldName(...)`.
  // ignore: library_private_types_in_public_api
  _$ComptageOuverturesJourDtoCWProxy get copyWith =>
      _$ComptageOuverturesJourDtoCWProxyImpl(this);
}

// **************************************************************************
// JsonSerializableGenerator
// **************************************************************************

ComptageOuverturesJourDto _$ComptageOuverturesJourDtoFromJson(
  Map<String, dynamic> json,
) => $checkedCreate('ComptageOuverturesJourDto', json, ($checkedConvert) {
  $checkKeys(
    json,
    requiredKeys: const [
      'openedById',
      'openedByName',
      'jour',
      'ouvertures',
      'qualifiees',
      'liberees',
      'dureeMoyenneSecondes',
    ],
  );
  final val = ComptageOuverturesJourDto(
    openedById: $checkedConvert('openedById', (v) => v as String),
    openedByName: $checkedConvert('openedByName', (v) => v as String),
    jour: $checkedConvert('jour', (v) => DateTime.parse(v as String)),
    ouvertures: $checkedConvert('ouvertures', (v) => v as num),
    qualifiees: $checkedConvert('qualifiees', (v) => v as num),
    liberees: $checkedConvert('liberees', (v) => v as num),
    dureeMoyenneSecondes: $checkedConvert(
      'dureeMoyenneSecondes',
      (v) => v as num?,
    ),
  );
  return val;
});

Map<String, dynamic> _$ComptageOuverturesJourDtoToJson(
  ComptageOuverturesJourDto instance,
) => <String, dynamic>{
  'openedById': instance.openedById,
  'openedByName': instance.openedByName,
  'jour': instance.jour.toIso8601String(),
  'ouvertures': instance.ouvertures,
  'qualifiees': instance.qualifiees,
  'liberees': instance.liberees,
  'dureeMoyenneSecondes': instance.dureeMoyenneSecondes,
};

// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'supervision_campagne_dto.dart';

// **************************************************************************
// CopyWithGenerator
// **************************************************************************

abstract class _$SupervisionCampagneDtoCWProxy {
  SupervisionCampagneDto prevues(num prevues);

  SupervisionCampagneDto appelees(num appelees);

  SupervisionCampagneDto traitees(num traitees);

  SupervisionCampagneDto contactRate(num? contactRate);

  SupervisionCampagneDto exploitationRate(num? exploitationRate);

  SupervisionCampagneDto id(String id);

  SupervisionCampagneDto name(String name);

  SupervisionCampagneDto cible(LotExportCible cible);

  SupervisionCampagneDto createdAt(DateTime createdAt);

  SupervisionCampagneDto parTeleconseiller(
    List<SupervisionCampagneTeleconseillerDto> parTeleconseiller,
  );

  /// This function **does support** nullification of nullable fields. All `null` values passed to `non-nullable` fields will be ignored. You can also use `SupervisionCampagneDto(...).copyWith.fieldName(...)` to override fields one at a time with nullification support.
  ///
  /// Usage
  /// ```dart
  /// SupervisionCampagneDto(...).copyWith(id: 12, name: "My name")
  /// ````
  SupervisionCampagneDto call({
    num prevues,
    num appelees,
    num traitees,
    num? contactRate,
    num? exploitationRate,
    String id,
    String name,
    LotExportCible cible,
    DateTime createdAt,
    List<SupervisionCampagneTeleconseillerDto> parTeleconseiller,
  });
}

/// Proxy class for `copyWith` functionality. This is a callable class and can be used as follows: `instanceOfSupervisionCampagneDto.copyWith(...)`. Additionally contains functions for specific fields e.g. `instanceOfSupervisionCampagneDto.copyWith.fieldName(...)`
class _$SupervisionCampagneDtoCWProxyImpl
    implements _$SupervisionCampagneDtoCWProxy {
  const _$SupervisionCampagneDtoCWProxyImpl(this._value);

  final SupervisionCampagneDto _value;

  @override
  SupervisionCampagneDto prevues(num prevues) => this(prevues: prevues);

  @override
  SupervisionCampagneDto appelees(num appelees) => this(appelees: appelees);

  @override
  SupervisionCampagneDto traitees(num traitees) => this(traitees: traitees);

  @override
  SupervisionCampagneDto contactRate(num? contactRate) =>
      this(contactRate: contactRate);

  @override
  SupervisionCampagneDto exploitationRate(num? exploitationRate) =>
      this(exploitationRate: exploitationRate);

  @override
  SupervisionCampagneDto id(String id) => this(id: id);

  @override
  SupervisionCampagneDto name(String name) => this(name: name);

  @override
  SupervisionCampagneDto cible(LotExportCible cible) => this(cible: cible);

  @override
  SupervisionCampagneDto createdAt(DateTime createdAt) =>
      this(createdAt: createdAt);

  @override
  SupervisionCampagneDto parTeleconseiller(
    List<SupervisionCampagneTeleconseillerDto> parTeleconseiller,
  ) => this(parTeleconseiller: parTeleconseiller);

  @override
  /// This function **does support** nullification of nullable fields. All `null` values passed to `non-nullable` fields will be ignored. You can also use `SupervisionCampagneDto(...).copyWith.fieldName(...)` to override fields one at a time with nullification support.
  ///
  /// Usage
  /// ```dart
  /// SupervisionCampagneDto(...).copyWith(id: 12, name: "My name")
  /// ````
  SupervisionCampagneDto call({
    Object? prevues = const $CopyWithPlaceholder(),
    Object? appelees = const $CopyWithPlaceholder(),
    Object? traitees = const $CopyWithPlaceholder(),
    Object? contactRate = const $CopyWithPlaceholder(),
    Object? exploitationRate = const $CopyWithPlaceholder(),
    Object? id = const $CopyWithPlaceholder(),
    Object? name = const $CopyWithPlaceholder(),
    Object? cible = const $CopyWithPlaceholder(),
    Object? createdAt = const $CopyWithPlaceholder(),
    Object? parTeleconseiller = const $CopyWithPlaceholder(),
  }) {
    return SupervisionCampagneDto(
      prevues: prevues == const $CopyWithPlaceholder()
          ? _value.prevues
          // ignore: cast_nullable_to_non_nullable
          : prevues as num,
      appelees: appelees == const $CopyWithPlaceholder()
          ? _value.appelees
          // ignore: cast_nullable_to_non_nullable
          : appelees as num,
      traitees: traitees == const $CopyWithPlaceholder()
          ? _value.traitees
          // ignore: cast_nullable_to_non_nullable
          : traitees as num,
      contactRate: contactRate == const $CopyWithPlaceholder()
          ? _value.contactRate
          // ignore: cast_nullable_to_non_nullable
          : contactRate as num?,
      exploitationRate: exploitationRate == const $CopyWithPlaceholder()
          ? _value.exploitationRate
          // ignore: cast_nullable_to_non_nullable
          : exploitationRate as num?,
      id: id == const $CopyWithPlaceholder()
          ? _value.id
          // ignore: cast_nullable_to_non_nullable
          : id as String,
      name: name == const $CopyWithPlaceholder()
          ? _value.name
          // ignore: cast_nullable_to_non_nullable
          : name as String,
      cible: cible == const $CopyWithPlaceholder()
          ? _value.cible
          // ignore: cast_nullable_to_non_nullable
          : cible as LotExportCible,
      createdAt: createdAt == const $CopyWithPlaceholder()
          ? _value.createdAt
          // ignore: cast_nullable_to_non_nullable
          : createdAt as DateTime,
      parTeleconseiller: parTeleconseiller == const $CopyWithPlaceholder()
          ? _value.parTeleconseiller
          // ignore: cast_nullable_to_non_nullable
          : parTeleconseiller as List<SupervisionCampagneTeleconseillerDto>,
    );
  }
}

extension $SupervisionCampagneDtoCopyWith on SupervisionCampagneDto {
  /// Returns a callable class that can be used as follows: `instanceOfSupervisionCampagneDto.copyWith(...)` or like so:`instanceOfSupervisionCampagneDto.copyWith.fieldName(...)`.
  // ignore: library_private_types_in_public_api
  _$SupervisionCampagneDtoCWProxy get copyWith =>
      _$SupervisionCampagneDtoCWProxyImpl(this);
}

// **************************************************************************
// JsonSerializableGenerator
// **************************************************************************

SupervisionCampagneDto _$SupervisionCampagneDtoFromJson(
  Map<String, dynamic> json,
) => $checkedCreate('SupervisionCampagneDto', json, ($checkedConvert) {
  $checkKeys(
    json,
    requiredKeys: const [
      'prevues',
      'appelees',
      'traitees',
      'contactRate',
      'exploitationRate',
      'id',
      'name',
      'cible',
      'createdAt',
      'parTeleconseiller',
    ],
  );
  final val = SupervisionCampagneDto(
    prevues: $checkedConvert('prevues', (v) => v as num),
    appelees: $checkedConvert('appelees', (v) => v as num),
    traitees: $checkedConvert('traitees', (v) => v as num),
    contactRate: $checkedConvert('contactRate', (v) => v as num?),
    exploitationRate: $checkedConvert('exploitationRate', (v) => v as num?),
    id: $checkedConvert('id', (v) => v as String),
    name: $checkedConvert('name', (v) => v as String),
    cible: $checkedConvert(
      'cible',
      (v) => $enumDecode(
        _$LotExportCibleEnumMap,
        v,
        unknownValue: LotExportCible.unknownDefaultOpenApi,
      ),
    ),
    createdAt: $checkedConvert('createdAt', (v) => DateTime.parse(v as String)),
    parTeleconseiller: $checkedConvert(
      'parTeleconseiller',
      (v) => (v as List<dynamic>)
          .map(
            (e) => SupervisionCampagneTeleconseillerDto.fromJson(
              e as Map<String, dynamic>,
            ),
          )
          .toList(),
    ),
  );
  return val;
});

Map<String, dynamic> _$SupervisionCampagneDtoToJson(
  SupervisionCampagneDto instance,
) => <String, dynamic>{
  'prevues': instance.prevues,
  'appelees': instance.appelees,
  'traitees': instance.traitees,
  'contactRate': instance.contactRate,
  'exploitationRate': instance.exploitationRate,
  'id': instance.id,
  'name': instance.name,
  'cible': _$LotExportCibleEnumMap[instance.cible]!,
  'createdAt': instance.createdAt.toIso8601String(),
  'parTeleconseiller': instance.parTeleconseiller
      .map((e) => e.toJson())
      .toList(),
};

const _$LotExportCibleEnumMap = {
  LotExportCible.REPRESENTANTS: 'REPRESENTANTS',
  LotExportCible.PROSPECTS: 'PROSPECTS',
  LotExportCible.unknownDefaultOpenApi: 'unknown_default_open_api',
};

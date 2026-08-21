// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'prospect_conflict_existing_dto.dart';

// **************************************************************************
// CopyWithGenerator
// **************************************************************************

abstract class _$ProspectConflictExistingDtoCWProxy {
  ProspectConflictExistingDto id(String id);

  ProspectConflictExistingDto nom(String nom);

  ProspectConflictExistingDto prenom(String prenom);

  ProspectConflictExistingDto representantId(String? representantId);

  ProspectConflictExistingDto representantName(String? representantName);

  ProspectConflictExistingDto ownedByCommercialId(String ownedByCommercialId);

  ProspectConflictExistingDto ownedByCommercialName(
    String ownedByCommercialName,
  );

  ProspectConflictExistingDto createdAt(DateTime createdAt);

  /// This function **does support** nullification of nullable fields. All `null` values passed to `non-nullable` fields will be ignored. You can also use `ProspectConflictExistingDto(...).copyWith.fieldName(...)` to override fields one at a time with nullification support.
  ///
  /// Usage
  /// ```dart
  /// ProspectConflictExistingDto(...).copyWith(id: 12, name: "My name")
  /// ````
  ProspectConflictExistingDto call({
    String id,
    String nom,
    String prenom,
    String? representantId,
    String? representantName,
    String ownedByCommercialId,
    String ownedByCommercialName,
    DateTime createdAt,
  });
}

/// Proxy class for `copyWith` functionality. This is a callable class and can be used as follows: `instanceOfProspectConflictExistingDto.copyWith(...)`. Additionally contains functions for specific fields e.g. `instanceOfProspectConflictExistingDto.copyWith.fieldName(...)`
class _$ProspectConflictExistingDtoCWProxyImpl
    implements _$ProspectConflictExistingDtoCWProxy {
  const _$ProspectConflictExistingDtoCWProxyImpl(this._value);

  final ProspectConflictExistingDto _value;

  @override
  ProspectConflictExistingDto id(String id) => this(id: id);

  @override
  ProspectConflictExistingDto nom(String nom) => this(nom: nom);

  @override
  ProspectConflictExistingDto prenom(String prenom) => this(prenom: prenom);

  @override
  ProspectConflictExistingDto representantId(String? representantId) =>
      this(representantId: representantId);

  @override
  ProspectConflictExistingDto representantName(String? representantName) =>
      this(representantName: representantName);

  @override
  ProspectConflictExistingDto ownedByCommercialId(String ownedByCommercialId) =>
      this(ownedByCommercialId: ownedByCommercialId);

  @override
  ProspectConflictExistingDto ownedByCommercialName(
    String ownedByCommercialName,
  ) => this(ownedByCommercialName: ownedByCommercialName);

  @override
  ProspectConflictExistingDto createdAt(DateTime createdAt) =>
      this(createdAt: createdAt);

  @override
  /// This function **does support** nullification of nullable fields. All `null` values passed to `non-nullable` fields will be ignored. You can also use `ProspectConflictExistingDto(...).copyWith.fieldName(...)` to override fields one at a time with nullification support.
  ///
  /// Usage
  /// ```dart
  /// ProspectConflictExistingDto(...).copyWith(id: 12, name: "My name")
  /// ````
  ProspectConflictExistingDto call({
    Object? id = const $CopyWithPlaceholder(),
    Object? nom = const $CopyWithPlaceholder(),
    Object? prenom = const $CopyWithPlaceholder(),
    Object? representantId = const $CopyWithPlaceholder(),
    Object? representantName = const $CopyWithPlaceholder(),
    Object? ownedByCommercialId = const $CopyWithPlaceholder(),
    Object? ownedByCommercialName = const $CopyWithPlaceholder(),
    Object? createdAt = const $CopyWithPlaceholder(),
  }) {
    return ProspectConflictExistingDto(
      id: id == const $CopyWithPlaceholder()
          ? _value.id
          // ignore: cast_nullable_to_non_nullable
          : id as String,
      nom: nom == const $CopyWithPlaceholder()
          ? _value.nom
          // ignore: cast_nullable_to_non_nullable
          : nom as String,
      prenom: prenom == const $CopyWithPlaceholder()
          ? _value.prenom
          // ignore: cast_nullable_to_non_nullable
          : prenom as String,
      representantId: representantId == const $CopyWithPlaceholder()
          ? _value.representantId
          // ignore: cast_nullable_to_non_nullable
          : representantId as String?,
      representantName: representantName == const $CopyWithPlaceholder()
          ? _value.representantName
          // ignore: cast_nullable_to_non_nullable
          : representantName as String?,
      ownedByCommercialId: ownedByCommercialId == const $CopyWithPlaceholder()
          ? _value.ownedByCommercialId
          // ignore: cast_nullable_to_non_nullable
          : ownedByCommercialId as String,
      ownedByCommercialName:
          ownedByCommercialName == const $CopyWithPlaceholder()
          ? _value.ownedByCommercialName
          // ignore: cast_nullable_to_non_nullable
          : ownedByCommercialName as String,
      createdAt: createdAt == const $CopyWithPlaceholder()
          ? _value.createdAt
          // ignore: cast_nullable_to_non_nullable
          : createdAt as DateTime,
    );
  }
}

extension $ProspectConflictExistingDtoCopyWith on ProspectConflictExistingDto {
  /// Returns a callable class that can be used as follows: `instanceOfProspectConflictExistingDto.copyWith(...)` or like so:`instanceOfProspectConflictExistingDto.copyWith.fieldName(...)`.
  // ignore: library_private_types_in_public_api
  _$ProspectConflictExistingDtoCWProxy get copyWith =>
      _$ProspectConflictExistingDtoCWProxyImpl(this);
}

// **************************************************************************
// JsonSerializableGenerator
// **************************************************************************

ProspectConflictExistingDto _$ProspectConflictExistingDtoFromJson(
  Map<String, dynamic> json,
) => $checkedCreate('ProspectConflictExistingDto', json, ($checkedConvert) {
  $checkKeys(
    json,
    requiredKeys: const [
      'id',
      'nom',
      'prenom',
      'representantId',
      'representantName',
      'ownedByCommercialId',
      'ownedByCommercialName',
      'createdAt',
    ],
  );
  final val = ProspectConflictExistingDto(
    id: $checkedConvert('id', (v) => v as String),
    nom: $checkedConvert('nom', (v) => v as String),
    prenom: $checkedConvert('prenom', (v) => v as String),
    representantId: $checkedConvert('representantId', (v) => v as String?),
    representantName: $checkedConvert('representantName', (v) => v as String?),
    ownedByCommercialId: $checkedConvert(
      'ownedByCommercialId',
      (v) => v as String,
    ),
    ownedByCommercialName: $checkedConvert(
      'ownedByCommercialName',
      (v) => v as String,
    ),
    createdAt: $checkedConvert('createdAt', (v) => DateTime.parse(v as String)),
  );
  return val;
});

Map<String, dynamic> _$ProspectConflictExistingDtoToJson(
  ProspectConflictExistingDto instance,
) => <String, dynamic>{
  'id': instance.id,
  'nom': instance.nom,
  'prenom': instance.prenom,
  'representantId': instance.representantId,
  'representantName': instance.representantName,
  'ownedByCommercialId': instance.ownedByCommercialId,
  'ownedByCommercialName': instance.ownedByCommercialName,
  'createdAt': instance.createdAt.toIso8601String(),
};

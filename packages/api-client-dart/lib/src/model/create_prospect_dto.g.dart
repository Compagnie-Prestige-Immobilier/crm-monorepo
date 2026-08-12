// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'create_prospect_dto.dart';

// **************************************************************************
// CopyWithGenerator
// **************************************************************************

abstract class _$CreateProspectDtoCWProxy {
  CreateProspectDto id(String? id);

  CreateProspectDto nom(String nom);

  CreateProspectDto prenom(String prenom);

  CreateProspectDto phone(String phone);

  CreateProspectDto banqueId(String banqueId);

  CreateProspectDto syndicatId(String syndicatId);

  CreateProspectDto representantId(String representantId);

  CreateProspectDto statut(ProspectStatut? statut);

  CreateProspectDto clientCreatedAt(DateTime? clientCreatedAt);

  /// This function **does support** nullification of nullable fields. All `null` values passed to `non-nullable` fields will be ignored. You can also use `CreateProspectDto(...).copyWith.fieldName(...)` to override fields one at a time with nullification support.
  ///
  /// Usage
  /// ```dart
  /// CreateProspectDto(...).copyWith(id: 12, name: "My name")
  /// ````
  CreateProspectDto call({
    String? id,
    String nom,
    String prenom,
    String phone,
    String banqueId,
    String syndicatId,
    String representantId,
    ProspectStatut? statut,
    DateTime? clientCreatedAt,
  });
}

/// Proxy class for `copyWith` functionality. This is a callable class and can be used as follows: `instanceOfCreateProspectDto.copyWith(...)`. Additionally contains functions for specific fields e.g. `instanceOfCreateProspectDto.copyWith.fieldName(...)`
class _$CreateProspectDtoCWProxyImpl implements _$CreateProspectDtoCWProxy {
  const _$CreateProspectDtoCWProxyImpl(this._value);

  final CreateProspectDto _value;

  @override
  CreateProspectDto id(String? id) => this(id: id);

  @override
  CreateProspectDto nom(String nom) => this(nom: nom);

  @override
  CreateProspectDto prenom(String prenom) => this(prenom: prenom);

  @override
  CreateProspectDto phone(String phone) => this(phone: phone);

  @override
  CreateProspectDto banqueId(String banqueId) => this(banqueId: banqueId);

  @override
  CreateProspectDto syndicatId(String syndicatId) =>
      this(syndicatId: syndicatId);

  @override
  CreateProspectDto representantId(String representantId) =>
      this(representantId: representantId);

  @override
  CreateProspectDto statut(ProspectStatut? statut) => this(statut: statut);

  @override
  CreateProspectDto clientCreatedAt(DateTime? clientCreatedAt) =>
      this(clientCreatedAt: clientCreatedAt);

  @override
  /// This function **does support** nullification of nullable fields. All `null` values passed to `non-nullable` fields will be ignored. You can also use `CreateProspectDto(...).copyWith.fieldName(...)` to override fields one at a time with nullification support.
  ///
  /// Usage
  /// ```dart
  /// CreateProspectDto(...).copyWith(id: 12, name: "My name")
  /// ````
  CreateProspectDto call({
    Object? id = const $CopyWithPlaceholder(),
    Object? nom = const $CopyWithPlaceholder(),
    Object? prenom = const $CopyWithPlaceholder(),
    Object? phone = const $CopyWithPlaceholder(),
    Object? banqueId = const $CopyWithPlaceholder(),
    Object? syndicatId = const $CopyWithPlaceholder(),
    Object? representantId = const $CopyWithPlaceholder(),
    Object? statut = const $CopyWithPlaceholder(),
    Object? clientCreatedAt = const $CopyWithPlaceholder(),
  }) {
    return CreateProspectDto(
      id: id == const $CopyWithPlaceholder()
          ? _value.id
          // ignore: cast_nullable_to_non_nullable
          : id as String?,
      nom: nom == const $CopyWithPlaceholder()
          ? _value.nom
          // ignore: cast_nullable_to_non_nullable
          : nom as String,
      prenom: prenom == const $CopyWithPlaceholder()
          ? _value.prenom
          // ignore: cast_nullable_to_non_nullable
          : prenom as String,
      phone: phone == const $CopyWithPlaceholder()
          ? _value.phone
          // ignore: cast_nullable_to_non_nullable
          : phone as String,
      banqueId: banqueId == const $CopyWithPlaceholder()
          ? _value.banqueId
          // ignore: cast_nullable_to_non_nullable
          : banqueId as String,
      syndicatId: syndicatId == const $CopyWithPlaceholder()
          ? _value.syndicatId
          // ignore: cast_nullable_to_non_nullable
          : syndicatId as String,
      representantId: representantId == const $CopyWithPlaceholder()
          ? _value.representantId
          // ignore: cast_nullable_to_non_nullable
          : representantId as String,
      statut: statut == const $CopyWithPlaceholder()
          ? _value.statut
          // ignore: cast_nullable_to_non_nullable
          : statut as ProspectStatut?,
      clientCreatedAt: clientCreatedAt == const $CopyWithPlaceholder()
          ? _value.clientCreatedAt
          // ignore: cast_nullable_to_non_nullable
          : clientCreatedAt as DateTime?,
    );
  }
}

extension $CreateProspectDtoCopyWith on CreateProspectDto {
  /// Returns a callable class that can be used as follows: `instanceOfCreateProspectDto.copyWith(...)` or like so:`instanceOfCreateProspectDto.copyWith.fieldName(...)`.
  // ignore: library_private_types_in_public_api
  _$CreateProspectDtoCWProxy get copyWith =>
      _$CreateProspectDtoCWProxyImpl(this);
}

// **************************************************************************
// JsonSerializableGenerator
// **************************************************************************

CreateProspectDto _$CreateProspectDtoFromJson(Map<String, dynamic> json) =>
    $checkedCreate('CreateProspectDto', json, ($checkedConvert) {
      $checkKeys(
        json,
        requiredKeys: const [
          'nom',
          'prenom',
          'phone',
          'banqueId',
          'syndicatId',
          'representantId',
        ],
      );
      final val = CreateProspectDto(
        id: $checkedConvert('id', (v) => v as String?),
        nom: $checkedConvert('nom', (v) => v as String),
        prenom: $checkedConvert('prenom', (v) => v as String),
        phone: $checkedConvert('phone', (v) => v as String),
        banqueId: $checkedConvert('banqueId', (v) => v as String),
        syndicatId: $checkedConvert('syndicatId', (v) => v as String),
        representantId: $checkedConvert('representantId', (v) => v as String),
        statut: $checkedConvert(
          'statut',
          (v) => $enumDecodeNullable(
            _$ProspectStatutEnumMap,
            v,
            unknownValue: ProspectStatut.unknownDefaultOpenApi,
          ),
        ),
        clientCreatedAt: $checkedConvert(
          'clientCreatedAt',
          (v) => v == null ? null : DateTime.parse(v as String),
        ),
      );
      return val;
    });

Map<String, dynamic> _$CreateProspectDtoToJson(CreateProspectDto instance) =>
    <String, dynamic>{
      if (instance.id case final value?) 'id': value,
      'nom': instance.nom,
      'prenom': instance.prenom,
      'phone': instance.phone,
      'banqueId': instance.banqueId,
      'syndicatId': instance.syndicatId,
      'representantId': instance.representantId,
      if (_$ProspectStatutEnumMap[instance.statut] case final value?)
        'statut': value,
      if (instance.clientCreatedAt?.toIso8601String() case final value?)
        'clientCreatedAt': value,
    };

const _$ProspectStatutEnumMap = {
  ProspectStatut.NOUVEAU: 'NOUVEAU',
  ProspectStatut.CONTACTE: 'CONTACTE',
  ProspectStatut.CONVERTI: 'CONVERTI',
  ProspectStatut.PERDU: 'PERDU',
  ProspectStatut.unknownDefaultOpenApi: 'unknown_default_open_api',
};

// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'prospect_search_item_dto.dart';

// **************************************************************************
// CopyWithGenerator
// **************************************************************************

abstract class _$ProspectSearchItemDtoCWProxy {
  ProspectSearchItemDto id(String id);

  ProspectSearchItemDto nom(String nom);

  ProspectSearchItemDto prenom(String prenom);

  ProspectSearchItemDto fullName(String fullName);

  ProspectSearchItemDto phoneE164(String phoneE164);

  ProspectSearchItemDto banqueId(String banqueId);

  ProspectSearchItemDto banqueName(String banqueName);

  /// This function **does support** nullification of nullable fields. All `null` values passed to `non-nullable` fields will be ignored. You can also use `ProspectSearchItemDto(...).copyWith.fieldName(...)` to override fields one at a time with nullification support.
  ///
  /// Usage
  /// ```dart
  /// ProspectSearchItemDto(...).copyWith(id: 12, name: "My name")
  /// ````
  ProspectSearchItemDto call({
    String id,
    String nom,
    String prenom,
    String fullName,
    String phoneE164,
    String banqueId,
    String banqueName,
  });
}

/// Proxy class for `copyWith` functionality. This is a callable class and can be used as follows: `instanceOfProspectSearchItemDto.copyWith(...)`. Additionally contains functions for specific fields e.g. `instanceOfProspectSearchItemDto.copyWith.fieldName(...)`
class _$ProspectSearchItemDtoCWProxyImpl
    implements _$ProspectSearchItemDtoCWProxy {
  const _$ProspectSearchItemDtoCWProxyImpl(this._value);

  final ProspectSearchItemDto _value;

  @override
  ProspectSearchItemDto id(String id) => this(id: id);

  @override
  ProspectSearchItemDto nom(String nom) => this(nom: nom);

  @override
  ProspectSearchItemDto prenom(String prenom) => this(prenom: prenom);

  @override
  ProspectSearchItemDto fullName(String fullName) => this(fullName: fullName);

  @override
  ProspectSearchItemDto phoneE164(String phoneE164) =>
      this(phoneE164: phoneE164);

  @override
  ProspectSearchItemDto banqueId(String banqueId) => this(banqueId: banqueId);

  @override
  ProspectSearchItemDto banqueName(String banqueName) =>
      this(banqueName: banqueName);

  @override
  /// This function **does support** nullification of nullable fields. All `null` values passed to `non-nullable` fields will be ignored. You can also use `ProspectSearchItemDto(...).copyWith.fieldName(...)` to override fields one at a time with nullification support.
  ///
  /// Usage
  /// ```dart
  /// ProspectSearchItemDto(...).copyWith(id: 12, name: "My name")
  /// ````
  ProspectSearchItemDto call({
    Object? id = const $CopyWithPlaceholder(),
    Object? nom = const $CopyWithPlaceholder(),
    Object? prenom = const $CopyWithPlaceholder(),
    Object? fullName = const $CopyWithPlaceholder(),
    Object? phoneE164 = const $CopyWithPlaceholder(),
    Object? banqueId = const $CopyWithPlaceholder(),
    Object? banqueName = const $CopyWithPlaceholder(),
  }) {
    return ProspectSearchItemDto(
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
      fullName: fullName == const $CopyWithPlaceholder()
          ? _value.fullName
          // ignore: cast_nullable_to_non_nullable
          : fullName as String,
      phoneE164: phoneE164 == const $CopyWithPlaceholder()
          ? _value.phoneE164
          // ignore: cast_nullable_to_non_nullable
          : phoneE164 as String,
      banqueId: banqueId == const $CopyWithPlaceholder()
          ? _value.banqueId
          // ignore: cast_nullable_to_non_nullable
          : banqueId as String,
      banqueName: banqueName == const $CopyWithPlaceholder()
          ? _value.banqueName
          // ignore: cast_nullable_to_non_nullable
          : banqueName as String,
    );
  }
}

extension $ProspectSearchItemDtoCopyWith on ProspectSearchItemDto {
  /// Returns a callable class that can be used as follows: `instanceOfProspectSearchItemDto.copyWith(...)` or like so:`instanceOfProspectSearchItemDto.copyWith.fieldName(...)`.
  // ignore: library_private_types_in_public_api
  _$ProspectSearchItemDtoCWProxy get copyWith =>
      _$ProspectSearchItemDtoCWProxyImpl(this);
}

// **************************************************************************
// JsonSerializableGenerator
// **************************************************************************

ProspectSearchItemDto _$ProspectSearchItemDtoFromJson(
  Map<String, dynamic> json,
) => $checkedCreate('ProspectSearchItemDto', json, ($checkedConvert) {
  $checkKeys(
    json,
    requiredKeys: const [
      'id',
      'nom',
      'prenom',
      'fullName',
      'phoneE164',
      'banqueId',
      'banqueName',
    ],
  );
  final val = ProspectSearchItemDto(
    id: $checkedConvert('id', (v) => v as String),
    nom: $checkedConvert('nom', (v) => v as String),
    prenom: $checkedConvert('prenom', (v) => v as String),
    fullName: $checkedConvert('fullName', (v) => v as String),
    phoneE164: $checkedConvert('phoneE164', (v) => v as String),
    banqueId: $checkedConvert('banqueId', (v) => v as String),
    banqueName: $checkedConvert('banqueName', (v) => v as String),
  );
  return val;
});

Map<String, dynamic> _$ProspectSearchItemDtoToJson(
  ProspectSearchItemDto instance,
) => <String, dynamic>{
  'id': instance.id,
  'nom': instance.nom,
  'prenom': instance.prenom,
  'fullName': instance.fullName,
  'phoneE164': instance.phoneE164,
  'banqueId': instance.banqueId,
  'banqueName': instance.banqueName,
};

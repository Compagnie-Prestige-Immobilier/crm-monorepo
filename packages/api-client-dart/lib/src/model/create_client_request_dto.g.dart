// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'create_client_request_dto.dart';

// **************************************************************************
// CopyWithGenerator
// **************************************************************************

abstract class _$CreateClientRequestDtoCWProxy {
  CreateClientRequestDto nom(String nom);

  CreateClientRequestDto prenom(String prenom);

  CreateClientRequestDto phone(String phone);

  CreateClientRequestDto banqueId(String banqueId);

  CreateClientRequestDto note(String? note);

  /// This function **does support** nullification of nullable fields. All `null` values passed to `non-nullable` fields will be ignored. You can also use `CreateClientRequestDto(...).copyWith.fieldName(...)` to override fields one at a time with nullification support.
  ///
  /// Usage
  /// ```dart
  /// CreateClientRequestDto(...).copyWith(id: 12, name: "My name")
  /// ````
  CreateClientRequestDto call({
    String nom,
    String prenom,
    String phone,
    String banqueId,
    String? note,
  });
}

/// Proxy class for `copyWith` functionality. This is a callable class and can be used as follows: `instanceOfCreateClientRequestDto.copyWith(...)`. Additionally contains functions for specific fields e.g. `instanceOfCreateClientRequestDto.copyWith.fieldName(...)`
class _$CreateClientRequestDtoCWProxyImpl
    implements _$CreateClientRequestDtoCWProxy {
  const _$CreateClientRequestDtoCWProxyImpl(this._value);

  final CreateClientRequestDto _value;

  @override
  CreateClientRequestDto nom(String nom) => this(nom: nom);

  @override
  CreateClientRequestDto prenom(String prenom) => this(prenom: prenom);

  @override
  CreateClientRequestDto phone(String phone) => this(phone: phone);

  @override
  CreateClientRequestDto banqueId(String banqueId) => this(banqueId: banqueId);

  @override
  CreateClientRequestDto note(String? note) => this(note: note);

  @override
  /// This function **does support** nullification of nullable fields. All `null` values passed to `non-nullable` fields will be ignored. You can also use `CreateClientRequestDto(...).copyWith.fieldName(...)` to override fields one at a time with nullification support.
  ///
  /// Usage
  /// ```dart
  /// CreateClientRequestDto(...).copyWith(id: 12, name: "My name")
  /// ````
  CreateClientRequestDto call({
    Object? nom = const $CopyWithPlaceholder(),
    Object? prenom = const $CopyWithPlaceholder(),
    Object? phone = const $CopyWithPlaceholder(),
    Object? banqueId = const $CopyWithPlaceholder(),
    Object? note = const $CopyWithPlaceholder(),
  }) {
    return CreateClientRequestDto(
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
      note: note == const $CopyWithPlaceholder()
          ? _value.note
          // ignore: cast_nullable_to_non_nullable
          : note as String?,
    );
  }
}

extension $CreateClientRequestDtoCopyWith on CreateClientRequestDto {
  /// Returns a callable class that can be used as follows: `instanceOfCreateClientRequestDto.copyWith(...)` or like so:`instanceOfCreateClientRequestDto.copyWith.fieldName(...)`.
  // ignore: library_private_types_in_public_api
  _$CreateClientRequestDtoCWProxy get copyWith =>
      _$CreateClientRequestDtoCWProxyImpl(this);
}

// **************************************************************************
// JsonSerializableGenerator
// **************************************************************************

CreateClientRequestDto _$CreateClientRequestDtoFromJson(
  Map<String, dynamic> json,
) => $checkedCreate('CreateClientRequestDto', json, ($checkedConvert) {
  $checkKeys(json, requiredKeys: const ['nom', 'prenom', 'phone', 'banqueId']);
  final val = CreateClientRequestDto(
    nom: $checkedConvert('nom', (v) => v as String),
    prenom: $checkedConvert('prenom', (v) => v as String),
    phone: $checkedConvert('phone', (v) => v as String),
    banqueId: $checkedConvert('banqueId', (v) => v as String),
    note: $checkedConvert('note', (v) => v as String?),
  );
  return val;
});

Map<String, dynamic> _$CreateClientRequestDtoToJson(
  CreateClientRequestDto instance,
) => <String, dynamic>{
  'nom': instance.nom,
  'prenom': instance.prenom,
  'phone': instance.phone,
  'banqueId': instance.banqueId,
  if (instance.note case final value?) 'note': value,
};

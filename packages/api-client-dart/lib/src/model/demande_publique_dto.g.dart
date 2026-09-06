// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'demande_publique_dto.dart';

// **************************************************************************
// CopyWithGenerator
// **************************************************************************

abstract class _$DemandePubliqueDtoCWProxy {
  DemandePubliqueDto nom(String nom);

  DemandePubliqueDto prenom(String prenom);

  DemandePubliqueDto phone(String phone);

  DemandePubliqueDto email(String? email);

  DemandePubliqueDto profession(String? profession);

  DemandePubliqueDto employeur(String? employeur);

  DemandePubliqueDto message(String? message);

  DemandePubliqueDto site(String? site);

  DemandePubliqueDto turnstileToken(String? turnstileToken);

  /// This function **does support** nullification of nullable fields. All `null` values passed to `non-nullable` fields will be ignored. You can also use `DemandePubliqueDto(...).copyWith.fieldName(...)` to override fields one at a time with nullification support.
  ///
  /// Usage
  /// ```dart
  /// DemandePubliqueDto(...).copyWith(id: 12, name: "My name")
  /// ````
  DemandePubliqueDto call({
    String nom,
    String prenom,
    String phone,
    String? email,
    String? profession,
    String? employeur,
    String? message,
    String? site,
    String? turnstileToken,
  });
}

/// Proxy class for `copyWith` functionality. This is a callable class and can be used as follows: `instanceOfDemandePubliqueDto.copyWith(...)`. Additionally contains functions for specific fields e.g. `instanceOfDemandePubliqueDto.copyWith.fieldName(...)`
class _$DemandePubliqueDtoCWProxyImpl implements _$DemandePubliqueDtoCWProxy {
  const _$DemandePubliqueDtoCWProxyImpl(this._value);

  final DemandePubliqueDto _value;

  @override
  DemandePubliqueDto nom(String nom) => this(nom: nom);

  @override
  DemandePubliqueDto prenom(String prenom) => this(prenom: prenom);

  @override
  DemandePubliqueDto phone(String phone) => this(phone: phone);

  @override
  DemandePubliqueDto email(String? email) => this(email: email);

  @override
  DemandePubliqueDto profession(String? profession) =>
      this(profession: profession);

  @override
  DemandePubliqueDto employeur(String? employeur) => this(employeur: employeur);

  @override
  DemandePubliqueDto message(String? message) => this(message: message);

  @override
  DemandePubliqueDto site(String? site) => this(site: site);

  @override
  DemandePubliqueDto turnstileToken(String? turnstileToken) =>
      this(turnstileToken: turnstileToken);

  @override
  /// This function **does support** nullification of nullable fields. All `null` values passed to `non-nullable` fields will be ignored. You can also use `DemandePubliqueDto(...).copyWith.fieldName(...)` to override fields one at a time with nullification support.
  ///
  /// Usage
  /// ```dart
  /// DemandePubliqueDto(...).copyWith(id: 12, name: "My name")
  /// ````
  DemandePubliqueDto call({
    Object? nom = const $CopyWithPlaceholder(),
    Object? prenom = const $CopyWithPlaceholder(),
    Object? phone = const $CopyWithPlaceholder(),
    Object? email = const $CopyWithPlaceholder(),
    Object? profession = const $CopyWithPlaceholder(),
    Object? employeur = const $CopyWithPlaceholder(),
    Object? message = const $CopyWithPlaceholder(),
    Object? site = const $CopyWithPlaceholder(),
    Object? turnstileToken = const $CopyWithPlaceholder(),
  }) {
    return DemandePubliqueDto(
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
      email: email == const $CopyWithPlaceholder()
          ? _value.email
          // ignore: cast_nullable_to_non_nullable
          : email as String?,
      profession: profession == const $CopyWithPlaceholder()
          ? _value.profession
          // ignore: cast_nullable_to_non_nullable
          : profession as String?,
      employeur: employeur == const $CopyWithPlaceholder()
          ? _value.employeur
          // ignore: cast_nullable_to_non_nullable
          : employeur as String?,
      message: message == const $CopyWithPlaceholder()
          ? _value.message
          // ignore: cast_nullable_to_non_nullable
          : message as String?,
      site: site == const $CopyWithPlaceholder()
          ? _value.site
          // ignore: cast_nullable_to_non_nullable
          : site as String?,
      turnstileToken: turnstileToken == const $CopyWithPlaceholder()
          ? _value.turnstileToken
          // ignore: cast_nullable_to_non_nullable
          : turnstileToken as String?,
    );
  }
}

extension $DemandePubliqueDtoCopyWith on DemandePubliqueDto {
  /// Returns a callable class that can be used as follows: `instanceOfDemandePubliqueDto.copyWith(...)` or like so:`instanceOfDemandePubliqueDto.copyWith.fieldName(...)`.
  // ignore: library_private_types_in_public_api
  _$DemandePubliqueDtoCWProxy get copyWith =>
      _$DemandePubliqueDtoCWProxyImpl(this);
}

// **************************************************************************
// JsonSerializableGenerator
// **************************************************************************

DemandePubliqueDto _$DemandePubliqueDtoFromJson(Map<String, dynamic> json) =>
    $checkedCreate('DemandePubliqueDto', json, ($checkedConvert) {
      $checkKeys(json, requiredKeys: const ['nom', 'prenom', 'phone']);
      final val = DemandePubliqueDto(
        nom: $checkedConvert('nom', (v) => v as String),
        prenom: $checkedConvert('prenom', (v) => v as String),
        phone: $checkedConvert('phone', (v) => v as String),
        email: $checkedConvert('email', (v) => v as String?),
        profession: $checkedConvert('profession', (v) => v as String?),
        employeur: $checkedConvert('employeur', (v) => v as String?),
        message: $checkedConvert('message', (v) => v as String?),
        site: $checkedConvert('site', (v) => v as String?),
        turnstileToken: $checkedConvert('turnstileToken', (v) => v as String?),
      );
      return val;
    });

Map<String, dynamic> _$DemandePubliqueDtoToJson(DemandePubliqueDto instance) =>
    <String, dynamic>{
      'nom': instance.nom,
      'prenom': instance.prenom,
      'phone': instance.phone,
      if (instance.email case final value?) 'email': value,
      if (instance.profession case final value?) 'profession': value,
      if (instance.employeur case final value?) 'employeur': value,
      if (instance.message case final value?) 'message': value,
      if (instance.site case final value?) 'site': value,
      if (instance.turnstileToken case final value?) 'turnstileToken': value,
    };

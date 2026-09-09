// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'update_grand_public_consent_dto.dart';

// **************************************************************************
// CopyWithGenerator
// **************************************************************************

abstract class _$UpdateGrandPublicConsentDtoCWProxy {
  UpdateGrandPublicConsentDto consent(GrandPublicConsent consent);

  /// This function **does support** nullification of nullable fields. All `null` values passed to `non-nullable` fields will be ignored. You can also use `UpdateGrandPublicConsentDto(...).copyWith.fieldName(...)` to override fields one at a time with nullification support.
  ///
  /// Usage
  /// ```dart
  /// UpdateGrandPublicConsentDto(...).copyWith(id: 12, name: "My name")
  /// ````
  UpdateGrandPublicConsentDto call({GrandPublicConsent consent});
}

/// Proxy class for `copyWith` functionality. This is a callable class and can be used as follows: `instanceOfUpdateGrandPublicConsentDto.copyWith(...)`. Additionally contains functions for specific fields e.g. `instanceOfUpdateGrandPublicConsentDto.copyWith.fieldName(...)`
class _$UpdateGrandPublicConsentDtoCWProxyImpl
    implements _$UpdateGrandPublicConsentDtoCWProxy {
  const _$UpdateGrandPublicConsentDtoCWProxyImpl(this._value);

  final UpdateGrandPublicConsentDto _value;

  @override
  UpdateGrandPublicConsentDto consent(GrandPublicConsent consent) =>
      this(consent: consent);

  @override
  /// This function **does support** nullification of nullable fields. All `null` values passed to `non-nullable` fields will be ignored. You can also use `UpdateGrandPublicConsentDto(...).copyWith.fieldName(...)` to override fields one at a time with nullification support.
  ///
  /// Usage
  /// ```dart
  /// UpdateGrandPublicConsentDto(...).copyWith(id: 12, name: "My name")
  /// ````
  UpdateGrandPublicConsentDto call({
    Object? consent = const $CopyWithPlaceholder(),
  }) {
    return UpdateGrandPublicConsentDto(
      consent: consent == const $CopyWithPlaceholder()
          ? _value.consent
          // ignore: cast_nullable_to_non_nullable
          : consent as GrandPublicConsent,
    );
  }
}

extension $UpdateGrandPublicConsentDtoCopyWith on UpdateGrandPublicConsentDto {
  /// Returns a callable class that can be used as follows: `instanceOfUpdateGrandPublicConsentDto.copyWith(...)` or like so:`instanceOfUpdateGrandPublicConsentDto.copyWith.fieldName(...)`.
  // ignore: library_private_types_in_public_api
  _$UpdateGrandPublicConsentDtoCWProxy get copyWith =>
      _$UpdateGrandPublicConsentDtoCWProxyImpl(this);
}

// **************************************************************************
// JsonSerializableGenerator
// **************************************************************************

UpdateGrandPublicConsentDto _$UpdateGrandPublicConsentDtoFromJson(
  Map<String, dynamic> json,
) => $checkedCreate('UpdateGrandPublicConsentDto', json, ($checkedConvert) {
  $checkKeys(json, requiredKeys: const ['consent']);
  final val = UpdateGrandPublicConsentDto(
    consent: $checkedConvert(
      'consent',
      (v) => $enumDecode(
        _$GrandPublicConsentEnumMap,
        v,
        unknownValue: GrandPublicConsent.unknownDefaultOpenApi,
      ),
    ),
  );
  return val;
});

Map<String, dynamic> _$UpdateGrandPublicConsentDtoToJson(
  UpdateGrandPublicConsentDto instance,
) => <String, dynamic>{
  'consent': _$GrandPublicConsentEnumMap[instance.consent]!,
};

const _$GrandPublicConsentEnumMap = {
  GrandPublicConsent.NON_DEMANDE: 'NON_DEMANDE',
  GrandPublicConsent.INTERESSE: 'INTERESSE',
  GrandPublicConsent.REFUSE: 'REFUSE',
  GrandPublicConsent.unknownDefaultOpenApi: 'unknown_default_open_api',
};

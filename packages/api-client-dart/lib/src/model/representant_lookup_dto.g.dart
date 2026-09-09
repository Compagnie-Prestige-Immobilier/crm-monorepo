// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'representant_lookup_dto.dart';

// **************************************************************************
// CopyWithGenerator
// **************************************************************************

abstract class _$RepresentantLookupDtoCWProxy {
  RepresentantLookupDto found(bool found);

  RepresentantLookupDto phoneE164(String phoneE164);

  RepresentantLookupDto representant(RepresentantDto? representant);

  RepresentantLookupDto ownedByCommercialName(String? ownedByCommercialName);

  RepresentantLookupDto ownedByCommercialId(String? ownedByCommercialId);

  /// This function **does support** nullification of nullable fields. All `null` values passed to `non-nullable` fields will be ignored. You can also use `RepresentantLookupDto(...).copyWith.fieldName(...)` to override fields one at a time with nullification support.
  ///
  /// Usage
  /// ```dart
  /// RepresentantLookupDto(...).copyWith(id: 12, name: "My name")
  /// ````
  RepresentantLookupDto call({
    bool found,
    String phoneE164,
    RepresentantDto? representant,
    String? ownedByCommercialName,
    String? ownedByCommercialId,
  });
}

/// Proxy class for `copyWith` functionality. This is a callable class and can be used as follows: `instanceOfRepresentantLookupDto.copyWith(...)`. Additionally contains functions for specific fields e.g. `instanceOfRepresentantLookupDto.copyWith.fieldName(...)`
class _$RepresentantLookupDtoCWProxyImpl
    implements _$RepresentantLookupDtoCWProxy {
  const _$RepresentantLookupDtoCWProxyImpl(this._value);

  final RepresentantLookupDto _value;

  @override
  RepresentantLookupDto found(bool found) => this(found: found);

  @override
  RepresentantLookupDto phoneE164(String phoneE164) =>
      this(phoneE164: phoneE164);

  @override
  RepresentantLookupDto representant(RepresentantDto? representant) =>
      this(representant: representant);

  @override
  RepresentantLookupDto ownedByCommercialName(String? ownedByCommercialName) =>
      this(ownedByCommercialName: ownedByCommercialName);

  @override
  RepresentantLookupDto ownedByCommercialId(String? ownedByCommercialId) =>
      this(ownedByCommercialId: ownedByCommercialId);

  @override
  /// This function **does support** nullification of nullable fields. All `null` values passed to `non-nullable` fields will be ignored. You can also use `RepresentantLookupDto(...).copyWith.fieldName(...)` to override fields one at a time with nullification support.
  ///
  /// Usage
  /// ```dart
  /// RepresentantLookupDto(...).copyWith(id: 12, name: "My name")
  /// ````
  RepresentantLookupDto call({
    Object? found = const $CopyWithPlaceholder(),
    Object? phoneE164 = const $CopyWithPlaceholder(),
    Object? representant = const $CopyWithPlaceholder(),
    Object? ownedByCommercialName = const $CopyWithPlaceholder(),
    Object? ownedByCommercialId = const $CopyWithPlaceholder(),
  }) {
    return RepresentantLookupDto(
      found: found == const $CopyWithPlaceholder()
          ? _value.found
          // ignore: cast_nullable_to_non_nullable
          : found as bool,
      phoneE164: phoneE164 == const $CopyWithPlaceholder()
          ? _value.phoneE164
          // ignore: cast_nullable_to_non_nullable
          : phoneE164 as String,
      representant: representant == const $CopyWithPlaceholder()
          ? _value.representant
          // ignore: cast_nullable_to_non_nullable
          : representant as RepresentantDto?,
      ownedByCommercialName:
          ownedByCommercialName == const $CopyWithPlaceholder()
          ? _value.ownedByCommercialName
          // ignore: cast_nullable_to_non_nullable
          : ownedByCommercialName as String?,
      ownedByCommercialId: ownedByCommercialId == const $CopyWithPlaceholder()
          ? _value.ownedByCommercialId
          // ignore: cast_nullable_to_non_nullable
          : ownedByCommercialId as String?,
    );
  }
}

extension $RepresentantLookupDtoCopyWith on RepresentantLookupDto {
  /// Returns a callable class that can be used as follows: `instanceOfRepresentantLookupDto.copyWith(...)` or like so:`instanceOfRepresentantLookupDto.copyWith.fieldName(...)`.
  // ignore: library_private_types_in_public_api
  _$RepresentantLookupDtoCWProxy get copyWith =>
      _$RepresentantLookupDtoCWProxyImpl(this);
}

// **************************************************************************
// JsonSerializableGenerator
// **************************************************************************

RepresentantLookupDto _$RepresentantLookupDtoFromJson(
  Map<String, dynamic> json,
) => $checkedCreate('RepresentantLookupDto', json, ($checkedConvert) {
  $checkKeys(
    json,
    requiredKeys: const [
      'found',
      'phoneE164',
      'representant',
      'ownedByCommercialName',
      'ownedByCommercialId',
    ],
  );
  final val = RepresentantLookupDto(
    found: $checkedConvert('found', (v) => v as bool),
    phoneE164: $checkedConvert('phoneE164', (v) => v as String),
    representant: $checkedConvert(
      'representant',
      (v) => v == null
          ? null
          : RepresentantDto.fromJson(v as Map<String, dynamic>),
    ),
    ownedByCommercialName: $checkedConvert(
      'ownedByCommercialName',
      (v) => v as String?,
    ),
    ownedByCommercialId: $checkedConvert(
      'ownedByCommercialId',
      (v) => v as String?,
    ),
  );
  return val;
});

Map<String, dynamic> _$RepresentantLookupDtoToJson(
  RepresentantLookupDto instance,
) => <String, dynamic>{
  'found': instance.found,
  'phoneE164': instance.phoneE164,
  'representant': instance.representant?.toJson(),
  'ownedByCommercialName': instance.ownedByCommercialName,
  'ownedByCommercialId': instance.ownedByCommercialId,
};

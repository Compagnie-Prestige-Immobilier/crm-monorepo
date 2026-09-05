// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'ouvrir_fiche_dto.dart';

// **************************************************************************
// CopyWithGenerator
// **************************************************************************

abstract class _$OuvrirFicheDtoCWProxy {
  OuvrirFicheDto id(String id);

  OuvrirFicheDto representantId(String? representantId);

  OuvrirFicheDto prospectId(String? prospectId);

  OuvrirFicheDto openedAt(DateTime openedAt);

  OuvrirFicheDto draft(Map<String, Object>? draft);

  /// This function **does support** nullification of nullable fields. All `null` values passed to `non-nullable` fields will be ignored. You can also use `OuvrirFicheDto(...).copyWith.fieldName(...)` to override fields one at a time with nullification support.
  ///
  /// Usage
  /// ```dart
  /// OuvrirFicheDto(...).copyWith(id: 12, name: "My name")
  /// ````
  OuvrirFicheDto call({
    String id,
    String? representantId,
    String? prospectId,
    DateTime openedAt,
    Map<String, Object>? draft,
  });
}

/// Proxy class for `copyWith` functionality. This is a callable class and can be used as follows: `instanceOfOuvrirFicheDto.copyWith(...)`. Additionally contains functions for specific fields e.g. `instanceOfOuvrirFicheDto.copyWith.fieldName(...)`
class _$OuvrirFicheDtoCWProxyImpl implements _$OuvrirFicheDtoCWProxy {
  const _$OuvrirFicheDtoCWProxyImpl(this._value);

  final OuvrirFicheDto _value;

  @override
  OuvrirFicheDto id(String id) => this(id: id);

  @override
  OuvrirFicheDto representantId(String? representantId) =>
      this(representantId: representantId);

  @override
  OuvrirFicheDto prospectId(String? prospectId) => this(prospectId: prospectId);

  @override
  OuvrirFicheDto openedAt(DateTime openedAt) => this(openedAt: openedAt);

  @override
  OuvrirFicheDto draft(Map<String, Object>? draft) => this(draft: draft);

  @override
  /// This function **does support** nullification of nullable fields. All `null` values passed to `non-nullable` fields will be ignored. You can also use `OuvrirFicheDto(...).copyWith.fieldName(...)` to override fields one at a time with nullification support.
  ///
  /// Usage
  /// ```dart
  /// OuvrirFicheDto(...).copyWith(id: 12, name: "My name")
  /// ````
  OuvrirFicheDto call({
    Object? id = const $CopyWithPlaceholder(),
    Object? representantId = const $CopyWithPlaceholder(),
    Object? prospectId = const $CopyWithPlaceholder(),
    Object? openedAt = const $CopyWithPlaceholder(),
    Object? draft = const $CopyWithPlaceholder(),
  }) {
    return OuvrirFicheDto(
      id: id == const $CopyWithPlaceholder()
          ? _value.id
          // ignore: cast_nullable_to_non_nullable
          : id as String,
      representantId: representantId == const $CopyWithPlaceholder()
          ? _value.representantId
          // ignore: cast_nullable_to_non_nullable
          : representantId as String?,
      prospectId: prospectId == const $CopyWithPlaceholder()
          ? _value.prospectId
          // ignore: cast_nullable_to_non_nullable
          : prospectId as String?,
      openedAt: openedAt == const $CopyWithPlaceholder()
          ? _value.openedAt
          // ignore: cast_nullable_to_non_nullable
          : openedAt as DateTime,
      draft: draft == const $CopyWithPlaceholder()
          ? _value.draft
          // ignore: cast_nullable_to_non_nullable
          : draft as Map<String, Object>?,
    );
  }
}

extension $OuvrirFicheDtoCopyWith on OuvrirFicheDto {
  /// Returns a callable class that can be used as follows: `instanceOfOuvrirFicheDto.copyWith(...)` or like so:`instanceOfOuvrirFicheDto.copyWith.fieldName(...)`.
  // ignore: library_private_types_in_public_api
  _$OuvrirFicheDtoCWProxy get copyWith => _$OuvrirFicheDtoCWProxyImpl(this);
}

// **************************************************************************
// JsonSerializableGenerator
// **************************************************************************

OuvrirFicheDto _$OuvrirFicheDtoFromJson(
  Map<String, dynamic> json,
) => $checkedCreate('OuvrirFicheDto', json, ($checkedConvert) {
  $checkKeys(json, requiredKeys: const ['id', 'openedAt']);
  final val = OuvrirFicheDto(
    id: $checkedConvert('id', (v) => v as String),
    representantId: $checkedConvert('representantId', (v) => v as String?),
    prospectId: $checkedConvert('prospectId', (v) => v as String?),
    openedAt: $checkedConvert('openedAt', (v) => DateTime.parse(v as String)),
    draft: $checkedConvert(
      'draft',
      (v) =>
          (v as Map<String, dynamic>?)?.map((k, e) => MapEntry(k, e as Object)),
    ),
  );
  return val;
});

Map<String, dynamic> _$OuvrirFicheDtoToJson(OuvrirFicheDto instance) =>
    <String, dynamic>{
      'id': instance.id,
      if (instance.representantId case final value?) 'representantId': value,
      if (instance.prospectId case final value?) 'prospectId': value,
      'openedAt': instance.openedAt.toIso8601String(),
      if (instance.draft case final value?) 'draft': value,
    };

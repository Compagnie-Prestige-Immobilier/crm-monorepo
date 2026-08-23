// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'sync_visite_referentiel_dto.dart';

// **************************************************************************
// CopyWithGenerator
// **************************************************************************

abstract class _$SyncVisiteReferentielDtoCWProxy {
  SyncVisiteReferentielDto id(String id);

  SyncVisiteReferentielDto kind(VisiteReferentielKind kind);

  SyncVisiteReferentielDto code(String code);

  SyncVisiteReferentielDto label(String label);

  SyncVisiteReferentielDto isActive(bool isActive);

  SyncVisiteReferentielDto sortOrder(num sortOrder);

  SyncVisiteReferentielDto updatedAt(DateTime updatedAt);

  /// This function **does support** nullification of nullable fields. All `null` values passed to `non-nullable` fields will be ignored. You can also use `SyncVisiteReferentielDto(...).copyWith.fieldName(...)` to override fields one at a time with nullification support.
  ///
  /// Usage
  /// ```dart
  /// SyncVisiteReferentielDto(...).copyWith(id: 12, name: "My name")
  /// ````
  SyncVisiteReferentielDto call({
    String id,
    VisiteReferentielKind kind,
    String code,
    String label,
    bool isActive,
    num sortOrder,
    DateTime updatedAt,
  });
}

/// Proxy class for `copyWith` functionality. This is a callable class and can be used as follows: `instanceOfSyncVisiteReferentielDto.copyWith(...)`. Additionally contains functions for specific fields e.g. `instanceOfSyncVisiteReferentielDto.copyWith.fieldName(...)`
class _$SyncVisiteReferentielDtoCWProxyImpl
    implements _$SyncVisiteReferentielDtoCWProxy {
  const _$SyncVisiteReferentielDtoCWProxyImpl(this._value);

  final SyncVisiteReferentielDto _value;

  @override
  SyncVisiteReferentielDto id(String id) => this(id: id);

  @override
  SyncVisiteReferentielDto kind(VisiteReferentielKind kind) => this(kind: kind);

  @override
  SyncVisiteReferentielDto code(String code) => this(code: code);

  @override
  SyncVisiteReferentielDto label(String label) => this(label: label);

  @override
  SyncVisiteReferentielDto isActive(bool isActive) => this(isActive: isActive);

  @override
  SyncVisiteReferentielDto sortOrder(num sortOrder) =>
      this(sortOrder: sortOrder);

  @override
  SyncVisiteReferentielDto updatedAt(DateTime updatedAt) =>
      this(updatedAt: updatedAt);

  @override
  /// This function **does support** nullification of nullable fields. All `null` values passed to `non-nullable` fields will be ignored. You can also use `SyncVisiteReferentielDto(...).copyWith.fieldName(...)` to override fields one at a time with nullification support.
  ///
  /// Usage
  /// ```dart
  /// SyncVisiteReferentielDto(...).copyWith(id: 12, name: "My name")
  /// ````
  SyncVisiteReferentielDto call({
    Object? id = const $CopyWithPlaceholder(),
    Object? kind = const $CopyWithPlaceholder(),
    Object? code = const $CopyWithPlaceholder(),
    Object? label = const $CopyWithPlaceholder(),
    Object? isActive = const $CopyWithPlaceholder(),
    Object? sortOrder = const $CopyWithPlaceholder(),
    Object? updatedAt = const $CopyWithPlaceholder(),
  }) {
    return SyncVisiteReferentielDto(
      id: id == const $CopyWithPlaceholder()
          ? _value.id
          // ignore: cast_nullable_to_non_nullable
          : id as String,
      kind: kind == const $CopyWithPlaceholder()
          ? _value.kind
          // ignore: cast_nullable_to_non_nullable
          : kind as VisiteReferentielKind,
      code: code == const $CopyWithPlaceholder()
          ? _value.code
          // ignore: cast_nullable_to_non_nullable
          : code as String,
      label: label == const $CopyWithPlaceholder()
          ? _value.label
          // ignore: cast_nullable_to_non_nullable
          : label as String,
      isActive: isActive == const $CopyWithPlaceholder()
          ? _value.isActive
          // ignore: cast_nullable_to_non_nullable
          : isActive as bool,
      sortOrder: sortOrder == const $CopyWithPlaceholder()
          ? _value.sortOrder
          // ignore: cast_nullable_to_non_nullable
          : sortOrder as num,
      updatedAt: updatedAt == const $CopyWithPlaceholder()
          ? _value.updatedAt
          // ignore: cast_nullable_to_non_nullable
          : updatedAt as DateTime,
    );
  }
}

extension $SyncVisiteReferentielDtoCopyWith on SyncVisiteReferentielDto {
  /// Returns a callable class that can be used as follows: `instanceOfSyncVisiteReferentielDto.copyWith(...)` or like so:`instanceOfSyncVisiteReferentielDto.copyWith.fieldName(...)`.
  // ignore: library_private_types_in_public_api
  _$SyncVisiteReferentielDtoCWProxy get copyWith =>
      _$SyncVisiteReferentielDtoCWProxyImpl(this);
}

// **************************************************************************
// JsonSerializableGenerator
// **************************************************************************

SyncVisiteReferentielDto _$SyncVisiteReferentielDtoFromJson(
  Map<String, dynamic> json,
) => $checkedCreate('SyncVisiteReferentielDto', json, ($checkedConvert) {
  $checkKeys(
    json,
    requiredKeys: const [
      'id',
      'kind',
      'code',
      'label',
      'isActive',
      'sortOrder',
      'updatedAt',
    ],
  );
  final val = SyncVisiteReferentielDto(
    id: $checkedConvert('id', (v) => v as String),
    kind: $checkedConvert(
      'kind',
      (v) => $enumDecode(
        _$VisiteReferentielKindEnumMap,
        v,
        unknownValue: VisiteReferentielKind.unknownDefaultOpenApi,
      ),
    ),
    code: $checkedConvert('code', (v) => v as String),
    label: $checkedConvert('label', (v) => v as String),
    isActive: $checkedConvert('isActive', (v) => v as bool),
    sortOrder: $checkedConvert('sortOrder', (v) => v as num),
    updatedAt: $checkedConvert('updatedAt', (v) => DateTime.parse(v as String)),
  );
  return val;
});

Map<String, dynamic> _$SyncVisiteReferentielDtoToJson(
  SyncVisiteReferentielDto instance,
) => <String, dynamic>{
  'id': instance.id,
  'kind': _$VisiteReferentielKindEnumMap[instance.kind]!,
  'code': instance.code,
  'label': instance.label,
  'isActive': instance.isActive,
  'sortOrder': instance.sortOrder,
  'updatedAt': instance.updatedAt.toIso8601String(),
};

const _$VisiteReferentielKindEnumMap = {
  VisiteReferentielKind.entreprises: 'entreprises',
  VisiteReferentielKind.directions: 'directions',
  VisiteReferentielKind.destinataires: 'destinataires',
  VisiteReferentielKind.objets: 'objets',
  VisiteReferentielKind.unknownDefaultOpenApi: 'unknown_default_open_api',
};

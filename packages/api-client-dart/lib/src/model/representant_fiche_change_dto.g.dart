// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'representant_fiche_change_dto.dart';

// **************************************************************************
// CopyWithGenerator
// **************************************************************************

abstract class _$RepresentantFicheChangeDtoCWProxy {
  RepresentantFicheChangeDto id(String id);

  RepresentantFicheChangeDto representantId(String representantId);

  RepresentantFicheChangeDto source_(FicheChangeSource source_);

  RepresentantFicheChangeDto changedById(String? changedById);

  RepresentantFicheChangeDto changedByName(String changedByName);

  RepresentantFicheChangeDto changedAt(DateTime changedAt);

  RepresentantFicheChangeDto champs(List<RepresentantFicheChampDto> champs);

  /// This function **does support** nullification of nullable fields. All `null` values passed to `non-nullable` fields will be ignored. You can also use `RepresentantFicheChangeDto(...).copyWith.fieldName(...)` to override fields one at a time with nullification support.
  ///
  /// Usage
  /// ```dart
  /// RepresentantFicheChangeDto(...).copyWith(id: 12, name: "My name")
  /// ````
  RepresentantFicheChangeDto call({
    String id,
    String representantId,
    FicheChangeSource source_,
    String? changedById,
    String changedByName,
    DateTime changedAt,
    List<RepresentantFicheChampDto> champs,
  });
}

/// Proxy class for `copyWith` functionality. This is a callable class and can be used as follows: `instanceOfRepresentantFicheChangeDto.copyWith(...)`. Additionally contains functions for specific fields e.g. `instanceOfRepresentantFicheChangeDto.copyWith.fieldName(...)`
class _$RepresentantFicheChangeDtoCWProxyImpl
    implements _$RepresentantFicheChangeDtoCWProxy {
  const _$RepresentantFicheChangeDtoCWProxyImpl(this._value);

  final RepresentantFicheChangeDto _value;

  @override
  RepresentantFicheChangeDto id(String id) => this(id: id);

  @override
  RepresentantFicheChangeDto representantId(String representantId) =>
      this(representantId: representantId);

  @override
  RepresentantFicheChangeDto source_(FicheChangeSource source_) =>
      this(source_: source_);

  @override
  RepresentantFicheChangeDto changedById(String? changedById) =>
      this(changedById: changedById);

  @override
  RepresentantFicheChangeDto changedByName(String changedByName) =>
      this(changedByName: changedByName);

  @override
  RepresentantFicheChangeDto changedAt(DateTime changedAt) =>
      this(changedAt: changedAt);

  @override
  RepresentantFicheChangeDto champs(List<RepresentantFicheChampDto> champs) =>
      this(champs: champs);

  @override
  /// This function **does support** nullification of nullable fields. All `null` values passed to `non-nullable` fields will be ignored. You can also use `RepresentantFicheChangeDto(...).copyWith.fieldName(...)` to override fields one at a time with nullification support.
  ///
  /// Usage
  /// ```dart
  /// RepresentantFicheChangeDto(...).copyWith(id: 12, name: "My name")
  /// ````
  RepresentantFicheChangeDto call({
    Object? id = const $CopyWithPlaceholder(),
    Object? representantId = const $CopyWithPlaceholder(),
    Object? source_ = const $CopyWithPlaceholder(),
    Object? changedById = const $CopyWithPlaceholder(),
    Object? changedByName = const $CopyWithPlaceholder(),
    Object? changedAt = const $CopyWithPlaceholder(),
    Object? champs = const $CopyWithPlaceholder(),
  }) {
    return RepresentantFicheChangeDto(
      id: id == const $CopyWithPlaceholder()
          ? _value.id
          // ignore: cast_nullable_to_non_nullable
          : id as String,
      representantId: representantId == const $CopyWithPlaceholder()
          ? _value.representantId
          // ignore: cast_nullable_to_non_nullable
          : representantId as String,
      source_: source_ == const $CopyWithPlaceholder()
          ? _value.source_
          // ignore: cast_nullable_to_non_nullable
          : source_ as FicheChangeSource,
      changedById: changedById == const $CopyWithPlaceholder()
          ? _value.changedById
          // ignore: cast_nullable_to_non_nullable
          : changedById as String?,
      changedByName: changedByName == const $CopyWithPlaceholder()
          ? _value.changedByName
          // ignore: cast_nullable_to_non_nullable
          : changedByName as String,
      changedAt: changedAt == const $CopyWithPlaceholder()
          ? _value.changedAt
          // ignore: cast_nullable_to_non_nullable
          : changedAt as DateTime,
      champs: champs == const $CopyWithPlaceholder()
          ? _value.champs
          // ignore: cast_nullable_to_non_nullable
          : champs as List<RepresentantFicheChampDto>,
    );
  }
}

extension $RepresentantFicheChangeDtoCopyWith on RepresentantFicheChangeDto {
  /// Returns a callable class that can be used as follows: `instanceOfRepresentantFicheChangeDto.copyWith(...)` or like so:`instanceOfRepresentantFicheChangeDto.copyWith.fieldName(...)`.
  // ignore: library_private_types_in_public_api
  _$RepresentantFicheChangeDtoCWProxy get copyWith =>
      _$RepresentantFicheChangeDtoCWProxyImpl(this);
}

// **************************************************************************
// JsonSerializableGenerator
// **************************************************************************

RepresentantFicheChangeDto _$RepresentantFicheChangeDtoFromJson(
  Map<String, dynamic> json,
) => $checkedCreate('RepresentantFicheChangeDto', json, ($checkedConvert) {
  $checkKeys(
    json,
    requiredKeys: const [
      'id',
      'representantId',
      'source',
      'changedById',
      'changedByName',
      'changedAt',
      'champs',
    ],
  );
  final val = RepresentantFicheChangeDto(
    id: $checkedConvert('id', (v) => v as String),
    representantId: $checkedConvert('representantId', (v) => v as String),
    source_: $checkedConvert(
      'source',
      (v) => $enumDecode(
        _$FicheChangeSourceEnumMap,
        v,
        unknownValue: FicheChangeSource.unknownDefaultOpenApi,
      ),
    ),
    changedById: $checkedConvert('changedById', (v) => v as String?),
    changedByName: $checkedConvert('changedByName', (v) => v as String),
    changedAt: $checkedConvert('changedAt', (v) => DateTime.parse(v as String)),
    champs: $checkedConvert(
      'champs',
      (v) => (v as List<dynamic>)
          .map(
            (e) =>
                RepresentantFicheChampDto.fromJson(e as Map<String, dynamic>),
          )
          .toList(),
    ),
  );
  return val;
}, fieldKeyMap: const {'source_': 'source'});

Map<String, dynamic> _$RepresentantFicheChangeDtoToJson(
  RepresentantFicheChangeDto instance,
) => <String, dynamic>{
  'id': instance.id,
  'representantId': instance.representantId,
  'source': _$FicheChangeSourceEnumMap[instance.source_]!,
  'changedById': instance.changedById,
  'changedByName': instance.changedByName,
  'changedAt': instance.changedAt.toIso8601String(),
  'champs': instance.champs.map((e) => e.toJson()).toList(),
};

const _$FicheChangeSourceEnumMap = {
  FicheChangeSource.WEB: 'WEB',
  FicheChangeSource.MOBILE: 'MOBILE',
  FicheChangeSource.APPEL: 'APPEL',
  FicheChangeSource.IMPORT: 'IMPORT',
  FicheChangeSource.unknownDefaultOpenApi: 'unknown_default_open_api',
};

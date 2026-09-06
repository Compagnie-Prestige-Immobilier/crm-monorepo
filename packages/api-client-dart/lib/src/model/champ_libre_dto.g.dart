// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'champ_libre_dto.dart';

// **************************************************************************
// CopyWithGenerator
// **************************************************************************

abstract class _$ChampLibreDtoCWProxy {
  ChampLibreDto id(String id);

  ChampLibreDto libelle(String libelle);

  ChampLibreDto type(ChampLibreDtoTypeEnum type);

  ChampLibreDto options(List<String> options);

  ChampLibreDto obligatoire(bool obligatoire);

  /// This function **does support** nullification of nullable fields. All `null` values passed to `non-nullable` fields will be ignored. You can also use `ChampLibreDto(...).copyWith.fieldName(...)` to override fields one at a time with nullification support.
  ///
  /// Usage
  /// ```dart
  /// ChampLibreDto(...).copyWith(id: 12, name: "My name")
  /// ````
  ChampLibreDto call({
    String id,
    String libelle,
    ChampLibreDtoTypeEnum type,
    List<String> options,
    bool obligatoire,
  });
}

/// Proxy class for `copyWith` functionality. This is a callable class and can be used as follows: `instanceOfChampLibreDto.copyWith(...)`. Additionally contains functions for specific fields e.g. `instanceOfChampLibreDto.copyWith.fieldName(...)`
class _$ChampLibreDtoCWProxyImpl implements _$ChampLibreDtoCWProxy {
  const _$ChampLibreDtoCWProxyImpl(this._value);

  final ChampLibreDto _value;

  @override
  ChampLibreDto id(String id) => this(id: id);

  @override
  ChampLibreDto libelle(String libelle) => this(libelle: libelle);

  @override
  ChampLibreDto type(ChampLibreDtoTypeEnum type) => this(type: type);

  @override
  ChampLibreDto options(List<String> options) => this(options: options);

  @override
  ChampLibreDto obligatoire(bool obligatoire) => this(obligatoire: obligatoire);

  @override
  /// This function **does support** nullification of nullable fields. All `null` values passed to `non-nullable` fields will be ignored. You can also use `ChampLibreDto(...).copyWith.fieldName(...)` to override fields one at a time with nullification support.
  ///
  /// Usage
  /// ```dart
  /// ChampLibreDto(...).copyWith(id: 12, name: "My name")
  /// ````
  ChampLibreDto call({
    Object? id = const $CopyWithPlaceholder(),
    Object? libelle = const $CopyWithPlaceholder(),
    Object? type = const $CopyWithPlaceholder(),
    Object? options = const $CopyWithPlaceholder(),
    Object? obligatoire = const $CopyWithPlaceholder(),
  }) {
    return ChampLibreDto(
      id: id == const $CopyWithPlaceholder()
          ? _value.id
          // ignore: cast_nullable_to_non_nullable
          : id as String,
      libelle: libelle == const $CopyWithPlaceholder()
          ? _value.libelle
          // ignore: cast_nullable_to_non_nullable
          : libelle as String,
      type: type == const $CopyWithPlaceholder()
          ? _value.type
          // ignore: cast_nullable_to_non_nullable
          : type as ChampLibreDtoTypeEnum,
      options: options == const $CopyWithPlaceholder()
          ? _value.options
          // ignore: cast_nullable_to_non_nullable
          : options as List<String>,
      obligatoire: obligatoire == const $CopyWithPlaceholder()
          ? _value.obligatoire
          // ignore: cast_nullable_to_non_nullable
          : obligatoire as bool,
    );
  }
}

extension $ChampLibreDtoCopyWith on ChampLibreDto {
  /// Returns a callable class that can be used as follows: `instanceOfChampLibreDto.copyWith(...)` or like so:`instanceOfChampLibreDto.copyWith.fieldName(...)`.
  // ignore: library_private_types_in_public_api
  _$ChampLibreDtoCWProxy get copyWith => _$ChampLibreDtoCWProxyImpl(this);
}

// **************************************************************************
// JsonSerializableGenerator
// **************************************************************************

ChampLibreDto _$ChampLibreDtoFromJson(Map<String, dynamic> json) =>
    $checkedCreate('ChampLibreDto', json, ($checkedConvert) {
      $checkKeys(
        json,
        requiredKeys: const ['id', 'libelle', 'type', 'options', 'obligatoire'],
      );
      final val = ChampLibreDto(
        id: $checkedConvert('id', (v) => v as String),
        libelle: $checkedConvert('libelle', (v) => v as String),
        type: $checkedConvert(
          'type',
          (v) => $enumDecode(
            _$ChampLibreDtoTypeEnumEnumMap,
            v,
            unknownValue: ChampLibreDtoTypeEnum.unknownDefaultOpenApi,
          ),
        ),
        options: $checkedConvert(
          'options',
          (v) => (v as List<dynamic>).map((e) => e as String).toList(),
        ),
        obligatoire: $checkedConvert('obligatoire', (v) => v as bool),
      );
      return val;
    });

Map<String, dynamic> _$ChampLibreDtoToJson(ChampLibreDto instance) =>
    <String, dynamic>{
      'id': instance.id,
      'libelle': instance.libelle,
      'type': _$ChampLibreDtoTypeEnumEnumMap[instance.type]!,
      'options': instance.options,
      'obligatoire': instance.obligatoire,
    };

const _$ChampLibreDtoTypeEnumEnumMap = {
  ChampLibreDtoTypeEnum.TEXTE: 'TEXTE',
  ChampLibreDtoTypeEnum.LISTE: 'LISTE',
  ChampLibreDtoTypeEnum.OUI_NON: 'OUI_NON',
  ChampLibreDtoTypeEnum.unknownDefaultOpenApi: 'unknown_default_open_api',
};

// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'champ_libre_input_dto.dart';

// **************************************************************************
// CopyWithGenerator
// **************************************************************************

abstract class _$ChampLibreInputDtoCWProxy {
  ChampLibreInputDto id(String? id);

  ChampLibreInputDto libelle(String libelle);

  ChampLibreInputDto type(ChampLibreInputDtoTypeEnum type);

  ChampLibreInputDto options(List<String>? options);

  ChampLibreInputDto obligatoire(bool obligatoire);

  /// This function **does support** nullification of nullable fields. All `null` values passed to `non-nullable` fields will be ignored. You can also use `ChampLibreInputDto(...).copyWith.fieldName(...)` to override fields one at a time with nullification support.
  ///
  /// Usage
  /// ```dart
  /// ChampLibreInputDto(...).copyWith(id: 12, name: "My name")
  /// ````
  ChampLibreInputDto call({
    String? id,
    String libelle,
    ChampLibreInputDtoTypeEnum type,
    List<String>? options,
    bool obligatoire,
  });
}

/// Proxy class for `copyWith` functionality. This is a callable class and can be used as follows: `instanceOfChampLibreInputDto.copyWith(...)`. Additionally contains functions for specific fields e.g. `instanceOfChampLibreInputDto.copyWith.fieldName(...)`
class _$ChampLibreInputDtoCWProxyImpl implements _$ChampLibreInputDtoCWProxy {
  const _$ChampLibreInputDtoCWProxyImpl(this._value);

  final ChampLibreInputDto _value;

  @override
  ChampLibreInputDto id(String? id) => this(id: id);

  @override
  ChampLibreInputDto libelle(String libelle) => this(libelle: libelle);

  @override
  ChampLibreInputDto type(ChampLibreInputDtoTypeEnum type) => this(type: type);

  @override
  ChampLibreInputDto options(List<String>? options) => this(options: options);

  @override
  ChampLibreInputDto obligatoire(bool obligatoire) =>
      this(obligatoire: obligatoire);

  @override
  /// This function **does support** nullification of nullable fields. All `null` values passed to `non-nullable` fields will be ignored. You can also use `ChampLibreInputDto(...).copyWith.fieldName(...)` to override fields one at a time with nullification support.
  ///
  /// Usage
  /// ```dart
  /// ChampLibreInputDto(...).copyWith(id: 12, name: "My name")
  /// ````
  ChampLibreInputDto call({
    Object? id = const $CopyWithPlaceholder(),
    Object? libelle = const $CopyWithPlaceholder(),
    Object? type = const $CopyWithPlaceholder(),
    Object? options = const $CopyWithPlaceholder(),
    Object? obligatoire = const $CopyWithPlaceholder(),
  }) {
    return ChampLibreInputDto(
      id: id == const $CopyWithPlaceholder()
          ? _value.id
          // ignore: cast_nullable_to_non_nullable
          : id as String?,
      libelle: libelle == const $CopyWithPlaceholder()
          ? _value.libelle
          // ignore: cast_nullable_to_non_nullable
          : libelle as String,
      type: type == const $CopyWithPlaceholder()
          ? _value.type
          // ignore: cast_nullable_to_non_nullable
          : type as ChampLibreInputDtoTypeEnum,
      options: options == const $CopyWithPlaceholder()
          ? _value.options
          // ignore: cast_nullable_to_non_nullable
          : options as List<String>?,
      obligatoire: obligatoire == const $CopyWithPlaceholder()
          ? _value.obligatoire
          // ignore: cast_nullable_to_non_nullable
          : obligatoire as bool,
    );
  }
}

extension $ChampLibreInputDtoCopyWith on ChampLibreInputDto {
  /// Returns a callable class that can be used as follows: `instanceOfChampLibreInputDto.copyWith(...)` or like so:`instanceOfChampLibreInputDto.copyWith.fieldName(...)`.
  // ignore: library_private_types_in_public_api
  _$ChampLibreInputDtoCWProxy get copyWith =>
      _$ChampLibreInputDtoCWProxyImpl(this);
}

// **************************************************************************
// JsonSerializableGenerator
// **************************************************************************

ChampLibreInputDto _$ChampLibreInputDtoFromJson(Map<String, dynamic> json) =>
    $checkedCreate('ChampLibreInputDto', json, ($checkedConvert) {
      $checkKeys(json, requiredKeys: const ['libelle', 'type', 'obligatoire']);
      final val = ChampLibreInputDto(
        id: $checkedConvert('id', (v) => v as String?),
        libelle: $checkedConvert('libelle', (v) => v as String),
        type: $checkedConvert(
          'type',
          (v) => $enumDecode(
            _$ChampLibreInputDtoTypeEnumEnumMap,
            v,
            unknownValue: ChampLibreInputDtoTypeEnum.unknownDefaultOpenApi,
          ),
        ),
        options: $checkedConvert(
          'options',
          (v) => (v as List<dynamic>?)?.map((e) => e as String).toList(),
        ),
        obligatoire: $checkedConvert('obligatoire', (v) => v as bool),
      );
      return val;
    });

Map<String, dynamic> _$ChampLibreInputDtoToJson(ChampLibreInputDto instance) =>
    <String, dynamic>{
      if (instance.id case final value?) 'id': value,
      'libelle': instance.libelle,
      'type': _$ChampLibreInputDtoTypeEnumEnumMap[instance.type]!,
      if (instance.options case final value?) 'options': value,
      'obligatoire': instance.obligatoire,
    };

const _$ChampLibreInputDtoTypeEnumEnumMap = {
  ChampLibreInputDtoTypeEnum.TEXTE: 'TEXTE',
  ChampLibreInputDtoTypeEnum.LISTE: 'LISTE',
  ChampLibreInputDtoTypeEnum.OUI_NON: 'OUI_NON',
  ChampLibreInputDtoTypeEnum.unknownDefaultOpenApi: 'unknown_default_open_api',
};

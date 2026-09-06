// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'reglage_champ_dto.dart';

// **************************************************************************
// CopyWithGenerator
// **************************************************************************

abstract class _$ReglageChampDtoCWProxy {
  ReglageChampDto champ(String champ);

  ReglageChampDto libelle(String libelle);

  ReglageChampDto visible(bool visible);

  ReglageChampDto obligatoire(bool obligatoire);

  ReglageChampDto impose(bool impose);

  /// This function **does support** nullification of nullable fields. All `null` values passed to `non-nullable` fields will be ignored. You can also use `ReglageChampDto(...).copyWith.fieldName(...)` to override fields one at a time with nullification support.
  ///
  /// Usage
  /// ```dart
  /// ReglageChampDto(...).copyWith(id: 12, name: "My name")
  /// ````
  ReglageChampDto call({
    String champ,
    String libelle,
    bool visible,
    bool obligatoire,
    bool impose,
  });
}

/// Proxy class for `copyWith` functionality. This is a callable class and can be used as follows: `instanceOfReglageChampDto.copyWith(...)`. Additionally contains functions for specific fields e.g. `instanceOfReglageChampDto.copyWith.fieldName(...)`
class _$ReglageChampDtoCWProxyImpl implements _$ReglageChampDtoCWProxy {
  const _$ReglageChampDtoCWProxyImpl(this._value);

  final ReglageChampDto _value;

  @override
  ReglageChampDto champ(String champ) => this(champ: champ);

  @override
  ReglageChampDto libelle(String libelle) => this(libelle: libelle);

  @override
  ReglageChampDto visible(bool visible) => this(visible: visible);

  @override
  ReglageChampDto obligatoire(bool obligatoire) =>
      this(obligatoire: obligatoire);

  @override
  ReglageChampDto impose(bool impose) => this(impose: impose);

  @override
  /// This function **does support** nullification of nullable fields. All `null` values passed to `non-nullable` fields will be ignored. You can also use `ReglageChampDto(...).copyWith.fieldName(...)` to override fields one at a time with nullification support.
  ///
  /// Usage
  /// ```dart
  /// ReglageChampDto(...).copyWith(id: 12, name: "My name")
  /// ````
  ReglageChampDto call({
    Object? champ = const $CopyWithPlaceholder(),
    Object? libelle = const $CopyWithPlaceholder(),
    Object? visible = const $CopyWithPlaceholder(),
    Object? obligatoire = const $CopyWithPlaceholder(),
    Object? impose = const $CopyWithPlaceholder(),
  }) {
    return ReglageChampDto(
      champ: champ == const $CopyWithPlaceholder()
          ? _value.champ
          // ignore: cast_nullable_to_non_nullable
          : champ as String,
      libelle: libelle == const $CopyWithPlaceholder()
          ? _value.libelle
          // ignore: cast_nullable_to_non_nullable
          : libelle as String,
      visible: visible == const $CopyWithPlaceholder()
          ? _value.visible
          // ignore: cast_nullable_to_non_nullable
          : visible as bool,
      obligatoire: obligatoire == const $CopyWithPlaceholder()
          ? _value.obligatoire
          // ignore: cast_nullable_to_non_nullable
          : obligatoire as bool,
      impose: impose == const $CopyWithPlaceholder()
          ? _value.impose
          // ignore: cast_nullable_to_non_nullable
          : impose as bool,
    );
  }
}

extension $ReglageChampDtoCopyWith on ReglageChampDto {
  /// Returns a callable class that can be used as follows: `instanceOfReglageChampDto.copyWith(...)` or like so:`instanceOfReglageChampDto.copyWith.fieldName(...)`.
  // ignore: library_private_types_in_public_api
  _$ReglageChampDtoCWProxy get copyWith => _$ReglageChampDtoCWProxyImpl(this);
}

// **************************************************************************
// JsonSerializableGenerator
// **************************************************************************

ReglageChampDto _$ReglageChampDtoFromJson(Map<String, dynamic> json) =>
    $checkedCreate('ReglageChampDto', json, ($checkedConvert) {
      $checkKeys(
        json,
        requiredKeys: const [
          'champ',
          'libelle',
          'visible',
          'obligatoire',
          'impose',
        ],
      );
      final val = ReglageChampDto(
        champ: $checkedConvert('champ', (v) => v as String),
        libelle: $checkedConvert('libelle', (v) => v as String),
        visible: $checkedConvert('visible', (v) => v as bool),
        obligatoire: $checkedConvert('obligatoire', (v) => v as bool),
        impose: $checkedConvert('impose', (v) => v as bool),
      );
      return val;
    });

Map<String, dynamic> _$ReglageChampDtoToJson(ReglageChampDto instance) =>
    <String, dynamic>{
      'champ': instance.champ,
      'libelle': instance.libelle,
      'visible': instance.visible,
      'obligatoire': instance.obligatoire,
      'impose': instance.impose,
    };

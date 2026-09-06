// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'reglage_champ_input_dto.dart';

// **************************************************************************
// CopyWithGenerator
// **************************************************************************

abstract class _$ReglageChampInputDtoCWProxy {
  ReglageChampInputDto champ(String champ);

  ReglageChampInputDto visible(bool visible);

  ReglageChampInputDto obligatoire(bool obligatoire);

  /// This function **does support** nullification of nullable fields. All `null` values passed to `non-nullable` fields will be ignored. You can also use `ReglageChampInputDto(...).copyWith.fieldName(...)` to override fields one at a time with nullification support.
  ///
  /// Usage
  /// ```dart
  /// ReglageChampInputDto(...).copyWith(id: 12, name: "My name")
  /// ````
  ReglageChampInputDto call({String champ, bool visible, bool obligatoire});
}

/// Proxy class for `copyWith` functionality. This is a callable class and can be used as follows: `instanceOfReglageChampInputDto.copyWith(...)`. Additionally contains functions for specific fields e.g. `instanceOfReglageChampInputDto.copyWith.fieldName(...)`
class _$ReglageChampInputDtoCWProxyImpl
    implements _$ReglageChampInputDtoCWProxy {
  const _$ReglageChampInputDtoCWProxyImpl(this._value);

  final ReglageChampInputDto _value;

  @override
  ReglageChampInputDto champ(String champ) => this(champ: champ);

  @override
  ReglageChampInputDto visible(bool visible) => this(visible: visible);

  @override
  ReglageChampInputDto obligatoire(bool obligatoire) =>
      this(obligatoire: obligatoire);

  @override
  /// This function **does support** nullification of nullable fields. All `null` values passed to `non-nullable` fields will be ignored. You can also use `ReglageChampInputDto(...).copyWith.fieldName(...)` to override fields one at a time with nullification support.
  ///
  /// Usage
  /// ```dart
  /// ReglageChampInputDto(...).copyWith(id: 12, name: "My name")
  /// ````
  ReglageChampInputDto call({
    Object? champ = const $CopyWithPlaceholder(),
    Object? visible = const $CopyWithPlaceholder(),
    Object? obligatoire = const $CopyWithPlaceholder(),
  }) {
    return ReglageChampInputDto(
      champ: champ == const $CopyWithPlaceholder()
          ? _value.champ
          // ignore: cast_nullable_to_non_nullable
          : champ as String,
      visible: visible == const $CopyWithPlaceholder()
          ? _value.visible
          // ignore: cast_nullable_to_non_nullable
          : visible as bool,
      obligatoire: obligatoire == const $CopyWithPlaceholder()
          ? _value.obligatoire
          // ignore: cast_nullable_to_non_nullable
          : obligatoire as bool,
    );
  }
}

extension $ReglageChampInputDtoCopyWith on ReglageChampInputDto {
  /// Returns a callable class that can be used as follows: `instanceOfReglageChampInputDto.copyWith(...)` or like so:`instanceOfReglageChampInputDto.copyWith.fieldName(...)`.
  // ignore: library_private_types_in_public_api
  _$ReglageChampInputDtoCWProxy get copyWith =>
      _$ReglageChampInputDtoCWProxyImpl(this);
}

// **************************************************************************
// JsonSerializableGenerator
// **************************************************************************

ReglageChampInputDto _$ReglageChampInputDtoFromJson(
  Map<String, dynamic> json,
) => $checkedCreate('ReglageChampInputDto', json, ($checkedConvert) {
  $checkKeys(json, requiredKeys: const ['champ', 'visible', 'obligatoire']);
  final val = ReglageChampInputDto(
    champ: $checkedConvert('champ', (v) => v as String),
    visible: $checkedConvert('visible', (v) => v as bool),
    obligatoire: $checkedConvert('obligatoire', (v) => v as bool),
  );
  return val;
});

Map<String, dynamic> _$ReglageChampInputDtoToJson(
  ReglageChampInputDto instance,
) => <String, dynamic>{
  'champ': instance.champ,
  'visible': instance.visible,
  'obligatoire': instance.obligatoire,
};

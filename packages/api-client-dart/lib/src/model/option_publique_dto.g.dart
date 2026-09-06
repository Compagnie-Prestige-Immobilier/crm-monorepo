// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'option_publique_dto.dart';

// **************************************************************************
// CopyWithGenerator
// **************************************************************************

abstract class _$OptionPubliqueDtoCWProxy {
  OptionPubliqueDto id(String id);

  OptionPubliqueDto libelle(String libelle);

  /// This function **does support** nullification of nullable fields. All `null` values passed to `non-nullable` fields will be ignored. You can also use `OptionPubliqueDto(...).copyWith.fieldName(...)` to override fields one at a time with nullification support.
  ///
  /// Usage
  /// ```dart
  /// OptionPubliqueDto(...).copyWith(id: 12, name: "My name")
  /// ````
  OptionPubliqueDto call({String id, String libelle});
}

/// Proxy class for `copyWith` functionality. This is a callable class and can be used as follows: `instanceOfOptionPubliqueDto.copyWith(...)`. Additionally contains functions for specific fields e.g. `instanceOfOptionPubliqueDto.copyWith.fieldName(...)`
class _$OptionPubliqueDtoCWProxyImpl implements _$OptionPubliqueDtoCWProxy {
  const _$OptionPubliqueDtoCWProxyImpl(this._value);

  final OptionPubliqueDto _value;

  @override
  OptionPubliqueDto id(String id) => this(id: id);

  @override
  OptionPubliqueDto libelle(String libelle) => this(libelle: libelle);

  @override
  /// This function **does support** nullification of nullable fields. All `null` values passed to `non-nullable` fields will be ignored. You can also use `OptionPubliqueDto(...).copyWith.fieldName(...)` to override fields one at a time with nullification support.
  ///
  /// Usage
  /// ```dart
  /// OptionPubliqueDto(...).copyWith(id: 12, name: "My name")
  /// ````
  OptionPubliqueDto call({
    Object? id = const $CopyWithPlaceholder(),
    Object? libelle = const $CopyWithPlaceholder(),
  }) {
    return OptionPubliqueDto(
      id: id == const $CopyWithPlaceholder()
          ? _value.id
          // ignore: cast_nullable_to_non_nullable
          : id as String,
      libelle: libelle == const $CopyWithPlaceholder()
          ? _value.libelle
          // ignore: cast_nullable_to_non_nullable
          : libelle as String,
    );
  }
}

extension $OptionPubliqueDtoCopyWith on OptionPubliqueDto {
  /// Returns a callable class that can be used as follows: `instanceOfOptionPubliqueDto.copyWith(...)` or like so:`instanceOfOptionPubliqueDto.copyWith.fieldName(...)`.
  // ignore: library_private_types_in_public_api
  _$OptionPubliqueDtoCWProxy get copyWith =>
      _$OptionPubliqueDtoCWProxyImpl(this);
}

// **************************************************************************
// JsonSerializableGenerator
// **************************************************************************

OptionPubliqueDto _$OptionPubliqueDtoFromJson(Map<String, dynamic> json) =>
    $checkedCreate('OptionPubliqueDto', json, ($checkedConvert) {
      $checkKeys(json, requiredKeys: const ['id', 'libelle']);
      final val = OptionPubliqueDto(
        id: $checkedConvert('id', (v) => v as String),
        libelle: $checkedConvert('libelle', (v) => v as String),
      );
      return val;
    });

Map<String, dynamic> _$OptionPubliqueDtoToJson(OptionPubliqueDto instance) =>
    <String, dynamic>{'id': instance.id, 'libelle': instance.libelle};

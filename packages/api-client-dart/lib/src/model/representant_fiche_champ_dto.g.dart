// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'representant_fiche_champ_dto.dart';

// **************************************************************************
// CopyWithGenerator
// **************************************************************************

abstract class _$RepresentantFicheChampDtoCWProxy {
  RepresentantFicheChampDto champ(String champ);

  RepresentantFicheChampDto avant(String? avant);

  RepresentantFicheChampDto apres(String? apres);

  /// This function **does support** nullification of nullable fields. All `null` values passed to `non-nullable` fields will be ignored. You can also use `RepresentantFicheChampDto(...).copyWith.fieldName(...)` to override fields one at a time with nullification support.
  ///
  /// Usage
  /// ```dart
  /// RepresentantFicheChampDto(...).copyWith(id: 12, name: "My name")
  /// ````
  RepresentantFicheChampDto call({String champ, String? avant, String? apres});
}

/// Proxy class for `copyWith` functionality. This is a callable class and can be used as follows: `instanceOfRepresentantFicheChampDto.copyWith(...)`. Additionally contains functions for specific fields e.g. `instanceOfRepresentantFicheChampDto.copyWith.fieldName(...)`
class _$RepresentantFicheChampDtoCWProxyImpl
    implements _$RepresentantFicheChampDtoCWProxy {
  const _$RepresentantFicheChampDtoCWProxyImpl(this._value);

  final RepresentantFicheChampDto _value;

  @override
  RepresentantFicheChampDto champ(String champ) => this(champ: champ);

  @override
  RepresentantFicheChampDto avant(String? avant) => this(avant: avant);

  @override
  RepresentantFicheChampDto apres(String? apres) => this(apres: apres);

  @override
  /// This function **does support** nullification of nullable fields. All `null` values passed to `non-nullable` fields will be ignored. You can also use `RepresentantFicheChampDto(...).copyWith.fieldName(...)` to override fields one at a time with nullification support.
  ///
  /// Usage
  /// ```dart
  /// RepresentantFicheChampDto(...).copyWith(id: 12, name: "My name")
  /// ````
  RepresentantFicheChampDto call({
    Object? champ = const $CopyWithPlaceholder(),
    Object? avant = const $CopyWithPlaceholder(),
    Object? apres = const $CopyWithPlaceholder(),
  }) {
    return RepresentantFicheChampDto(
      champ: champ == const $CopyWithPlaceholder()
          ? _value.champ
          // ignore: cast_nullable_to_non_nullable
          : champ as String,
      avant: avant == const $CopyWithPlaceholder()
          ? _value.avant
          // ignore: cast_nullable_to_non_nullable
          : avant as String?,
      apres: apres == const $CopyWithPlaceholder()
          ? _value.apres
          // ignore: cast_nullable_to_non_nullable
          : apres as String?,
    );
  }
}

extension $RepresentantFicheChampDtoCopyWith on RepresentantFicheChampDto {
  /// Returns a callable class that can be used as follows: `instanceOfRepresentantFicheChampDto.copyWith(...)` or like so:`instanceOfRepresentantFicheChampDto.copyWith.fieldName(...)`.
  // ignore: library_private_types_in_public_api
  _$RepresentantFicheChampDtoCWProxy get copyWith =>
      _$RepresentantFicheChampDtoCWProxyImpl(this);
}

// **************************************************************************
// JsonSerializableGenerator
// **************************************************************************

RepresentantFicheChampDto _$RepresentantFicheChampDtoFromJson(
  Map<String, dynamic> json,
) => $checkedCreate('RepresentantFicheChampDto', json, ($checkedConvert) {
  $checkKeys(json, requiredKeys: const ['champ', 'avant', 'apres']);
  final val = RepresentantFicheChampDto(
    champ: $checkedConvert('champ', (v) => v as String),
    avant: $checkedConvert('avant', (v) => v as String?),
    apres: $checkedConvert('apres', (v) => v as String?),
  );
  return val;
});

Map<String, dynamic> _$RepresentantFicheChampDtoToJson(
  RepresentantFicheChampDto instance,
) => <String, dynamic>{
  'champ': instance.champ,
  'avant': instance.avant,
  'apres': instance.apres,
};

// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'visite_stat_recurrent_dto.dart';

// **************************************************************************
// CopyWithGenerator
// **************************************************************************

abstract class _$VisiteStatRecurrentDtoCWProxy {
  VisiteStatRecurrentDto nom(String nom);

  VisiteStatRecurrentDto visites(num visites);

  VisiteStatRecurrentDto derniereVisite(String derniereVisite);

  /// This function **does support** nullification of nullable fields. All `null` values passed to `non-nullable` fields will be ignored. You can also use `VisiteStatRecurrentDto(...).copyWith.fieldName(...)` to override fields one at a time with nullification support.
  ///
  /// Usage
  /// ```dart
  /// VisiteStatRecurrentDto(...).copyWith(id: 12, name: "My name")
  /// ````
  VisiteStatRecurrentDto call({String nom, num visites, String derniereVisite});
}

/// Proxy class for `copyWith` functionality. This is a callable class and can be used as follows: `instanceOfVisiteStatRecurrentDto.copyWith(...)`. Additionally contains functions for specific fields e.g. `instanceOfVisiteStatRecurrentDto.copyWith.fieldName(...)`
class _$VisiteStatRecurrentDtoCWProxyImpl
    implements _$VisiteStatRecurrentDtoCWProxy {
  const _$VisiteStatRecurrentDtoCWProxyImpl(this._value);

  final VisiteStatRecurrentDto _value;

  @override
  VisiteStatRecurrentDto nom(String nom) => this(nom: nom);

  @override
  VisiteStatRecurrentDto visites(num visites) => this(visites: visites);

  @override
  VisiteStatRecurrentDto derniereVisite(String derniereVisite) =>
      this(derniereVisite: derniereVisite);

  @override
  /// This function **does support** nullification of nullable fields. All `null` values passed to `non-nullable` fields will be ignored. You can also use `VisiteStatRecurrentDto(...).copyWith.fieldName(...)` to override fields one at a time with nullification support.
  ///
  /// Usage
  /// ```dart
  /// VisiteStatRecurrentDto(...).copyWith(id: 12, name: "My name")
  /// ````
  VisiteStatRecurrentDto call({
    Object? nom = const $CopyWithPlaceholder(),
    Object? visites = const $CopyWithPlaceholder(),
    Object? derniereVisite = const $CopyWithPlaceholder(),
  }) {
    return VisiteStatRecurrentDto(
      nom: nom == const $CopyWithPlaceholder()
          ? _value.nom
          // ignore: cast_nullable_to_non_nullable
          : nom as String,
      visites: visites == const $CopyWithPlaceholder()
          ? _value.visites
          // ignore: cast_nullable_to_non_nullable
          : visites as num,
      derniereVisite: derniereVisite == const $CopyWithPlaceholder()
          ? _value.derniereVisite
          // ignore: cast_nullable_to_non_nullable
          : derniereVisite as String,
    );
  }
}

extension $VisiteStatRecurrentDtoCopyWith on VisiteStatRecurrentDto {
  /// Returns a callable class that can be used as follows: `instanceOfVisiteStatRecurrentDto.copyWith(...)` or like so:`instanceOfVisiteStatRecurrentDto.copyWith.fieldName(...)`.
  // ignore: library_private_types_in_public_api
  _$VisiteStatRecurrentDtoCWProxy get copyWith =>
      _$VisiteStatRecurrentDtoCWProxyImpl(this);
}

// **************************************************************************
// JsonSerializableGenerator
// **************************************************************************

VisiteStatRecurrentDto _$VisiteStatRecurrentDtoFromJson(
  Map<String, dynamic> json,
) => $checkedCreate('VisiteStatRecurrentDto', json, ($checkedConvert) {
  $checkKeys(json, requiredKeys: const ['nom', 'visites', 'derniereVisite']);
  final val = VisiteStatRecurrentDto(
    nom: $checkedConvert('nom', (v) => v as String),
    visites: $checkedConvert('visites', (v) => v as num),
    derniereVisite: $checkedConvert('derniereVisite', (v) => v as String),
  );
  return val;
});

Map<String, dynamic> _$VisiteStatRecurrentDtoToJson(
  VisiteStatRecurrentDto instance,
) => <String, dynamic>{
  'nom': instance.nom,
  'visites': instance.visites,
  'derniereVisite': instance.derniereVisite,
};

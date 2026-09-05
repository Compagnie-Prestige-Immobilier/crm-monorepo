// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'supervision_campagnes_dto.dart';

// **************************************************************************
// CopyWithGenerator
// **************************************************************************

abstract class _$SupervisionCampagnesDtoCWProxy {
  SupervisionCampagnesDto items(List<SupervisionCampagneDto> items);

  SupervisionCampagnesDto totals(SupervisionCampagnesTotauxDto totals);

  /// This function **does support** nullification of nullable fields. All `null` values passed to `non-nullable` fields will be ignored. You can also use `SupervisionCampagnesDto(...).copyWith.fieldName(...)` to override fields one at a time with nullification support.
  ///
  /// Usage
  /// ```dart
  /// SupervisionCampagnesDto(...).copyWith(id: 12, name: "My name")
  /// ````
  SupervisionCampagnesDto call({
    List<SupervisionCampagneDto> items,
    SupervisionCampagnesTotauxDto totals,
  });
}

/// Proxy class for `copyWith` functionality. This is a callable class and can be used as follows: `instanceOfSupervisionCampagnesDto.copyWith(...)`. Additionally contains functions for specific fields e.g. `instanceOfSupervisionCampagnesDto.copyWith.fieldName(...)`
class _$SupervisionCampagnesDtoCWProxyImpl
    implements _$SupervisionCampagnesDtoCWProxy {
  const _$SupervisionCampagnesDtoCWProxyImpl(this._value);

  final SupervisionCampagnesDto _value;

  @override
  SupervisionCampagnesDto items(List<SupervisionCampagneDto> items) =>
      this(items: items);

  @override
  SupervisionCampagnesDto totals(SupervisionCampagnesTotauxDto totals) =>
      this(totals: totals);

  @override
  /// This function **does support** nullification of nullable fields. All `null` values passed to `non-nullable` fields will be ignored. You can also use `SupervisionCampagnesDto(...).copyWith.fieldName(...)` to override fields one at a time with nullification support.
  ///
  /// Usage
  /// ```dart
  /// SupervisionCampagnesDto(...).copyWith(id: 12, name: "My name")
  /// ````
  SupervisionCampagnesDto call({
    Object? items = const $CopyWithPlaceholder(),
    Object? totals = const $CopyWithPlaceholder(),
  }) {
    return SupervisionCampagnesDto(
      items: items == const $CopyWithPlaceholder()
          ? _value.items
          // ignore: cast_nullable_to_non_nullable
          : items as List<SupervisionCampagneDto>,
      totals: totals == const $CopyWithPlaceholder()
          ? _value.totals
          // ignore: cast_nullable_to_non_nullable
          : totals as SupervisionCampagnesTotauxDto,
    );
  }
}

extension $SupervisionCampagnesDtoCopyWith on SupervisionCampagnesDto {
  /// Returns a callable class that can be used as follows: `instanceOfSupervisionCampagnesDto.copyWith(...)` or like so:`instanceOfSupervisionCampagnesDto.copyWith.fieldName(...)`.
  // ignore: library_private_types_in_public_api
  _$SupervisionCampagnesDtoCWProxy get copyWith =>
      _$SupervisionCampagnesDtoCWProxyImpl(this);
}

// **************************************************************************
// JsonSerializableGenerator
// **************************************************************************

SupervisionCampagnesDto _$SupervisionCampagnesDtoFromJson(
  Map<String, dynamic> json,
) => $checkedCreate('SupervisionCampagnesDto', json, ($checkedConvert) {
  $checkKeys(json, requiredKeys: const ['items', 'totals']);
  final val = SupervisionCampagnesDto(
    items: $checkedConvert(
      'items',
      (v) => (v as List<dynamic>)
          .map(
            (e) => SupervisionCampagneDto.fromJson(e as Map<String, dynamic>),
          )
          .toList(),
    ),
    totals: $checkedConvert(
      'totals',
      (v) => SupervisionCampagnesTotauxDto.fromJson(v as Map<String, dynamic>),
    ),
  );
  return val;
});

Map<String, dynamic> _$SupervisionCampagnesDtoToJson(
  SupervisionCampagnesDto instance,
) => <String, dynamic>{
  'items': instance.items.map((e) => e.toJson()).toList(),
  'totals': instance.totals.toJson(),
};

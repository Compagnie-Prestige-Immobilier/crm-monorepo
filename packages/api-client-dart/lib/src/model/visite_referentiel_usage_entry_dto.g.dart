// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'visite_referentiel_usage_entry_dto.dart';

// **************************************************************************
// CopyWithGenerator
// **************************************************************************

abstract class _$VisiteReferentielUsageEntryDtoCWProxy {
  VisiteReferentielUsageEntryDto id(String id);

  VisiteReferentielUsageEntryDto count(num count);

  /// This function **does support** nullification of nullable fields. All `null` values passed to `non-nullable` fields will be ignored. You can also use `VisiteReferentielUsageEntryDto(...).copyWith.fieldName(...)` to override fields one at a time with nullification support.
  ///
  /// Usage
  /// ```dart
  /// VisiteReferentielUsageEntryDto(...).copyWith(id: 12, name: "My name")
  /// ````
  VisiteReferentielUsageEntryDto call({String id, num count});
}

/// Proxy class for `copyWith` functionality. This is a callable class and can be used as follows: `instanceOfVisiteReferentielUsageEntryDto.copyWith(...)`. Additionally contains functions for specific fields e.g. `instanceOfVisiteReferentielUsageEntryDto.copyWith.fieldName(...)`
class _$VisiteReferentielUsageEntryDtoCWProxyImpl
    implements _$VisiteReferentielUsageEntryDtoCWProxy {
  const _$VisiteReferentielUsageEntryDtoCWProxyImpl(this._value);

  final VisiteReferentielUsageEntryDto _value;

  @override
  VisiteReferentielUsageEntryDto id(String id) => this(id: id);

  @override
  VisiteReferentielUsageEntryDto count(num count) => this(count: count);

  @override
  /// This function **does support** nullification of nullable fields. All `null` values passed to `non-nullable` fields will be ignored. You can also use `VisiteReferentielUsageEntryDto(...).copyWith.fieldName(...)` to override fields one at a time with nullification support.
  ///
  /// Usage
  /// ```dart
  /// VisiteReferentielUsageEntryDto(...).copyWith(id: 12, name: "My name")
  /// ````
  VisiteReferentielUsageEntryDto call({
    Object? id = const $CopyWithPlaceholder(),
    Object? count = const $CopyWithPlaceholder(),
  }) {
    return VisiteReferentielUsageEntryDto(
      id: id == const $CopyWithPlaceholder()
          ? _value.id
          // ignore: cast_nullable_to_non_nullable
          : id as String,
      count: count == const $CopyWithPlaceholder()
          ? _value.count
          // ignore: cast_nullable_to_non_nullable
          : count as num,
    );
  }
}

extension $VisiteReferentielUsageEntryDtoCopyWith
    on VisiteReferentielUsageEntryDto {
  /// Returns a callable class that can be used as follows: `instanceOfVisiteReferentielUsageEntryDto.copyWith(...)` or like so:`instanceOfVisiteReferentielUsageEntryDto.copyWith.fieldName(...)`.
  // ignore: library_private_types_in_public_api
  _$VisiteReferentielUsageEntryDtoCWProxy get copyWith =>
      _$VisiteReferentielUsageEntryDtoCWProxyImpl(this);
}

// **************************************************************************
// JsonSerializableGenerator
// **************************************************************************

VisiteReferentielUsageEntryDto _$VisiteReferentielUsageEntryDtoFromJson(
  Map<String, dynamic> json,
) => $checkedCreate('VisiteReferentielUsageEntryDto', json, ($checkedConvert) {
  $checkKeys(json, requiredKeys: const ['id', 'count']);
  final val = VisiteReferentielUsageEntryDto(
    id: $checkedConvert('id', (v) => v as String),
    count: $checkedConvert('count', (v) => v as num),
  );
  return val;
});

Map<String, dynamic> _$VisiteReferentielUsageEntryDtoToJson(
  VisiteReferentielUsageEntryDto instance,
) => <String, dynamic>{'id': instance.id, 'count': instance.count};

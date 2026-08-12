// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'reassign_prospects_dto.dart';

// **************************************************************************
// CopyWithGenerator
// **************************************************************************

abstract class _$ReassignProspectsDtoCWProxy {
  ReassignProspectsDto prospectIds(List<String> prospectIds);

  ReassignProspectsDto representantId(String? representantId);

  ReassignProspectsDto commercialId(String? commercialId);

  /// This function **does support** nullification of nullable fields. All `null` values passed to `non-nullable` fields will be ignored. You can also use `ReassignProspectsDto(...).copyWith.fieldName(...)` to override fields one at a time with nullification support.
  ///
  /// Usage
  /// ```dart
  /// ReassignProspectsDto(...).copyWith(id: 12, name: "My name")
  /// ````
  ReassignProspectsDto call({
    List<String> prospectIds,
    String? representantId,
    String? commercialId,
  });
}

/// Proxy class for `copyWith` functionality. This is a callable class and can be used as follows: `instanceOfReassignProspectsDto.copyWith(...)`. Additionally contains functions for specific fields e.g. `instanceOfReassignProspectsDto.copyWith.fieldName(...)`
class _$ReassignProspectsDtoCWProxyImpl
    implements _$ReassignProspectsDtoCWProxy {
  const _$ReassignProspectsDtoCWProxyImpl(this._value);

  final ReassignProspectsDto _value;

  @override
  ReassignProspectsDto prospectIds(List<String> prospectIds) =>
      this(prospectIds: prospectIds);

  @override
  ReassignProspectsDto representantId(String? representantId) =>
      this(representantId: representantId);

  @override
  ReassignProspectsDto commercialId(String? commercialId) =>
      this(commercialId: commercialId);

  @override
  /// This function **does support** nullification of nullable fields. All `null` values passed to `non-nullable` fields will be ignored. You can also use `ReassignProspectsDto(...).copyWith.fieldName(...)` to override fields one at a time with nullification support.
  ///
  /// Usage
  /// ```dart
  /// ReassignProspectsDto(...).copyWith(id: 12, name: "My name")
  /// ````
  ReassignProspectsDto call({
    Object? prospectIds = const $CopyWithPlaceholder(),
    Object? representantId = const $CopyWithPlaceholder(),
    Object? commercialId = const $CopyWithPlaceholder(),
  }) {
    return ReassignProspectsDto(
      prospectIds: prospectIds == const $CopyWithPlaceholder()
          ? _value.prospectIds
          // ignore: cast_nullable_to_non_nullable
          : prospectIds as List<String>,
      representantId: representantId == const $CopyWithPlaceholder()
          ? _value.representantId
          // ignore: cast_nullable_to_non_nullable
          : representantId as String?,
      commercialId: commercialId == const $CopyWithPlaceholder()
          ? _value.commercialId
          // ignore: cast_nullable_to_non_nullable
          : commercialId as String?,
    );
  }
}

extension $ReassignProspectsDtoCopyWith on ReassignProspectsDto {
  /// Returns a callable class that can be used as follows: `instanceOfReassignProspectsDto.copyWith(...)` or like so:`instanceOfReassignProspectsDto.copyWith.fieldName(...)`.
  // ignore: library_private_types_in_public_api
  _$ReassignProspectsDtoCWProxy get copyWith =>
      _$ReassignProspectsDtoCWProxyImpl(this);
}

// **************************************************************************
// JsonSerializableGenerator
// **************************************************************************

ReassignProspectsDto _$ReassignProspectsDtoFromJson(
  Map<String, dynamic> json,
) => $checkedCreate('ReassignProspectsDto', json, ($checkedConvert) {
  $checkKeys(json, requiredKeys: const ['prospectIds']);
  final val = ReassignProspectsDto(
    prospectIds: $checkedConvert(
      'prospectIds',
      (v) => (v as List<dynamic>).map((e) => e as String).toList(),
    ),
    representantId: $checkedConvert('representantId', (v) => v as String?),
    commercialId: $checkedConvert('commercialId', (v) => v as String?),
  );
  return val;
});

Map<String, dynamic> _$ReassignProspectsDtoToJson(
  ReassignProspectsDto instance,
) => <String, dynamic>{
  'prospectIds': instance.prospectIds,
  if (instance.representantId case final value?) 'representantId': value,
  if (instance.commercialId case final value?) 'commercialId': value,
};

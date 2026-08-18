// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'change_prospect_segment_dto.dart';

// **************************************************************************
// CopyWithGenerator
// **************************************************************************

abstract class _$ChangeProspectSegmentDtoCWProxy {
  ChangeProspectSegmentDto banqueId(String? banqueId);

  ChangeProspectSegmentDto syndicatId(String? syndicatId);

  ChangeProspectSegmentDto reason(String reason);

  ChangeProspectSegmentDto expectedRev(num expectedRev);

  /// This function **does support** nullification of nullable fields. All `null` values passed to `non-nullable` fields will be ignored. You can also use `ChangeProspectSegmentDto(...).copyWith.fieldName(...)` to override fields one at a time with nullification support.
  ///
  /// Usage
  /// ```dart
  /// ChangeProspectSegmentDto(...).copyWith(id: 12, name: "My name")
  /// ````
  ChangeProspectSegmentDto call({
    String? banqueId,
    String? syndicatId,
    String reason,
    num expectedRev,
  });
}

/// Proxy class for `copyWith` functionality. This is a callable class and can be used as follows: `instanceOfChangeProspectSegmentDto.copyWith(...)`. Additionally contains functions for specific fields e.g. `instanceOfChangeProspectSegmentDto.copyWith.fieldName(...)`
class _$ChangeProspectSegmentDtoCWProxyImpl
    implements _$ChangeProspectSegmentDtoCWProxy {
  const _$ChangeProspectSegmentDtoCWProxyImpl(this._value);

  final ChangeProspectSegmentDto _value;

  @override
  ChangeProspectSegmentDto banqueId(String? banqueId) =>
      this(banqueId: banqueId);

  @override
  ChangeProspectSegmentDto syndicatId(String? syndicatId) =>
      this(syndicatId: syndicatId);

  @override
  ChangeProspectSegmentDto reason(String reason) => this(reason: reason);

  @override
  ChangeProspectSegmentDto expectedRev(num expectedRev) =>
      this(expectedRev: expectedRev);

  @override
  /// This function **does support** nullification of nullable fields. All `null` values passed to `non-nullable` fields will be ignored. You can also use `ChangeProspectSegmentDto(...).copyWith.fieldName(...)` to override fields one at a time with nullification support.
  ///
  /// Usage
  /// ```dart
  /// ChangeProspectSegmentDto(...).copyWith(id: 12, name: "My name")
  /// ````
  ChangeProspectSegmentDto call({
    Object? banqueId = const $CopyWithPlaceholder(),
    Object? syndicatId = const $CopyWithPlaceholder(),
    Object? reason = const $CopyWithPlaceholder(),
    Object? expectedRev = const $CopyWithPlaceholder(),
  }) {
    return ChangeProspectSegmentDto(
      banqueId: banqueId == const $CopyWithPlaceholder()
          ? _value.banqueId
          // ignore: cast_nullable_to_non_nullable
          : banqueId as String?,
      syndicatId: syndicatId == const $CopyWithPlaceholder()
          ? _value.syndicatId
          // ignore: cast_nullable_to_non_nullable
          : syndicatId as String?,
      reason: reason == const $CopyWithPlaceholder()
          ? _value.reason
          // ignore: cast_nullable_to_non_nullable
          : reason as String,
      expectedRev: expectedRev == const $CopyWithPlaceholder()
          ? _value.expectedRev
          // ignore: cast_nullable_to_non_nullable
          : expectedRev as num,
    );
  }
}

extension $ChangeProspectSegmentDtoCopyWith on ChangeProspectSegmentDto {
  /// Returns a callable class that can be used as follows: `instanceOfChangeProspectSegmentDto.copyWith(...)` or like so:`instanceOfChangeProspectSegmentDto.copyWith.fieldName(...)`.
  // ignore: library_private_types_in_public_api
  _$ChangeProspectSegmentDtoCWProxy get copyWith =>
      _$ChangeProspectSegmentDtoCWProxyImpl(this);
}

// **************************************************************************
// JsonSerializableGenerator
// **************************************************************************

ChangeProspectSegmentDto _$ChangeProspectSegmentDtoFromJson(
  Map<String, dynamic> json,
) => $checkedCreate('ChangeProspectSegmentDto', json, ($checkedConvert) {
  $checkKeys(json, requiredKeys: const ['reason', 'expectedRev']);
  final val = ChangeProspectSegmentDto(
    banqueId: $checkedConvert('banqueId', (v) => v as String?),
    syndicatId: $checkedConvert('syndicatId', (v) => v as String?),
    reason: $checkedConvert('reason', (v) => v as String),
    expectedRev: $checkedConvert('expectedRev', (v) => v as num),
  );
  return val;
});

Map<String, dynamic> _$ChangeProspectSegmentDtoToJson(
  ChangeProspectSegmentDto instance,
) => <String, dynamic>{
  if (instance.banqueId case final value?) 'banqueId': value,
  if (instance.syndicatId case final value?) 'syndicatId': value,
  'reason': instance.reason,
  'expectedRev': instance.expectedRev,
};

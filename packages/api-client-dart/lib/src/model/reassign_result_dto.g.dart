// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'reassign_result_dto.dart';

// **************************************************************************
// CopyWithGenerator
// **************************************************************************

abstract class _$ReassignResultDtoCWProxy {
  ReassignResultDto updated(num updated);

  ReassignResultDto prospectIds(List<String> prospectIds);

  /// This function **does support** nullification of nullable fields. All `null` values passed to `non-nullable` fields will be ignored. You can also use `ReassignResultDto(...).copyWith.fieldName(...)` to override fields one at a time with nullification support.
  ///
  /// Usage
  /// ```dart
  /// ReassignResultDto(...).copyWith(id: 12, name: "My name")
  /// ````
  ReassignResultDto call({num updated, List<String> prospectIds});
}

/// Proxy class for `copyWith` functionality. This is a callable class and can be used as follows: `instanceOfReassignResultDto.copyWith(...)`. Additionally contains functions for specific fields e.g. `instanceOfReassignResultDto.copyWith.fieldName(...)`
class _$ReassignResultDtoCWProxyImpl implements _$ReassignResultDtoCWProxy {
  const _$ReassignResultDtoCWProxyImpl(this._value);

  final ReassignResultDto _value;

  @override
  ReassignResultDto updated(num updated) => this(updated: updated);

  @override
  ReassignResultDto prospectIds(List<String> prospectIds) =>
      this(prospectIds: prospectIds);

  @override
  /// This function **does support** nullification of nullable fields. All `null` values passed to `non-nullable` fields will be ignored. You can also use `ReassignResultDto(...).copyWith.fieldName(...)` to override fields one at a time with nullification support.
  ///
  /// Usage
  /// ```dart
  /// ReassignResultDto(...).copyWith(id: 12, name: "My name")
  /// ````
  ReassignResultDto call({
    Object? updated = const $CopyWithPlaceholder(),
    Object? prospectIds = const $CopyWithPlaceholder(),
  }) {
    return ReassignResultDto(
      updated: updated == const $CopyWithPlaceholder()
          ? _value.updated
          // ignore: cast_nullable_to_non_nullable
          : updated as num,
      prospectIds: prospectIds == const $CopyWithPlaceholder()
          ? _value.prospectIds
          // ignore: cast_nullable_to_non_nullable
          : prospectIds as List<String>,
    );
  }
}

extension $ReassignResultDtoCopyWith on ReassignResultDto {
  /// Returns a callable class that can be used as follows: `instanceOfReassignResultDto.copyWith(...)` or like so:`instanceOfReassignResultDto.copyWith.fieldName(...)`.
  // ignore: library_private_types_in_public_api
  _$ReassignResultDtoCWProxy get copyWith =>
      _$ReassignResultDtoCWProxyImpl(this);
}

// **************************************************************************
// JsonSerializableGenerator
// **************************************************************************

ReassignResultDto _$ReassignResultDtoFromJson(Map<String, dynamic> json) =>
    $checkedCreate('ReassignResultDto', json, ($checkedConvert) {
      $checkKeys(json, requiredKeys: const ['updated', 'prospectIds']);
      final val = ReassignResultDto(
        updated: $checkedConvert('updated', (v) => v as num),
        prospectIds: $checkedConvert(
          'prospectIds',
          (v) => (v as List<dynamic>).map((e) => e as String).toList(),
        ),
      );
      return val;
    });

Map<String, dynamic> _$ReassignResultDtoToJson(ReassignResultDto instance) =>
    <String, dynamic>{
      'updated': instance.updated,
      'prospectIds': instance.prospectIds,
    };

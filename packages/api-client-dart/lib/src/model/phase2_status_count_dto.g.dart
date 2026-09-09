// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'phase2_status_count_dto.dart';

// **************************************************************************
// CopyWithGenerator
// **************************************************************************

abstract class _$Phase2StatusCountDtoCWProxy {
  Phase2StatusCountDto status(Phase2Status status);

  Phase2StatusCountDto label(String label);

  Phase2StatusCountDto prospects(num prospects);

  Phase2StatusCountDto share(num share);

  /// This function **does support** nullification of nullable fields. All `null` values passed to `non-nullable` fields will be ignored. You can also use `Phase2StatusCountDto(...).copyWith.fieldName(...)` to override fields one at a time with nullification support.
  ///
  /// Usage
  /// ```dart
  /// Phase2StatusCountDto(...).copyWith(id: 12, name: "My name")
  /// ````
  Phase2StatusCountDto call({
    Phase2Status status,
    String label,
    num prospects,
    num share,
  });
}

/// Proxy class for `copyWith` functionality. This is a callable class and can be used as follows: `instanceOfPhase2StatusCountDto.copyWith(...)`. Additionally contains functions for specific fields e.g. `instanceOfPhase2StatusCountDto.copyWith.fieldName(...)`
class _$Phase2StatusCountDtoCWProxyImpl
    implements _$Phase2StatusCountDtoCWProxy {
  const _$Phase2StatusCountDtoCWProxyImpl(this._value);

  final Phase2StatusCountDto _value;

  @override
  Phase2StatusCountDto status(Phase2Status status) => this(status: status);

  @override
  Phase2StatusCountDto label(String label) => this(label: label);

  @override
  Phase2StatusCountDto prospects(num prospects) => this(prospects: prospects);

  @override
  Phase2StatusCountDto share(num share) => this(share: share);

  @override
  /// This function **does support** nullification of nullable fields. All `null` values passed to `non-nullable` fields will be ignored. You can also use `Phase2StatusCountDto(...).copyWith.fieldName(...)` to override fields one at a time with nullification support.
  ///
  /// Usage
  /// ```dart
  /// Phase2StatusCountDto(...).copyWith(id: 12, name: "My name")
  /// ````
  Phase2StatusCountDto call({
    Object? status = const $CopyWithPlaceholder(),
    Object? label = const $CopyWithPlaceholder(),
    Object? prospects = const $CopyWithPlaceholder(),
    Object? share = const $CopyWithPlaceholder(),
  }) {
    return Phase2StatusCountDto(
      status: status == const $CopyWithPlaceholder()
          ? _value.status
          // ignore: cast_nullable_to_non_nullable
          : status as Phase2Status,
      label: label == const $CopyWithPlaceholder()
          ? _value.label
          // ignore: cast_nullable_to_non_nullable
          : label as String,
      prospects: prospects == const $CopyWithPlaceholder()
          ? _value.prospects
          // ignore: cast_nullable_to_non_nullable
          : prospects as num,
      share: share == const $CopyWithPlaceholder()
          ? _value.share
          // ignore: cast_nullable_to_non_nullable
          : share as num,
    );
  }
}

extension $Phase2StatusCountDtoCopyWith on Phase2StatusCountDto {
  /// Returns a callable class that can be used as follows: `instanceOfPhase2StatusCountDto.copyWith(...)` or like so:`instanceOfPhase2StatusCountDto.copyWith.fieldName(...)`.
  // ignore: library_private_types_in_public_api
  _$Phase2StatusCountDtoCWProxy get copyWith =>
      _$Phase2StatusCountDtoCWProxyImpl(this);
}

// **************************************************************************
// JsonSerializableGenerator
// **************************************************************************

Phase2StatusCountDto _$Phase2StatusCountDtoFromJson(
  Map<String, dynamic> json,
) => $checkedCreate('Phase2StatusCountDto', json, ($checkedConvert) {
  $checkKeys(
    json,
    requiredKeys: const ['status', 'label', 'prospects', 'share'],
  );
  final val = Phase2StatusCountDto(
    status: $checkedConvert(
      'status',
      (v) => $enumDecode(
        _$Phase2StatusEnumMap,
        v,
        unknownValue: Phase2Status.unknownDefaultOpenApi,
      ),
    ),
    label: $checkedConvert('label', (v) => v as String),
    prospects: $checkedConvert('prospects', (v) => v as num),
    share: $checkedConvert('share', (v) => v as num),
  );
  return val;
});

Map<String, dynamic> _$Phase2StatusCountDtoToJson(
  Phase2StatusCountDto instance,
) => <String, dynamic>{
  'status': _$Phase2StatusEnumMap[instance.status]!,
  'label': instance.label,
  'prospects': instance.prospects,
  'share': instance.share,
};

const _$Phase2StatusEnumMap = {
  Phase2Status.PENDING: 'PENDING',
  Phase2Status.METHOD_OBTAINED: 'METHOD_OBTAINED',
  Phase2Status.REFUSED: 'REFUSED',
  Phase2Status.WRONG_NUMBER: 'WRONG_NUMBER',
  Phase2Status.unknownDefaultOpenApi: 'unknown_default_open_api',
};

// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'segment_conversion_origin_dto.dart';

// **************************************************************************
// CopyWithGenerator
// **************************************************************************

abstract class _$SegmentConversionOriginDtoCWProxy {
  SegmentConversionOriginDto segment(BddSegment segment);

  SegmentConversionOriginDto conversions(num conversions);

  /// This function **does support** nullification of nullable fields. All `null` values passed to `non-nullable` fields will be ignored. You can also use `SegmentConversionOriginDto(...).copyWith.fieldName(...)` to override fields one at a time with nullification support.
  ///
  /// Usage
  /// ```dart
  /// SegmentConversionOriginDto(...).copyWith(id: 12, name: "My name")
  /// ````
  SegmentConversionOriginDto call({BddSegment segment, num conversions});
}

/// Proxy class for `copyWith` functionality. This is a callable class and can be used as follows: `instanceOfSegmentConversionOriginDto.copyWith(...)`. Additionally contains functions for specific fields e.g. `instanceOfSegmentConversionOriginDto.copyWith.fieldName(...)`
class _$SegmentConversionOriginDtoCWProxyImpl
    implements _$SegmentConversionOriginDtoCWProxy {
  const _$SegmentConversionOriginDtoCWProxyImpl(this._value);

  final SegmentConversionOriginDto _value;

  @override
  SegmentConversionOriginDto segment(BddSegment segment) =>
      this(segment: segment);

  @override
  SegmentConversionOriginDto conversions(num conversions) =>
      this(conversions: conversions);

  @override
  /// This function **does support** nullification of nullable fields. All `null` values passed to `non-nullable` fields will be ignored. You can also use `SegmentConversionOriginDto(...).copyWith.fieldName(...)` to override fields one at a time with nullification support.
  ///
  /// Usage
  /// ```dart
  /// SegmentConversionOriginDto(...).copyWith(id: 12, name: "My name")
  /// ````
  SegmentConversionOriginDto call({
    Object? segment = const $CopyWithPlaceholder(),
    Object? conversions = const $CopyWithPlaceholder(),
  }) {
    return SegmentConversionOriginDto(
      segment: segment == const $CopyWithPlaceholder()
          ? _value.segment
          // ignore: cast_nullable_to_non_nullable
          : segment as BddSegment,
      conversions: conversions == const $CopyWithPlaceholder()
          ? _value.conversions
          // ignore: cast_nullable_to_non_nullable
          : conversions as num,
    );
  }
}

extension $SegmentConversionOriginDtoCopyWith on SegmentConversionOriginDto {
  /// Returns a callable class that can be used as follows: `instanceOfSegmentConversionOriginDto.copyWith(...)` or like so:`instanceOfSegmentConversionOriginDto.copyWith.fieldName(...)`.
  // ignore: library_private_types_in_public_api
  _$SegmentConversionOriginDtoCWProxy get copyWith =>
      _$SegmentConversionOriginDtoCWProxyImpl(this);
}

// **************************************************************************
// JsonSerializableGenerator
// **************************************************************************

SegmentConversionOriginDto _$SegmentConversionOriginDtoFromJson(
  Map<String, dynamic> json,
) => $checkedCreate('SegmentConversionOriginDto', json, ($checkedConvert) {
  $checkKeys(json, requiredKeys: const ['segment', 'conversions']);
  final val = SegmentConversionOriginDto(
    segment: $checkedConvert(
      'segment',
      (v) => $enumDecode(
        _$BddSegmentEnumMap,
        v,
        unknownValue: BddSegment.unknownDefaultOpenApi,
      ),
    ),
    conversions: $checkedConvert('conversions', (v) => v as num),
  );
  return val;
});

Map<String, dynamic> _$SegmentConversionOriginDtoToJson(
  SegmentConversionOriginDto instance,
) => <String, dynamic>{
  'segment': _$BddSegmentEnumMap[instance.segment]!,
  'conversions': instance.conversions,
};

const _$BddSegmentEnumMap = {
  BddSegment.BDD1: 'BDD1',
  BddSegment.BDD2: 'BDD2',
  BddSegment.BDD3: 'BDD3',
  BddSegment.BDD4: 'BDD4',
  BddSegment.unknownDefaultOpenApi: 'unknown_default_open_api',
};

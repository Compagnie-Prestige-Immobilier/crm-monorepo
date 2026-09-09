// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'segment_count_dto.dart';

// **************************************************************************
// CopyWithGenerator
// **************************************************************************

abstract class _$SegmentCountDtoCWProxy {
  SegmentCountDto segment(BddSegment segment);

  SegmentCountDto label(String label);

  SegmentCountDto prospects(num prospects);

  SegmentCountDto share(num share);

  SegmentCountDto methodObtained(num methodObtained);

  /// This function **does support** nullification of nullable fields. All `null` values passed to `non-nullable` fields will be ignored. You can also use `SegmentCountDto(...).copyWith.fieldName(...)` to override fields one at a time with nullification support.
  ///
  /// Usage
  /// ```dart
  /// SegmentCountDto(...).copyWith(id: 12, name: "My name")
  /// ````
  SegmentCountDto call({
    BddSegment segment,
    String label,
    num prospects,
    num share,
    num methodObtained,
  });
}

/// Proxy class for `copyWith` functionality. This is a callable class and can be used as follows: `instanceOfSegmentCountDto.copyWith(...)`. Additionally contains functions for specific fields e.g. `instanceOfSegmentCountDto.copyWith.fieldName(...)`
class _$SegmentCountDtoCWProxyImpl implements _$SegmentCountDtoCWProxy {
  const _$SegmentCountDtoCWProxyImpl(this._value);

  final SegmentCountDto _value;

  @override
  SegmentCountDto segment(BddSegment segment) => this(segment: segment);

  @override
  SegmentCountDto label(String label) => this(label: label);

  @override
  SegmentCountDto prospects(num prospects) => this(prospects: prospects);

  @override
  SegmentCountDto share(num share) => this(share: share);

  @override
  SegmentCountDto methodObtained(num methodObtained) =>
      this(methodObtained: methodObtained);

  @override
  /// This function **does support** nullification of nullable fields. All `null` values passed to `non-nullable` fields will be ignored. You can also use `SegmentCountDto(...).copyWith.fieldName(...)` to override fields one at a time with nullification support.
  ///
  /// Usage
  /// ```dart
  /// SegmentCountDto(...).copyWith(id: 12, name: "My name")
  /// ````
  SegmentCountDto call({
    Object? segment = const $CopyWithPlaceholder(),
    Object? label = const $CopyWithPlaceholder(),
    Object? prospects = const $CopyWithPlaceholder(),
    Object? share = const $CopyWithPlaceholder(),
    Object? methodObtained = const $CopyWithPlaceholder(),
  }) {
    return SegmentCountDto(
      segment: segment == const $CopyWithPlaceholder()
          ? _value.segment
          // ignore: cast_nullable_to_non_nullable
          : segment as BddSegment,
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
      methodObtained: methodObtained == const $CopyWithPlaceholder()
          ? _value.methodObtained
          // ignore: cast_nullable_to_non_nullable
          : methodObtained as num,
    );
  }
}

extension $SegmentCountDtoCopyWith on SegmentCountDto {
  /// Returns a callable class that can be used as follows: `instanceOfSegmentCountDto.copyWith(...)` or like so:`instanceOfSegmentCountDto.copyWith.fieldName(...)`.
  // ignore: library_private_types_in_public_api
  _$SegmentCountDtoCWProxy get copyWith => _$SegmentCountDtoCWProxyImpl(this);
}

// **************************************************************************
// JsonSerializableGenerator
// **************************************************************************

SegmentCountDto _$SegmentCountDtoFromJson(Map<String, dynamic> json) =>
    $checkedCreate('SegmentCountDto', json, ($checkedConvert) {
      $checkKeys(
        json,
        requiredKeys: const [
          'segment',
          'label',
          'prospects',
          'share',
          'methodObtained',
        ],
      );
      final val = SegmentCountDto(
        segment: $checkedConvert(
          'segment',
          (v) => $enumDecode(
            _$BddSegmentEnumMap,
            v,
            unknownValue: BddSegment.unknownDefaultOpenApi,
          ),
        ),
        label: $checkedConvert('label', (v) => v as String),
        prospects: $checkedConvert('prospects', (v) => v as num),
        share: $checkedConvert('share', (v) => v as num),
        methodObtained: $checkedConvert('methodObtained', (v) => v as num),
      );
      return val;
    });

Map<String, dynamic> _$SegmentCountDtoToJson(SegmentCountDto instance) =>
    <String, dynamic>{
      'segment': _$BddSegmentEnumMap[instance.segment]!,
      'label': instance.label,
      'prospects': instance.prospects,
      'share': instance.share,
      'methodObtained': instance.methodObtained,
    };

const _$BddSegmentEnumMap = {
  BddSegment.BDD1: 'BDD1',
  BddSegment.BDD2: 'BDD2',
  BddSegment.BDD3: 'BDD3',
  BddSegment.BDD4: 'BDD4',
  BddSegment.unknownDefaultOpenApi: 'unknown_default_open_api',
};

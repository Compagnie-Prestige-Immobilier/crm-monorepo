// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'merge_prospects_dto.dart';

// **************************************************************************
// CopyWithGenerator
// **************************************************************************

abstract class _$MergeProspectsDtoCWProxy {
  MergeProspectsDto targetId(String targetId);

  MergeProspectsDto sourceId(String sourceId);

  MergeProspectsDto preferSource(bool? preferSource);

  /// This function **does support** nullification of nullable fields. All `null` values passed to `non-nullable` fields will be ignored. You can also use `MergeProspectsDto(...).copyWith.fieldName(...)` to override fields one at a time with nullification support.
  ///
  /// Usage
  /// ```dart
  /// MergeProspectsDto(...).copyWith(id: 12, name: "My name")
  /// ````
  MergeProspectsDto call({
    String targetId,
    String sourceId,
    bool? preferSource,
  });
}

/// Proxy class for `copyWith` functionality. This is a callable class and can be used as follows: `instanceOfMergeProspectsDto.copyWith(...)`. Additionally contains functions for specific fields e.g. `instanceOfMergeProspectsDto.copyWith.fieldName(...)`
class _$MergeProspectsDtoCWProxyImpl implements _$MergeProspectsDtoCWProxy {
  const _$MergeProspectsDtoCWProxyImpl(this._value);

  final MergeProspectsDto _value;

  @override
  MergeProspectsDto targetId(String targetId) => this(targetId: targetId);

  @override
  MergeProspectsDto sourceId(String sourceId) => this(sourceId: sourceId);

  @override
  MergeProspectsDto preferSource(bool? preferSource) =>
      this(preferSource: preferSource);

  @override
  /// This function **does support** nullification of nullable fields. All `null` values passed to `non-nullable` fields will be ignored. You can also use `MergeProspectsDto(...).copyWith.fieldName(...)` to override fields one at a time with nullification support.
  ///
  /// Usage
  /// ```dart
  /// MergeProspectsDto(...).copyWith(id: 12, name: "My name")
  /// ````
  MergeProspectsDto call({
    Object? targetId = const $CopyWithPlaceholder(),
    Object? sourceId = const $CopyWithPlaceholder(),
    Object? preferSource = const $CopyWithPlaceholder(),
  }) {
    return MergeProspectsDto(
      targetId: targetId == const $CopyWithPlaceholder()
          ? _value.targetId
          // ignore: cast_nullable_to_non_nullable
          : targetId as String,
      sourceId: sourceId == const $CopyWithPlaceholder()
          ? _value.sourceId
          // ignore: cast_nullable_to_non_nullable
          : sourceId as String,
      preferSource: preferSource == const $CopyWithPlaceholder()
          ? _value.preferSource
          // ignore: cast_nullable_to_non_nullable
          : preferSource as bool?,
    );
  }
}

extension $MergeProspectsDtoCopyWith on MergeProspectsDto {
  /// Returns a callable class that can be used as follows: `instanceOfMergeProspectsDto.copyWith(...)` or like so:`instanceOfMergeProspectsDto.copyWith.fieldName(...)`.
  // ignore: library_private_types_in_public_api
  _$MergeProspectsDtoCWProxy get copyWith =>
      _$MergeProspectsDtoCWProxyImpl(this);
}

// **************************************************************************
// JsonSerializableGenerator
// **************************************************************************

MergeProspectsDto _$MergeProspectsDtoFromJson(Map<String, dynamic> json) =>
    $checkedCreate('MergeProspectsDto', json, ($checkedConvert) {
      $checkKeys(json, requiredKeys: const ['targetId', 'sourceId']);
      final val = MergeProspectsDto(
        targetId: $checkedConvert('targetId', (v) => v as String),
        sourceId: $checkedConvert('sourceId', (v) => v as String),
        preferSource: $checkedConvert(
          'preferSource',
          (v) => v as bool? ?? false,
        ),
      );
      return val;
    });

Map<String, dynamic> _$MergeProspectsDtoToJson(MergeProspectsDto instance) =>
    <String, dynamic>{
      'targetId': instance.targetId,
      'sourceId': instance.sourceId,
      if (instance.preferSource case final value?) 'preferSource': value,
    };

// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'funnel_stage_dto.dart';

// **************************************************************************
// CopyWithGenerator
// **************************************************************************

abstract class _$FunnelStageDtoCWProxy {
  FunnelStageDto label(String label);

  FunnelStageDto count(num count);

  FunnelStageDto tauxEtapePrecedente(num tauxEtapePrecedente);

  FunnelStageDto tauxGlobal(num tauxGlobal);

  /// This function **does support** nullification of nullable fields. All `null` values passed to `non-nullable` fields will be ignored. You can also use `FunnelStageDto(...).copyWith.fieldName(...)` to override fields one at a time with nullification support.
  ///
  /// Usage
  /// ```dart
  /// FunnelStageDto(...).copyWith(id: 12, name: "My name")
  /// ````
  FunnelStageDto call({
    String label,
    num count,
    num tauxEtapePrecedente,
    num tauxGlobal,
  });
}

/// Proxy class for `copyWith` functionality. This is a callable class and can be used as follows: `instanceOfFunnelStageDto.copyWith(...)`. Additionally contains functions for specific fields e.g. `instanceOfFunnelStageDto.copyWith.fieldName(...)`
class _$FunnelStageDtoCWProxyImpl implements _$FunnelStageDtoCWProxy {
  const _$FunnelStageDtoCWProxyImpl(this._value);

  final FunnelStageDto _value;

  @override
  FunnelStageDto label(String label) => this(label: label);

  @override
  FunnelStageDto count(num count) => this(count: count);

  @override
  FunnelStageDto tauxEtapePrecedente(num tauxEtapePrecedente) =>
      this(tauxEtapePrecedente: tauxEtapePrecedente);

  @override
  FunnelStageDto tauxGlobal(num tauxGlobal) => this(tauxGlobal: tauxGlobal);

  @override
  /// This function **does support** nullification of nullable fields. All `null` values passed to `non-nullable` fields will be ignored. You can also use `FunnelStageDto(...).copyWith.fieldName(...)` to override fields one at a time with nullification support.
  ///
  /// Usage
  /// ```dart
  /// FunnelStageDto(...).copyWith(id: 12, name: "My name")
  /// ````
  FunnelStageDto call({
    Object? label = const $CopyWithPlaceholder(),
    Object? count = const $CopyWithPlaceholder(),
    Object? tauxEtapePrecedente = const $CopyWithPlaceholder(),
    Object? tauxGlobal = const $CopyWithPlaceholder(),
  }) {
    return FunnelStageDto(
      label: label == const $CopyWithPlaceholder()
          ? _value.label
          // ignore: cast_nullable_to_non_nullable
          : label as String,
      count: count == const $CopyWithPlaceholder()
          ? _value.count
          // ignore: cast_nullable_to_non_nullable
          : count as num,
      tauxEtapePrecedente: tauxEtapePrecedente == const $CopyWithPlaceholder()
          ? _value.tauxEtapePrecedente
          // ignore: cast_nullable_to_non_nullable
          : tauxEtapePrecedente as num,
      tauxGlobal: tauxGlobal == const $CopyWithPlaceholder()
          ? _value.tauxGlobal
          // ignore: cast_nullable_to_non_nullable
          : tauxGlobal as num,
    );
  }
}

extension $FunnelStageDtoCopyWith on FunnelStageDto {
  /// Returns a callable class that can be used as follows: `instanceOfFunnelStageDto.copyWith(...)` or like so:`instanceOfFunnelStageDto.copyWith.fieldName(...)`.
  // ignore: library_private_types_in_public_api
  _$FunnelStageDtoCWProxy get copyWith => _$FunnelStageDtoCWProxyImpl(this);
}

// **************************************************************************
// JsonSerializableGenerator
// **************************************************************************

FunnelStageDto _$FunnelStageDtoFromJson(Map<String, dynamic> json) =>
    $checkedCreate('FunnelStageDto', json, ($checkedConvert) {
      $checkKeys(
        json,
        requiredKeys: const [
          'label',
          'count',
          'tauxEtapePrecedente',
          'tauxGlobal',
        ],
      );
      final val = FunnelStageDto(
        label: $checkedConvert('label', (v) => v as String),
        count: $checkedConvert('count', (v) => v as num),
        tauxEtapePrecedente: $checkedConvert(
          'tauxEtapePrecedente',
          (v) => v as num,
        ),
        tauxGlobal: $checkedConvert('tauxGlobal', (v) => v as num),
      );
      return val;
    });

Map<String, dynamic> _$FunnelStageDtoToJson(FunnelStageDto instance) =>
    <String, dynamic>{
      'label': instance.label,
      'count': instance.count,
      'tauxEtapePrecedente': instance.tauxEtapePrecedente,
      'tauxGlobal': instance.tauxGlobal,
    };

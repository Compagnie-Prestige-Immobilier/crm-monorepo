// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'disposition_response_dto.dart';

// **************************************************************************
// CopyWithGenerator
// **************************************************************************

abstract class _$DispositionResponseDtoCWProxy {
  DispositionResponseDto widgets(List<DispositionWidgetDto> widgets);

  DispositionResponseDto preset(DashboardPreset preset);

  DispositionResponseDto source_(DispositionResponseDtoSource_Enum source_);

  DispositionResponseDto updatedAt(DateTime? updatedAt);

  /// This function **does support** nullification of nullable fields. All `null` values passed to `non-nullable` fields will be ignored. You can also use `DispositionResponseDto(...).copyWith.fieldName(...)` to override fields one at a time with nullification support.
  ///
  /// Usage
  /// ```dart
  /// DispositionResponseDto(...).copyWith(id: 12, name: "My name")
  /// ````
  DispositionResponseDto call({
    List<DispositionWidgetDto> widgets,
    DashboardPreset preset,
    DispositionResponseDtoSource_Enum source_,
    DateTime? updatedAt,
  });
}

/// Proxy class for `copyWith` functionality. This is a callable class and can be used as follows: `instanceOfDispositionResponseDto.copyWith(...)`. Additionally contains functions for specific fields e.g. `instanceOfDispositionResponseDto.copyWith.fieldName(...)`
class _$DispositionResponseDtoCWProxyImpl
    implements _$DispositionResponseDtoCWProxy {
  const _$DispositionResponseDtoCWProxyImpl(this._value);

  final DispositionResponseDto _value;

  @override
  DispositionResponseDto widgets(List<DispositionWidgetDto> widgets) =>
      this(widgets: widgets);

  @override
  DispositionResponseDto preset(DashboardPreset preset) => this(preset: preset);

  @override
  DispositionResponseDto source_(DispositionResponseDtoSource_Enum source_) =>
      this(source_: source_);

  @override
  DispositionResponseDto updatedAt(DateTime? updatedAt) =>
      this(updatedAt: updatedAt);

  @override
  /// This function **does support** nullification of nullable fields. All `null` values passed to `non-nullable` fields will be ignored. You can also use `DispositionResponseDto(...).copyWith.fieldName(...)` to override fields one at a time with nullification support.
  ///
  /// Usage
  /// ```dart
  /// DispositionResponseDto(...).copyWith(id: 12, name: "My name")
  /// ````
  DispositionResponseDto call({
    Object? widgets = const $CopyWithPlaceholder(),
    Object? preset = const $CopyWithPlaceholder(),
    Object? source_ = const $CopyWithPlaceholder(),
    Object? updatedAt = const $CopyWithPlaceholder(),
  }) {
    return DispositionResponseDto(
      widgets: widgets == const $CopyWithPlaceholder()
          ? _value.widgets
          // ignore: cast_nullable_to_non_nullable
          : widgets as List<DispositionWidgetDto>,
      preset: preset == const $CopyWithPlaceholder()
          ? _value.preset
          // ignore: cast_nullable_to_non_nullable
          : preset as DashboardPreset,
      source_: source_ == const $CopyWithPlaceholder()
          ? _value.source_
          // ignore: cast_nullable_to_non_nullable
          : source_ as DispositionResponseDtoSource_Enum,
      updatedAt: updatedAt == const $CopyWithPlaceholder()
          ? _value.updatedAt
          // ignore: cast_nullable_to_non_nullable
          : updatedAt as DateTime?,
    );
  }
}

extension $DispositionResponseDtoCopyWith on DispositionResponseDto {
  /// Returns a callable class that can be used as follows: `instanceOfDispositionResponseDto.copyWith(...)` or like so:`instanceOfDispositionResponseDto.copyWith.fieldName(...)`.
  // ignore: library_private_types_in_public_api
  _$DispositionResponseDtoCWProxy get copyWith =>
      _$DispositionResponseDtoCWProxyImpl(this);
}

// **************************************************************************
// JsonSerializableGenerator
// **************************************************************************

DispositionResponseDto _$DispositionResponseDtoFromJson(
  Map<String, dynamic> json,
) => $checkedCreate('DispositionResponseDto', json, ($checkedConvert) {
  $checkKeys(
    json,
    requiredKeys: const ['widgets', 'preset', 'source', 'updatedAt'],
  );
  final val = DispositionResponseDto(
    widgets: $checkedConvert(
      'widgets',
      (v) => (v as List<dynamic>)
          .map((e) => DispositionWidgetDto.fromJson(e as Map<String, dynamic>))
          .toList(),
    ),
    preset: $checkedConvert(
      'preset',
      (v) => $enumDecode(
        _$DashboardPresetEnumMap,
        v,
        unknownValue: DashboardPreset.unknownDefaultOpenApi,
      ),
    ),
    source_: $checkedConvert(
      'source',
      (v) => $enumDecode(
        _$DispositionResponseDtoSource_EnumEnumMap,
        v,
        unknownValue: DispositionResponseDtoSource_Enum.unknownDefaultOpenApi,
      ),
    ),
    updatedAt: $checkedConvert(
      'updatedAt',
      (v) => v == null ? null : DateTime.parse(v as String),
    ),
  );
  return val;
}, fieldKeyMap: const {'source_': 'source'});

Map<String, dynamic> _$DispositionResponseDtoToJson(
  DispositionResponseDto instance,
) => <String, dynamic>{
  'widgets': instance.widgets.map((e) => e.toJson()).toList(),
  'preset': _$DashboardPresetEnumMap[instance.preset]!,
  'source': _$DispositionResponseDtoSource_EnumEnumMap[instance.source_]!,
  'updatedAt': instance.updatedAt?.toIso8601String(),
};

const _$DashboardPresetEnumMap = {
  DashboardPreset.essentiel: 'essentiel',
  DashboardPreset.affluence: 'affluence',
  DashboardPreset.organisation: 'organisation',
  DashboardPreset.complet: 'complet',
  DashboardPreset.unknownDefaultOpenApi: 'unknown_default_open_api',
};

const _$DispositionResponseDtoSource_EnumEnumMap = {
  DispositionResponseDtoSource_Enum.utilisateur: 'utilisateur',
  DispositionResponseDtoSource_Enum.defaut: 'defaut',
  DispositionResponseDtoSource_Enum.usine: 'usine',
  DispositionResponseDtoSource_Enum.unknownDefaultOpenApi:
      'unknown_default_open_api',
};

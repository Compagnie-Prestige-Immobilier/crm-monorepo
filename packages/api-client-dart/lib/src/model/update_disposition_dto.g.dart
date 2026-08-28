// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'update_disposition_dto.dart';

// **************************************************************************
// CopyWithGenerator
// **************************************************************************

abstract class _$UpdateDispositionDtoCWProxy {
  UpdateDispositionDto preset(DashboardPreset? preset);

  UpdateDispositionDto widgets(List<DispositionWidgetDto> widgets);

  /// This function **does support** nullification of nullable fields. All `null` values passed to `non-nullable` fields will be ignored. You can also use `UpdateDispositionDto(...).copyWith.fieldName(...)` to override fields one at a time with nullification support.
  ///
  /// Usage
  /// ```dart
  /// UpdateDispositionDto(...).copyWith(id: 12, name: "My name")
  /// ````
  UpdateDispositionDto call({
    DashboardPreset? preset,
    List<DispositionWidgetDto> widgets,
  });
}

/// Proxy class for `copyWith` functionality. This is a callable class and can be used as follows: `instanceOfUpdateDispositionDto.copyWith(...)`. Additionally contains functions for specific fields e.g. `instanceOfUpdateDispositionDto.copyWith.fieldName(...)`
class _$UpdateDispositionDtoCWProxyImpl
    implements _$UpdateDispositionDtoCWProxy {
  const _$UpdateDispositionDtoCWProxyImpl(this._value);

  final UpdateDispositionDto _value;

  @override
  UpdateDispositionDto preset(DashboardPreset? preset) => this(preset: preset);

  @override
  UpdateDispositionDto widgets(List<DispositionWidgetDto> widgets) =>
      this(widgets: widgets);

  @override
  /// This function **does support** nullification of nullable fields. All `null` values passed to `non-nullable` fields will be ignored. You can also use `UpdateDispositionDto(...).copyWith.fieldName(...)` to override fields one at a time with nullification support.
  ///
  /// Usage
  /// ```dart
  /// UpdateDispositionDto(...).copyWith(id: 12, name: "My name")
  /// ````
  UpdateDispositionDto call({
    Object? preset = const $CopyWithPlaceholder(),
    Object? widgets = const $CopyWithPlaceholder(),
  }) {
    return UpdateDispositionDto(
      preset: preset == const $CopyWithPlaceholder()
          ? _value.preset
          // ignore: cast_nullable_to_non_nullable
          : preset as DashboardPreset?,
      widgets: widgets == const $CopyWithPlaceholder()
          ? _value.widgets
          // ignore: cast_nullable_to_non_nullable
          : widgets as List<DispositionWidgetDto>,
    );
  }
}

extension $UpdateDispositionDtoCopyWith on UpdateDispositionDto {
  /// Returns a callable class that can be used as follows: `instanceOfUpdateDispositionDto.copyWith(...)` or like so:`instanceOfUpdateDispositionDto.copyWith.fieldName(...)`.
  // ignore: library_private_types_in_public_api
  _$UpdateDispositionDtoCWProxy get copyWith =>
      _$UpdateDispositionDtoCWProxyImpl(this);
}

// **************************************************************************
// JsonSerializableGenerator
// **************************************************************************

UpdateDispositionDto _$UpdateDispositionDtoFromJson(
  Map<String, dynamic> json,
) => $checkedCreate('UpdateDispositionDto', json, ($checkedConvert) {
  $checkKeys(json, requiredKeys: const ['widgets']);
  final val = UpdateDispositionDto(
    preset: $checkedConvert(
      'preset',
      (v) => $enumDecodeNullable(
        _$DashboardPresetEnumMap,
        v,
        unknownValue: DashboardPreset.unknownDefaultOpenApi,
      ),
    ),
    widgets: $checkedConvert(
      'widgets',
      (v) => (v as List<dynamic>)
          .map((e) => DispositionWidgetDto.fromJson(e as Map<String, dynamic>))
          .toList(),
    ),
  );
  return val;
});

Map<String, dynamic> _$UpdateDispositionDtoToJson(
  UpdateDispositionDto instance,
) => <String, dynamic>{
  if (_$DashboardPresetEnumMap[instance.preset] case final value?)
    'preset': value,
  'widgets': instance.widgets.map((e) => e.toJson()).toList(),
};

const _$DashboardPresetEnumMap = {
  DashboardPreset.essentiel: 'essentiel',
  DashboardPreset.affluence: 'affluence',
  DashboardPreset.organisation: 'organisation',
  DashboardPreset.complet: 'complet',
  DashboardPreset.unknownDefaultOpenApi: 'unknown_default_open_api',
};

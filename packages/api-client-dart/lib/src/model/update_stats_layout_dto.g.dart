// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'update_stats_layout_dto.dart';

// **************************************************************************
// CopyWithGenerator
// **************************************************************************

abstract class _$UpdateStatsLayoutDtoCWProxy {
  UpdateStatsLayoutDto widgets(List<StatsLayoutWidgetDto> widgets);

  /// This function **does support** nullification of nullable fields. All `null` values passed to `non-nullable` fields will be ignored. You can also use `UpdateStatsLayoutDto(...).copyWith.fieldName(...)` to override fields one at a time with nullification support.
  ///
  /// Usage
  /// ```dart
  /// UpdateStatsLayoutDto(...).copyWith(id: 12, name: "My name")
  /// ````
  UpdateStatsLayoutDto call({List<StatsLayoutWidgetDto> widgets});
}

/// Proxy class for `copyWith` functionality. This is a callable class and can be used as follows: `instanceOfUpdateStatsLayoutDto.copyWith(...)`. Additionally contains functions for specific fields e.g. `instanceOfUpdateStatsLayoutDto.copyWith.fieldName(...)`
class _$UpdateStatsLayoutDtoCWProxyImpl
    implements _$UpdateStatsLayoutDtoCWProxy {
  const _$UpdateStatsLayoutDtoCWProxyImpl(this._value);

  final UpdateStatsLayoutDto _value;

  @override
  UpdateStatsLayoutDto widgets(List<StatsLayoutWidgetDto> widgets) =>
      this(widgets: widgets);

  @override
  /// This function **does support** nullification of nullable fields. All `null` values passed to `non-nullable` fields will be ignored. You can also use `UpdateStatsLayoutDto(...).copyWith.fieldName(...)` to override fields one at a time with nullification support.
  ///
  /// Usage
  /// ```dart
  /// UpdateStatsLayoutDto(...).copyWith(id: 12, name: "My name")
  /// ````
  UpdateStatsLayoutDto call({Object? widgets = const $CopyWithPlaceholder()}) {
    return UpdateStatsLayoutDto(
      widgets: widgets == const $CopyWithPlaceholder()
          ? _value.widgets
          // ignore: cast_nullable_to_non_nullable
          : widgets as List<StatsLayoutWidgetDto>,
    );
  }
}

extension $UpdateStatsLayoutDtoCopyWith on UpdateStatsLayoutDto {
  /// Returns a callable class that can be used as follows: `instanceOfUpdateStatsLayoutDto.copyWith(...)` or like so:`instanceOfUpdateStatsLayoutDto.copyWith.fieldName(...)`.
  // ignore: library_private_types_in_public_api
  _$UpdateStatsLayoutDtoCWProxy get copyWith =>
      _$UpdateStatsLayoutDtoCWProxyImpl(this);
}

// **************************************************************************
// JsonSerializableGenerator
// **************************************************************************

UpdateStatsLayoutDto _$UpdateStatsLayoutDtoFromJson(
  Map<String, dynamic> json,
) => $checkedCreate('UpdateStatsLayoutDto', json, ($checkedConvert) {
  $checkKeys(json, requiredKeys: const ['widgets']);
  final val = UpdateStatsLayoutDto(
    widgets: $checkedConvert(
      'widgets',
      (v) => (v as List<dynamic>)
          .map((e) => StatsLayoutWidgetDto.fromJson(e as Map<String, dynamic>))
          .toList(),
    ),
  );
  return val;
});

Map<String, dynamic> _$UpdateStatsLayoutDtoToJson(
  UpdateStatsLayoutDto instance,
) => <String, dynamic>{
  'widgets': instance.widgets.map((e) => e.toJson()).toList(),
};

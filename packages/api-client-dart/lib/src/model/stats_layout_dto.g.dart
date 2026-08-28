// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'stats_layout_dto.dart';

// **************************************************************************
// CopyWithGenerator
// **************************************************************************

abstract class _$StatsLayoutDtoCWProxy {
  StatsLayoutDto screen(StatsLayoutScreen screen);

  StatsLayoutDto widgets(List<StatsLayoutWidgetDto> widgets);

  StatsLayoutDto updatedAt(DateTime? updatedAt);

  /// This function **does support** nullification of nullable fields. All `null` values passed to `non-nullable` fields will be ignored. You can also use `StatsLayoutDto(...).copyWith.fieldName(...)` to override fields one at a time with nullification support.
  ///
  /// Usage
  /// ```dart
  /// StatsLayoutDto(...).copyWith(id: 12, name: "My name")
  /// ````
  StatsLayoutDto call({
    StatsLayoutScreen screen,
    List<StatsLayoutWidgetDto> widgets,
    DateTime? updatedAt,
  });
}

/// Proxy class for `copyWith` functionality. This is a callable class and can be used as follows: `instanceOfStatsLayoutDto.copyWith(...)`. Additionally contains functions for specific fields e.g. `instanceOfStatsLayoutDto.copyWith.fieldName(...)`
class _$StatsLayoutDtoCWProxyImpl implements _$StatsLayoutDtoCWProxy {
  const _$StatsLayoutDtoCWProxyImpl(this._value);

  final StatsLayoutDto _value;

  @override
  StatsLayoutDto screen(StatsLayoutScreen screen) => this(screen: screen);

  @override
  StatsLayoutDto widgets(List<StatsLayoutWidgetDto> widgets) =>
      this(widgets: widgets);

  @override
  StatsLayoutDto updatedAt(DateTime? updatedAt) => this(updatedAt: updatedAt);

  @override
  /// This function **does support** nullification of nullable fields. All `null` values passed to `non-nullable` fields will be ignored. You can also use `StatsLayoutDto(...).copyWith.fieldName(...)` to override fields one at a time with nullification support.
  ///
  /// Usage
  /// ```dart
  /// StatsLayoutDto(...).copyWith(id: 12, name: "My name")
  /// ````
  StatsLayoutDto call({
    Object? screen = const $CopyWithPlaceholder(),
    Object? widgets = const $CopyWithPlaceholder(),
    Object? updatedAt = const $CopyWithPlaceholder(),
  }) {
    return StatsLayoutDto(
      screen: screen == const $CopyWithPlaceholder()
          ? _value.screen
          // ignore: cast_nullable_to_non_nullable
          : screen as StatsLayoutScreen,
      widgets: widgets == const $CopyWithPlaceholder()
          ? _value.widgets
          // ignore: cast_nullable_to_non_nullable
          : widgets as List<StatsLayoutWidgetDto>,
      updatedAt: updatedAt == const $CopyWithPlaceholder()
          ? _value.updatedAt
          // ignore: cast_nullable_to_non_nullable
          : updatedAt as DateTime?,
    );
  }
}

extension $StatsLayoutDtoCopyWith on StatsLayoutDto {
  /// Returns a callable class that can be used as follows: `instanceOfStatsLayoutDto.copyWith(...)` or like so:`instanceOfStatsLayoutDto.copyWith.fieldName(...)`.
  // ignore: library_private_types_in_public_api
  _$StatsLayoutDtoCWProxy get copyWith => _$StatsLayoutDtoCWProxyImpl(this);
}

// **************************************************************************
// JsonSerializableGenerator
// **************************************************************************

StatsLayoutDto _$StatsLayoutDtoFromJson(Map<String, dynamic> json) =>
    $checkedCreate('StatsLayoutDto', json, ($checkedConvert) {
      $checkKeys(json, requiredKeys: const ['screen', 'widgets', 'updatedAt']);
      final val = StatsLayoutDto(
        screen: $checkedConvert(
          'screen',
          (v) => $enumDecode(
            _$StatsLayoutScreenEnumMap,
            v,
            unknownValue: StatsLayoutScreen.unknownDefaultOpenApi,
          ),
        ),
        widgets: $checkedConvert(
          'widgets',
          (v) => (v as List<dynamic>)
              .map(
                (e) => StatsLayoutWidgetDto.fromJson(e as Map<String, dynamic>),
              )
              .toList(),
        ),
        updatedAt: $checkedConvert(
          'updatedAt',
          (v) => v == null ? null : DateTime.parse(v as String),
        ),
      );
      return val;
    });

Map<String, dynamic> _$StatsLayoutDtoToJson(StatsLayoutDto instance) =>
    <String, dynamic>{
      'screen': _$StatsLayoutScreenEnumMap[instance.screen]!,
      'widgets': instance.widgets.map((e) => e.toJson()).toList(),
      'updatedAt': instance.updatedAt?.toIso8601String(),
    };

const _$StatsLayoutScreenEnumMap = {
  StatsLayoutScreen.dashboard: 'dashboard',
  StatsLayoutScreen.teleconseil: 'teleconseil',
  StatsLayoutScreen.unknownDefaultOpenApi: 'unknown_default_open_api',
};

// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'stats_layout_widget_dto.dart';

// **************************************************************************
// CopyWithGenerator
// **************************************************************************

abstract class _$StatsLayoutWidgetDtoCWProxy {
  StatsLayoutWidgetDto id(String id);

  StatsLayoutWidgetDto visible(bool visible);

  /// This function **does support** nullification of nullable fields. All `null` values passed to `non-nullable` fields will be ignored. You can also use `StatsLayoutWidgetDto(...).copyWith.fieldName(...)` to override fields one at a time with nullification support.
  ///
  /// Usage
  /// ```dart
  /// StatsLayoutWidgetDto(...).copyWith(id: 12, name: "My name")
  /// ````
  StatsLayoutWidgetDto call({String id, bool visible});
}

/// Proxy class for `copyWith` functionality. This is a callable class and can be used as follows: `instanceOfStatsLayoutWidgetDto.copyWith(...)`. Additionally contains functions for specific fields e.g. `instanceOfStatsLayoutWidgetDto.copyWith.fieldName(...)`
class _$StatsLayoutWidgetDtoCWProxyImpl
    implements _$StatsLayoutWidgetDtoCWProxy {
  const _$StatsLayoutWidgetDtoCWProxyImpl(this._value);

  final StatsLayoutWidgetDto _value;

  @override
  StatsLayoutWidgetDto id(String id) => this(id: id);

  @override
  StatsLayoutWidgetDto visible(bool visible) => this(visible: visible);

  @override
  /// This function **does support** nullification of nullable fields. All `null` values passed to `non-nullable` fields will be ignored. You can also use `StatsLayoutWidgetDto(...).copyWith.fieldName(...)` to override fields one at a time with nullification support.
  ///
  /// Usage
  /// ```dart
  /// StatsLayoutWidgetDto(...).copyWith(id: 12, name: "My name")
  /// ````
  StatsLayoutWidgetDto call({
    Object? id = const $CopyWithPlaceholder(),
    Object? visible = const $CopyWithPlaceholder(),
  }) {
    return StatsLayoutWidgetDto(
      id: id == const $CopyWithPlaceholder()
          ? _value.id
          // ignore: cast_nullable_to_non_nullable
          : id as String,
      visible: visible == const $CopyWithPlaceholder()
          ? _value.visible
          // ignore: cast_nullable_to_non_nullable
          : visible as bool,
    );
  }
}

extension $StatsLayoutWidgetDtoCopyWith on StatsLayoutWidgetDto {
  /// Returns a callable class that can be used as follows: `instanceOfStatsLayoutWidgetDto.copyWith(...)` or like so:`instanceOfStatsLayoutWidgetDto.copyWith.fieldName(...)`.
  // ignore: library_private_types_in_public_api
  _$StatsLayoutWidgetDtoCWProxy get copyWith =>
      _$StatsLayoutWidgetDtoCWProxyImpl(this);
}

// **************************************************************************
// JsonSerializableGenerator
// **************************************************************************

StatsLayoutWidgetDto _$StatsLayoutWidgetDtoFromJson(
  Map<String, dynamic> json,
) => $checkedCreate('StatsLayoutWidgetDto', json, ($checkedConvert) {
  $checkKeys(json, requiredKeys: const ['id', 'visible']);
  final val = StatsLayoutWidgetDto(
    id: $checkedConvert('id', (v) => v as String),
    visible: $checkedConvert('visible', (v) => v as bool),
  );
  return val;
});

Map<String, dynamic> _$StatsLayoutWidgetDtoToJson(
  StatsLayoutWidgetDto instance,
) => <String, dynamic>{'id': instance.id, 'visible': instance.visible};

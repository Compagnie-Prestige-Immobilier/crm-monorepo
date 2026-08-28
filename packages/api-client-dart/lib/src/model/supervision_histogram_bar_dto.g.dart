// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'supervision_histogram_bar_dto.dart';

// **************************************************************************
// CopyWithGenerator
// **************************************************************************

abstract class _$SupervisionHistogramBarDtoCWProxy {
  SupervisionHistogramBarDto id(String? id);

  SupervisionHistogramBarDto label(String label);

  SupervisionHistogramBarDto prospects(num prospects);

  /// This function **does support** nullification of nullable fields. All `null` values passed to `non-nullable` fields will be ignored. You can also use `SupervisionHistogramBarDto(...).copyWith.fieldName(...)` to override fields one at a time with nullification support.
  ///
  /// Usage
  /// ```dart
  /// SupervisionHistogramBarDto(...).copyWith(id: 12, name: "My name")
  /// ````
  SupervisionHistogramBarDto call({String? id, String label, num prospects});
}

/// Proxy class for `copyWith` functionality. This is a callable class and can be used as follows: `instanceOfSupervisionHistogramBarDto.copyWith(...)`. Additionally contains functions for specific fields e.g. `instanceOfSupervisionHistogramBarDto.copyWith.fieldName(...)`
class _$SupervisionHistogramBarDtoCWProxyImpl
    implements _$SupervisionHistogramBarDtoCWProxy {
  const _$SupervisionHistogramBarDtoCWProxyImpl(this._value);

  final SupervisionHistogramBarDto _value;

  @override
  SupervisionHistogramBarDto id(String? id) => this(id: id);

  @override
  SupervisionHistogramBarDto label(String label) => this(label: label);

  @override
  SupervisionHistogramBarDto prospects(num prospects) =>
      this(prospects: prospects);

  @override
  /// This function **does support** nullification of nullable fields. All `null` values passed to `non-nullable` fields will be ignored. You can also use `SupervisionHistogramBarDto(...).copyWith.fieldName(...)` to override fields one at a time with nullification support.
  ///
  /// Usage
  /// ```dart
  /// SupervisionHistogramBarDto(...).copyWith(id: 12, name: "My name")
  /// ````
  SupervisionHistogramBarDto call({
    Object? id = const $CopyWithPlaceholder(),
    Object? label = const $CopyWithPlaceholder(),
    Object? prospects = const $CopyWithPlaceholder(),
  }) {
    return SupervisionHistogramBarDto(
      id: id == const $CopyWithPlaceholder()
          ? _value.id
          // ignore: cast_nullable_to_non_nullable
          : id as String?,
      label: label == const $CopyWithPlaceholder()
          ? _value.label
          // ignore: cast_nullable_to_non_nullable
          : label as String,
      prospects: prospects == const $CopyWithPlaceholder()
          ? _value.prospects
          // ignore: cast_nullable_to_non_nullable
          : prospects as num,
    );
  }
}

extension $SupervisionHistogramBarDtoCopyWith on SupervisionHistogramBarDto {
  /// Returns a callable class that can be used as follows: `instanceOfSupervisionHistogramBarDto.copyWith(...)` or like so:`instanceOfSupervisionHistogramBarDto.copyWith.fieldName(...)`.
  // ignore: library_private_types_in_public_api
  _$SupervisionHistogramBarDtoCWProxy get copyWith =>
      _$SupervisionHistogramBarDtoCWProxyImpl(this);
}

// **************************************************************************
// JsonSerializableGenerator
// **************************************************************************

SupervisionHistogramBarDto _$SupervisionHistogramBarDtoFromJson(
  Map<String, dynamic> json,
) => $checkedCreate('SupervisionHistogramBarDto', json, ($checkedConvert) {
  $checkKeys(json, requiredKeys: const ['id', 'label', 'prospects']);
  final val = SupervisionHistogramBarDto(
    id: $checkedConvert('id', (v) => v as String?),
    label: $checkedConvert('label', (v) => v as String),
    prospects: $checkedConvert('prospects', (v) => v as num),
  );
  return val;
});

Map<String, dynamic> _$SupervisionHistogramBarDtoToJson(
  SupervisionHistogramBarDto instance,
) => <String, dynamic>{
  'id': instance.id,
  'label': instance.label,
  'prospects': instance.prospects,
};

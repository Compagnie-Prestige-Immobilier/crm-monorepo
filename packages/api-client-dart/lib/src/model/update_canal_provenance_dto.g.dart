// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'update_canal_provenance_dto.dart';

// **************************************************************************
// CopyWithGenerator
// **************************************************************************

abstract class _$UpdateCanalProvenanceDtoCWProxy {
  UpdateCanalProvenanceDto label(String? label);

  UpdateCanalProvenanceDto position(num? position);

  UpdateCanalProvenanceDto isActive(bool? isActive);

  /// This function **does support** nullification of nullable fields. All `null` values passed to `non-nullable` fields will be ignored. You can also use `UpdateCanalProvenanceDto(...).copyWith.fieldName(...)` to override fields one at a time with nullification support.
  ///
  /// Usage
  /// ```dart
  /// UpdateCanalProvenanceDto(...).copyWith(id: 12, name: "My name")
  /// ````
  UpdateCanalProvenanceDto call({String? label, num? position, bool? isActive});
}

/// Proxy class for `copyWith` functionality. This is a callable class and can be used as follows: `instanceOfUpdateCanalProvenanceDto.copyWith(...)`. Additionally contains functions for specific fields e.g. `instanceOfUpdateCanalProvenanceDto.copyWith.fieldName(...)`
class _$UpdateCanalProvenanceDtoCWProxyImpl
    implements _$UpdateCanalProvenanceDtoCWProxy {
  const _$UpdateCanalProvenanceDtoCWProxyImpl(this._value);

  final UpdateCanalProvenanceDto _value;

  @override
  UpdateCanalProvenanceDto label(String? label) => this(label: label);

  @override
  UpdateCanalProvenanceDto position(num? position) => this(position: position);

  @override
  UpdateCanalProvenanceDto isActive(bool? isActive) => this(isActive: isActive);

  @override
  /// This function **does support** nullification of nullable fields. All `null` values passed to `non-nullable` fields will be ignored. You can also use `UpdateCanalProvenanceDto(...).copyWith.fieldName(...)` to override fields one at a time with nullification support.
  ///
  /// Usage
  /// ```dart
  /// UpdateCanalProvenanceDto(...).copyWith(id: 12, name: "My name")
  /// ````
  UpdateCanalProvenanceDto call({
    Object? label = const $CopyWithPlaceholder(),
    Object? position = const $CopyWithPlaceholder(),
    Object? isActive = const $CopyWithPlaceholder(),
  }) {
    return UpdateCanalProvenanceDto(
      label: label == const $CopyWithPlaceholder()
          ? _value.label
          // ignore: cast_nullable_to_non_nullable
          : label as String?,
      position: position == const $CopyWithPlaceholder()
          ? _value.position
          // ignore: cast_nullable_to_non_nullable
          : position as num?,
      isActive: isActive == const $CopyWithPlaceholder()
          ? _value.isActive
          // ignore: cast_nullable_to_non_nullable
          : isActive as bool?,
    );
  }
}

extension $UpdateCanalProvenanceDtoCopyWith on UpdateCanalProvenanceDto {
  /// Returns a callable class that can be used as follows: `instanceOfUpdateCanalProvenanceDto.copyWith(...)` or like so:`instanceOfUpdateCanalProvenanceDto.copyWith.fieldName(...)`.
  // ignore: library_private_types_in_public_api
  _$UpdateCanalProvenanceDtoCWProxy get copyWith =>
      _$UpdateCanalProvenanceDtoCWProxyImpl(this);
}

// **************************************************************************
// JsonSerializableGenerator
// **************************************************************************

UpdateCanalProvenanceDto _$UpdateCanalProvenanceDtoFromJson(
  Map<String, dynamic> json,
) => $checkedCreate('UpdateCanalProvenanceDto', json, ($checkedConvert) {
  final val = UpdateCanalProvenanceDto(
    label: $checkedConvert('label', (v) => v as String?),
    position: $checkedConvert('position', (v) => v as num?),
    isActive: $checkedConvert('isActive', (v) => v as bool?),
  );
  return val;
});

Map<String, dynamic> _$UpdateCanalProvenanceDtoToJson(
  UpdateCanalProvenanceDto instance,
) => <String, dynamic>{
  if (instance.label case final value?) 'label': value,
  if (instance.position case final value?) 'position': value,
  if (instance.isActive case final value?) 'isActive': value,
};

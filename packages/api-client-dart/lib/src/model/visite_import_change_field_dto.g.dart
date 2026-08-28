// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'visite_import_change_field_dto.dart';

// **************************************************************************
// CopyWithGenerator
// **************************************************************************

abstract class _$VisiteImportChangeFieldDtoCWProxy {
  VisiteImportChangeFieldDto field(String field);

  VisiteImportChangeFieldDto label(String label);

  VisiteImportChangeFieldDto before(String before);

  VisiteImportChangeFieldDto after(String after);

  /// This function **does support** nullification of nullable fields. All `null` values passed to `non-nullable` fields will be ignored. You can also use `VisiteImportChangeFieldDto(...).copyWith.fieldName(...)` to override fields one at a time with nullification support.
  ///
  /// Usage
  /// ```dart
  /// VisiteImportChangeFieldDto(...).copyWith(id: 12, name: "My name")
  /// ````
  VisiteImportChangeFieldDto call({
    String field,
    String label,
    String before,
    String after,
  });
}

/// Proxy class for `copyWith` functionality. This is a callable class and can be used as follows: `instanceOfVisiteImportChangeFieldDto.copyWith(...)`. Additionally contains functions for specific fields e.g. `instanceOfVisiteImportChangeFieldDto.copyWith.fieldName(...)`
class _$VisiteImportChangeFieldDtoCWProxyImpl
    implements _$VisiteImportChangeFieldDtoCWProxy {
  const _$VisiteImportChangeFieldDtoCWProxyImpl(this._value);

  final VisiteImportChangeFieldDto _value;

  @override
  VisiteImportChangeFieldDto field(String field) => this(field: field);

  @override
  VisiteImportChangeFieldDto label(String label) => this(label: label);

  @override
  VisiteImportChangeFieldDto before(String before) => this(before: before);

  @override
  VisiteImportChangeFieldDto after(String after) => this(after: after);

  @override
  /// This function **does support** nullification of nullable fields. All `null` values passed to `non-nullable` fields will be ignored. You can also use `VisiteImportChangeFieldDto(...).copyWith.fieldName(...)` to override fields one at a time with nullification support.
  ///
  /// Usage
  /// ```dart
  /// VisiteImportChangeFieldDto(...).copyWith(id: 12, name: "My name")
  /// ````
  VisiteImportChangeFieldDto call({
    Object? field = const $CopyWithPlaceholder(),
    Object? label = const $CopyWithPlaceholder(),
    Object? before = const $CopyWithPlaceholder(),
    Object? after = const $CopyWithPlaceholder(),
  }) {
    return VisiteImportChangeFieldDto(
      field: field == const $CopyWithPlaceholder()
          ? _value.field
          // ignore: cast_nullable_to_non_nullable
          : field as String,
      label: label == const $CopyWithPlaceholder()
          ? _value.label
          // ignore: cast_nullable_to_non_nullable
          : label as String,
      before: before == const $CopyWithPlaceholder()
          ? _value.before
          // ignore: cast_nullable_to_non_nullable
          : before as String,
      after: after == const $CopyWithPlaceholder()
          ? _value.after
          // ignore: cast_nullable_to_non_nullable
          : after as String,
    );
  }
}

extension $VisiteImportChangeFieldDtoCopyWith on VisiteImportChangeFieldDto {
  /// Returns a callable class that can be used as follows: `instanceOfVisiteImportChangeFieldDto.copyWith(...)` or like so:`instanceOfVisiteImportChangeFieldDto.copyWith.fieldName(...)`.
  // ignore: library_private_types_in_public_api
  _$VisiteImportChangeFieldDtoCWProxy get copyWith =>
      _$VisiteImportChangeFieldDtoCWProxyImpl(this);
}

// **************************************************************************
// JsonSerializableGenerator
// **************************************************************************

VisiteImportChangeFieldDto _$VisiteImportChangeFieldDtoFromJson(
  Map<String, dynamic> json,
) => $checkedCreate('VisiteImportChangeFieldDto', json, ($checkedConvert) {
  $checkKeys(json, requiredKeys: const ['field', 'label', 'before', 'after']);
  final val = VisiteImportChangeFieldDto(
    field: $checkedConvert('field', (v) => v as String),
    label: $checkedConvert('label', (v) => v as String),
    before: $checkedConvert('before', (v) => v as String),
    after: $checkedConvert('after', (v) => v as String),
  );
  return val;
});

Map<String, dynamic> _$VisiteImportChangeFieldDtoToJson(
  VisiteImportChangeFieldDto instance,
) => <String, dynamic>{
  'field': instance.field,
  'label': instance.label,
  'before': instance.before,
  'after': instance.after,
};

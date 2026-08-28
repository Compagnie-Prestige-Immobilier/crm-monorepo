// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'set_visite_import_change_selection_dto.dart';

// **************************************************************************
// CopyWithGenerator
// **************************************************************************

abstract class _$SetVisiteImportChangeSelectionDtoCWProxy {
  SetVisiteImportChangeSelectionDto ids(List<String> ids);

  SetVisiteImportChangeSelectionDto selected(bool selected);

  /// This function **does support** nullification of nullable fields. All `null` values passed to `non-nullable` fields will be ignored. You can also use `SetVisiteImportChangeSelectionDto(...).copyWith.fieldName(...)` to override fields one at a time with nullification support.
  ///
  /// Usage
  /// ```dart
  /// SetVisiteImportChangeSelectionDto(...).copyWith(id: 12, name: "My name")
  /// ````
  SetVisiteImportChangeSelectionDto call({List<String> ids, bool selected});
}

/// Proxy class for `copyWith` functionality. This is a callable class and can be used as follows: `instanceOfSetVisiteImportChangeSelectionDto.copyWith(...)`. Additionally contains functions for specific fields e.g. `instanceOfSetVisiteImportChangeSelectionDto.copyWith.fieldName(...)`
class _$SetVisiteImportChangeSelectionDtoCWProxyImpl
    implements _$SetVisiteImportChangeSelectionDtoCWProxy {
  const _$SetVisiteImportChangeSelectionDtoCWProxyImpl(this._value);

  final SetVisiteImportChangeSelectionDto _value;

  @override
  SetVisiteImportChangeSelectionDto ids(List<String> ids) => this(ids: ids);

  @override
  SetVisiteImportChangeSelectionDto selected(bool selected) =>
      this(selected: selected);

  @override
  /// This function **does support** nullification of nullable fields. All `null` values passed to `non-nullable` fields will be ignored. You can also use `SetVisiteImportChangeSelectionDto(...).copyWith.fieldName(...)` to override fields one at a time with nullification support.
  ///
  /// Usage
  /// ```dart
  /// SetVisiteImportChangeSelectionDto(...).copyWith(id: 12, name: "My name")
  /// ````
  SetVisiteImportChangeSelectionDto call({
    Object? ids = const $CopyWithPlaceholder(),
    Object? selected = const $CopyWithPlaceholder(),
  }) {
    return SetVisiteImportChangeSelectionDto(
      ids: ids == const $CopyWithPlaceholder()
          ? _value.ids
          // ignore: cast_nullable_to_non_nullable
          : ids as List<String>,
      selected: selected == const $CopyWithPlaceholder()
          ? _value.selected
          // ignore: cast_nullable_to_non_nullable
          : selected as bool,
    );
  }
}

extension $SetVisiteImportChangeSelectionDtoCopyWith
    on SetVisiteImportChangeSelectionDto {
  /// Returns a callable class that can be used as follows: `instanceOfSetVisiteImportChangeSelectionDto.copyWith(...)` or like so:`instanceOfSetVisiteImportChangeSelectionDto.copyWith.fieldName(...)`.
  // ignore: library_private_types_in_public_api
  _$SetVisiteImportChangeSelectionDtoCWProxy get copyWith =>
      _$SetVisiteImportChangeSelectionDtoCWProxyImpl(this);
}

// **************************************************************************
// JsonSerializableGenerator
// **************************************************************************

SetVisiteImportChangeSelectionDto _$SetVisiteImportChangeSelectionDtoFromJson(
  Map<String, dynamic> json,
) => $checkedCreate('SetVisiteImportChangeSelectionDto', json, (
  $checkedConvert,
) {
  $checkKeys(json, requiredKeys: const ['ids', 'selected']);
  final val = SetVisiteImportChangeSelectionDto(
    ids: $checkedConvert(
      'ids',
      (v) => (v as List<dynamic>).map((e) => e as String).toList(),
    ),
    selected: $checkedConvert('selected', (v) => v as bool),
  );
  return val;
});

Map<String, dynamic> _$SetVisiteImportChangeSelectionDtoToJson(
  SetVisiteImportChangeSelectionDto instance,
) => <String, dynamic>{'ids': instance.ids, 'selected': instance.selected};

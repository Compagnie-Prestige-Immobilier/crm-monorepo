// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'visite_import_change_dto.dart';

// **************************************************************************
// CopyWithGenerator
// **************************************************************************

abstract class _$VisiteImportChangeDtoCWProxy {
  VisiteImportChangeDto id(String id);

  VisiteImportChangeDto sheet(String sheet);

  VisiteImportChangeDto rowNumber(num rowNumber);

  VisiteImportChangeDto kind(VisiteImportChangeKind kind);

  VisiteImportChangeDto reference(String? reference);

  VisiteImportChangeDto visiteId(String? visiteId);

  VisiteImportChangeDto label(String label);

  VisiteImportChangeDto fields(List<VisiteImportChangeFieldDto> fields);

  VisiteImportChangeDto selected(bool selected);

  /// This function **does support** nullification of nullable fields. All `null` values passed to `non-nullable` fields will be ignored. You can also use `VisiteImportChangeDto(...).copyWith.fieldName(...)` to override fields one at a time with nullification support.
  ///
  /// Usage
  /// ```dart
  /// VisiteImportChangeDto(...).copyWith(id: 12, name: "My name")
  /// ````
  VisiteImportChangeDto call({
    String id,
    String sheet,
    num rowNumber,
    VisiteImportChangeKind kind,
    String? reference,
    String? visiteId,
    String label,
    List<VisiteImportChangeFieldDto> fields,
    bool selected,
  });
}

/// Proxy class for `copyWith` functionality. This is a callable class and can be used as follows: `instanceOfVisiteImportChangeDto.copyWith(...)`. Additionally contains functions for specific fields e.g. `instanceOfVisiteImportChangeDto.copyWith.fieldName(...)`
class _$VisiteImportChangeDtoCWProxyImpl
    implements _$VisiteImportChangeDtoCWProxy {
  const _$VisiteImportChangeDtoCWProxyImpl(this._value);

  final VisiteImportChangeDto _value;

  @override
  VisiteImportChangeDto id(String id) => this(id: id);

  @override
  VisiteImportChangeDto sheet(String sheet) => this(sheet: sheet);

  @override
  VisiteImportChangeDto rowNumber(num rowNumber) => this(rowNumber: rowNumber);

  @override
  VisiteImportChangeDto kind(VisiteImportChangeKind kind) => this(kind: kind);

  @override
  VisiteImportChangeDto reference(String? reference) =>
      this(reference: reference);

  @override
  VisiteImportChangeDto visiteId(String? visiteId) => this(visiteId: visiteId);

  @override
  VisiteImportChangeDto label(String label) => this(label: label);

  @override
  VisiteImportChangeDto fields(List<VisiteImportChangeFieldDto> fields) =>
      this(fields: fields);

  @override
  VisiteImportChangeDto selected(bool selected) => this(selected: selected);

  @override
  /// This function **does support** nullification of nullable fields. All `null` values passed to `non-nullable` fields will be ignored. You can also use `VisiteImportChangeDto(...).copyWith.fieldName(...)` to override fields one at a time with nullification support.
  ///
  /// Usage
  /// ```dart
  /// VisiteImportChangeDto(...).copyWith(id: 12, name: "My name")
  /// ````
  VisiteImportChangeDto call({
    Object? id = const $CopyWithPlaceholder(),
    Object? sheet = const $CopyWithPlaceholder(),
    Object? rowNumber = const $CopyWithPlaceholder(),
    Object? kind = const $CopyWithPlaceholder(),
    Object? reference = const $CopyWithPlaceholder(),
    Object? visiteId = const $CopyWithPlaceholder(),
    Object? label = const $CopyWithPlaceholder(),
    Object? fields = const $CopyWithPlaceholder(),
    Object? selected = const $CopyWithPlaceholder(),
  }) {
    return VisiteImportChangeDto(
      id: id == const $CopyWithPlaceholder()
          ? _value.id
          // ignore: cast_nullable_to_non_nullable
          : id as String,
      sheet: sheet == const $CopyWithPlaceholder()
          ? _value.sheet
          // ignore: cast_nullable_to_non_nullable
          : sheet as String,
      rowNumber: rowNumber == const $CopyWithPlaceholder()
          ? _value.rowNumber
          // ignore: cast_nullable_to_non_nullable
          : rowNumber as num,
      kind: kind == const $CopyWithPlaceholder()
          ? _value.kind
          // ignore: cast_nullable_to_non_nullable
          : kind as VisiteImportChangeKind,
      reference: reference == const $CopyWithPlaceholder()
          ? _value.reference
          // ignore: cast_nullable_to_non_nullable
          : reference as String?,
      visiteId: visiteId == const $CopyWithPlaceholder()
          ? _value.visiteId
          // ignore: cast_nullable_to_non_nullable
          : visiteId as String?,
      label: label == const $CopyWithPlaceholder()
          ? _value.label
          // ignore: cast_nullable_to_non_nullable
          : label as String,
      fields: fields == const $CopyWithPlaceholder()
          ? _value.fields
          // ignore: cast_nullable_to_non_nullable
          : fields as List<VisiteImportChangeFieldDto>,
      selected: selected == const $CopyWithPlaceholder()
          ? _value.selected
          // ignore: cast_nullable_to_non_nullable
          : selected as bool,
    );
  }
}

extension $VisiteImportChangeDtoCopyWith on VisiteImportChangeDto {
  /// Returns a callable class that can be used as follows: `instanceOfVisiteImportChangeDto.copyWith(...)` or like so:`instanceOfVisiteImportChangeDto.copyWith.fieldName(...)`.
  // ignore: library_private_types_in_public_api
  _$VisiteImportChangeDtoCWProxy get copyWith =>
      _$VisiteImportChangeDtoCWProxyImpl(this);
}

// **************************************************************************
// JsonSerializableGenerator
// **************************************************************************

VisiteImportChangeDto _$VisiteImportChangeDtoFromJson(
  Map<String, dynamic> json,
) => $checkedCreate('VisiteImportChangeDto', json, ($checkedConvert) {
  $checkKeys(
    json,
    requiredKeys: const [
      'id',
      'sheet',
      'rowNumber',
      'kind',
      'reference',
      'visiteId',
      'label',
      'fields',
      'selected',
    ],
  );
  final val = VisiteImportChangeDto(
    id: $checkedConvert('id', (v) => v as String),
    sheet: $checkedConvert('sheet', (v) => v as String),
    rowNumber: $checkedConvert('rowNumber', (v) => v as num),
    kind: $checkedConvert(
      'kind',
      (v) => $enumDecode(
        _$VisiteImportChangeKindEnumMap,
        v,
        unknownValue: VisiteImportChangeKind.unknownDefaultOpenApi,
      ),
    ),
    reference: $checkedConvert('reference', (v) => v as String?),
    visiteId: $checkedConvert('visiteId', (v) => v as String?),
    label: $checkedConvert('label', (v) => v as String),
    fields: $checkedConvert(
      'fields',
      (v) => (v as List<dynamic>)
          .map(
            (e) =>
                VisiteImportChangeFieldDto.fromJson(e as Map<String, dynamic>),
          )
          .toList(),
    ),
    selected: $checkedConvert('selected', (v) => v as bool),
  );
  return val;
});

Map<String, dynamic> _$VisiteImportChangeDtoToJson(
  VisiteImportChangeDto instance,
) => <String, dynamic>{
  'id': instance.id,
  'sheet': instance.sheet,
  'rowNumber': instance.rowNumber,
  'kind': _$VisiteImportChangeKindEnumMap[instance.kind]!,
  'reference': instance.reference,
  'visiteId': instance.visiteId,
  'label': instance.label,
  'fields': instance.fields.map((e) => e.toJson()).toList(),
  'selected': instance.selected,
};

const _$VisiteImportChangeKindEnumMap = {
  VisiteImportChangeKind.CREATE: 'CREATE',
  VisiteImportChangeKind.UPDATE: 'UPDATE',
  VisiteImportChangeKind.unknownDefaultOpenApi: 'unknown_default_open_api',
};

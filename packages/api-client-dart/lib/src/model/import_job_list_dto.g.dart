// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'import_job_list_dto.dart';

// **************************************************************************
// CopyWithGenerator
// **************************************************************************

abstract class _$ImportJobListDtoCWProxy {
  ImportJobListDto items(List<ImportJobDto> items);

  ImportJobListDto meta(PageMetaDto meta);

  /// This function **does support** nullification of nullable fields. All `null` values passed to `non-nullable` fields will be ignored. You can also use `ImportJobListDto(...).copyWith.fieldName(...)` to override fields one at a time with nullification support.
  ///
  /// Usage
  /// ```dart
  /// ImportJobListDto(...).copyWith(id: 12, name: "My name")
  /// ````
  ImportJobListDto call({List<ImportJobDto> items, PageMetaDto meta});
}

/// Proxy class for `copyWith` functionality. This is a callable class and can be used as follows: `instanceOfImportJobListDto.copyWith(...)`. Additionally contains functions for specific fields e.g. `instanceOfImportJobListDto.copyWith.fieldName(...)`
class _$ImportJobListDtoCWProxyImpl implements _$ImportJobListDtoCWProxy {
  const _$ImportJobListDtoCWProxyImpl(this._value);

  final ImportJobListDto _value;

  @override
  ImportJobListDto items(List<ImportJobDto> items) => this(items: items);

  @override
  ImportJobListDto meta(PageMetaDto meta) => this(meta: meta);

  @override
  /// This function **does support** nullification of nullable fields. All `null` values passed to `non-nullable` fields will be ignored. You can also use `ImportJobListDto(...).copyWith.fieldName(...)` to override fields one at a time with nullification support.
  ///
  /// Usage
  /// ```dart
  /// ImportJobListDto(...).copyWith(id: 12, name: "My name")
  /// ````
  ImportJobListDto call({
    Object? items = const $CopyWithPlaceholder(),
    Object? meta = const $CopyWithPlaceholder(),
  }) {
    return ImportJobListDto(
      items: items == const $CopyWithPlaceholder()
          ? _value.items
          // ignore: cast_nullable_to_non_nullable
          : items as List<ImportJobDto>,
      meta: meta == const $CopyWithPlaceholder()
          ? _value.meta
          // ignore: cast_nullable_to_non_nullable
          : meta as PageMetaDto,
    );
  }
}

extension $ImportJobListDtoCopyWith on ImportJobListDto {
  /// Returns a callable class that can be used as follows: `instanceOfImportJobListDto.copyWith(...)` or like so:`instanceOfImportJobListDto.copyWith.fieldName(...)`.
  // ignore: library_private_types_in_public_api
  _$ImportJobListDtoCWProxy get copyWith => _$ImportJobListDtoCWProxyImpl(this);
}

// **************************************************************************
// JsonSerializableGenerator
// **************************************************************************

ImportJobListDto _$ImportJobListDtoFromJson(Map<String, dynamic> json) =>
    $checkedCreate('ImportJobListDto', json, ($checkedConvert) {
      $checkKeys(json, requiredKeys: const ['items', 'meta']);
      final val = ImportJobListDto(
        items: $checkedConvert(
          'items',
          (v) => (v as List<dynamic>)
              .map((e) => ImportJobDto.fromJson(e as Map<String, dynamic>))
              .toList(),
        ),
        meta: $checkedConvert(
          'meta',
          (v) => PageMetaDto.fromJson(v as Map<String, dynamic>),
        ),
      );
      return val;
    });

Map<String, dynamic> _$ImportJobListDtoToJson(ImportJobListDto instance) =>
    <String, dynamic>{
      'items': instance.items.map((e) => e.toJson()).toList(),
      'meta': instance.meta.toJson(),
    };

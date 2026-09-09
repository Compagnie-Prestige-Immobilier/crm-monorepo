// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'import_report_dto.dart';

// **************************************************************************
// CopyWithGenerator
// **************************************************************************

abstract class _$ImportReportDtoCWProxy {
  ImportReportDto dryRun(bool dryRun);

  ImportReportDto totalRows(num totalRows);

  ImportReportDto valid(num valid);

  ImportReportDto enrichable(num enrichable);

  ImportReportDto enriched(num enriched);

  ImportReportDto rejected(num rejected);

  ImportReportDto duplicates(num duplicates);

  ImportReportDto created(num created);

  ImportReportDto errors(List<ImportRowErrorDto> errors);

  ImportReportDto preview(List<ImportRowPreviewDto> preview);

  /// This function **does support** nullification of nullable fields. All `null` values passed to `non-nullable` fields will be ignored. You can also use `ImportReportDto(...).copyWith.fieldName(...)` to override fields one at a time with nullification support.
  ///
  /// Usage
  /// ```dart
  /// ImportReportDto(...).copyWith(id: 12, name: "My name")
  /// ````
  ImportReportDto call({
    bool dryRun,
    num totalRows,
    num valid,
    num enrichable,
    num enriched,
    num rejected,
    num duplicates,
    num created,
    List<ImportRowErrorDto> errors,
    List<ImportRowPreviewDto> preview,
  });
}

/// Proxy class for `copyWith` functionality. This is a callable class and can be used as follows: `instanceOfImportReportDto.copyWith(...)`. Additionally contains functions for specific fields e.g. `instanceOfImportReportDto.copyWith.fieldName(...)`
class _$ImportReportDtoCWProxyImpl implements _$ImportReportDtoCWProxy {
  const _$ImportReportDtoCWProxyImpl(this._value);

  final ImportReportDto _value;

  @override
  ImportReportDto dryRun(bool dryRun) => this(dryRun: dryRun);

  @override
  ImportReportDto totalRows(num totalRows) => this(totalRows: totalRows);

  @override
  ImportReportDto valid(num valid) => this(valid: valid);

  @override
  ImportReportDto enrichable(num enrichable) => this(enrichable: enrichable);

  @override
  ImportReportDto enriched(num enriched) => this(enriched: enriched);

  @override
  ImportReportDto rejected(num rejected) => this(rejected: rejected);

  @override
  ImportReportDto duplicates(num duplicates) => this(duplicates: duplicates);

  @override
  ImportReportDto created(num created) => this(created: created);

  @override
  ImportReportDto errors(List<ImportRowErrorDto> errors) =>
      this(errors: errors);

  @override
  ImportReportDto preview(List<ImportRowPreviewDto> preview) =>
      this(preview: preview);

  @override
  /// This function **does support** nullification of nullable fields. All `null` values passed to `non-nullable` fields will be ignored. You can also use `ImportReportDto(...).copyWith.fieldName(...)` to override fields one at a time with nullification support.
  ///
  /// Usage
  /// ```dart
  /// ImportReportDto(...).copyWith(id: 12, name: "My name")
  /// ````
  ImportReportDto call({
    Object? dryRun = const $CopyWithPlaceholder(),
    Object? totalRows = const $CopyWithPlaceholder(),
    Object? valid = const $CopyWithPlaceholder(),
    Object? enrichable = const $CopyWithPlaceholder(),
    Object? enriched = const $CopyWithPlaceholder(),
    Object? rejected = const $CopyWithPlaceholder(),
    Object? duplicates = const $CopyWithPlaceholder(),
    Object? created = const $CopyWithPlaceholder(),
    Object? errors = const $CopyWithPlaceholder(),
    Object? preview = const $CopyWithPlaceholder(),
  }) {
    return ImportReportDto(
      dryRun: dryRun == const $CopyWithPlaceholder()
          ? _value.dryRun
          // ignore: cast_nullable_to_non_nullable
          : dryRun as bool,
      totalRows: totalRows == const $CopyWithPlaceholder()
          ? _value.totalRows
          // ignore: cast_nullable_to_non_nullable
          : totalRows as num,
      valid: valid == const $CopyWithPlaceholder()
          ? _value.valid
          // ignore: cast_nullable_to_non_nullable
          : valid as num,
      enrichable: enrichable == const $CopyWithPlaceholder()
          ? _value.enrichable
          // ignore: cast_nullable_to_non_nullable
          : enrichable as num,
      enriched: enriched == const $CopyWithPlaceholder()
          ? _value.enriched
          // ignore: cast_nullable_to_non_nullable
          : enriched as num,
      rejected: rejected == const $CopyWithPlaceholder()
          ? _value.rejected
          // ignore: cast_nullable_to_non_nullable
          : rejected as num,
      duplicates: duplicates == const $CopyWithPlaceholder()
          ? _value.duplicates
          // ignore: cast_nullable_to_non_nullable
          : duplicates as num,
      created: created == const $CopyWithPlaceholder()
          ? _value.created
          // ignore: cast_nullable_to_non_nullable
          : created as num,
      errors: errors == const $CopyWithPlaceholder()
          ? _value.errors
          // ignore: cast_nullable_to_non_nullable
          : errors as List<ImportRowErrorDto>,
      preview: preview == const $CopyWithPlaceholder()
          ? _value.preview
          // ignore: cast_nullable_to_non_nullable
          : preview as List<ImportRowPreviewDto>,
    );
  }
}

extension $ImportReportDtoCopyWith on ImportReportDto {
  /// Returns a callable class that can be used as follows: `instanceOfImportReportDto.copyWith(...)` or like so:`instanceOfImportReportDto.copyWith.fieldName(...)`.
  // ignore: library_private_types_in_public_api
  _$ImportReportDtoCWProxy get copyWith => _$ImportReportDtoCWProxyImpl(this);
}

// **************************************************************************
// JsonSerializableGenerator
// **************************************************************************

ImportReportDto _$ImportReportDtoFromJson(Map<String, dynamic> json) =>
    $checkedCreate('ImportReportDto', json, ($checkedConvert) {
      $checkKeys(
        json,
        requiredKeys: const [
          'dryRun',
          'totalRows',
          'valid',
          'enrichable',
          'enriched',
          'rejected',
          'duplicates',
          'created',
          'errors',
          'preview',
        ],
      );
      final val = ImportReportDto(
        dryRun: $checkedConvert('dryRun', (v) => v as bool),
        totalRows: $checkedConvert('totalRows', (v) => v as num),
        valid: $checkedConvert('valid', (v) => v as num),
        enrichable: $checkedConvert('enrichable', (v) => v as num),
        enriched: $checkedConvert('enriched', (v) => v as num),
        rejected: $checkedConvert('rejected', (v) => v as num),
        duplicates: $checkedConvert('duplicates', (v) => v as num),
        created: $checkedConvert('created', (v) => v as num),
        errors: $checkedConvert(
          'errors',
          (v) => (v as List<dynamic>)
              .map((e) => ImportRowErrorDto.fromJson(e as Map<String, dynamic>))
              .toList(),
        ),
        preview: $checkedConvert(
          'preview',
          (v) => (v as List<dynamic>)
              .map(
                (e) => ImportRowPreviewDto.fromJson(e as Map<String, dynamic>),
              )
              .toList(),
        ),
      );
      return val;
    });

Map<String, dynamic> _$ImportReportDtoToJson(ImportReportDto instance) =>
    <String, dynamic>{
      'dryRun': instance.dryRun,
      'totalRows': instance.totalRows,
      'valid': instance.valid,
      'enrichable': instance.enrichable,
      'enriched': instance.enriched,
      'rejected': instance.rejected,
      'duplicates': instance.duplicates,
      'created': instance.created,
      'errors': instance.errors.map((e) => e.toJson()).toList(),
      'preview': instance.preview.map((e) => e.toJson()).toList(),
    };

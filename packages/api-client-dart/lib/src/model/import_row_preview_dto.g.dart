// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'import_row_preview_dto.dart';

// **************************************************************************
// CopyWithGenerator
// **************************************************************************

abstract class _$ImportRowPreviewDtoCWProxy {
  ImportRowPreviewDto line(num line);

  ImportRowPreviewDto fullName(String fullName);

  ImportRowPreviewDto phoneE164(String phoneE164);

  ImportRowPreviewDto departementName(String departementName);

  ImportRowPreviewDto iefName(String? iefName);

  ImportRowPreviewDto notes(String? notes);

  ImportRowPreviewDto etablissement(String? etablissement);

  ImportRowPreviewDto relationStatus(RepresentantRelation relationStatus);

  ImportRowPreviewDto whatsappStatus(WhatsappStatus whatsappStatus);

  ImportRowPreviewDto calledAt(DateTime? calledAt);

  /// This function **does support** nullification of nullable fields. All `null` values passed to `non-nullable` fields will be ignored. You can also use `ImportRowPreviewDto(...).copyWith.fieldName(...)` to override fields one at a time with nullification support.
  ///
  /// Usage
  /// ```dart
  /// ImportRowPreviewDto(...).copyWith(id: 12, name: "My name")
  /// ````
  ImportRowPreviewDto call({
    num line,
    String fullName,
    String phoneE164,
    String departementName,
    String? iefName,
    String? notes,
    String? etablissement,
    RepresentantRelation relationStatus,
    WhatsappStatus whatsappStatus,
    DateTime? calledAt,
  });
}

/// Proxy class for `copyWith` functionality. This is a callable class and can be used as follows: `instanceOfImportRowPreviewDto.copyWith(...)`. Additionally contains functions for specific fields e.g. `instanceOfImportRowPreviewDto.copyWith.fieldName(...)`
class _$ImportRowPreviewDtoCWProxyImpl implements _$ImportRowPreviewDtoCWProxy {
  const _$ImportRowPreviewDtoCWProxyImpl(this._value);

  final ImportRowPreviewDto _value;

  @override
  ImportRowPreviewDto line(num line) => this(line: line);

  @override
  ImportRowPreviewDto fullName(String fullName) => this(fullName: fullName);

  @override
  ImportRowPreviewDto phoneE164(String phoneE164) => this(phoneE164: phoneE164);

  @override
  ImportRowPreviewDto departementName(String departementName) =>
      this(departementName: departementName);

  @override
  ImportRowPreviewDto iefName(String? iefName) => this(iefName: iefName);

  @override
  ImportRowPreviewDto notes(String? notes) => this(notes: notes);

  @override
  ImportRowPreviewDto etablissement(String? etablissement) =>
      this(etablissement: etablissement);

  @override
  ImportRowPreviewDto relationStatus(RepresentantRelation relationStatus) =>
      this(relationStatus: relationStatus);

  @override
  ImportRowPreviewDto whatsappStatus(WhatsappStatus whatsappStatus) =>
      this(whatsappStatus: whatsappStatus);

  @override
  ImportRowPreviewDto calledAt(DateTime? calledAt) => this(calledAt: calledAt);

  @override
  /// This function **does support** nullification of nullable fields. All `null` values passed to `non-nullable` fields will be ignored. You can also use `ImportRowPreviewDto(...).copyWith.fieldName(...)` to override fields one at a time with nullification support.
  ///
  /// Usage
  /// ```dart
  /// ImportRowPreviewDto(...).copyWith(id: 12, name: "My name")
  /// ````
  ImportRowPreviewDto call({
    Object? line = const $CopyWithPlaceholder(),
    Object? fullName = const $CopyWithPlaceholder(),
    Object? phoneE164 = const $CopyWithPlaceholder(),
    Object? departementName = const $CopyWithPlaceholder(),
    Object? iefName = const $CopyWithPlaceholder(),
    Object? notes = const $CopyWithPlaceholder(),
    Object? etablissement = const $CopyWithPlaceholder(),
    Object? relationStatus = const $CopyWithPlaceholder(),
    Object? whatsappStatus = const $CopyWithPlaceholder(),
    Object? calledAt = const $CopyWithPlaceholder(),
  }) {
    return ImportRowPreviewDto(
      line: line == const $CopyWithPlaceholder()
          ? _value.line
          // ignore: cast_nullable_to_non_nullable
          : line as num,
      fullName: fullName == const $CopyWithPlaceholder()
          ? _value.fullName
          // ignore: cast_nullable_to_non_nullable
          : fullName as String,
      phoneE164: phoneE164 == const $CopyWithPlaceholder()
          ? _value.phoneE164
          // ignore: cast_nullable_to_non_nullable
          : phoneE164 as String,
      departementName: departementName == const $CopyWithPlaceholder()
          ? _value.departementName
          // ignore: cast_nullable_to_non_nullable
          : departementName as String,
      iefName: iefName == const $CopyWithPlaceholder()
          ? _value.iefName
          // ignore: cast_nullable_to_non_nullable
          : iefName as String?,
      notes: notes == const $CopyWithPlaceholder()
          ? _value.notes
          // ignore: cast_nullable_to_non_nullable
          : notes as String?,
      etablissement: etablissement == const $CopyWithPlaceholder()
          ? _value.etablissement
          // ignore: cast_nullable_to_non_nullable
          : etablissement as String?,
      relationStatus: relationStatus == const $CopyWithPlaceholder()
          ? _value.relationStatus
          // ignore: cast_nullable_to_non_nullable
          : relationStatus as RepresentantRelation,
      whatsappStatus: whatsappStatus == const $CopyWithPlaceholder()
          ? _value.whatsappStatus
          // ignore: cast_nullable_to_non_nullable
          : whatsappStatus as WhatsappStatus,
      calledAt: calledAt == const $CopyWithPlaceholder()
          ? _value.calledAt
          // ignore: cast_nullable_to_non_nullable
          : calledAt as DateTime?,
    );
  }
}

extension $ImportRowPreviewDtoCopyWith on ImportRowPreviewDto {
  /// Returns a callable class that can be used as follows: `instanceOfImportRowPreviewDto.copyWith(...)` or like so:`instanceOfImportRowPreviewDto.copyWith.fieldName(...)`.
  // ignore: library_private_types_in_public_api
  _$ImportRowPreviewDtoCWProxy get copyWith =>
      _$ImportRowPreviewDtoCWProxyImpl(this);
}

// **************************************************************************
// JsonSerializableGenerator
// **************************************************************************

ImportRowPreviewDto _$ImportRowPreviewDtoFromJson(Map<String, dynamic> json) =>
    $checkedCreate('ImportRowPreviewDto', json, ($checkedConvert) {
      $checkKeys(
        json,
        requiredKeys: const [
          'line',
          'fullName',
          'phoneE164',
          'departementName',
          'iefName',
          'notes',
          'etablissement',
          'relationStatus',
          'whatsappStatus',
          'calledAt',
        ],
      );
      final val = ImportRowPreviewDto(
        line: $checkedConvert('line', (v) => v as num),
        fullName: $checkedConvert('fullName', (v) => v as String),
        phoneE164: $checkedConvert('phoneE164', (v) => v as String),
        departementName: $checkedConvert('departementName', (v) => v as String),
        iefName: $checkedConvert('iefName', (v) => v as String?),
        notes: $checkedConvert('notes', (v) => v as String?),
        etablissement: $checkedConvert('etablissement', (v) => v as String?),
        relationStatus: $checkedConvert(
          'relationStatus',
          (v) => $enumDecode(
            _$RepresentantRelationEnumMap,
            v,
            unknownValue: RepresentantRelation.unknownDefaultOpenApi,
          ),
        ),
        whatsappStatus: $checkedConvert(
          'whatsappStatus',
          (v) => $enumDecode(
            _$WhatsappStatusEnumMap,
            v,
            unknownValue: WhatsappStatus.unknownDefaultOpenApi,
          ),
        ),
        calledAt: $checkedConvert(
          'calledAt',
          (v) => v == null ? null : DateTime.parse(v as String),
        ),
      );
      return val;
    });

Map<String, dynamic> _$ImportRowPreviewDtoToJson(
  ImportRowPreviewDto instance,
) => <String, dynamic>{
  'line': instance.line,
  'fullName': instance.fullName,
  'phoneE164': instance.phoneE164,
  'departementName': instance.departementName,
  'iefName': instance.iefName,
  'notes': instance.notes,
  'etablissement': instance.etablissement,
  'relationStatus': _$RepresentantRelationEnumMap[instance.relationStatus]!,
  'whatsappStatus': _$WhatsappStatusEnumMap[instance.whatsappStatus]!,
  'calledAt': instance.calledAt?.toIso8601String(),
};

const _$RepresentantRelationEnumMap = {
  RepresentantRelation.INCONNU: 'INCONNU',
  RepresentantRelation.CONTACTE: 'CONTACTE',
  RepresentantRelation.AMBASSADEUR: 'AMBASSADEUR',
  RepresentantRelation.REFUS: 'REFUS',
  RepresentantRelation.unknownDefaultOpenApi: 'unknown_default_open_api',
};

const _$WhatsappStatusEnumMap = {
  WhatsappStatus.NON_DEMANDE: 'NON_DEMANDE',
  WhatsappStatus.MEME_NUMERO: 'MEME_NUMERO',
  WhatsappStatus.AUTRE_NUMERO: 'AUTRE_NUMERO',
  WhatsappStatus.AUCUN: 'AUCUN',
  WhatsappStatus.unknownDefaultOpenApi: 'unknown_default_open_api',
};

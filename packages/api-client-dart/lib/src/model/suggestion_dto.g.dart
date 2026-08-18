// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'suggestion_dto.dart';

// **************************************************************************
// CopyWithGenerator
// **************************************************************************

abstract class _$SuggestionDtoCWProxy {
  SuggestionDto id(String id);

  SuggestionDto sourceRepresentantId(String sourceRepresentantId);

  SuggestionDto sourceRepresentantShortCode(String sourceRepresentantShortCode);

  SuggestionDto suggestedName(String? suggestedName);

  SuggestionDto suggestedPhoneE164(String suggestedPhoneE164);

  SuggestionDto note(String? note);

  SuggestionDto status(SuggestionStatus status);

  SuggestionDto suggestedById(String suggestedById);

  SuggestionDto suggestedByName(String suggestedByName);

  SuggestionDto resolvedRepresentantId(String? resolvedRepresentantId);

  SuggestionDto clientCreatedAt(DateTime clientCreatedAt);

  SuggestionDto createdAt(DateTime createdAt);

  /// This function **does support** nullification of nullable fields. All `null` values passed to `non-nullable` fields will be ignored. You can also use `SuggestionDto(...).copyWith.fieldName(...)` to override fields one at a time with nullification support.
  ///
  /// Usage
  /// ```dart
  /// SuggestionDto(...).copyWith(id: 12, name: "My name")
  /// ````
  SuggestionDto call({
    String id,
    String sourceRepresentantId,
    String sourceRepresentantShortCode,
    String? suggestedName,
    String suggestedPhoneE164,
    String? note,
    SuggestionStatus status,
    String suggestedById,
    String suggestedByName,
    String? resolvedRepresentantId,
    DateTime clientCreatedAt,
    DateTime createdAt,
  });
}

/// Proxy class for `copyWith` functionality. This is a callable class and can be used as follows: `instanceOfSuggestionDto.copyWith(...)`. Additionally contains functions for specific fields e.g. `instanceOfSuggestionDto.copyWith.fieldName(...)`
class _$SuggestionDtoCWProxyImpl implements _$SuggestionDtoCWProxy {
  const _$SuggestionDtoCWProxyImpl(this._value);

  final SuggestionDto _value;

  @override
  SuggestionDto id(String id) => this(id: id);

  @override
  SuggestionDto sourceRepresentantId(String sourceRepresentantId) =>
      this(sourceRepresentantId: sourceRepresentantId);

  @override
  SuggestionDto sourceRepresentantShortCode(
    String sourceRepresentantShortCode,
  ) => this(sourceRepresentantShortCode: sourceRepresentantShortCode);

  @override
  SuggestionDto suggestedName(String? suggestedName) =>
      this(suggestedName: suggestedName);

  @override
  SuggestionDto suggestedPhoneE164(String suggestedPhoneE164) =>
      this(suggestedPhoneE164: suggestedPhoneE164);

  @override
  SuggestionDto note(String? note) => this(note: note);

  @override
  SuggestionDto status(SuggestionStatus status) => this(status: status);

  @override
  SuggestionDto suggestedById(String suggestedById) =>
      this(suggestedById: suggestedById);

  @override
  SuggestionDto suggestedByName(String suggestedByName) =>
      this(suggestedByName: suggestedByName);

  @override
  SuggestionDto resolvedRepresentantId(String? resolvedRepresentantId) =>
      this(resolvedRepresentantId: resolvedRepresentantId);

  @override
  SuggestionDto clientCreatedAt(DateTime clientCreatedAt) =>
      this(clientCreatedAt: clientCreatedAt);

  @override
  SuggestionDto createdAt(DateTime createdAt) => this(createdAt: createdAt);

  @override
  /// This function **does support** nullification of nullable fields. All `null` values passed to `non-nullable` fields will be ignored. You can also use `SuggestionDto(...).copyWith.fieldName(...)` to override fields one at a time with nullification support.
  ///
  /// Usage
  /// ```dart
  /// SuggestionDto(...).copyWith(id: 12, name: "My name")
  /// ````
  SuggestionDto call({
    Object? id = const $CopyWithPlaceholder(),
    Object? sourceRepresentantId = const $CopyWithPlaceholder(),
    Object? sourceRepresentantShortCode = const $CopyWithPlaceholder(),
    Object? suggestedName = const $CopyWithPlaceholder(),
    Object? suggestedPhoneE164 = const $CopyWithPlaceholder(),
    Object? note = const $CopyWithPlaceholder(),
    Object? status = const $CopyWithPlaceholder(),
    Object? suggestedById = const $CopyWithPlaceholder(),
    Object? suggestedByName = const $CopyWithPlaceholder(),
    Object? resolvedRepresentantId = const $CopyWithPlaceholder(),
    Object? clientCreatedAt = const $CopyWithPlaceholder(),
    Object? createdAt = const $CopyWithPlaceholder(),
  }) {
    return SuggestionDto(
      id: id == const $CopyWithPlaceholder()
          ? _value.id
          // ignore: cast_nullable_to_non_nullable
          : id as String,
      sourceRepresentantId: sourceRepresentantId == const $CopyWithPlaceholder()
          ? _value.sourceRepresentantId
          // ignore: cast_nullable_to_non_nullable
          : sourceRepresentantId as String,
      sourceRepresentantShortCode:
          sourceRepresentantShortCode == const $CopyWithPlaceholder()
          ? _value.sourceRepresentantShortCode
          // ignore: cast_nullable_to_non_nullable
          : sourceRepresentantShortCode as String,
      suggestedName: suggestedName == const $CopyWithPlaceholder()
          ? _value.suggestedName
          // ignore: cast_nullable_to_non_nullable
          : suggestedName as String?,
      suggestedPhoneE164: suggestedPhoneE164 == const $CopyWithPlaceholder()
          ? _value.suggestedPhoneE164
          // ignore: cast_nullable_to_non_nullable
          : suggestedPhoneE164 as String,
      note: note == const $CopyWithPlaceholder()
          ? _value.note
          // ignore: cast_nullable_to_non_nullable
          : note as String?,
      status: status == const $CopyWithPlaceholder()
          ? _value.status
          // ignore: cast_nullable_to_non_nullable
          : status as SuggestionStatus,
      suggestedById: suggestedById == const $CopyWithPlaceholder()
          ? _value.suggestedById
          // ignore: cast_nullable_to_non_nullable
          : suggestedById as String,
      suggestedByName: suggestedByName == const $CopyWithPlaceholder()
          ? _value.suggestedByName
          // ignore: cast_nullable_to_non_nullable
          : suggestedByName as String,
      resolvedRepresentantId:
          resolvedRepresentantId == const $CopyWithPlaceholder()
          ? _value.resolvedRepresentantId
          // ignore: cast_nullable_to_non_nullable
          : resolvedRepresentantId as String?,
      clientCreatedAt: clientCreatedAt == const $CopyWithPlaceholder()
          ? _value.clientCreatedAt
          // ignore: cast_nullable_to_non_nullable
          : clientCreatedAt as DateTime,
      createdAt: createdAt == const $CopyWithPlaceholder()
          ? _value.createdAt
          // ignore: cast_nullable_to_non_nullable
          : createdAt as DateTime,
    );
  }
}

extension $SuggestionDtoCopyWith on SuggestionDto {
  /// Returns a callable class that can be used as follows: `instanceOfSuggestionDto.copyWith(...)` or like so:`instanceOfSuggestionDto.copyWith.fieldName(...)`.
  // ignore: library_private_types_in_public_api
  _$SuggestionDtoCWProxy get copyWith => _$SuggestionDtoCWProxyImpl(this);
}

// **************************************************************************
// JsonSerializableGenerator
// **************************************************************************

SuggestionDto _$SuggestionDtoFromJson(Map<String, dynamic> json) =>
    $checkedCreate('SuggestionDto', json, ($checkedConvert) {
      $checkKeys(
        json,
        requiredKeys: const [
          'id',
          'sourceRepresentantId',
          'sourceRepresentantShortCode',
          'suggestedName',
          'suggestedPhoneE164',
          'note',
          'status',
          'suggestedById',
          'suggestedByName',
          'resolvedRepresentantId',
          'clientCreatedAt',
          'createdAt',
        ],
      );
      final val = SuggestionDto(
        id: $checkedConvert('id', (v) => v as String),
        sourceRepresentantId: $checkedConvert(
          'sourceRepresentantId',
          (v) => v as String,
        ),
        sourceRepresentantShortCode: $checkedConvert(
          'sourceRepresentantShortCode',
          (v) => v as String,
        ),
        suggestedName: $checkedConvert('suggestedName', (v) => v as String?),
        suggestedPhoneE164: $checkedConvert(
          'suggestedPhoneE164',
          (v) => v as String,
        ),
        note: $checkedConvert('note', (v) => v as String?),
        status: $checkedConvert(
          'status',
          (v) => $enumDecode(
            _$SuggestionStatusEnumMap,
            v,
            unknownValue: SuggestionStatus.unknownDefaultOpenApi,
          ),
        ),
        suggestedById: $checkedConvert('suggestedById', (v) => v as String),
        suggestedByName: $checkedConvert('suggestedByName', (v) => v as String),
        resolvedRepresentantId: $checkedConvert(
          'resolvedRepresentantId',
          (v) => v as String?,
        ),
        clientCreatedAt: $checkedConvert(
          'clientCreatedAt',
          (v) => DateTime.parse(v as String),
        ),
        createdAt: $checkedConvert(
          'createdAt',
          (v) => DateTime.parse(v as String),
        ),
      );
      return val;
    });

Map<String, dynamic> _$SuggestionDtoToJson(SuggestionDto instance) =>
    <String, dynamic>{
      'id': instance.id,
      'sourceRepresentantId': instance.sourceRepresentantId,
      'sourceRepresentantShortCode': instance.sourceRepresentantShortCode,
      'suggestedName': instance.suggestedName,
      'suggestedPhoneE164': instance.suggestedPhoneE164,
      'note': instance.note,
      'status': _$SuggestionStatusEnumMap[instance.status]!,
      'suggestedById': instance.suggestedById,
      'suggestedByName': instance.suggestedByName,
      'resolvedRepresentantId': instance.resolvedRepresentantId,
      'clientCreatedAt': instance.clientCreatedAt.toIso8601String(),
      'createdAt': instance.createdAt.toIso8601String(),
    };

const _$SuggestionStatusEnumMap = {
  SuggestionStatus.A_APPELER: 'A_APPELER',
  SuggestionStatus.APPELE: 'APPELE',
  SuggestionStatus.ABANDONNE: 'ABANDONNE',
  SuggestionStatus.unknownDefaultOpenApi: 'unknown_default_open_api',
};

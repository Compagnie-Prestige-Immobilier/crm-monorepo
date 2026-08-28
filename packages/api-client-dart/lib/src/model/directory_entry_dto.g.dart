// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'directory_entry_dto.dart';

// **************************************************************************
// CopyWithGenerator
// **************************************************************************

abstract class _$DirectoryEntryDtoCWProxy {
  DirectoryEntryDto prospectId(String prospectId);

  DirectoryEntryDto phoneE164(String phoneE164);

  DirectoryEntryDto phase2Status(Phase2Status phase2Status);

  DirectoryEntryDto enrollmentMethod(EnrollmentMethod? enrollmentMethod);

  DirectoryEntryDto rev(num rev);

  DirectoryEntryDto updatedAt(DateTime updatedAt);

  /// This function **does support** nullification of nullable fields. All `null` values passed to `non-nullable` fields will be ignored. You can also use `DirectoryEntryDto(...).copyWith.fieldName(...)` to override fields one at a time with nullification support.
  ///
  /// Usage
  /// ```dart
  /// DirectoryEntryDto(...).copyWith(id: 12, name: "My name")
  /// ````
  DirectoryEntryDto call({
    String prospectId,
    String phoneE164,
    Phase2Status phase2Status,
    EnrollmentMethod? enrollmentMethod,
    num rev,
    DateTime updatedAt,
  });
}

/// Proxy class for `copyWith` functionality. This is a callable class and can be used as follows: `instanceOfDirectoryEntryDto.copyWith(...)`. Additionally contains functions for specific fields e.g. `instanceOfDirectoryEntryDto.copyWith.fieldName(...)`
class _$DirectoryEntryDtoCWProxyImpl implements _$DirectoryEntryDtoCWProxy {
  const _$DirectoryEntryDtoCWProxyImpl(this._value);

  final DirectoryEntryDto _value;

  @override
  DirectoryEntryDto prospectId(String prospectId) =>
      this(prospectId: prospectId);

  @override
  DirectoryEntryDto phoneE164(String phoneE164) => this(phoneE164: phoneE164);

  @override
  DirectoryEntryDto phase2Status(Phase2Status phase2Status) =>
      this(phase2Status: phase2Status);

  @override
  DirectoryEntryDto enrollmentMethod(EnrollmentMethod? enrollmentMethod) =>
      this(enrollmentMethod: enrollmentMethod);

  @override
  DirectoryEntryDto rev(num rev) => this(rev: rev);

  @override
  DirectoryEntryDto updatedAt(DateTime updatedAt) => this(updatedAt: updatedAt);

  @override
  /// This function **does support** nullification of nullable fields. All `null` values passed to `non-nullable` fields will be ignored. You can also use `DirectoryEntryDto(...).copyWith.fieldName(...)` to override fields one at a time with nullification support.
  ///
  /// Usage
  /// ```dart
  /// DirectoryEntryDto(...).copyWith(id: 12, name: "My name")
  /// ````
  DirectoryEntryDto call({
    Object? prospectId = const $CopyWithPlaceholder(),
    Object? phoneE164 = const $CopyWithPlaceholder(),
    Object? phase2Status = const $CopyWithPlaceholder(),
    Object? enrollmentMethod = const $CopyWithPlaceholder(),
    Object? rev = const $CopyWithPlaceholder(),
    Object? updatedAt = const $CopyWithPlaceholder(),
  }) {
    return DirectoryEntryDto(
      prospectId: prospectId == const $CopyWithPlaceholder()
          ? _value.prospectId
          // ignore: cast_nullable_to_non_nullable
          : prospectId as String,
      phoneE164: phoneE164 == const $CopyWithPlaceholder()
          ? _value.phoneE164
          // ignore: cast_nullable_to_non_nullable
          : phoneE164 as String,
      phase2Status: phase2Status == const $CopyWithPlaceholder()
          ? _value.phase2Status
          // ignore: cast_nullable_to_non_nullable
          : phase2Status as Phase2Status,
      enrollmentMethod: enrollmentMethod == const $CopyWithPlaceholder()
          ? _value.enrollmentMethod
          // ignore: cast_nullable_to_non_nullable
          : enrollmentMethod as EnrollmentMethod?,
      rev: rev == const $CopyWithPlaceholder()
          ? _value.rev
          // ignore: cast_nullable_to_non_nullable
          : rev as num,
      updatedAt: updatedAt == const $CopyWithPlaceholder()
          ? _value.updatedAt
          // ignore: cast_nullable_to_non_nullable
          : updatedAt as DateTime,
    );
  }
}

extension $DirectoryEntryDtoCopyWith on DirectoryEntryDto {
  /// Returns a callable class that can be used as follows: `instanceOfDirectoryEntryDto.copyWith(...)` or like so:`instanceOfDirectoryEntryDto.copyWith.fieldName(...)`.
  // ignore: library_private_types_in_public_api
  _$DirectoryEntryDtoCWProxy get copyWith =>
      _$DirectoryEntryDtoCWProxyImpl(this);
}

// **************************************************************************
// JsonSerializableGenerator
// **************************************************************************

DirectoryEntryDto _$DirectoryEntryDtoFromJson(Map<String, dynamic> json) =>
    $checkedCreate('DirectoryEntryDto', json, ($checkedConvert) {
      $checkKeys(
        json,
        requiredKeys: const [
          'prospectId',
          'phoneE164',
          'phase2Status',
          'enrollmentMethod',
          'rev',
          'updatedAt',
        ],
      );
      final val = DirectoryEntryDto(
        prospectId: $checkedConvert('prospectId', (v) => v as String),
        phoneE164: $checkedConvert('phoneE164', (v) => v as String),
        phase2Status: $checkedConvert(
          'phase2Status',
          (v) => $enumDecode(
            _$Phase2StatusEnumMap,
            v,
            unknownValue: Phase2Status.unknownDefaultOpenApi,
          ),
        ),
        enrollmentMethod: $checkedConvert(
          'enrollmentMethod',
          (v) => $enumDecodeNullable(
            _$EnrollmentMethodEnumMap,
            v,
            unknownValue: EnrollmentMethod.unknownDefaultOpenApi,
          ),
        ),
        rev: $checkedConvert('rev', (v) => v as num),
        updatedAt: $checkedConvert(
          'updatedAt',
          (v) => DateTime.parse(v as String),
        ),
      );
      return val;
    });

Map<String, dynamic> _$DirectoryEntryDtoToJson(DirectoryEntryDto instance) =>
    <String, dynamic>{
      'prospectId': instance.prospectId,
      'phoneE164': instance.phoneE164,
      'phase2Status': _$Phase2StatusEnumMap[instance.phase2Status]!,
      'enrollmentMethod': _$EnrollmentMethodEnumMap[instance.enrollmentMethod],
      'rev': instance.rev,
      'updatedAt': instance.updatedAt.toIso8601String(),
    };

const _$Phase2StatusEnumMap = {
  Phase2Status.PENDING: 'PENDING',
  Phase2Status.METHOD_OBTAINED: 'METHOD_OBTAINED',
  Phase2Status.REFUSED: 'REFUSED',
  Phase2Status.WRONG_NUMBER: 'WRONG_NUMBER',
  Phase2Status.unknownDefaultOpenApi: 'unknown_default_open_api',
};

const _$EnrollmentMethodEnumMap = {
  EnrollmentMethod.PLATFORM: 'PLATFORM',
  EnrollmentMethod.PHYSICAL: 'PHYSICAL',
  EnrollmentMethod.VOICE_OR_ELECTRONIC_MESSAGING:
      'VOICE_OR_ELECTRONIC_MESSAGING',
  EnrollmentMethod.APPOINTMENT: 'APPOINTMENT',
  EnrollmentMethod.unknownDefaultOpenApi: 'unknown_default_open_api',
};

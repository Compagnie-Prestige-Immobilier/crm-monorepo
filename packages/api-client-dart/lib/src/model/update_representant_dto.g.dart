// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'update_representant_dto.dart';

// **************************************************************************
// CopyWithGenerator
// **************************************************************************

abstract class _$UpdateRepresentantDtoCWProxy {
  UpdateRepresentantDto id(String? id);

  UpdateRepresentantDto fullName(String? fullName);

  UpdateRepresentantDto phone(String? phone);

  UpdateRepresentantDto departementId(String? departementId);

  UpdateRepresentantDto iefId(String? iefId);

  UpdateRepresentantDto notes(String? notes);

  UpdateRepresentantDto clientCreatedAt(DateTime? clientCreatedAt);

  /// This function **does support** nullification of nullable fields. All `null` values passed to `non-nullable` fields will be ignored. You can also use `UpdateRepresentantDto(...).copyWith.fieldName(...)` to override fields one at a time with nullification support.
  ///
  /// Usage
  /// ```dart
  /// UpdateRepresentantDto(...).copyWith(id: 12, name: "My name")
  /// ````
  UpdateRepresentantDto call({
    String? id,
    String? fullName,
    String? phone,
    String? departementId,
    String? iefId,
    String? notes,
    DateTime? clientCreatedAt,
  });
}

/// Proxy class for `copyWith` functionality. This is a callable class and can be used as follows: `instanceOfUpdateRepresentantDto.copyWith(...)`. Additionally contains functions for specific fields e.g. `instanceOfUpdateRepresentantDto.copyWith.fieldName(...)`
class _$UpdateRepresentantDtoCWProxyImpl
    implements _$UpdateRepresentantDtoCWProxy {
  const _$UpdateRepresentantDtoCWProxyImpl(this._value);

  final UpdateRepresentantDto _value;

  @override
  UpdateRepresentantDto id(String? id) => this(id: id);

  @override
  UpdateRepresentantDto fullName(String? fullName) => this(fullName: fullName);

  @override
  UpdateRepresentantDto phone(String? phone) => this(phone: phone);

  @override
  UpdateRepresentantDto departementId(String? departementId) =>
      this(departementId: departementId);

  @override
  UpdateRepresentantDto iefId(String? iefId) => this(iefId: iefId);

  @override
  UpdateRepresentantDto notes(String? notes) => this(notes: notes);

  @override
  UpdateRepresentantDto clientCreatedAt(DateTime? clientCreatedAt) =>
      this(clientCreatedAt: clientCreatedAt);

  @override
  /// This function **does support** nullification of nullable fields. All `null` values passed to `non-nullable` fields will be ignored. You can also use `UpdateRepresentantDto(...).copyWith.fieldName(...)` to override fields one at a time with nullification support.
  ///
  /// Usage
  /// ```dart
  /// UpdateRepresentantDto(...).copyWith(id: 12, name: "My name")
  /// ````
  UpdateRepresentantDto call({
    Object? id = const $CopyWithPlaceholder(),
    Object? fullName = const $CopyWithPlaceholder(),
    Object? phone = const $CopyWithPlaceholder(),
    Object? departementId = const $CopyWithPlaceholder(),
    Object? iefId = const $CopyWithPlaceholder(),
    Object? notes = const $CopyWithPlaceholder(),
    Object? clientCreatedAt = const $CopyWithPlaceholder(),
  }) {
    return UpdateRepresentantDto(
      id: id == const $CopyWithPlaceholder()
          ? _value.id
          // ignore: cast_nullable_to_non_nullable
          : id as String?,
      fullName: fullName == const $CopyWithPlaceholder()
          ? _value.fullName
          // ignore: cast_nullable_to_non_nullable
          : fullName as String?,
      phone: phone == const $CopyWithPlaceholder()
          ? _value.phone
          // ignore: cast_nullable_to_non_nullable
          : phone as String?,
      departementId: departementId == const $CopyWithPlaceholder()
          ? _value.departementId
          // ignore: cast_nullable_to_non_nullable
          : departementId as String?,
      iefId: iefId == const $CopyWithPlaceholder()
          ? _value.iefId
          // ignore: cast_nullable_to_non_nullable
          : iefId as String?,
      notes: notes == const $CopyWithPlaceholder()
          ? _value.notes
          // ignore: cast_nullable_to_non_nullable
          : notes as String?,
      clientCreatedAt: clientCreatedAt == const $CopyWithPlaceholder()
          ? _value.clientCreatedAt
          // ignore: cast_nullable_to_non_nullable
          : clientCreatedAt as DateTime?,
    );
  }
}

extension $UpdateRepresentantDtoCopyWith on UpdateRepresentantDto {
  /// Returns a callable class that can be used as follows: `instanceOfUpdateRepresentantDto.copyWith(...)` or like so:`instanceOfUpdateRepresentantDto.copyWith.fieldName(...)`.
  // ignore: library_private_types_in_public_api
  _$UpdateRepresentantDtoCWProxy get copyWith =>
      _$UpdateRepresentantDtoCWProxyImpl(this);
}

// **************************************************************************
// JsonSerializableGenerator
// **************************************************************************

UpdateRepresentantDto _$UpdateRepresentantDtoFromJson(
  Map<String, dynamic> json,
) => $checkedCreate('UpdateRepresentantDto', json, ($checkedConvert) {
  final val = UpdateRepresentantDto(
    id: $checkedConvert('id', (v) => v as String?),
    fullName: $checkedConvert('fullName', (v) => v as String?),
    phone: $checkedConvert('phone', (v) => v as String?),
    departementId: $checkedConvert('departementId', (v) => v as String?),
    iefId: $checkedConvert('iefId', (v) => v as String?),
    notes: $checkedConvert('notes', (v) => v as String?),
    clientCreatedAt: $checkedConvert(
      'clientCreatedAt',
      (v) => v == null ? null : DateTime.parse(v as String),
    ),
  );
  return val;
});

Map<String, dynamic> _$UpdateRepresentantDtoToJson(
  UpdateRepresentantDto instance,
) => <String, dynamic>{
  if (instance.id case final value?) 'id': value,
  if (instance.fullName case final value?) 'fullName': value,
  if (instance.phone case final value?) 'phone': value,
  if (instance.departementId case final value?) 'departementId': value,
  if (instance.iefId case final value?) 'iefId': value,
  if (instance.notes case final value?) 'notes': value,
  if (instance.clientCreatedAt?.toIso8601String() case final value?)
    'clientCreatedAt': value,
};

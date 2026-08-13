// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'create_representant_dto.dart';

// **************************************************************************
// CopyWithGenerator
// **************************************************************************

abstract class _$CreateRepresentantDtoCWProxy {
  CreateRepresentantDto id(String? id);

  CreateRepresentantDto fullName(String fullName);

  CreateRepresentantDto phone(String phone);

  CreateRepresentantDto departementId(String departementId);

  CreateRepresentantDto iefId(String? iefId);

  CreateRepresentantDto notes(String? notes);

  CreateRepresentantDto clientCreatedAt(DateTime? clientCreatedAt);

  /// This function **does support** nullification of nullable fields. All `null` values passed to `non-nullable` fields will be ignored. You can also use `CreateRepresentantDto(...).copyWith.fieldName(...)` to override fields one at a time with nullification support.
  ///
  /// Usage
  /// ```dart
  /// CreateRepresentantDto(...).copyWith(id: 12, name: "My name")
  /// ````
  CreateRepresentantDto call({
    String? id,
    String fullName,
    String phone,
    String departementId,
    String? iefId,
    String? notes,
    DateTime? clientCreatedAt,
  });
}

/// Proxy class for `copyWith` functionality. This is a callable class and can be used as follows: `instanceOfCreateRepresentantDto.copyWith(...)`. Additionally contains functions for specific fields e.g. `instanceOfCreateRepresentantDto.copyWith.fieldName(...)`
class _$CreateRepresentantDtoCWProxyImpl
    implements _$CreateRepresentantDtoCWProxy {
  const _$CreateRepresentantDtoCWProxyImpl(this._value);

  final CreateRepresentantDto _value;

  @override
  CreateRepresentantDto id(String? id) => this(id: id);

  @override
  CreateRepresentantDto fullName(String fullName) => this(fullName: fullName);

  @override
  CreateRepresentantDto phone(String phone) => this(phone: phone);

  @override
  CreateRepresentantDto departementId(String departementId) =>
      this(departementId: departementId);

  @override
  CreateRepresentantDto iefId(String? iefId) => this(iefId: iefId);

  @override
  CreateRepresentantDto notes(String? notes) => this(notes: notes);

  @override
  CreateRepresentantDto clientCreatedAt(DateTime? clientCreatedAt) =>
      this(clientCreatedAt: clientCreatedAt);

  @override
  /// This function **does support** nullification of nullable fields. All `null` values passed to `non-nullable` fields will be ignored. You can also use `CreateRepresentantDto(...).copyWith.fieldName(...)` to override fields one at a time with nullification support.
  ///
  /// Usage
  /// ```dart
  /// CreateRepresentantDto(...).copyWith(id: 12, name: "My name")
  /// ````
  CreateRepresentantDto call({
    Object? id = const $CopyWithPlaceholder(),
    Object? fullName = const $CopyWithPlaceholder(),
    Object? phone = const $CopyWithPlaceholder(),
    Object? departementId = const $CopyWithPlaceholder(),
    Object? iefId = const $CopyWithPlaceholder(),
    Object? notes = const $CopyWithPlaceholder(),
    Object? clientCreatedAt = const $CopyWithPlaceholder(),
  }) {
    return CreateRepresentantDto(
      id: id == const $CopyWithPlaceholder()
          ? _value.id
          // ignore: cast_nullable_to_non_nullable
          : id as String?,
      fullName: fullName == const $CopyWithPlaceholder()
          ? _value.fullName
          // ignore: cast_nullable_to_non_nullable
          : fullName as String,
      phone: phone == const $CopyWithPlaceholder()
          ? _value.phone
          // ignore: cast_nullable_to_non_nullable
          : phone as String,
      departementId: departementId == const $CopyWithPlaceholder()
          ? _value.departementId
          // ignore: cast_nullable_to_non_nullable
          : departementId as String,
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

extension $CreateRepresentantDtoCopyWith on CreateRepresentantDto {
  /// Returns a callable class that can be used as follows: `instanceOfCreateRepresentantDto.copyWith(...)` or like so:`instanceOfCreateRepresentantDto.copyWith.fieldName(...)`.
  // ignore: library_private_types_in_public_api
  _$CreateRepresentantDtoCWProxy get copyWith =>
      _$CreateRepresentantDtoCWProxyImpl(this);
}

// **************************************************************************
// JsonSerializableGenerator
// **************************************************************************

CreateRepresentantDto _$CreateRepresentantDtoFromJson(
  Map<String, dynamic> json,
) => $checkedCreate('CreateRepresentantDto', json, ($checkedConvert) {
  $checkKeys(json, requiredKeys: const ['fullName', 'phone', 'departementId']);
  final val = CreateRepresentantDto(
    id: $checkedConvert('id', (v) => v as String?),
    fullName: $checkedConvert('fullName', (v) => v as String),
    phone: $checkedConvert('phone', (v) => v as String),
    departementId: $checkedConvert('departementId', (v) => v as String),
    iefId: $checkedConvert('iefId', (v) => v as String?),
    notes: $checkedConvert('notes', (v) => v as String?),
    clientCreatedAt: $checkedConvert(
      'clientCreatedAt',
      (v) => v == null ? null : DateTime.parse(v as String),
    ),
  );
  return val;
});

Map<String, dynamic> _$CreateRepresentantDtoToJson(
  CreateRepresentantDto instance,
) => <String, dynamic>{
  if (instance.id case final value?) 'id': value,
  'fullName': instance.fullName,
  'phone': instance.phone,
  'departementId': instance.departementId,
  if (instance.iefId case final value?) 'iefId': value,
  if (instance.notes case final value?) 'notes': value,
  if (instance.clientCreatedAt?.toIso8601String() case final value?)
    'clientCreatedAt': value,
};

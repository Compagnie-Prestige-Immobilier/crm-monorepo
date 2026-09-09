// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'client_request_dto.dart';

// **************************************************************************
// CopyWithGenerator
// **************************************************************************

abstract class _$ClientRequestDtoCWProxy {
  ClientRequestDto id(String id);

  ClientRequestDto nom(String nom);

  ClientRequestDto prenom(String prenom);

  ClientRequestDto phoneE164(String phoneE164);

  ClientRequestDto note(String? note);

  ClientRequestDto banqueId(String banqueId);

  ClientRequestDto banqueName(String banqueName);

  ClientRequestDto requestedById(String requestedById);

  ClientRequestDto requestedByName(String requestedByName);

  ClientRequestDto status(ClientRequestStatus status);

  ClientRequestDto reviewedById(String? reviewedById);

  ClientRequestDto reviewedByName(String? reviewedByName);

  ClientRequestDto reviewedAt(DateTime? reviewedAt);

  ClientRequestDto rejectionNote(String? rejectionNote);

  ClientRequestDto createdProspectId(String? createdProspectId);

  ClientRequestDto createdAt(DateTime createdAt);

  ClientRequestDto updatedAt(DateTime updatedAt);

  /// This function **does support** nullification of nullable fields. All `null` values passed to `non-nullable` fields will be ignored. You can also use `ClientRequestDto(...).copyWith.fieldName(...)` to override fields one at a time with nullification support.
  ///
  /// Usage
  /// ```dart
  /// ClientRequestDto(...).copyWith(id: 12, name: "My name")
  /// ````
  ClientRequestDto call({
    String id,
    String nom,
    String prenom,
    String phoneE164,
    String? note,
    String banqueId,
    String banqueName,
    String requestedById,
    String requestedByName,
    ClientRequestStatus status,
    String? reviewedById,
    String? reviewedByName,
    DateTime? reviewedAt,
    String? rejectionNote,
    String? createdProspectId,
    DateTime createdAt,
    DateTime updatedAt,
  });
}

/// Proxy class for `copyWith` functionality. This is a callable class and can be used as follows: `instanceOfClientRequestDto.copyWith(...)`. Additionally contains functions for specific fields e.g. `instanceOfClientRequestDto.copyWith.fieldName(...)`
class _$ClientRequestDtoCWProxyImpl implements _$ClientRequestDtoCWProxy {
  const _$ClientRequestDtoCWProxyImpl(this._value);

  final ClientRequestDto _value;

  @override
  ClientRequestDto id(String id) => this(id: id);

  @override
  ClientRequestDto nom(String nom) => this(nom: nom);

  @override
  ClientRequestDto prenom(String prenom) => this(prenom: prenom);

  @override
  ClientRequestDto phoneE164(String phoneE164) => this(phoneE164: phoneE164);

  @override
  ClientRequestDto note(String? note) => this(note: note);

  @override
  ClientRequestDto banqueId(String banqueId) => this(banqueId: banqueId);

  @override
  ClientRequestDto banqueName(String banqueName) =>
      this(banqueName: banqueName);

  @override
  ClientRequestDto requestedById(String requestedById) =>
      this(requestedById: requestedById);

  @override
  ClientRequestDto requestedByName(String requestedByName) =>
      this(requestedByName: requestedByName);

  @override
  ClientRequestDto status(ClientRequestStatus status) => this(status: status);

  @override
  ClientRequestDto reviewedById(String? reviewedById) =>
      this(reviewedById: reviewedById);

  @override
  ClientRequestDto reviewedByName(String? reviewedByName) =>
      this(reviewedByName: reviewedByName);

  @override
  ClientRequestDto reviewedAt(DateTime? reviewedAt) =>
      this(reviewedAt: reviewedAt);

  @override
  ClientRequestDto rejectionNote(String? rejectionNote) =>
      this(rejectionNote: rejectionNote);

  @override
  ClientRequestDto createdProspectId(String? createdProspectId) =>
      this(createdProspectId: createdProspectId);

  @override
  ClientRequestDto createdAt(DateTime createdAt) => this(createdAt: createdAt);

  @override
  ClientRequestDto updatedAt(DateTime updatedAt) => this(updatedAt: updatedAt);

  @override
  /// This function **does support** nullification of nullable fields. All `null` values passed to `non-nullable` fields will be ignored. You can also use `ClientRequestDto(...).copyWith.fieldName(...)` to override fields one at a time with nullification support.
  ///
  /// Usage
  /// ```dart
  /// ClientRequestDto(...).copyWith(id: 12, name: "My name")
  /// ````
  ClientRequestDto call({
    Object? id = const $CopyWithPlaceholder(),
    Object? nom = const $CopyWithPlaceholder(),
    Object? prenom = const $CopyWithPlaceholder(),
    Object? phoneE164 = const $CopyWithPlaceholder(),
    Object? note = const $CopyWithPlaceholder(),
    Object? banqueId = const $CopyWithPlaceholder(),
    Object? banqueName = const $CopyWithPlaceholder(),
    Object? requestedById = const $CopyWithPlaceholder(),
    Object? requestedByName = const $CopyWithPlaceholder(),
    Object? status = const $CopyWithPlaceholder(),
    Object? reviewedById = const $CopyWithPlaceholder(),
    Object? reviewedByName = const $CopyWithPlaceholder(),
    Object? reviewedAt = const $CopyWithPlaceholder(),
    Object? rejectionNote = const $CopyWithPlaceholder(),
    Object? createdProspectId = const $CopyWithPlaceholder(),
    Object? createdAt = const $CopyWithPlaceholder(),
    Object? updatedAt = const $CopyWithPlaceholder(),
  }) {
    return ClientRequestDto(
      id: id == const $CopyWithPlaceholder()
          ? _value.id
          // ignore: cast_nullable_to_non_nullable
          : id as String,
      nom: nom == const $CopyWithPlaceholder()
          ? _value.nom
          // ignore: cast_nullable_to_non_nullable
          : nom as String,
      prenom: prenom == const $CopyWithPlaceholder()
          ? _value.prenom
          // ignore: cast_nullable_to_non_nullable
          : prenom as String,
      phoneE164: phoneE164 == const $CopyWithPlaceholder()
          ? _value.phoneE164
          // ignore: cast_nullable_to_non_nullable
          : phoneE164 as String,
      note: note == const $CopyWithPlaceholder()
          ? _value.note
          // ignore: cast_nullable_to_non_nullable
          : note as String?,
      banqueId: banqueId == const $CopyWithPlaceholder()
          ? _value.banqueId
          // ignore: cast_nullable_to_non_nullable
          : banqueId as String,
      banqueName: banqueName == const $CopyWithPlaceholder()
          ? _value.banqueName
          // ignore: cast_nullable_to_non_nullable
          : banqueName as String,
      requestedById: requestedById == const $CopyWithPlaceholder()
          ? _value.requestedById
          // ignore: cast_nullable_to_non_nullable
          : requestedById as String,
      requestedByName: requestedByName == const $CopyWithPlaceholder()
          ? _value.requestedByName
          // ignore: cast_nullable_to_non_nullable
          : requestedByName as String,
      status: status == const $CopyWithPlaceholder()
          ? _value.status
          // ignore: cast_nullable_to_non_nullable
          : status as ClientRequestStatus,
      reviewedById: reviewedById == const $CopyWithPlaceholder()
          ? _value.reviewedById
          // ignore: cast_nullable_to_non_nullable
          : reviewedById as String?,
      reviewedByName: reviewedByName == const $CopyWithPlaceholder()
          ? _value.reviewedByName
          // ignore: cast_nullable_to_non_nullable
          : reviewedByName as String?,
      reviewedAt: reviewedAt == const $CopyWithPlaceholder()
          ? _value.reviewedAt
          // ignore: cast_nullable_to_non_nullable
          : reviewedAt as DateTime?,
      rejectionNote: rejectionNote == const $CopyWithPlaceholder()
          ? _value.rejectionNote
          // ignore: cast_nullable_to_non_nullable
          : rejectionNote as String?,
      createdProspectId: createdProspectId == const $CopyWithPlaceholder()
          ? _value.createdProspectId
          // ignore: cast_nullable_to_non_nullable
          : createdProspectId as String?,
      createdAt: createdAt == const $CopyWithPlaceholder()
          ? _value.createdAt
          // ignore: cast_nullable_to_non_nullable
          : createdAt as DateTime,
      updatedAt: updatedAt == const $CopyWithPlaceholder()
          ? _value.updatedAt
          // ignore: cast_nullable_to_non_nullable
          : updatedAt as DateTime,
    );
  }
}

extension $ClientRequestDtoCopyWith on ClientRequestDto {
  /// Returns a callable class that can be used as follows: `instanceOfClientRequestDto.copyWith(...)` or like so:`instanceOfClientRequestDto.copyWith.fieldName(...)`.
  // ignore: library_private_types_in_public_api
  _$ClientRequestDtoCWProxy get copyWith => _$ClientRequestDtoCWProxyImpl(this);
}

// **************************************************************************
// JsonSerializableGenerator
// **************************************************************************

ClientRequestDto _$ClientRequestDtoFromJson(
  Map<String, dynamic> json,
) => $checkedCreate('ClientRequestDto', json, ($checkedConvert) {
  $checkKeys(
    json,
    requiredKeys: const [
      'id',
      'nom',
      'prenom',
      'phoneE164',
      'note',
      'banqueId',
      'banqueName',
      'requestedById',
      'requestedByName',
      'status',
      'reviewedById',
      'reviewedByName',
      'reviewedAt',
      'rejectionNote',
      'createdProspectId',
      'createdAt',
      'updatedAt',
    ],
  );
  final val = ClientRequestDto(
    id: $checkedConvert('id', (v) => v as String),
    nom: $checkedConvert('nom', (v) => v as String),
    prenom: $checkedConvert('prenom', (v) => v as String),
    phoneE164: $checkedConvert('phoneE164', (v) => v as String),
    note: $checkedConvert('note', (v) => v as String?),
    banqueId: $checkedConvert('banqueId', (v) => v as String),
    banqueName: $checkedConvert('banqueName', (v) => v as String),
    requestedById: $checkedConvert('requestedById', (v) => v as String),
    requestedByName: $checkedConvert('requestedByName', (v) => v as String),
    status: $checkedConvert(
      'status',
      (v) => $enumDecode(
        _$ClientRequestStatusEnumMap,
        v,
        unknownValue: ClientRequestStatus.unknownDefaultOpenApi,
      ),
    ),
    reviewedById: $checkedConvert('reviewedById', (v) => v as String?),
    reviewedByName: $checkedConvert('reviewedByName', (v) => v as String?),
    reviewedAt: $checkedConvert(
      'reviewedAt',
      (v) => v == null ? null : DateTime.parse(v as String),
    ),
    rejectionNote: $checkedConvert('rejectionNote', (v) => v as String?),
    createdProspectId: $checkedConvert(
      'createdProspectId',
      (v) => v as String?,
    ),
    createdAt: $checkedConvert('createdAt', (v) => DateTime.parse(v as String)),
    updatedAt: $checkedConvert('updatedAt', (v) => DateTime.parse(v as String)),
  );
  return val;
});

Map<String, dynamic> _$ClientRequestDtoToJson(ClientRequestDto instance) =>
    <String, dynamic>{
      'id': instance.id,
      'nom': instance.nom,
      'prenom': instance.prenom,
      'phoneE164': instance.phoneE164,
      'note': instance.note,
      'banqueId': instance.banqueId,
      'banqueName': instance.banqueName,
      'requestedById': instance.requestedById,
      'requestedByName': instance.requestedByName,
      'status': _$ClientRequestStatusEnumMap[instance.status]!,
      'reviewedById': instance.reviewedById,
      'reviewedByName': instance.reviewedByName,
      'reviewedAt': instance.reviewedAt?.toIso8601String(),
      'rejectionNote': instance.rejectionNote,
      'createdProspectId': instance.createdProspectId,
      'createdAt': instance.createdAt.toIso8601String(),
      'updatedAt': instance.updatedAt.toIso8601String(),
    };

const _$ClientRequestStatusEnumMap = {
  ClientRequestStatus.PENDING: 'PENDING',
  ClientRequestStatus.APPROVED: 'APPROVED',
  ClientRequestStatus.REJECTED: 'REJECTED',
  ClientRequestStatus.unknownDefaultOpenApi: 'unknown_default_open_api',
};

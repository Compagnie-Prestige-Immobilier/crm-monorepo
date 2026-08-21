// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'sync_visite_dto.dart';

// **************************************************************************
// CopyWithGenerator
// **************************************************************************

abstract class _$SyncVisiteDtoCWProxy {
  SyncVisiteDto id(String id);

  SyncVisiteDto reference(String reference);

  SyncVisiteDto date(String date);

  SyncVisiteDto time(String? time);

  SyncVisiteDto visitorName(String visitorName);

  SyncVisiteDto phone(String? phone);

  SyncVisiteDto phoneE164(String? phoneE164);

  SyncVisiteDto entreprise(VisiteReferentielRefDto entreprise);

  SyncVisiteDto objet(VisiteReferentielRefDto objet);

  SyncVisiteDto direction(VisiteReferentielRefDto? direction);

  SyncVisiteDto destinataire(VisiteReferentielRefDto? destinataire);

  SyncVisiteDto comment(String? comment);

  SyncVisiteDto createdById(String createdById);

  SyncVisiteDto createdAt(DateTime createdAt);

  SyncVisiteDto updatedAt(DateTime updatedAt);

  /// This function **does support** nullification of nullable fields. All `null` values passed to `non-nullable` fields will be ignored. You can also use `SyncVisiteDto(...).copyWith.fieldName(...)` to override fields one at a time with nullification support.
  ///
  /// Usage
  /// ```dart
  /// SyncVisiteDto(...).copyWith(id: 12, name: "My name")
  /// ````
  SyncVisiteDto call({
    String id,
    String reference,
    String date,
    String? time,
    String visitorName,
    String? phone,
    String? phoneE164,
    VisiteReferentielRefDto entreprise,
    VisiteReferentielRefDto objet,
    VisiteReferentielRefDto? direction,
    VisiteReferentielRefDto? destinataire,
    String? comment,
    String createdById,
    DateTime createdAt,
    DateTime updatedAt,
  });
}

/// Proxy class for `copyWith` functionality. This is a callable class and can be used as follows: `instanceOfSyncVisiteDto.copyWith(...)`. Additionally contains functions for specific fields e.g. `instanceOfSyncVisiteDto.copyWith.fieldName(...)`
class _$SyncVisiteDtoCWProxyImpl implements _$SyncVisiteDtoCWProxy {
  const _$SyncVisiteDtoCWProxyImpl(this._value);

  final SyncVisiteDto _value;

  @override
  SyncVisiteDto id(String id) => this(id: id);

  @override
  SyncVisiteDto reference(String reference) => this(reference: reference);

  @override
  SyncVisiteDto date(String date) => this(date: date);

  @override
  SyncVisiteDto time(String? time) => this(time: time);

  @override
  SyncVisiteDto visitorName(String visitorName) =>
      this(visitorName: visitorName);

  @override
  SyncVisiteDto phone(String? phone) => this(phone: phone);

  @override
  SyncVisiteDto phoneE164(String? phoneE164) => this(phoneE164: phoneE164);

  @override
  SyncVisiteDto entreprise(VisiteReferentielRefDto entreprise) =>
      this(entreprise: entreprise);

  @override
  SyncVisiteDto objet(VisiteReferentielRefDto objet) => this(objet: objet);

  @override
  SyncVisiteDto direction(VisiteReferentielRefDto? direction) =>
      this(direction: direction);

  @override
  SyncVisiteDto destinataire(VisiteReferentielRefDto? destinataire) =>
      this(destinataire: destinataire);

  @override
  SyncVisiteDto comment(String? comment) => this(comment: comment);

  @override
  SyncVisiteDto createdById(String createdById) =>
      this(createdById: createdById);

  @override
  SyncVisiteDto createdAt(DateTime createdAt) => this(createdAt: createdAt);

  @override
  SyncVisiteDto updatedAt(DateTime updatedAt) => this(updatedAt: updatedAt);

  @override
  /// This function **does support** nullification of nullable fields. All `null` values passed to `non-nullable` fields will be ignored. You can also use `SyncVisiteDto(...).copyWith.fieldName(...)` to override fields one at a time with nullification support.
  ///
  /// Usage
  /// ```dart
  /// SyncVisiteDto(...).copyWith(id: 12, name: "My name")
  /// ````
  SyncVisiteDto call({
    Object? id = const $CopyWithPlaceholder(),
    Object? reference = const $CopyWithPlaceholder(),
    Object? date = const $CopyWithPlaceholder(),
    Object? time = const $CopyWithPlaceholder(),
    Object? visitorName = const $CopyWithPlaceholder(),
    Object? phone = const $CopyWithPlaceholder(),
    Object? phoneE164 = const $CopyWithPlaceholder(),
    Object? entreprise = const $CopyWithPlaceholder(),
    Object? objet = const $CopyWithPlaceholder(),
    Object? direction = const $CopyWithPlaceholder(),
    Object? destinataire = const $CopyWithPlaceholder(),
    Object? comment = const $CopyWithPlaceholder(),
    Object? createdById = const $CopyWithPlaceholder(),
    Object? createdAt = const $CopyWithPlaceholder(),
    Object? updatedAt = const $CopyWithPlaceholder(),
  }) {
    return SyncVisiteDto(
      id: id == const $CopyWithPlaceholder()
          ? _value.id
          // ignore: cast_nullable_to_non_nullable
          : id as String,
      reference: reference == const $CopyWithPlaceholder()
          ? _value.reference
          // ignore: cast_nullable_to_non_nullable
          : reference as String,
      date: date == const $CopyWithPlaceholder()
          ? _value.date
          // ignore: cast_nullable_to_non_nullable
          : date as String,
      time: time == const $CopyWithPlaceholder()
          ? _value.time
          // ignore: cast_nullable_to_non_nullable
          : time as String?,
      visitorName: visitorName == const $CopyWithPlaceholder()
          ? _value.visitorName
          // ignore: cast_nullable_to_non_nullable
          : visitorName as String,
      phone: phone == const $CopyWithPlaceholder()
          ? _value.phone
          // ignore: cast_nullable_to_non_nullable
          : phone as String?,
      phoneE164: phoneE164 == const $CopyWithPlaceholder()
          ? _value.phoneE164
          // ignore: cast_nullable_to_non_nullable
          : phoneE164 as String?,
      entreprise: entreprise == const $CopyWithPlaceholder()
          ? _value.entreprise
          // ignore: cast_nullable_to_non_nullable
          : entreprise as VisiteReferentielRefDto,
      objet: objet == const $CopyWithPlaceholder()
          ? _value.objet
          // ignore: cast_nullable_to_non_nullable
          : objet as VisiteReferentielRefDto,
      direction: direction == const $CopyWithPlaceholder()
          ? _value.direction
          // ignore: cast_nullable_to_non_nullable
          : direction as VisiteReferentielRefDto?,
      destinataire: destinataire == const $CopyWithPlaceholder()
          ? _value.destinataire
          // ignore: cast_nullable_to_non_nullable
          : destinataire as VisiteReferentielRefDto?,
      comment: comment == const $CopyWithPlaceholder()
          ? _value.comment
          // ignore: cast_nullable_to_non_nullable
          : comment as String?,
      createdById: createdById == const $CopyWithPlaceholder()
          ? _value.createdById
          // ignore: cast_nullable_to_non_nullable
          : createdById as String,
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

extension $SyncVisiteDtoCopyWith on SyncVisiteDto {
  /// Returns a callable class that can be used as follows: `instanceOfSyncVisiteDto.copyWith(...)` or like so:`instanceOfSyncVisiteDto.copyWith.fieldName(...)`.
  // ignore: library_private_types_in_public_api
  _$SyncVisiteDtoCWProxy get copyWith => _$SyncVisiteDtoCWProxyImpl(this);
}

// **************************************************************************
// JsonSerializableGenerator
// **************************************************************************

SyncVisiteDto _$SyncVisiteDtoFromJson(
  Map<String, dynamic> json,
) => $checkedCreate('SyncVisiteDto', json, ($checkedConvert) {
  $checkKeys(
    json,
    requiredKeys: const [
      'id',
      'reference',
      'date',
      'time',
      'visitorName',
      'phone',
      'phoneE164',
      'entreprise',
      'objet',
      'direction',
      'destinataire',
      'comment',
      'createdById',
      'createdAt',
      'updatedAt',
    ],
  );
  final val = SyncVisiteDto(
    id: $checkedConvert('id', (v) => v as String),
    reference: $checkedConvert('reference', (v) => v as String),
    date: $checkedConvert('date', (v) => v as String),
    time: $checkedConvert('time', (v) => v as String?),
    visitorName: $checkedConvert('visitorName', (v) => v as String),
    phone: $checkedConvert('phone', (v) => v as String?),
    phoneE164: $checkedConvert('phoneE164', (v) => v as String?),
    entreprise: $checkedConvert(
      'entreprise',
      (v) => VisiteReferentielRefDto.fromJson(v as Map<String, dynamic>),
    ),
    objet: $checkedConvert(
      'objet',
      (v) => VisiteReferentielRefDto.fromJson(v as Map<String, dynamic>),
    ),
    direction: $checkedConvert(
      'direction',
      (v) => v == null
          ? null
          : VisiteReferentielRefDto.fromJson(v as Map<String, dynamic>),
    ),
    destinataire: $checkedConvert(
      'destinataire',
      (v) => v == null
          ? null
          : VisiteReferentielRefDto.fromJson(v as Map<String, dynamic>),
    ),
    comment: $checkedConvert('comment', (v) => v as String?),
    createdById: $checkedConvert('createdById', (v) => v as String),
    createdAt: $checkedConvert('createdAt', (v) => DateTime.parse(v as String)),
    updatedAt: $checkedConvert('updatedAt', (v) => DateTime.parse(v as String)),
  );
  return val;
});

Map<String, dynamic> _$SyncVisiteDtoToJson(SyncVisiteDto instance) =>
    <String, dynamic>{
      'id': instance.id,
      'reference': instance.reference,
      'date': instance.date,
      'time': instance.time,
      'visitorName': instance.visitorName,
      'phone': instance.phone,
      'phoneE164': instance.phoneE164,
      'entreprise': instance.entreprise.toJson(),
      'objet': instance.objet.toJson(),
      'direction': instance.direction?.toJson(),
      'destinataire': instance.destinataire?.toJson(),
      'comment': instance.comment,
      'createdById': instance.createdById,
      'createdAt': instance.createdAt.toIso8601String(),
      'updatedAt': instance.updatedAt.toIso8601String(),
    };

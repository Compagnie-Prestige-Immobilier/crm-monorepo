// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'create_visite_dto.dart';

// **************************************************************************
// CopyWithGenerator
// **************************************************************************

abstract class _$CreateVisiteDtoCWProxy {
  CreateVisiteDto date(String date);

  CreateVisiteDto time(String? time);

  CreateVisiteDto visitorName(String visitorName);

  CreateVisiteDto phone(String? phone);

  CreateVisiteDto entrepriseId(String entrepriseId);

  CreateVisiteDto objetId(String objetId);

  CreateVisiteDto directionId(String? directionId);

  CreateVisiteDto destinataireId(String? destinataireId);

  CreateVisiteDto comment(String? comment);

  /// This function **does support** nullification of nullable fields. All `null` values passed to `non-nullable` fields will be ignored. You can also use `CreateVisiteDto(...).copyWith.fieldName(...)` to override fields one at a time with nullification support.
  ///
  /// Usage
  /// ```dart
  /// CreateVisiteDto(...).copyWith(id: 12, name: "My name")
  /// ````
  CreateVisiteDto call({
    String date,
    String? time,
    String visitorName,
    String? phone,
    String entrepriseId,
    String objetId,
    String? directionId,
    String? destinataireId,
    String? comment,
  });
}

/// Proxy class for `copyWith` functionality. This is a callable class and can be used as follows: `instanceOfCreateVisiteDto.copyWith(...)`. Additionally contains functions for specific fields e.g. `instanceOfCreateVisiteDto.copyWith.fieldName(...)`
class _$CreateVisiteDtoCWProxyImpl implements _$CreateVisiteDtoCWProxy {
  const _$CreateVisiteDtoCWProxyImpl(this._value);

  final CreateVisiteDto _value;

  @override
  CreateVisiteDto date(String date) => this(date: date);

  @override
  CreateVisiteDto time(String? time) => this(time: time);

  @override
  CreateVisiteDto visitorName(String visitorName) =>
      this(visitorName: visitorName);

  @override
  CreateVisiteDto phone(String? phone) => this(phone: phone);

  @override
  CreateVisiteDto entrepriseId(String entrepriseId) =>
      this(entrepriseId: entrepriseId);

  @override
  CreateVisiteDto objetId(String objetId) => this(objetId: objetId);

  @override
  CreateVisiteDto directionId(String? directionId) =>
      this(directionId: directionId);

  @override
  CreateVisiteDto destinataireId(String? destinataireId) =>
      this(destinataireId: destinataireId);

  @override
  CreateVisiteDto comment(String? comment) => this(comment: comment);

  @override
  /// This function **does support** nullification of nullable fields. All `null` values passed to `non-nullable` fields will be ignored. You can also use `CreateVisiteDto(...).copyWith.fieldName(...)` to override fields one at a time with nullification support.
  ///
  /// Usage
  /// ```dart
  /// CreateVisiteDto(...).copyWith(id: 12, name: "My name")
  /// ````
  CreateVisiteDto call({
    Object? date = const $CopyWithPlaceholder(),
    Object? time = const $CopyWithPlaceholder(),
    Object? visitorName = const $CopyWithPlaceholder(),
    Object? phone = const $CopyWithPlaceholder(),
    Object? entrepriseId = const $CopyWithPlaceholder(),
    Object? objetId = const $CopyWithPlaceholder(),
    Object? directionId = const $CopyWithPlaceholder(),
    Object? destinataireId = const $CopyWithPlaceholder(),
    Object? comment = const $CopyWithPlaceholder(),
  }) {
    return CreateVisiteDto(
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
      entrepriseId: entrepriseId == const $CopyWithPlaceholder()
          ? _value.entrepriseId
          // ignore: cast_nullable_to_non_nullable
          : entrepriseId as String,
      objetId: objetId == const $CopyWithPlaceholder()
          ? _value.objetId
          // ignore: cast_nullable_to_non_nullable
          : objetId as String,
      directionId: directionId == const $CopyWithPlaceholder()
          ? _value.directionId
          // ignore: cast_nullable_to_non_nullable
          : directionId as String?,
      destinataireId: destinataireId == const $CopyWithPlaceholder()
          ? _value.destinataireId
          // ignore: cast_nullable_to_non_nullable
          : destinataireId as String?,
      comment: comment == const $CopyWithPlaceholder()
          ? _value.comment
          // ignore: cast_nullable_to_non_nullable
          : comment as String?,
    );
  }
}

extension $CreateVisiteDtoCopyWith on CreateVisiteDto {
  /// Returns a callable class that can be used as follows: `instanceOfCreateVisiteDto.copyWith(...)` or like so:`instanceOfCreateVisiteDto.copyWith.fieldName(...)`.
  // ignore: library_private_types_in_public_api
  _$CreateVisiteDtoCWProxy get copyWith => _$CreateVisiteDtoCWProxyImpl(this);
}

// **************************************************************************
// JsonSerializableGenerator
// **************************************************************************

CreateVisiteDto _$CreateVisiteDtoFromJson(Map<String, dynamic> json) =>
    $checkedCreate('CreateVisiteDto', json, ($checkedConvert) {
      $checkKeys(
        json,
        requiredKeys: const ['date', 'visitorName', 'entrepriseId', 'objetId'],
      );
      final val = CreateVisiteDto(
        date: $checkedConvert('date', (v) => v as String),
        time: $checkedConvert('time', (v) => v as String?),
        visitorName: $checkedConvert('visitorName', (v) => v as String),
        phone: $checkedConvert('phone', (v) => v as String?),
        entrepriseId: $checkedConvert('entrepriseId', (v) => v as String),
        objetId: $checkedConvert('objetId', (v) => v as String),
        directionId: $checkedConvert('directionId', (v) => v as String?),
        destinataireId: $checkedConvert('destinataireId', (v) => v as String?),
        comment: $checkedConvert('comment', (v) => v as String?),
      );
      return val;
    });

Map<String, dynamic> _$CreateVisiteDtoToJson(CreateVisiteDto instance) =>
    <String, dynamic>{
      'date': instance.date,
      if (instance.time case final value?) 'time': value,
      'visitorName': instance.visitorName,
      if (instance.phone case final value?) 'phone': value,
      'entrepriseId': instance.entrepriseId,
      'objetId': instance.objetId,
      if (instance.directionId case final value?) 'directionId': value,
      if (instance.destinataireId case final value?) 'destinataireId': value,
      if (instance.comment case final value?) 'comment': value,
    };

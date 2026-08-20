// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'update_visite_dto.dart';

// **************************************************************************
// CopyWithGenerator
// **************************************************************************

abstract class _$UpdateVisiteDtoCWProxy {
  UpdateVisiteDto time(String? time);

  UpdateVisiteDto visitorName(String? visitorName);

  UpdateVisiteDto phone(String? phone);

  UpdateVisiteDto entrepriseId(String? entrepriseId);

  UpdateVisiteDto objetId(String? objetId);

  UpdateVisiteDto directionId(String? directionId);

  UpdateVisiteDto destinataireId(String? destinataireId);

  UpdateVisiteDto comment(String? comment);

  /// This function **does support** nullification of nullable fields. All `null` values passed to `non-nullable` fields will be ignored. You can also use `UpdateVisiteDto(...).copyWith.fieldName(...)` to override fields one at a time with nullification support.
  ///
  /// Usage
  /// ```dart
  /// UpdateVisiteDto(...).copyWith(id: 12, name: "My name")
  /// ````
  UpdateVisiteDto call({
    String? time,
    String? visitorName,
    String? phone,
    String? entrepriseId,
    String? objetId,
    String? directionId,
    String? destinataireId,
    String? comment,
  });
}

/// Proxy class for `copyWith` functionality. This is a callable class and can be used as follows: `instanceOfUpdateVisiteDto.copyWith(...)`. Additionally contains functions for specific fields e.g. `instanceOfUpdateVisiteDto.copyWith.fieldName(...)`
class _$UpdateVisiteDtoCWProxyImpl implements _$UpdateVisiteDtoCWProxy {
  const _$UpdateVisiteDtoCWProxyImpl(this._value);

  final UpdateVisiteDto _value;

  @override
  UpdateVisiteDto time(String? time) => this(time: time);

  @override
  UpdateVisiteDto visitorName(String? visitorName) =>
      this(visitorName: visitorName);

  @override
  UpdateVisiteDto phone(String? phone) => this(phone: phone);

  @override
  UpdateVisiteDto entrepriseId(String? entrepriseId) =>
      this(entrepriseId: entrepriseId);

  @override
  UpdateVisiteDto objetId(String? objetId) => this(objetId: objetId);

  @override
  UpdateVisiteDto directionId(String? directionId) =>
      this(directionId: directionId);

  @override
  UpdateVisiteDto destinataireId(String? destinataireId) =>
      this(destinataireId: destinataireId);

  @override
  UpdateVisiteDto comment(String? comment) => this(comment: comment);

  @override
  /// This function **does support** nullification of nullable fields. All `null` values passed to `non-nullable` fields will be ignored. You can also use `UpdateVisiteDto(...).copyWith.fieldName(...)` to override fields one at a time with nullification support.
  ///
  /// Usage
  /// ```dart
  /// UpdateVisiteDto(...).copyWith(id: 12, name: "My name")
  /// ````
  UpdateVisiteDto call({
    Object? time = const $CopyWithPlaceholder(),
    Object? visitorName = const $CopyWithPlaceholder(),
    Object? phone = const $CopyWithPlaceholder(),
    Object? entrepriseId = const $CopyWithPlaceholder(),
    Object? objetId = const $CopyWithPlaceholder(),
    Object? directionId = const $CopyWithPlaceholder(),
    Object? destinataireId = const $CopyWithPlaceholder(),
    Object? comment = const $CopyWithPlaceholder(),
  }) {
    return UpdateVisiteDto(
      time: time == const $CopyWithPlaceholder()
          ? _value.time
          // ignore: cast_nullable_to_non_nullable
          : time as String?,
      visitorName: visitorName == const $CopyWithPlaceholder()
          ? _value.visitorName
          // ignore: cast_nullable_to_non_nullable
          : visitorName as String?,
      phone: phone == const $CopyWithPlaceholder()
          ? _value.phone
          // ignore: cast_nullable_to_non_nullable
          : phone as String?,
      entrepriseId: entrepriseId == const $CopyWithPlaceholder()
          ? _value.entrepriseId
          // ignore: cast_nullable_to_non_nullable
          : entrepriseId as String?,
      objetId: objetId == const $CopyWithPlaceholder()
          ? _value.objetId
          // ignore: cast_nullable_to_non_nullable
          : objetId as String?,
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

extension $UpdateVisiteDtoCopyWith on UpdateVisiteDto {
  /// Returns a callable class that can be used as follows: `instanceOfUpdateVisiteDto.copyWith(...)` or like so:`instanceOfUpdateVisiteDto.copyWith.fieldName(...)`.
  // ignore: library_private_types_in_public_api
  _$UpdateVisiteDtoCWProxy get copyWith => _$UpdateVisiteDtoCWProxyImpl(this);
}

// **************************************************************************
// JsonSerializableGenerator
// **************************************************************************

UpdateVisiteDto _$UpdateVisiteDtoFromJson(Map<String, dynamic> json) =>
    $checkedCreate('UpdateVisiteDto', json, ($checkedConvert) {
      final val = UpdateVisiteDto(
        time: $checkedConvert('time', (v) => v as String?),
        visitorName: $checkedConvert('visitorName', (v) => v as String?),
        phone: $checkedConvert('phone', (v) => v as String?),
        entrepriseId: $checkedConvert('entrepriseId', (v) => v as String?),
        objetId: $checkedConvert('objetId', (v) => v as String?),
        directionId: $checkedConvert('directionId', (v) => v as String?),
        destinataireId: $checkedConvert('destinataireId', (v) => v as String?),
        comment: $checkedConvert('comment', (v) => v as String?),
      );
      return val;
    });

Map<String, dynamic> _$UpdateVisiteDtoToJson(UpdateVisiteDto instance) =>
    <String, dynamic>{
      if (instance.time case final value?) 'time': value,
      if (instance.visitorName case final value?) 'visitorName': value,
      if (instance.phone case final value?) 'phone': value,
      if (instance.entrepriseId case final value?) 'entrepriseId': value,
      if (instance.objetId case final value?) 'objetId': value,
      if (instance.directionId case final value?) 'directionId': value,
      if (instance.destinataireId case final value?) 'destinataireId': value,
      if (instance.comment case final value?) 'comment': value,
    };

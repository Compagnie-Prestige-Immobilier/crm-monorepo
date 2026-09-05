// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'supervision_campagne_teleconseiller_dto.dart';

// **************************************************************************
// CopyWithGenerator
// **************************************************************************

abstract class _$SupervisionCampagneTeleconseillerDtoCWProxy {
  SupervisionCampagneTeleconseillerDto prevues(num prevues);

  SupervisionCampagneTeleconseillerDto appelees(num appelees);

  SupervisionCampagneTeleconseillerDto traitees(num traitees);

  SupervisionCampagneTeleconseillerDto contactRate(num? contactRate);

  SupervisionCampagneTeleconseillerDto exploitationRate(num? exploitationRate);

  SupervisionCampagneTeleconseillerDto teleconseillerId(
    String teleconseillerId,
  );

  SupervisionCampagneTeleconseillerDto teleconseillerName(
    String teleconseillerName,
  );

  /// This function **does support** nullification of nullable fields. All `null` values passed to `non-nullable` fields will be ignored. You can also use `SupervisionCampagneTeleconseillerDto(...).copyWith.fieldName(...)` to override fields one at a time with nullification support.
  ///
  /// Usage
  /// ```dart
  /// SupervisionCampagneTeleconseillerDto(...).copyWith(id: 12, name: "My name")
  /// ````
  SupervisionCampagneTeleconseillerDto call({
    num prevues,
    num appelees,
    num traitees,
    num? contactRate,
    num? exploitationRate,
    String teleconseillerId,
    String teleconseillerName,
  });
}

/// Proxy class for `copyWith` functionality. This is a callable class and can be used as follows: `instanceOfSupervisionCampagneTeleconseillerDto.copyWith(...)`. Additionally contains functions for specific fields e.g. `instanceOfSupervisionCampagneTeleconseillerDto.copyWith.fieldName(...)`
class _$SupervisionCampagneTeleconseillerDtoCWProxyImpl
    implements _$SupervisionCampagneTeleconseillerDtoCWProxy {
  const _$SupervisionCampagneTeleconseillerDtoCWProxyImpl(this._value);

  final SupervisionCampagneTeleconseillerDto _value;

  @override
  SupervisionCampagneTeleconseillerDto prevues(num prevues) =>
      this(prevues: prevues);

  @override
  SupervisionCampagneTeleconseillerDto appelees(num appelees) =>
      this(appelees: appelees);

  @override
  SupervisionCampagneTeleconseillerDto traitees(num traitees) =>
      this(traitees: traitees);

  @override
  SupervisionCampagneTeleconseillerDto contactRate(num? contactRate) =>
      this(contactRate: contactRate);

  @override
  SupervisionCampagneTeleconseillerDto exploitationRate(
    num? exploitationRate,
  ) => this(exploitationRate: exploitationRate);

  @override
  SupervisionCampagneTeleconseillerDto teleconseillerId(
    String teleconseillerId,
  ) => this(teleconseillerId: teleconseillerId);

  @override
  SupervisionCampagneTeleconseillerDto teleconseillerName(
    String teleconseillerName,
  ) => this(teleconseillerName: teleconseillerName);

  @override
  /// This function **does support** nullification of nullable fields. All `null` values passed to `non-nullable` fields will be ignored. You can also use `SupervisionCampagneTeleconseillerDto(...).copyWith.fieldName(...)` to override fields one at a time with nullification support.
  ///
  /// Usage
  /// ```dart
  /// SupervisionCampagneTeleconseillerDto(...).copyWith(id: 12, name: "My name")
  /// ````
  SupervisionCampagneTeleconseillerDto call({
    Object? prevues = const $CopyWithPlaceholder(),
    Object? appelees = const $CopyWithPlaceholder(),
    Object? traitees = const $CopyWithPlaceholder(),
    Object? contactRate = const $CopyWithPlaceholder(),
    Object? exploitationRate = const $CopyWithPlaceholder(),
    Object? teleconseillerId = const $CopyWithPlaceholder(),
    Object? teleconseillerName = const $CopyWithPlaceholder(),
  }) {
    return SupervisionCampagneTeleconseillerDto(
      prevues: prevues == const $CopyWithPlaceholder()
          ? _value.prevues
          // ignore: cast_nullable_to_non_nullable
          : prevues as num,
      appelees: appelees == const $CopyWithPlaceholder()
          ? _value.appelees
          // ignore: cast_nullable_to_non_nullable
          : appelees as num,
      traitees: traitees == const $CopyWithPlaceholder()
          ? _value.traitees
          // ignore: cast_nullable_to_non_nullable
          : traitees as num,
      contactRate: contactRate == const $CopyWithPlaceholder()
          ? _value.contactRate
          // ignore: cast_nullable_to_non_nullable
          : contactRate as num?,
      exploitationRate: exploitationRate == const $CopyWithPlaceholder()
          ? _value.exploitationRate
          // ignore: cast_nullable_to_non_nullable
          : exploitationRate as num?,
      teleconseillerId: teleconseillerId == const $CopyWithPlaceholder()
          ? _value.teleconseillerId
          // ignore: cast_nullable_to_non_nullable
          : teleconseillerId as String,
      teleconseillerName: teleconseillerName == const $CopyWithPlaceholder()
          ? _value.teleconseillerName
          // ignore: cast_nullable_to_non_nullable
          : teleconseillerName as String,
    );
  }
}

extension $SupervisionCampagneTeleconseillerDtoCopyWith
    on SupervisionCampagneTeleconseillerDto {
  /// Returns a callable class that can be used as follows: `instanceOfSupervisionCampagneTeleconseillerDto.copyWith(...)` or like so:`instanceOfSupervisionCampagneTeleconseillerDto.copyWith.fieldName(...)`.
  // ignore: library_private_types_in_public_api
  _$SupervisionCampagneTeleconseillerDtoCWProxy get copyWith =>
      _$SupervisionCampagneTeleconseillerDtoCWProxyImpl(this);
}

// **************************************************************************
// JsonSerializableGenerator
// **************************************************************************

SupervisionCampagneTeleconseillerDto
_$SupervisionCampagneTeleconseillerDtoFromJson(Map<String, dynamic> json) =>
    $checkedCreate('SupervisionCampagneTeleconseillerDto', json, (
      $checkedConvert,
    ) {
      $checkKeys(
        json,
        requiredKeys: const [
          'prevues',
          'appelees',
          'traitees',
          'contactRate',
          'exploitationRate',
          'teleconseillerId',
          'teleconseillerName',
        ],
      );
      final val = SupervisionCampagneTeleconseillerDto(
        prevues: $checkedConvert('prevues', (v) => v as num),
        appelees: $checkedConvert('appelees', (v) => v as num),
        traitees: $checkedConvert('traitees', (v) => v as num),
        contactRate: $checkedConvert('contactRate', (v) => v as num?),
        exploitationRate: $checkedConvert('exploitationRate', (v) => v as num?),
        teleconseillerId: $checkedConvert(
          'teleconseillerId',
          (v) => v as String,
        ),
        teleconseillerName: $checkedConvert(
          'teleconseillerName',
          (v) => v as String,
        ),
      );
      return val;
    });

Map<String, dynamic> _$SupervisionCampagneTeleconseillerDtoToJson(
  SupervisionCampagneTeleconseillerDto instance,
) => <String, dynamic>{
  'prevues': instance.prevues,
  'appelees': instance.appelees,
  'traitees': instance.traitees,
  'contactRate': instance.contactRate,
  'exploitationRate': instance.exploitationRate,
  'teleconseillerId': instance.teleconseillerId,
  'teleconseillerName': instance.teleconseillerName,
};

// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'supervision_campagnes_totaux_dto.dart';

// **************************************************************************
// CopyWithGenerator
// **************************************************************************

abstract class _$SupervisionCampagnesTotauxDtoCWProxy {
  SupervisionCampagnesTotauxDto prevues(num prevues);

  SupervisionCampagnesTotauxDto appelees(num appelees);

  SupervisionCampagnesTotauxDto traitees(num traitees);

  SupervisionCampagnesTotauxDto contactRate(num? contactRate);

  SupervisionCampagnesTotauxDto exploitationRate(num? exploitationRate);

  /// This function **does support** nullification of nullable fields. All `null` values passed to `non-nullable` fields will be ignored. You can also use `SupervisionCampagnesTotauxDto(...).copyWith.fieldName(...)` to override fields one at a time with nullification support.
  ///
  /// Usage
  /// ```dart
  /// SupervisionCampagnesTotauxDto(...).copyWith(id: 12, name: "My name")
  /// ````
  SupervisionCampagnesTotauxDto call({
    num prevues,
    num appelees,
    num traitees,
    num? contactRate,
    num? exploitationRate,
  });
}

/// Proxy class for `copyWith` functionality. This is a callable class and can be used as follows: `instanceOfSupervisionCampagnesTotauxDto.copyWith(...)`. Additionally contains functions for specific fields e.g. `instanceOfSupervisionCampagnesTotauxDto.copyWith.fieldName(...)`
class _$SupervisionCampagnesTotauxDtoCWProxyImpl
    implements _$SupervisionCampagnesTotauxDtoCWProxy {
  const _$SupervisionCampagnesTotauxDtoCWProxyImpl(this._value);

  final SupervisionCampagnesTotauxDto _value;

  @override
  SupervisionCampagnesTotauxDto prevues(num prevues) => this(prevues: prevues);

  @override
  SupervisionCampagnesTotauxDto appelees(num appelees) =>
      this(appelees: appelees);

  @override
  SupervisionCampagnesTotauxDto traitees(num traitees) =>
      this(traitees: traitees);

  @override
  SupervisionCampagnesTotauxDto contactRate(num? contactRate) =>
      this(contactRate: contactRate);

  @override
  SupervisionCampagnesTotauxDto exploitationRate(num? exploitationRate) =>
      this(exploitationRate: exploitationRate);

  @override
  /// This function **does support** nullification of nullable fields. All `null` values passed to `non-nullable` fields will be ignored. You can also use `SupervisionCampagnesTotauxDto(...).copyWith.fieldName(...)` to override fields one at a time with nullification support.
  ///
  /// Usage
  /// ```dart
  /// SupervisionCampagnesTotauxDto(...).copyWith(id: 12, name: "My name")
  /// ````
  SupervisionCampagnesTotauxDto call({
    Object? prevues = const $CopyWithPlaceholder(),
    Object? appelees = const $CopyWithPlaceholder(),
    Object? traitees = const $CopyWithPlaceholder(),
    Object? contactRate = const $CopyWithPlaceholder(),
    Object? exploitationRate = const $CopyWithPlaceholder(),
  }) {
    return SupervisionCampagnesTotauxDto(
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
    );
  }
}

extension $SupervisionCampagnesTotauxDtoCopyWith
    on SupervisionCampagnesTotauxDto {
  /// Returns a callable class that can be used as follows: `instanceOfSupervisionCampagnesTotauxDto.copyWith(...)` or like so:`instanceOfSupervisionCampagnesTotauxDto.copyWith.fieldName(...)`.
  // ignore: library_private_types_in_public_api
  _$SupervisionCampagnesTotauxDtoCWProxy get copyWith =>
      _$SupervisionCampagnesTotauxDtoCWProxyImpl(this);
}

// **************************************************************************
// JsonSerializableGenerator
// **************************************************************************

SupervisionCampagnesTotauxDto _$SupervisionCampagnesTotauxDtoFromJson(
  Map<String, dynamic> json,
) => $checkedCreate('SupervisionCampagnesTotauxDto', json, ($checkedConvert) {
  $checkKeys(
    json,
    requiredKeys: const [
      'prevues',
      'appelees',
      'traitees',
      'contactRate',
      'exploitationRate',
    ],
  );
  final val = SupervisionCampagnesTotauxDto(
    prevues: $checkedConvert('prevues', (v) => v as num),
    appelees: $checkedConvert('appelees', (v) => v as num),
    traitees: $checkedConvert('traitees', (v) => v as num),
    contactRate: $checkedConvert('contactRate', (v) => v as num?),
    exploitationRate: $checkedConvert('exploitationRate', (v) => v as num?),
  );
  return val;
});

Map<String, dynamic> _$SupervisionCampagnesTotauxDtoToJson(
  SupervisionCampagnesTotauxDto instance,
) => <String, dynamic>{
  'prevues': instance.prevues,
  'appelees': instance.appelees,
  'traitees': instance.traitees,
  'contactRate': instance.contactRate,
  'exploitationRate': instance.exploitationRate,
};

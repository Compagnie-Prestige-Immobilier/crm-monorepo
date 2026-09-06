// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'purge_request_dto.dart';

// **************************************************************************
// CopyWithGenerator
// **************************************************************************

abstract class _$PurgeRequestDtoCWProxy {
  PurgeRequestDto domains(List<PurgeDomainKey> domains);

  PurgeRequestDto confirmation(String confirmation);

  /// This function **does support** nullification of nullable fields. All `null` values passed to `non-nullable` fields will be ignored. You can also use `PurgeRequestDto(...).copyWith.fieldName(...)` to override fields one at a time with nullification support.
  ///
  /// Usage
  /// ```dart
  /// PurgeRequestDto(...).copyWith(id: 12, name: "My name")
  /// ````
  PurgeRequestDto call({List<PurgeDomainKey> domains, String confirmation});
}

/// Proxy class for `copyWith` functionality. This is a callable class and can be used as follows: `instanceOfPurgeRequestDto.copyWith(...)`. Additionally contains functions for specific fields e.g. `instanceOfPurgeRequestDto.copyWith.fieldName(...)`
class _$PurgeRequestDtoCWProxyImpl implements _$PurgeRequestDtoCWProxy {
  const _$PurgeRequestDtoCWProxyImpl(this._value);

  final PurgeRequestDto _value;

  @override
  PurgeRequestDto domains(List<PurgeDomainKey> domains) =>
      this(domains: domains);

  @override
  PurgeRequestDto confirmation(String confirmation) =>
      this(confirmation: confirmation);

  @override
  /// This function **does support** nullification of nullable fields. All `null` values passed to `non-nullable` fields will be ignored. You can also use `PurgeRequestDto(...).copyWith.fieldName(...)` to override fields one at a time with nullification support.
  ///
  /// Usage
  /// ```dart
  /// PurgeRequestDto(...).copyWith(id: 12, name: "My name")
  /// ````
  PurgeRequestDto call({
    Object? domains = const $CopyWithPlaceholder(),
    Object? confirmation = const $CopyWithPlaceholder(),
  }) {
    return PurgeRequestDto(
      domains: domains == const $CopyWithPlaceholder()
          ? _value.domains
          // ignore: cast_nullable_to_non_nullable
          : domains as List<PurgeDomainKey>,
      confirmation: confirmation == const $CopyWithPlaceholder()
          ? _value.confirmation
          // ignore: cast_nullable_to_non_nullable
          : confirmation as String,
    );
  }
}

extension $PurgeRequestDtoCopyWith on PurgeRequestDto {
  /// Returns a callable class that can be used as follows: `instanceOfPurgeRequestDto.copyWith(...)` or like so:`instanceOfPurgeRequestDto.copyWith.fieldName(...)`.
  // ignore: library_private_types_in_public_api
  _$PurgeRequestDtoCWProxy get copyWith => _$PurgeRequestDtoCWProxyImpl(this);
}

// **************************************************************************
// JsonSerializableGenerator
// **************************************************************************

PurgeRequestDto _$PurgeRequestDtoFromJson(Map<String, dynamic> json) =>
    $checkedCreate('PurgeRequestDto', json, ($checkedConvert) {
      $checkKeys(json, requiredKeys: const ['domains', 'confirmation']);
      final val = PurgeRequestDto(
        domains: $checkedConvert(
          'domains',
          (v) => (v as List<dynamic>)
              .map((e) => $enumDecode(_$PurgeDomainKeyEnumMap, e))
              .toList(),
        ),
        confirmation: $checkedConvert('confirmation', (v) => v as String),
      );
      return val;
    });

Map<String, dynamic> _$PurgeRequestDtoToJson(
  PurgeRequestDto instance,
) => <String, dynamic>{
  'domains': instance.domains.map((e) => _$PurgeDomainKeyEnumMap[e]!).toList(),
  'confirmation': instance.confirmation,
};

const _$PurgeDomainKeyEnumMap = {
  PurgeDomainKey.teleconseillers: 'teleconseillers',
  PurgeDomainKey.chargesClientele: 'chargesClientele',
  PurgeDomainKey.finances: 'finances',
  PurgeDomainKey.supervision: 'supervision',
  PurgeDomainKey.directionAccueil: 'directionAccueil',
  PurgeDomainKey.representants: 'representants',
  PurgeDomainKey.prospects: 'prospects',
  PurgeDomainKey.lotsExport: 'lotsExport',
  PurgeDomainKey.demandesClients: 'demandesClients',
  PurgeDomainKey.visites: 'visites',
  PurgeDomainKey.fileAppels: 'fileAppels',
  PurgeDomainKey.tentatives: 'tentatives',
  PurgeDomainKey.dossiers: 'dossiers',
  PurgeDomainKey.notifications: 'notifications',
  PurgeDomainKey.synchronisation: 'synchronisation',
  PurgeDomainKey.journal: 'journal',
  PurgeDomainKey.referentiels: 'referentiels',
  PurgeDomainKey.unknownDefaultOpenApi: 'unknown_default_open_api',
};

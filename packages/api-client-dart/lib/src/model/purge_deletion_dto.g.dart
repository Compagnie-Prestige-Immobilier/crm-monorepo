// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'purge_deletion_dto.dart';

// **************************************************************************
// CopyWithGenerator
// **************************************************************************

abstract class _$PurgeDeletionDtoCWProxy {
  PurgeDeletionDto key(PurgeDomainKey key);

  PurgeDeletionDto label(String label);

  PurgeDeletionDto rows(num rows);

  /// This function **does support** nullification of nullable fields. All `null` values passed to `non-nullable` fields will be ignored. You can also use `PurgeDeletionDto(...).copyWith.fieldName(...)` to override fields one at a time with nullification support.
  ///
  /// Usage
  /// ```dart
  /// PurgeDeletionDto(...).copyWith(id: 12, name: "My name")
  /// ````
  PurgeDeletionDto call({PurgeDomainKey key, String label, num rows});
}

/// Proxy class for `copyWith` functionality. This is a callable class and can be used as follows: `instanceOfPurgeDeletionDto.copyWith(...)`. Additionally contains functions for specific fields e.g. `instanceOfPurgeDeletionDto.copyWith.fieldName(...)`
class _$PurgeDeletionDtoCWProxyImpl implements _$PurgeDeletionDtoCWProxy {
  const _$PurgeDeletionDtoCWProxyImpl(this._value);

  final PurgeDeletionDto _value;

  @override
  PurgeDeletionDto key(PurgeDomainKey key) => this(key: key);

  @override
  PurgeDeletionDto label(String label) => this(label: label);

  @override
  PurgeDeletionDto rows(num rows) => this(rows: rows);

  @override
  /// This function **does support** nullification of nullable fields. All `null` values passed to `non-nullable` fields will be ignored. You can also use `PurgeDeletionDto(...).copyWith.fieldName(...)` to override fields one at a time with nullification support.
  ///
  /// Usage
  /// ```dart
  /// PurgeDeletionDto(...).copyWith(id: 12, name: "My name")
  /// ````
  PurgeDeletionDto call({
    Object? key = const $CopyWithPlaceholder(),
    Object? label = const $CopyWithPlaceholder(),
    Object? rows = const $CopyWithPlaceholder(),
  }) {
    return PurgeDeletionDto(
      key: key == const $CopyWithPlaceholder()
          ? _value.key
          // ignore: cast_nullable_to_non_nullable
          : key as PurgeDomainKey,
      label: label == const $CopyWithPlaceholder()
          ? _value.label
          // ignore: cast_nullable_to_non_nullable
          : label as String,
      rows: rows == const $CopyWithPlaceholder()
          ? _value.rows
          // ignore: cast_nullable_to_non_nullable
          : rows as num,
    );
  }
}

extension $PurgeDeletionDtoCopyWith on PurgeDeletionDto {
  /// Returns a callable class that can be used as follows: `instanceOfPurgeDeletionDto.copyWith(...)` or like so:`instanceOfPurgeDeletionDto.copyWith.fieldName(...)`.
  // ignore: library_private_types_in_public_api
  _$PurgeDeletionDtoCWProxy get copyWith => _$PurgeDeletionDtoCWProxyImpl(this);
}

// **************************************************************************
// JsonSerializableGenerator
// **************************************************************************

PurgeDeletionDto _$PurgeDeletionDtoFromJson(Map<String, dynamic> json) =>
    $checkedCreate('PurgeDeletionDto', json, ($checkedConvert) {
      $checkKeys(json, requiredKeys: const ['key', 'label', 'rows']);
      final val = PurgeDeletionDto(
        key: $checkedConvert(
          'key',
          (v) => $enumDecode(
            _$PurgeDomainKeyEnumMap,
            v,
            unknownValue: PurgeDomainKey.unknownDefaultOpenApi,
          ),
        ),
        label: $checkedConvert('label', (v) => v as String),
        rows: $checkedConvert('rows', (v) => v as num),
      );
      return val;
    });

Map<String, dynamic> _$PurgeDeletionDtoToJson(PurgeDeletionDto instance) =>
    <String, dynamic>{
      'key': _$PurgeDomainKeyEnumMap[instance.key]!,
      'label': instance.label,
      'rows': instance.rows,
    };

const _$PurgeDomainKeyEnumMap = {
  PurgeDomainKey.teleconseillers: 'teleconseillers',
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

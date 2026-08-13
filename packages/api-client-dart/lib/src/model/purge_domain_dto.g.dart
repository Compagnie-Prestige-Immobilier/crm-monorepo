// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'purge_domain_dto.dart';

// **************************************************************************
// CopyWithGenerator
// **************************************************************************

abstract class _$PurgeDomainDtoCWProxy {
  PurgeDomainDto key(PurgeDomainKey key);

  PurgeDomainDto label(String label);

  PurgeDomainDto hint(String hint);

  PurgeDomainDto requires(List<String> requires);

  PurgeDomainDto rows(num rows);

  /// This function **does support** nullification of nullable fields. All `null` values passed to `non-nullable` fields will be ignored. You can also use `PurgeDomainDto(...).copyWith.fieldName(...)` to override fields one at a time with nullification support.
  ///
  /// Usage
  /// ```dart
  /// PurgeDomainDto(...).copyWith(id: 12, name: "My name")
  /// ````
  PurgeDomainDto call({
    PurgeDomainKey key,
    String label,
    String hint,
    List<String> requires,
    num rows,
  });
}

/// Proxy class for `copyWith` functionality. This is a callable class and can be used as follows: `instanceOfPurgeDomainDto.copyWith(...)`. Additionally contains functions for specific fields e.g. `instanceOfPurgeDomainDto.copyWith.fieldName(...)`
class _$PurgeDomainDtoCWProxyImpl implements _$PurgeDomainDtoCWProxy {
  const _$PurgeDomainDtoCWProxyImpl(this._value);

  final PurgeDomainDto _value;

  @override
  PurgeDomainDto key(PurgeDomainKey key) => this(key: key);

  @override
  PurgeDomainDto label(String label) => this(label: label);

  @override
  PurgeDomainDto hint(String hint) => this(hint: hint);

  @override
  PurgeDomainDto requires(List<String> requires) => this(requires: requires);

  @override
  PurgeDomainDto rows(num rows) => this(rows: rows);

  @override
  /// This function **does support** nullification of nullable fields. All `null` values passed to `non-nullable` fields will be ignored. You can also use `PurgeDomainDto(...).copyWith.fieldName(...)` to override fields one at a time with nullification support.
  ///
  /// Usage
  /// ```dart
  /// PurgeDomainDto(...).copyWith(id: 12, name: "My name")
  /// ````
  PurgeDomainDto call({
    Object? key = const $CopyWithPlaceholder(),
    Object? label = const $CopyWithPlaceholder(),
    Object? hint = const $CopyWithPlaceholder(),
    Object? requires = const $CopyWithPlaceholder(),
    Object? rows = const $CopyWithPlaceholder(),
  }) {
    return PurgeDomainDto(
      key: key == const $CopyWithPlaceholder()
          ? _value.key
          // ignore: cast_nullable_to_non_nullable
          : key as PurgeDomainKey,
      label: label == const $CopyWithPlaceholder()
          ? _value.label
          // ignore: cast_nullable_to_non_nullable
          : label as String,
      hint: hint == const $CopyWithPlaceholder()
          ? _value.hint
          // ignore: cast_nullable_to_non_nullable
          : hint as String,
      requires: requires == const $CopyWithPlaceholder()
          ? _value.requires
          // ignore: cast_nullable_to_non_nullable
          : requires as List<String>,
      rows: rows == const $CopyWithPlaceholder()
          ? _value.rows
          // ignore: cast_nullable_to_non_nullable
          : rows as num,
    );
  }
}

extension $PurgeDomainDtoCopyWith on PurgeDomainDto {
  /// Returns a callable class that can be used as follows: `instanceOfPurgeDomainDto.copyWith(...)` or like so:`instanceOfPurgeDomainDto.copyWith.fieldName(...)`.
  // ignore: library_private_types_in_public_api
  _$PurgeDomainDtoCWProxy get copyWith => _$PurgeDomainDtoCWProxyImpl(this);
}

// **************************************************************************
// JsonSerializableGenerator
// **************************************************************************

PurgeDomainDto _$PurgeDomainDtoFromJson(Map<String, dynamic> json) =>
    $checkedCreate('PurgeDomainDto', json, ($checkedConvert) {
      $checkKeys(
        json,
        requiredKeys: const ['key', 'label', 'hint', 'requires', 'rows'],
      );
      final val = PurgeDomainDto(
        key: $checkedConvert(
          'key',
          (v) => $enumDecode(
            _$PurgeDomainKeyEnumMap,
            v,
            unknownValue: PurgeDomainKey.unknownDefaultOpenApi,
          ),
        ),
        label: $checkedConvert('label', (v) => v as String),
        hint: $checkedConvert('hint', (v) => v as String),
        requires: $checkedConvert(
          'requires',
          (v) => (v as List<dynamic>).map((e) => e as String).toList(),
        ),
        rows: $checkedConvert('rows', (v) => v as num),
      );
      return val;
    });

Map<String, dynamic> _$PurgeDomainDtoToJson(PurgeDomainDto instance) =>
    <String, dynamic>{
      'key': _$PurgeDomainKeyEnumMap[instance.key]!,
      'label': instance.label,
      'hint': instance.hint,
      'requires': instance.requires,
      'rows': instance.rows,
    };

const _$PurgeDomainKeyEnumMap = {
  PurgeDomainKey.teleconseillers: 'teleconseillers',
  PurgeDomainKey.finances: 'finances',
  PurgeDomainKey.representants: 'representants',
  PurgeDomainKey.prospects: 'prospects',
  PurgeDomainKey.campagnes: 'campagnes',
  PurgeDomainKey.fileAppels: 'fileAppels',
  PurgeDomainKey.tentatives: 'tentatives',
  PurgeDomainKey.dossiers: 'dossiers',
  PurgeDomainKey.notifications: 'notifications',
  PurgeDomainKey.synchronisation: 'synchronisation',
  PurgeDomainKey.journal: 'journal',
  PurgeDomainKey.referentiels: 'referentiels',
  PurgeDomainKey.unknownDefaultOpenApi: 'unknown_default_open_api',
};

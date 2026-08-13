// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'purge_catalog_dto.dart';

// **************************************************************************
// CopyWithGenerator
// **************************************************************************

abstract class _$PurgeCatalogDtoCWProxy {
  PurgeCatalogDto allowed(bool allowed);

  PurgeCatalogDto confirmationHint(String confirmationHint);

  PurgeCatalogDto domains(List<PurgeDomainDto> domains);

  /// This function **does support** nullification of nullable fields. All `null` values passed to `non-nullable` fields will be ignored. You can also use `PurgeCatalogDto(...).copyWith.fieldName(...)` to override fields one at a time with nullification support.
  ///
  /// Usage
  /// ```dart
  /// PurgeCatalogDto(...).copyWith(id: 12, name: "My name")
  /// ````
  PurgeCatalogDto call({
    bool allowed,
    String confirmationHint,
    List<PurgeDomainDto> domains,
  });
}

/// Proxy class for `copyWith` functionality. This is a callable class and can be used as follows: `instanceOfPurgeCatalogDto.copyWith(...)`. Additionally contains functions for specific fields e.g. `instanceOfPurgeCatalogDto.copyWith.fieldName(...)`
class _$PurgeCatalogDtoCWProxyImpl implements _$PurgeCatalogDtoCWProxy {
  const _$PurgeCatalogDtoCWProxyImpl(this._value);

  final PurgeCatalogDto _value;

  @override
  PurgeCatalogDto allowed(bool allowed) => this(allowed: allowed);

  @override
  PurgeCatalogDto confirmationHint(String confirmationHint) =>
      this(confirmationHint: confirmationHint);

  @override
  PurgeCatalogDto domains(List<PurgeDomainDto> domains) =>
      this(domains: domains);

  @override
  /// This function **does support** nullification of nullable fields. All `null` values passed to `non-nullable` fields will be ignored. You can also use `PurgeCatalogDto(...).copyWith.fieldName(...)` to override fields one at a time with nullification support.
  ///
  /// Usage
  /// ```dart
  /// PurgeCatalogDto(...).copyWith(id: 12, name: "My name")
  /// ````
  PurgeCatalogDto call({
    Object? allowed = const $CopyWithPlaceholder(),
    Object? confirmationHint = const $CopyWithPlaceholder(),
    Object? domains = const $CopyWithPlaceholder(),
  }) {
    return PurgeCatalogDto(
      allowed: allowed == const $CopyWithPlaceholder()
          ? _value.allowed
          // ignore: cast_nullable_to_non_nullable
          : allowed as bool,
      confirmationHint: confirmationHint == const $CopyWithPlaceholder()
          ? _value.confirmationHint
          // ignore: cast_nullable_to_non_nullable
          : confirmationHint as String,
      domains: domains == const $CopyWithPlaceholder()
          ? _value.domains
          // ignore: cast_nullable_to_non_nullable
          : domains as List<PurgeDomainDto>,
    );
  }
}

extension $PurgeCatalogDtoCopyWith on PurgeCatalogDto {
  /// Returns a callable class that can be used as follows: `instanceOfPurgeCatalogDto.copyWith(...)` or like so:`instanceOfPurgeCatalogDto.copyWith.fieldName(...)`.
  // ignore: library_private_types_in_public_api
  _$PurgeCatalogDtoCWProxy get copyWith => _$PurgeCatalogDtoCWProxyImpl(this);
}

// **************************************************************************
// JsonSerializableGenerator
// **************************************************************************

PurgeCatalogDto _$PurgeCatalogDtoFromJson(Map<String, dynamic> json) =>
    $checkedCreate('PurgeCatalogDto', json, ($checkedConvert) {
      $checkKeys(
        json,
        requiredKeys: const ['allowed', 'confirmationHint', 'domains'],
      );
      final val = PurgeCatalogDto(
        allowed: $checkedConvert('allowed', (v) => v as bool),
        confirmationHint: $checkedConvert(
          'confirmationHint',
          (v) => v as String,
        ),
        domains: $checkedConvert(
          'domains',
          (v) => (v as List<dynamic>)
              .map((e) => PurgeDomainDto.fromJson(e as Map<String, dynamic>))
              .toList(),
        ),
      );
      return val;
    });

Map<String, dynamic> _$PurgeCatalogDtoToJson(PurgeCatalogDto instance) =>
    <String, dynamic>{
      'allowed': instance.allowed,
      'confirmationHint': instance.confirmationHint,
      'domains': instance.domains.map((e) => e.toJson()).toList(),
    };

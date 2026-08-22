// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'create_campaign_dto.dart';

// **************************************************************************
// CopyWithGenerator
// **************************************************************************

abstract class _$CreateCampaignDtoCWProxy {
  CreateCampaignDto name(String name);

  CreateCampaignDto projet(Projet? projet);

  CreateCampaignDto scope(CampaignScope scope);

  CreateCampaignDto offerId(String? offerId);

  CreateCampaignDto canalProvenanceId(String? canalProvenanceId);

  CreateCampaignDto professionId(String? professionId);

  CreateCampaignDto incomeBandId(String? incomeBandId);

  CreateCampaignDto commercialIds(List<String> commercialIds);

  CreateCampaignDto spreadDays(num? spreadDays);

  /// This function **does support** nullification of nullable fields. All `null` values passed to `non-nullable` fields will be ignored. You can also use `CreateCampaignDto(...).copyWith.fieldName(...)` to override fields one at a time with nullification support.
  ///
  /// Usage
  /// ```dart
  /// CreateCampaignDto(...).copyWith(id: 12, name: "My name")
  /// ````
  CreateCampaignDto call({
    String name,
    Projet? projet,
    CampaignScope scope,
    String? offerId,
    String? canalProvenanceId,
    String? professionId,
    String? incomeBandId,
    List<String> commercialIds,
    num? spreadDays,
  });
}

/// Proxy class for `copyWith` functionality. This is a callable class and can be used as follows: `instanceOfCreateCampaignDto.copyWith(...)`. Additionally contains functions for specific fields e.g. `instanceOfCreateCampaignDto.copyWith.fieldName(...)`
class _$CreateCampaignDtoCWProxyImpl implements _$CreateCampaignDtoCWProxy {
  const _$CreateCampaignDtoCWProxyImpl(this._value);

  final CreateCampaignDto _value;

  @override
  CreateCampaignDto name(String name) => this(name: name);

  @override
  CreateCampaignDto projet(Projet? projet) => this(projet: projet);

  @override
  CreateCampaignDto scope(CampaignScope scope) => this(scope: scope);

  @override
  CreateCampaignDto offerId(String? offerId) => this(offerId: offerId);

  @override
  CreateCampaignDto canalProvenanceId(String? canalProvenanceId) =>
      this(canalProvenanceId: canalProvenanceId);

  @override
  CreateCampaignDto professionId(String? professionId) =>
      this(professionId: professionId);

  @override
  CreateCampaignDto incomeBandId(String? incomeBandId) =>
      this(incomeBandId: incomeBandId);

  @override
  CreateCampaignDto commercialIds(List<String> commercialIds) =>
      this(commercialIds: commercialIds);

  @override
  CreateCampaignDto spreadDays(num? spreadDays) => this(spreadDays: spreadDays);

  @override
  /// This function **does support** nullification of nullable fields. All `null` values passed to `non-nullable` fields will be ignored. You can also use `CreateCampaignDto(...).copyWith.fieldName(...)` to override fields one at a time with nullification support.
  ///
  /// Usage
  /// ```dart
  /// CreateCampaignDto(...).copyWith(id: 12, name: "My name")
  /// ````
  CreateCampaignDto call({
    Object? name = const $CopyWithPlaceholder(),
    Object? projet = const $CopyWithPlaceholder(),
    Object? scope = const $CopyWithPlaceholder(),
    Object? offerId = const $CopyWithPlaceholder(),
    Object? canalProvenanceId = const $CopyWithPlaceholder(),
    Object? professionId = const $CopyWithPlaceholder(),
    Object? incomeBandId = const $CopyWithPlaceholder(),
    Object? commercialIds = const $CopyWithPlaceholder(),
    Object? spreadDays = const $CopyWithPlaceholder(),
  }) {
    return CreateCampaignDto(
      name: name == const $CopyWithPlaceholder()
          ? _value.name
          // ignore: cast_nullable_to_non_nullable
          : name as String,
      projet: projet == const $CopyWithPlaceholder()
          ? _value.projet
          // ignore: cast_nullable_to_non_nullable
          : projet as Projet?,
      scope: scope == const $CopyWithPlaceholder()
          ? _value.scope
          // ignore: cast_nullable_to_non_nullable
          : scope as CampaignScope,
      offerId: offerId == const $CopyWithPlaceholder()
          ? _value.offerId
          // ignore: cast_nullable_to_non_nullable
          : offerId as String?,
      canalProvenanceId: canalProvenanceId == const $CopyWithPlaceholder()
          ? _value.canalProvenanceId
          // ignore: cast_nullable_to_non_nullable
          : canalProvenanceId as String?,
      professionId: professionId == const $CopyWithPlaceholder()
          ? _value.professionId
          // ignore: cast_nullable_to_non_nullable
          : professionId as String?,
      incomeBandId: incomeBandId == const $CopyWithPlaceholder()
          ? _value.incomeBandId
          // ignore: cast_nullable_to_non_nullable
          : incomeBandId as String?,
      commercialIds: commercialIds == const $CopyWithPlaceholder()
          ? _value.commercialIds
          // ignore: cast_nullable_to_non_nullable
          : commercialIds as List<String>,
      spreadDays: spreadDays == const $CopyWithPlaceholder()
          ? _value.spreadDays
          // ignore: cast_nullable_to_non_nullable
          : spreadDays as num?,
    );
  }
}

extension $CreateCampaignDtoCopyWith on CreateCampaignDto {
  /// Returns a callable class that can be used as follows: `instanceOfCreateCampaignDto.copyWith(...)` or like so:`instanceOfCreateCampaignDto.copyWith.fieldName(...)`.
  // ignore: library_private_types_in_public_api
  _$CreateCampaignDtoCWProxy get copyWith =>
      _$CreateCampaignDtoCWProxyImpl(this);
}

// **************************************************************************
// JsonSerializableGenerator
// **************************************************************************

CreateCampaignDto _$CreateCampaignDtoFromJson(Map<String, dynamic> json) =>
    $checkedCreate('CreateCampaignDto', json, ($checkedConvert) {
      $checkKeys(json, requiredKeys: const ['name', 'scope', 'commercialIds']);
      final val = CreateCampaignDto(
        name: $checkedConvert('name', (v) => v as String),
        projet: $checkedConvert(
          'projet',
          (v) =>
              $enumDecodeNullable(
                _$ProjetEnumMap,
                v,
                unknownValue: Projet.unknownDefaultOpenApi,
              ) ??
              Projet.CHUES,
        ),
        scope: $checkedConvert(
          'scope',
          (v) => $enumDecode(
            _$CampaignScopeEnumMap,
            v,
            unknownValue: CampaignScope.unknownDefaultOpenApi,
          ),
        ),
        offerId: $checkedConvert('offerId', (v) => v as String?),
        canalProvenanceId: $checkedConvert(
          'canalProvenanceId',
          (v) => v as String?,
        ),
        professionId: $checkedConvert('professionId', (v) => v as String?),
        incomeBandId: $checkedConvert('incomeBandId', (v) => v as String?),
        commercialIds: $checkedConvert(
          'commercialIds',
          (v) => (v as List<dynamic>).map((e) => e as String).toList(),
        ),
        spreadDays: $checkedConvert('spreadDays', (v) => v as num? ?? 1),
      );
      return val;
    });

Map<String, dynamic> _$CreateCampaignDtoToJson(
  CreateCampaignDto instance,
) => <String, dynamic>{
  'name': instance.name,
  if (_$ProjetEnumMap[instance.projet] case final value?) 'projet': value,
  'scope': _$CampaignScopeEnumMap[instance.scope]!,
  if (instance.offerId case final value?) 'offerId': value,
  if (instance.canalProvenanceId case final value?) 'canalProvenanceId': value,
  if (instance.professionId case final value?) 'professionId': value,
  if (instance.incomeBandId case final value?) 'incomeBandId': value,
  'commercialIds': instance.commercialIds,
  if (instance.spreadDays case final value?) 'spreadDays': value,
};

const _$ProjetEnumMap = {
  Projet.CHUES: 'CHUES',
  Projet.GRAND_PUBLIC: 'GRAND_PUBLIC',
  Projet.unknownDefaultOpenApi: 'unknown_default_open_api',
};

const _$CampaignScopeEnumMap = {
  CampaignScope.BDD1: 'BDD1',
  CampaignScope.BDD2: 'BDD2',
  CampaignScope.BDD3: 'BDD3',
  CampaignScope.BDD4: 'BDD4',
  CampaignScope.GP1: 'GP1',
  CampaignScope.GP2: 'GP2',
  CampaignScope.GP3: 'GP3',
  CampaignScope.GP4: 'GP4',
  CampaignScope.ALL: 'ALL',
  CampaignScope.unknownDefaultOpenApi: 'unknown_default_open_api',
};

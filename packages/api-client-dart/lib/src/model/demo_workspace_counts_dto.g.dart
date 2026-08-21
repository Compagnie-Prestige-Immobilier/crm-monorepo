// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'demo_workspace_counts_dto.dart';

// **************************************************************************
// CopyWithGenerator
// **************************************************************************

abstract class _$DemoWorkspaceCountsDtoCWProxy {
  DemoWorkspaceCountsDto users(num users);

  DemoWorkspaceCountsDto representants(num representants);

  DemoWorkspaceCountsDto prospects(num prospects);

  DemoWorkspaceCountsDto campaigns(num campaigns);

  DemoWorkspaceCountsDto bankCases(num bankCases);

  /// This function **does support** nullification of nullable fields. All `null` values passed to `non-nullable` fields will be ignored. You can also use `DemoWorkspaceCountsDto(...).copyWith.fieldName(...)` to override fields one at a time with nullification support.
  ///
  /// Usage
  /// ```dart
  /// DemoWorkspaceCountsDto(...).copyWith(id: 12, name: "My name")
  /// ````
  DemoWorkspaceCountsDto call({
    num users,
    num representants,
    num prospects,
    num campaigns,
    num bankCases,
  });
}

/// Proxy class for `copyWith` functionality. This is a callable class and can be used as follows: `instanceOfDemoWorkspaceCountsDto.copyWith(...)`. Additionally contains functions for specific fields e.g. `instanceOfDemoWorkspaceCountsDto.copyWith.fieldName(...)`
class _$DemoWorkspaceCountsDtoCWProxyImpl
    implements _$DemoWorkspaceCountsDtoCWProxy {
  const _$DemoWorkspaceCountsDtoCWProxyImpl(this._value);

  final DemoWorkspaceCountsDto _value;

  @override
  DemoWorkspaceCountsDto users(num users) => this(users: users);

  @override
  DemoWorkspaceCountsDto representants(num representants) =>
      this(representants: representants);

  @override
  DemoWorkspaceCountsDto prospects(num prospects) => this(prospects: prospects);

  @override
  DemoWorkspaceCountsDto campaigns(num campaigns) => this(campaigns: campaigns);

  @override
  DemoWorkspaceCountsDto bankCases(num bankCases) => this(bankCases: bankCases);

  @override
  /// This function **does support** nullification of nullable fields. All `null` values passed to `non-nullable` fields will be ignored. You can also use `DemoWorkspaceCountsDto(...).copyWith.fieldName(...)` to override fields one at a time with nullification support.
  ///
  /// Usage
  /// ```dart
  /// DemoWorkspaceCountsDto(...).copyWith(id: 12, name: "My name")
  /// ````
  DemoWorkspaceCountsDto call({
    Object? users = const $CopyWithPlaceholder(),
    Object? representants = const $CopyWithPlaceholder(),
    Object? prospects = const $CopyWithPlaceholder(),
    Object? campaigns = const $CopyWithPlaceholder(),
    Object? bankCases = const $CopyWithPlaceholder(),
  }) {
    return DemoWorkspaceCountsDto(
      users: users == const $CopyWithPlaceholder()
          ? _value.users
          // ignore: cast_nullable_to_non_nullable
          : users as num,
      representants: representants == const $CopyWithPlaceholder()
          ? _value.representants
          // ignore: cast_nullable_to_non_nullable
          : representants as num,
      prospects: prospects == const $CopyWithPlaceholder()
          ? _value.prospects
          // ignore: cast_nullable_to_non_nullable
          : prospects as num,
      campaigns: campaigns == const $CopyWithPlaceholder()
          ? _value.campaigns
          // ignore: cast_nullable_to_non_nullable
          : campaigns as num,
      bankCases: bankCases == const $CopyWithPlaceholder()
          ? _value.bankCases
          // ignore: cast_nullable_to_non_nullable
          : bankCases as num,
    );
  }
}

extension $DemoWorkspaceCountsDtoCopyWith on DemoWorkspaceCountsDto {
  /// Returns a callable class that can be used as follows: `instanceOfDemoWorkspaceCountsDto.copyWith(...)` or like so:`instanceOfDemoWorkspaceCountsDto.copyWith.fieldName(...)`.
  // ignore: library_private_types_in_public_api
  _$DemoWorkspaceCountsDtoCWProxy get copyWith =>
      _$DemoWorkspaceCountsDtoCWProxyImpl(this);
}

// **************************************************************************
// JsonSerializableGenerator
// **************************************************************************

DemoWorkspaceCountsDto _$DemoWorkspaceCountsDtoFromJson(
  Map<String, dynamic> json,
) => $checkedCreate('DemoWorkspaceCountsDto', json, ($checkedConvert) {
  $checkKeys(
    json,
    requiredKeys: const [
      'users',
      'representants',
      'prospects',
      'campaigns',
      'bankCases',
    ],
  );
  final val = DemoWorkspaceCountsDto(
    users: $checkedConvert('users', (v) => v as num),
    representants: $checkedConvert('representants', (v) => v as num),
    prospects: $checkedConvert('prospects', (v) => v as num),
    campaigns: $checkedConvert('campaigns', (v) => v as num),
    bankCases: $checkedConvert('bankCases', (v) => v as num),
  );
  return val;
});

Map<String, dynamic> _$DemoWorkspaceCountsDtoToJson(
  DemoWorkspaceCountsDto instance,
) => <String, dynamic>{
  'users': instance.users,
  'representants': instance.representants,
  'prospects': instance.prospects,
  'campaigns': instance.campaigns,
  'bankCases': instance.bankCases,
};

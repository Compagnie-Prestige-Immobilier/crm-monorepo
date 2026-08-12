// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'demo_counts_dto.dart';

// **************************************************************************
// CopyWithGenerator
// **************************************************************************

abstract class _$DemoCountsDtoCWProxy {
  DemoCountsDto users(num users);

  DemoCountsDto representants(num representants);

  DemoCountsDto prospects(num prospects);

  DemoCountsDto campaigns(num campaigns);

  DemoCountsDto campaignCommerciaux(num campaignCommerciaux);

  DemoCountsDto callTasks(num callTasks);

  DemoCountsDto callAttempts(num callAttempts);

  DemoCountsDto bankCases(num bankCases);

  DemoCountsDto bankCaseTransitions(num bankCaseTransitions);

  /// This function **does support** nullification of nullable fields. All `null` values passed to `non-nullable` fields will be ignored. You can also use `DemoCountsDto(...).copyWith.fieldName(...)` to override fields one at a time with nullification support.
  ///
  /// Usage
  /// ```dart
  /// DemoCountsDto(...).copyWith(id: 12, name: "My name")
  /// ````
  DemoCountsDto call({
    num users,
    num representants,
    num prospects,
    num campaigns,
    num campaignCommerciaux,
    num callTasks,
    num callAttempts,
    num bankCases,
    num bankCaseTransitions,
  });
}

/// Proxy class for `copyWith` functionality. This is a callable class and can be used as follows: `instanceOfDemoCountsDto.copyWith(...)`. Additionally contains functions for specific fields e.g. `instanceOfDemoCountsDto.copyWith.fieldName(...)`
class _$DemoCountsDtoCWProxyImpl implements _$DemoCountsDtoCWProxy {
  const _$DemoCountsDtoCWProxyImpl(this._value);

  final DemoCountsDto _value;

  @override
  DemoCountsDto users(num users) => this(users: users);

  @override
  DemoCountsDto representants(num representants) =>
      this(representants: representants);

  @override
  DemoCountsDto prospects(num prospects) => this(prospects: prospects);

  @override
  DemoCountsDto campaigns(num campaigns) => this(campaigns: campaigns);

  @override
  DemoCountsDto campaignCommerciaux(num campaignCommerciaux) =>
      this(campaignCommerciaux: campaignCommerciaux);

  @override
  DemoCountsDto callTasks(num callTasks) => this(callTasks: callTasks);

  @override
  DemoCountsDto callAttempts(num callAttempts) =>
      this(callAttempts: callAttempts);

  @override
  DemoCountsDto bankCases(num bankCases) => this(bankCases: bankCases);

  @override
  DemoCountsDto bankCaseTransitions(num bankCaseTransitions) =>
      this(bankCaseTransitions: bankCaseTransitions);

  @override
  /// This function **does support** nullification of nullable fields. All `null` values passed to `non-nullable` fields will be ignored. You can also use `DemoCountsDto(...).copyWith.fieldName(...)` to override fields one at a time with nullification support.
  ///
  /// Usage
  /// ```dart
  /// DemoCountsDto(...).copyWith(id: 12, name: "My name")
  /// ````
  DemoCountsDto call({
    Object? users = const $CopyWithPlaceholder(),
    Object? representants = const $CopyWithPlaceholder(),
    Object? prospects = const $CopyWithPlaceholder(),
    Object? campaigns = const $CopyWithPlaceholder(),
    Object? campaignCommerciaux = const $CopyWithPlaceholder(),
    Object? callTasks = const $CopyWithPlaceholder(),
    Object? callAttempts = const $CopyWithPlaceholder(),
    Object? bankCases = const $CopyWithPlaceholder(),
    Object? bankCaseTransitions = const $CopyWithPlaceholder(),
  }) {
    return DemoCountsDto(
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
      campaignCommerciaux: campaignCommerciaux == const $CopyWithPlaceholder()
          ? _value.campaignCommerciaux
          // ignore: cast_nullable_to_non_nullable
          : campaignCommerciaux as num,
      callTasks: callTasks == const $CopyWithPlaceholder()
          ? _value.callTasks
          // ignore: cast_nullable_to_non_nullable
          : callTasks as num,
      callAttempts: callAttempts == const $CopyWithPlaceholder()
          ? _value.callAttempts
          // ignore: cast_nullable_to_non_nullable
          : callAttempts as num,
      bankCases: bankCases == const $CopyWithPlaceholder()
          ? _value.bankCases
          // ignore: cast_nullable_to_non_nullable
          : bankCases as num,
      bankCaseTransitions: bankCaseTransitions == const $CopyWithPlaceholder()
          ? _value.bankCaseTransitions
          // ignore: cast_nullable_to_non_nullable
          : bankCaseTransitions as num,
    );
  }
}

extension $DemoCountsDtoCopyWith on DemoCountsDto {
  /// Returns a callable class that can be used as follows: `instanceOfDemoCountsDto.copyWith(...)` or like so:`instanceOfDemoCountsDto.copyWith.fieldName(...)`.
  // ignore: library_private_types_in_public_api
  _$DemoCountsDtoCWProxy get copyWith => _$DemoCountsDtoCWProxyImpl(this);
}

// **************************************************************************
// JsonSerializableGenerator
// **************************************************************************

DemoCountsDto _$DemoCountsDtoFromJson(Map<String, dynamic> json) =>
    $checkedCreate('DemoCountsDto', json, ($checkedConvert) {
      $checkKeys(
        json,
        requiredKeys: const [
          'users',
          'representants',
          'prospects',
          'campaigns',
          'campaignCommerciaux',
          'callTasks',
          'callAttempts',
          'bankCases',
          'bankCaseTransitions',
        ],
      );
      final val = DemoCountsDto(
        users: $checkedConvert('users', (v) => v as num),
        representants: $checkedConvert('representants', (v) => v as num),
        prospects: $checkedConvert('prospects', (v) => v as num),
        campaigns: $checkedConvert('campaigns', (v) => v as num),
        campaignCommerciaux: $checkedConvert(
          'campaignCommerciaux',
          (v) => v as num,
        ),
        callTasks: $checkedConvert('callTasks', (v) => v as num),
        callAttempts: $checkedConvert('callAttempts', (v) => v as num),
        bankCases: $checkedConvert('bankCases', (v) => v as num),
        bankCaseTransitions: $checkedConvert(
          'bankCaseTransitions',
          (v) => v as num,
        ),
      );
      return val;
    });

Map<String, dynamic> _$DemoCountsDtoToJson(DemoCountsDto instance) =>
    <String, dynamic>{
      'users': instance.users,
      'representants': instance.representants,
      'prospects': instance.prospects,
      'campaigns': instance.campaigns,
      'campaignCommerciaux': instance.campaignCommerciaux,
      'callTasks': instance.callTasks,
      'callAttempts': instance.callAttempts,
      'bankCases': instance.bankCases,
      'bankCaseTransitions': instance.bankCaseTransitions,
    };

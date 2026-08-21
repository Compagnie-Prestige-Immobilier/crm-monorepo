// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'demo_workspace_status_dto.dart';

// **************************************************************************
// CopyWithGenerator
// **************************************************************************

abstract class _$DemoWorkspaceStatusDtoCWProxy {
  DemoWorkspaceStatusDto workspace(
    DemoWorkspaceStatusDtoWorkspaceEnum workspace,
  );

  DemoWorkspaceStatusDto counts(DemoWorkspaceCountsDto counts);

  /// This function **does support** nullification of nullable fields. All `null` values passed to `non-nullable` fields will be ignored. You can also use `DemoWorkspaceStatusDto(...).copyWith.fieldName(...)` to override fields one at a time with nullification support.
  ///
  /// Usage
  /// ```dart
  /// DemoWorkspaceStatusDto(...).copyWith(id: 12, name: "My name")
  /// ````
  DemoWorkspaceStatusDto call({
    DemoWorkspaceStatusDtoWorkspaceEnum workspace,
    DemoWorkspaceCountsDto counts,
  });
}

/// Proxy class for `copyWith` functionality. This is a callable class and can be used as follows: `instanceOfDemoWorkspaceStatusDto.copyWith(...)`. Additionally contains functions for specific fields e.g. `instanceOfDemoWorkspaceStatusDto.copyWith.fieldName(...)`
class _$DemoWorkspaceStatusDtoCWProxyImpl
    implements _$DemoWorkspaceStatusDtoCWProxy {
  const _$DemoWorkspaceStatusDtoCWProxyImpl(this._value);

  final DemoWorkspaceStatusDto _value;

  @override
  DemoWorkspaceStatusDto workspace(
    DemoWorkspaceStatusDtoWorkspaceEnum workspace,
  ) => this(workspace: workspace);

  @override
  DemoWorkspaceStatusDto counts(DemoWorkspaceCountsDto counts) =>
      this(counts: counts);

  @override
  /// This function **does support** nullification of nullable fields. All `null` values passed to `non-nullable` fields will be ignored. You can also use `DemoWorkspaceStatusDto(...).copyWith.fieldName(...)` to override fields one at a time with nullification support.
  ///
  /// Usage
  /// ```dart
  /// DemoWorkspaceStatusDto(...).copyWith(id: 12, name: "My name")
  /// ````
  DemoWorkspaceStatusDto call({
    Object? workspace = const $CopyWithPlaceholder(),
    Object? counts = const $CopyWithPlaceholder(),
  }) {
    return DemoWorkspaceStatusDto(
      workspace: workspace == const $CopyWithPlaceholder()
          ? _value.workspace
          // ignore: cast_nullable_to_non_nullable
          : workspace as DemoWorkspaceStatusDtoWorkspaceEnum,
      counts: counts == const $CopyWithPlaceholder()
          ? _value.counts
          // ignore: cast_nullable_to_non_nullable
          : counts as DemoWorkspaceCountsDto,
    );
  }
}

extension $DemoWorkspaceStatusDtoCopyWith on DemoWorkspaceStatusDto {
  /// Returns a callable class that can be used as follows: `instanceOfDemoWorkspaceStatusDto.copyWith(...)` or like so:`instanceOfDemoWorkspaceStatusDto.copyWith.fieldName(...)`.
  // ignore: library_private_types_in_public_api
  _$DemoWorkspaceStatusDtoCWProxy get copyWith =>
      _$DemoWorkspaceStatusDtoCWProxyImpl(this);
}

// **************************************************************************
// JsonSerializableGenerator
// **************************************************************************

DemoWorkspaceStatusDto _$DemoWorkspaceStatusDtoFromJson(
  Map<String, dynamic> json,
) => $checkedCreate('DemoWorkspaceStatusDto', json, ($checkedConvert) {
  $checkKeys(json, requiredKeys: const ['workspace', 'counts']);
  final val = DemoWorkspaceStatusDto(
    workspace: $checkedConvert(
      'workspace',
      (v) => $enumDecode(
        _$DemoWorkspaceStatusDtoWorkspaceEnumEnumMap,
        v,
        unknownValue: DemoWorkspaceStatusDtoWorkspaceEnum.unknownDefaultOpenApi,
      ),
    ),
    counts: $checkedConvert(
      'counts',
      (v) => DemoWorkspaceCountsDto.fromJson(v as Map<String, dynamic>),
    ),
  );
  return val;
});

Map<String, dynamic> _$DemoWorkspaceStatusDtoToJson(
  DemoWorkspaceStatusDto instance,
) => <String, dynamic>{
  'workspace':
      _$DemoWorkspaceStatusDtoWorkspaceEnumEnumMap[instance.workspace]!,
  'counts': instance.counts.toJson(),
};

const _$DemoWorkspaceStatusDtoWorkspaceEnumEnumMap = {
  DemoWorkspaceStatusDtoWorkspaceEnum.demo: 'demo',
  DemoWorkspaceStatusDtoWorkspaceEnum.unknownDefaultOpenApi:
      'unknown_default_open_api',
};

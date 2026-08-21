// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'switch_workspace_dto.dart';

// **************************************************************************
// CopyWithGenerator
// **************************************************************************

abstract class _$SwitchWorkspaceDtoCWProxy {
  SwitchWorkspaceDto workspace(SwitchWorkspaceDtoWorkspaceEnum workspace);

  /// This function **does support** nullification of nullable fields. All `null` values passed to `non-nullable` fields will be ignored. You can also use `SwitchWorkspaceDto(...).copyWith.fieldName(...)` to override fields one at a time with nullification support.
  ///
  /// Usage
  /// ```dart
  /// SwitchWorkspaceDto(...).copyWith(id: 12, name: "My name")
  /// ````
  SwitchWorkspaceDto call({SwitchWorkspaceDtoWorkspaceEnum workspace});
}

/// Proxy class for `copyWith` functionality. This is a callable class and can be used as follows: `instanceOfSwitchWorkspaceDto.copyWith(...)`. Additionally contains functions for specific fields e.g. `instanceOfSwitchWorkspaceDto.copyWith.fieldName(...)`
class _$SwitchWorkspaceDtoCWProxyImpl implements _$SwitchWorkspaceDtoCWProxy {
  const _$SwitchWorkspaceDtoCWProxyImpl(this._value);

  final SwitchWorkspaceDto _value;

  @override
  SwitchWorkspaceDto workspace(SwitchWorkspaceDtoWorkspaceEnum workspace) =>
      this(workspace: workspace);

  @override
  /// This function **does support** nullification of nullable fields. All `null` values passed to `non-nullable` fields will be ignored. You can also use `SwitchWorkspaceDto(...).copyWith.fieldName(...)` to override fields one at a time with nullification support.
  ///
  /// Usage
  /// ```dart
  /// SwitchWorkspaceDto(...).copyWith(id: 12, name: "My name")
  /// ````
  SwitchWorkspaceDto call({Object? workspace = const $CopyWithPlaceholder()}) {
    return SwitchWorkspaceDto(
      workspace: workspace == const $CopyWithPlaceholder()
          ? _value.workspace
          // ignore: cast_nullable_to_non_nullable
          : workspace as SwitchWorkspaceDtoWorkspaceEnum,
    );
  }
}

extension $SwitchWorkspaceDtoCopyWith on SwitchWorkspaceDto {
  /// Returns a callable class that can be used as follows: `instanceOfSwitchWorkspaceDto.copyWith(...)` or like so:`instanceOfSwitchWorkspaceDto.copyWith.fieldName(...)`.
  // ignore: library_private_types_in_public_api
  _$SwitchWorkspaceDtoCWProxy get copyWith =>
      _$SwitchWorkspaceDtoCWProxyImpl(this);
}

// **************************************************************************
// JsonSerializableGenerator
// **************************************************************************

SwitchWorkspaceDto _$SwitchWorkspaceDtoFromJson(Map<String, dynamic> json) =>
    $checkedCreate('SwitchWorkspaceDto', json, ($checkedConvert) {
      $checkKeys(json, requiredKeys: const ['workspace']);
      final val = SwitchWorkspaceDto(
        workspace: $checkedConvert(
          'workspace',
          (v) => $enumDecode(
            _$SwitchWorkspaceDtoWorkspaceEnumEnumMap,
            v,
            unknownValue: SwitchWorkspaceDtoWorkspaceEnum.unknownDefaultOpenApi,
          ),
        ),
      );
      return val;
    });

Map<String, dynamic> _$SwitchWorkspaceDtoToJson(
  SwitchWorkspaceDto instance,
) => <String, dynamic>{
  'workspace': _$SwitchWorkspaceDtoWorkspaceEnumEnumMap[instance.workspace]!,
};

const _$SwitchWorkspaceDtoWorkspaceEnumEnumMap = {
  SwitchWorkspaceDtoWorkspaceEnum.public: 'public',
  SwitchWorkspaceDtoWorkspaceEnum.demo: 'demo',
  SwitchWorkspaceDtoWorkspaceEnum.unknownDefaultOpenApi:
      'unknown_default_open_api',
};

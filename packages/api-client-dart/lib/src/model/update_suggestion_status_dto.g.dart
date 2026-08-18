// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'update_suggestion_status_dto.dart';

// **************************************************************************
// CopyWithGenerator
// **************************************************************************

abstract class _$UpdateSuggestionStatusDtoCWProxy {
  UpdateSuggestionStatusDto status(SuggestionStatus status);

  /// This function **does support** nullification of nullable fields. All `null` values passed to `non-nullable` fields will be ignored. You can also use `UpdateSuggestionStatusDto(...).copyWith.fieldName(...)` to override fields one at a time with nullification support.
  ///
  /// Usage
  /// ```dart
  /// UpdateSuggestionStatusDto(...).copyWith(id: 12, name: "My name")
  /// ````
  UpdateSuggestionStatusDto call({SuggestionStatus status});
}

/// Proxy class for `copyWith` functionality. This is a callable class and can be used as follows: `instanceOfUpdateSuggestionStatusDto.copyWith(...)`. Additionally contains functions for specific fields e.g. `instanceOfUpdateSuggestionStatusDto.copyWith.fieldName(...)`
class _$UpdateSuggestionStatusDtoCWProxyImpl
    implements _$UpdateSuggestionStatusDtoCWProxy {
  const _$UpdateSuggestionStatusDtoCWProxyImpl(this._value);

  final UpdateSuggestionStatusDto _value;

  @override
  UpdateSuggestionStatusDto status(SuggestionStatus status) =>
      this(status: status);

  @override
  /// This function **does support** nullification of nullable fields. All `null` values passed to `non-nullable` fields will be ignored. You can also use `UpdateSuggestionStatusDto(...).copyWith.fieldName(...)` to override fields one at a time with nullification support.
  ///
  /// Usage
  /// ```dart
  /// UpdateSuggestionStatusDto(...).copyWith(id: 12, name: "My name")
  /// ````
  UpdateSuggestionStatusDto call({
    Object? status = const $CopyWithPlaceholder(),
  }) {
    return UpdateSuggestionStatusDto(
      status: status == const $CopyWithPlaceholder()
          ? _value.status
          // ignore: cast_nullable_to_non_nullable
          : status as SuggestionStatus,
    );
  }
}

extension $UpdateSuggestionStatusDtoCopyWith on UpdateSuggestionStatusDto {
  /// Returns a callable class that can be used as follows: `instanceOfUpdateSuggestionStatusDto.copyWith(...)` or like so:`instanceOfUpdateSuggestionStatusDto.copyWith.fieldName(...)`.
  // ignore: library_private_types_in_public_api
  _$UpdateSuggestionStatusDtoCWProxy get copyWith =>
      _$UpdateSuggestionStatusDtoCWProxyImpl(this);
}

// **************************************************************************
// JsonSerializableGenerator
// **************************************************************************

UpdateSuggestionStatusDto _$UpdateSuggestionStatusDtoFromJson(
  Map<String, dynamic> json,
) => $checkedCreate('UpdateSuggestionStatusDto', json, ($checkedConvert) {
  $checkKeys(json, requiredKeys: const ['status']);
  final val = UpdateSuggestionStatusDto(
    status: $checkedConvert(
      'status',
      (v) => $enumDecode(
        _$SuggestionStatusEnumMap,
        v,
        unknownValue: SuggestionStatus.unknownDefaultOpenApi,
      ),
    ),
  );
  return val;
});

Map<String, dynamic> _$UpdateSuggestionStatusDtoToJson(
  UpdateSuggestionStatusDto instance,
) => <String, dynamic>{'status': _$SuggestionStatusEnumMap[instance.status]!};

const _$SuggestionStatusEnumMap = {
  SuggestionStatus.A_APPELER: 'A_APPELER',
  SuggestionStatus.APPELE: 'APPELE',
  SuggestionStatus.ABANDONNE: 'ABANDONNE',
  SuggestionStatus.unknownDefaultOpenApi: 'unknown_default_open_api',
};

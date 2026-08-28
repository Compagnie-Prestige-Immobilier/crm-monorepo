// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'approve_client_request_dto.dart';

// **************************************************************************
// CopyWithGenerator
// **************************************************************************

abstract class _$ApproveClientRequestDtoCWProxy {
  ApproveClientRequestDto representantId(String representantId);

  ApproveClientRequestDto syndicatId(String syndicatId);

  ApproveClientRequestDto banqueId(String? banqueId);

  ApproveClientRequestDto clientCreatedAt(DateTime? clientCreatedAt);

  /// This function **does support** nullification of nullable fields. All `null` values passed to `non-nullable` fields will be ignored. You can also use `ApproveClientRequestDto(...).copyWith.fieldName(...)` to override fields one at a time with nullification support.
  ///
  /// Usage
  /// ```dart
  /// ApproveClientRequestDto(...).copyWith(id: 12, name: "My name")
  /// ````
  ApproveClientRequestDto call({
    String representantId,
    String syndicatId,
    String? banqueId,
    DateTime? clientCreatedAt,
  });
}

/// Proxy class for `copyWith` functionality. This is a callable class and can be used as follows: `instanceOfApproveClientRequestDto.copyWith(...)`. Additionally contains functions for specific fields e.g. `instanceOfApproveClientRequestDto.copyWith.fieldName(...)`
class _$ApproveClientRequestDtoCWProxyImpl
    implements _$ApproveClientRequestDtoCWProxy {
  const _$ApproveClientRequestDtoCWProxyImpl(this._value);

  final ApproveClientRequestDto _value;

  @override
  ApproveClientRequestDto representantId(String representantId) =>
      this(representantId: representantId);

  @override
  ApproveClientRequestDto syndicatId(String syndicatId) =>
      this(syndicatId: syndicatId);

  @override
  ApproveClientRequestDto banqueId(String? banqueId) =>
      this(banqueId: banqueId);

  @override
  ApproveClientRequestDto clientCreatedAt(DateTime? clientCreatedAt) =>
      this(clientCreatedAt: clientCreatedAt);

  @override
  /// This function **does support** nullification of nullable fields. All `null` values passed to `non-nullable` fields will be ignored. You can also use `ApproveClientRequestDto(...).copyWith.fieldName(...)` to override fields one at a time with nullification support.
  ///
  /// Usage
  /// ```dart
  /// ApproveClientRequestDto(...).copyWith(id: 12, name: "My name")
  /// ````
  ApproveClientRequestDto call({
    Object? representantId = const $CopyWithPlaceholder(),
    Object? syndicatId = const $CopyWithPlaceholder(),
    Object? banqueId = const $CopyWithPlaceholder(),
    Object? clientCreatedAt = const $CopyWithPlaceholder(),
  }) {
    return ApproveClientRequestDto(
      representantId: representantId == const $CopyWithPlaceholder()
          ? _value.representantId
          // ignore: cast_nullable_to_non_nullable
          : representantId as String,
      syndicatId: syndicatId == const $CopyWithPlaceholder()
          ? _value.syndicatId
          // ignore: cast_nullable_to_non_nullable
          : syndicatId as String,
      banqueId: banqueId == const $CopyWithPlaceholder()
          ? _value.banqueId
          // ignore: cast_nullable_to_non_nullable
          : banqueId as String?,
      clientCreatedAt: clientCreatedAt == const $CopyWithPlaceholder()
          ? _value.clientCreatedAt
          // ignore: cast_nullable_to_non_nullable
          : clientCreatedAt as DateTime?,
    );
  }
}

extension $ApproveClientRequestDtoCopyWith on ApproveClientRequestDto {
  /// Returns a callable class that can be used as follows: `instanceOfApproveClientRequestDto.copyWith(...)` or like so:`instanceOfApproveClientRequestDto.copyWith.fieldName(...)`.
  // ignore: library_private_types_in_public_api
  _$ApproveClientRequestDtoCWProxy get copyWith =>
      _$ApproveClientRequestDtoCWProxyImpl(this);
}

// **************************************************************************
// JsonSerializableGenerator
// **************************************************************************

ApproveClientRequestDto _$ApproveClientRequestDtoFromJson(
  Map<String, dynamic> json,
) => $checkedCreate('ApproveClientRequestDto', json, ($checkedConvert) {
  $checkKeys(json, requiredKeys: const ['representantId', 'syndicatId']);
  final val = ApproveClientRequestDto(
    representantId: $checkedConvert('representantId', (v) => v as String),
    syndicatId: $checkedConvert('syndicatId', (v) => v as String),
    banqueId: $checkedConvert('banqueId', (v) => v as String?),
    clientCreatedAt: $checkedConvert(
      'clientCreatedAt',
      (v) => v == null ? null : DateTime.parse(v as String),
    ),
  );
  return val;
});

Map<String, dynamic> _$ApproveClientRequestDtoToJson(
  ApproveClientRequestDto instance,
) => <String, dynamic>{
  'representantId': instance.representantId,
  'syndicatId': instance.syndicatId,
  if (instance.banqueId case final value?) 'banqueId': value,
  if (instance.clientCreatedAt?.toIso8601String() case final value?)
    'clientCreatedAt': value,
};

// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'create_representant_comment_dto.dart';

// **************************************************************************
// CopyWithGenerator
// **************************************************************************

abstract class _$CreateRepresentantCommentDtoCWProxy {
  CreateRepresentantCommentDto id(String id);

  CreateRepresentantCommentDto body(String body);

  CreateRepresentantCommentDto clientCreatedAt(DateTime? clientCreatedAt);

  /// This function **does support** nullification of nullable fields. All `null` values passed to `non-nullable` fields will be ignored. You can also use `CreateRepresentantCommentDto(...).copyWith.fieldName(...)` to override fields one at a time with nullification support.
  ///
  /// Usage
  /// ```dart
  /// CreateRepresentantCommentDto(...).copyWith(id: 12, name: "My name")
  /// ````
  CreateRepresentantCommentDto call({
    String id,
    String body,
    DateTime? clientCreatedAt,
  });
}

/// Proxy class for `copyWith` functionality. This is a callable class and can be used as follows: `instanceOfCreateRepresentantCommentDto.copyWith(...)`. Additionally contains functions for specific fields e.g. `instanceOfCreateRepresentantCommentDto.copyWith.fieldName(...)`
class _$CreateRepresentantCommentDtoCWProxyImpl
    implements _$CreateRepresentantCommentDtoCWProxy {
  const _$CreateRepresentantCommentDtoCWProxyImpl(this._value);

  final CreateRepresentantCommentDto _value;

  @override
  CreateRepresentantCommentDto id(String id) => this(id: id);

  @override
  CreateRepresentantCommentDto body(String body) => this(body: body);

  @override
  CreateRepresentantCommentDto clientCreatedAt(DateTime? clientCreatedAt) =>
      this(clientCreatedAt: clientCreatedAt);

  @override
  /// This function **does support** nullification of nullable fields. All `null` values passed to `non-nullable` fields will be ignored. You can also use `CreateRepresentantCommentDto(...).copyWith.fieldName(...)` to override fields one at a time with nullification support.
  ///
  /// Usage
  /// ```dart
  /// CreateRepresentantCommentDto(...).copyWith(id: 12, name: "My name")
  /// ````
  CreateRepresentantCommentDto call({
    Object? id = const $CopyWithPlaceholder(),
    Object? body = const $CopyWithPlaceholder(),
    Object? clientCreatedAt = const $CopyWithPlaceholder(),
  }) {
    return CreateRepresentantCommentDto(
      id: id == const $CopyWithPlaceholder()
          ? _value.id
          // ignore: cast_nullable_to_non_nullable
          : id as String,
      body: body == const $CopyWithPlaceholder()
          ? _value.body
          // ignore: cast_nullable_to_non_nullable
          : body as String,
      clientCreatedAt: clientCreatedAt == const $CopyWithPlaceholder()
          ? _value.clientCreatedAt
          // ignore: cast_nullable_to_non_nullable
          : clientCreatedAt as DateTime?,
    );
  }
}

extension $CreateRepresentantCommentDtoCopyWith
    on CreateRepresentantCommentDto {
  /// Returns a callable class that can be used as follows: `instanceOfCreateRepresentantCommentDto.copyWith(...)` or like so:`instanceOfCreateRepresentantCommentDto.copyWith.fieldName(...)`.
  // ignore: library_private_types_in_public_api
  _$CreateRepresentantCommentDtoCWProxy get copyWith =>
      _$CreateRepresentantCommentDtoCWProxyImpl(this);
}

// **************************************************************************
// JsonSerializableGenerator
// **************************************************************************

CreateRepresentantCommentDto _$CreateRepresentantCommentDtoFromJson(
  Map<String, dynamic> json,
) => $checkedCreate('CreateRepresentantCommentDto', json, ($checkedConvert) {
  $checkKeys(json, requiredKeys: const ['id', 'body']);
  final val = CreateRepresentantCommentDto(
    id: $checkedConvert('id', (v) => v as String),
    body: $checkedConvert('body', (v) => v as String),
    clientCreatedAt: $checkedConvert(
      'clientCreatedAt',
      (v) => v == null ? null : DateTime.parse(v as String),
    ),
  );
  return val;
});

Map<String, dynamic> _$CreateRepresentantCommentDtoToJson(
  CreateRepresentantCommentDto instance,
) => <String, dynamic>{
  'id': instance.id,
  'body': instance.body,
  if (instance.clientCreatedAt?.toIso8601String() case final value?)
    'clientCreatedAt': value,
};
